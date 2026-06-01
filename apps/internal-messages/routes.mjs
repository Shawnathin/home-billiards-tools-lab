import express from 'express';
import { pool } from '../../src/db.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_LENGTH = 4000;
const MAX_SHORT_TEXT_LENGTH = 260;
const MAX_SUBJECT_LENGTH = 180;

const STATUS_OPTIONS = [
  ['open', 'Open'],
  ['resolved', 'Resolved'],
  ['archived', 'Archived']
];

const PRIORITY_OPTIONS = [
  ['normal', 'Normal'],
  ['needs_attention', 'Needs attention'],
  ['urgent', 'Urgent']
];

const RELATED_RECORD_TYPE_OPTIONS = [
  ['general', 'General'],
  ['work_order', 'Work order'],
  ['customer_contact', 'Customer contact'],
  ['warranty_service_ticket', 'Warranty / service ticket'],
  ['cue_repair', 'Cue repair'],
  ['product_inventory', 'Product / inventory']
];

const STATUSES = new Set(STATUS_OPTIONS.map(([value]) => value));
const PRIORITIES = new Set(PRIORITY_OPTIONS.map(([value]) => value));
const RELATED_RECORD_TYPES = new Set(RELATED_RECORD_TYPE_OPTIONS.map(([value]) => value));

export const internalMessagesApiRouter = express.Router();

internalMessagesApiRouter.get('/bootstrap', async (req, res, next) => {
  try {
    return res.json({
      summary: await getThreadSummary(),
      options: getOptionPayload()
    });
  } catch (error) {
    return next(error);
  }
});

internalMessagesApiRouter.get('/threads', async (req, res, next) => {
  try {
    const userId = getCurrentUserId(req);

    if (!userId) {
      return res.status(400).json({ error: 'Current staff user could not be identified.' });
    }

    const { whereSql, values } = buildThreadFilters(req.query || {}, 2);
    const result = await pool.query(
      `
        ${threadSelectSql('$1')}
        ${whereSql}
        order by
          case when (rs.last_read_at is null or rs.last_read_at < t.last_message_at) then 0 else 1 end,
          case t.priority
            when 'urgent' then 0
            when 'needs_attention' then 1
            else 2
          end,
          t.last_message_at desc,
          t.created_at desc
        limit 250
      `,
      [userId, ...values]
    );

    return res.json({
      threads: result.rows.map(formatThread),
      summary: await getThreadSummary(),
      options: getOptionPayload()
    });
  } catch (error) {
    return next(error);
  }
});

internalMessagesApiRouter.post('/threads', async (req, res, next) => {
  const userId = getCurrentUserId(req);

  if (!userId) {
    return res.status(400).json({ error: 'Current staff user could not be identified.' });
  }

  const normalized = normalizeThreadInput(req.body || {}, req.session.user);

  if (normalized.error) {
    return res.status(400).json({ error: normalized.error });
  }

  const client = await pool.connect();

  try {
    await client.query('begin');

    const threadResult = await client.query(
      `
        insert into internal_message_threads (
          subject,
          status,
          priority,
          related_record_type,
          related_record_id,
          related_record_label,
          created_by_user_id,
          created_by_display_name,
          last_message_at
        )
        values ($1, 'open', $2, $3, $4, $5, $6, $7, now())
        returning id
      `,
      [
        normalized.data.subject,
        normalized.data.priority,
        normalized.data.relatedRecordType,
        normalized.data.relatedRecordId,
        normalized.data.relatedRecordLabel,
        userId,
        normalized.data.createdByDisplayName
      ]
    );

    const threadId = threadResult.rows[0].id;

    await client.query(
      `
        insert into internal_message_posts (
          thread_id,
          body,
          created_by_user_id,
          created_by_display_name
        )
        values ($1, $2, $3, $4)
      `,
      [
        threadId,
        normalized.data.body,
        userId,
        normalized.data.createdByDisplayName
      ]
    );

    await markThreadRead(client, threadId, userId);
    await client.query('commit');

    const thread = await getThreadById(threadId, userId);

    return res.status(201).json({ thread: formatThread(thread) });
  } catch (error) {
    await client.query('rollback').catch(() => {});

    if (isValidationConstraintError(error)) {
      return res.status(400).json({ error: 'Thread could not be saved. Check the required fields and try again.' });
    }

    return next(error);
  } finally {
    client.release();
  }
});

internalMessagesApiRouter.get('/threads/:id', async (req, res, next) => {
  try {
    const userId = getCurrentUserId(req);
    const id = readUuid(req.params.id);

    if (!userId) {
      return res.status(400).json({ error: 'Current staff user could not be identified.' });
    }

    if (!id) {
      return res.status(400).json({ error: 'A valid thread id is required.' });
    }

    const thread = await getThreadById(id, userId);

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found.' });
    }

    const posts = await getPostsForThread(id);

    return res.json({
      thread: formatThread(thread),
      posts: posts.map(formatPost),
      options: getOptionPayload()
    });
  } catch (error) {
    return next(error);
  }
});

internalMessagesApiRouter.post('/threads/:id/posts', async (req, res, next) => {
  const userId = getCurrentUserId(req);
  const id = readUuid(req.params.id);

  if (!userId) {
    return res.status(400).json({ error: 'Current staff user could not be identified.' });
  }

  if (!id) {
    return res.status(400).json({ error: 'A valid thread id is required.' });
  }

  const body = cleanText(req.body?.body, { maxLength: MAX_BODY_LENGTH });

  if (!body) {
    return res.status(400).json({ error: 'Write a reply before posting.' });
  }

  const displayName = getDisplayName(req.session.user);
  const client = await pool.connect();

  try {
    await client.query('begin');

    const existing = await client.query(
      `
        select id
        from internal_message_threads
        where id = $1
        limit 1
      `,
      [id]
    );

    if (!existing.rows[0]) {
      await client.query('rollback');
      return res.status(404).json({ error: 'Thread not found.' });
    }

    const postResult = await client.query(
      `
        insert into internal_message_posts (
          thread_id,
          body,
          created_by_user_id,
          created_by_display_name
        )
        values ($1, $2, $3, $4)
        returning
          id,
          thread_id as "threadId",
          body,
          created_by_user_id as "createdByUserId",
          created_by_display_name as "createdByDisplayName",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `,
      [id, body, userId, displayName]
    );

    await markThreadRead(client, id, userId);
    await client.query('commit');

    const thread = await getThreadById(id, userId);

    return res.status(201).json({
      post: formatPost(postResult.rows[0]),
      thread: formatThread(thread)
    });
  } catch (error) {
    await client.query('rollback').catch(() => {});

    if (isValidationConstraintError(error)) {
      return res.status(400).json({ error: 'Reply could not be saved. Check the message and try again.' });
    }

    return next(error);
  } finally {
    client.release();
  }
});

internalMessagesApiRouter.patch('/threads/:id', async (req, res, next) => {
  try {
    const userId = getCurrentUserId(req);
    const id = readUuid(req.params.id);

    if (!userId) {
      return res.status(400).json({ error: 'Current staff user could not be identified.' });
    }

    if (!id) {
      return res.status(400).json({ error: 'A valid thread id is required.' });
    }

    const normalized = normalizeThreadUpdateInput(req.body || {});

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    if (normalized.updates.length === 0) {
      return res.status(400).json({ error: 'Choose a status or priority to update.' });
    }

    normalized.values.push(id);

    const result = await pool.query(
      `
        update internal_message_threads
        set ${normalized.updates.join(', ')}
        where id = $${normalized.values.length}
        returning id
      `,
      normalized.values
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Thread not found.' });
    }

    const thread = await getThreadById(id, userId);

    return res.json({ thread: formatThread(thread) });
  } catch (error) {
    if (isValidationConstraintError(error)) {
      return res.status(400).json({ error: 'Thread update could not be saved.' });
    }

    return next(error);
  }
});

internalMessagesApiRouter.post('/threads/:id/read', async (req, res, next) => {
  const userId = getCurrentUserId(req);
  const id = readUuid(req.params.id);

  if (!userId) {
    return res.status(400).json({ error: 'Current staff user could not be identified.' });
  }

  if (!id) {
    return res.status(400).json({ error: 'A valid thread id is required.' });
  }

  const client = await pool.connect();

  try {
    await client.query('begin');

    const existing = await client.query(
      `
        select id
        from internal_message_threads
        where id = $1
        limit 1
      `,
      [id]
    );

    if (!existing.rows[0]) {
      await client.query('rollback');
      return res.status(404).json({ error: 'Thread not found.' });
    }

    await markThreadRead(client, id, userId);
    await client.query('commit');

    return res.json({ success: true });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    return next(error);
  } finally {
    client.release();
  }
});

function threadSelectSql(userIdParam) {
  return `
    select
      t.id,
      t.subject,
      t.status,
      t.priority,
      t.related_record_type as "relatedRecordType",
      t.related_record_id as "relatedRecordId",
      t.related_record_label as "relatedRecordLabel",
      t.created_by_user_id as "createdByUserId",
      t.created_by_display_name as "createdByDisplayName",
      t.created_at as "createdAt",
      t.updated_at as "updatedAt",
      t.last_message_at as "lastMessageAt",
      rs.last_read_at as "lastReadAt",
      coalesce(pc.post_count, 0)::int as "postCount",
      lp.body as "lastPostBody",
      lp.created_by_display_name as "lastPostByDisplayName",
      lp.created_at as "lastPostAt",
      (rs.last_read_at is null or rs.last_read_at < t.last_message_at) as unread
    from internal_message_threads t
    left join internal_message_read_states rs
      on rs.thread_id = t.id
      and rs.user_id = ${userIdParam}
    left join lateral (
      select count(*)::int as post_count
      from internal_message_posts p
      where p.thread_id = t.id
    ) pc on true
    left join lateral (
      select
        p.body,
        p.created_by_display_name,
        p.created_at
      from internal_message_posts p
      where p.thread_id = t.id
      order by p.created_at desc
      limit 1
    ) lp on true
  `;
}

function buildThreadFilters(query, startIndex) {
  const conditions = [];
  const values = [];
  const nextParam = (value) => {
    values.push(value);
    return `$${startIndex + values.length - 1}`;
  };

  const status = cleanText(query.status, { maxLength: 80, lowercase: true });

  if (status === 'active') {
    conditions.push("t.status = 'open'");
  } else if (status) {
    if (!STATUSES.has(status)) {
      return { whereSql: 'where false', values: [] };
    }

    conditions.push(`t.status = ${nextParam(status)}`);
  }

  const priority = cleanText(query.priority, { maxLength: 80, lowercase: true });

  if (priority) {
    if (!PRIORITIES.has(priority)) {
      return { whereSql: 'where false', values: [] };
    }

    conditions.push(`t.priority = ${nextParam(priority)}`);
  }

  const relatedRecordType = cleanText(query.relatedRecordType, { maxLength: 80, lowercase: true });

  if (relatedRecordType) {
    if (!RELATED_RECORD_TYPES.has(relatedRecordType)) {
      return { whereSql: 'where false', values: [] };
    }

    conditions.push(`t.related_record_type = ${nextParam(relatedRecordType)}`);
  }

  if (readBoolean(query.unread)) {
    conditions.push('(rs.last_read_at is null or rs.last_read_at < t.last_message_at)');
  }

  const search = cleanText(query.search, { maxLength: 160 });

  if (search) {
    const searchParam = nextParam(`%${search}%`);
    conditions.push(`(
      t.subject ilike ${searchParam}
      or coalesce(t.related_record_type, '') ilike ${searchParam}
      or coalesce(t.related_record_id, '') ilike ${searchParam}
      or coalesce(t.related_record_label, '') ilike ${searchParam}
      or coalesce(t.created_by_display_name, '') ilike ${searchParam}
      or exists (
        select 1
        from internal_message_posts p
        where p.thread_id = t.id
          and (
            p.body ilike ${searchParam}
            or coalesce(p.created_by_display_name, '') ilike ${searchParam}
          )
      )
    )`);
  }

  return {
    whereSql: conditions.length > 0 ? `where ${conditions.join(' and ')}` : '',
    values
  };
}

function normalizeThreadInput(input, user) {
  const subject = cleanText(input.subject || input.title, { maxLength: MAX_SUBJECT_LENGTH });
  const body = cleanText(input.body, { maxLength: MAX_BODY_LENGTH });
  const priority = cleanText(input.priority, { maxLength: 80, lowercase: true }) || 'normal';
  const related = normalizeRelatedRecord(input);

  if (!subject) {
    return { error: 'Add a subject before creating a thread.' };
  }

  if (!body) {
    return { error: 'Add the first message before creating a thread.' };
  }

  if (!PRIORITIES.has(priority)) {
    return { error: 'Choose a valid priority.' };
  }

  if (related.error) {
    return { error: related.error };
  }

  return {
    data: {
      subject,
      body,
      priority,
      relatedRecordType: related.data.relatedRecordType,
      relatedRecordId: related.data.relatedRecordId,
      relatedRecordLabel: related.data.relatedRecordLabel,
      createdByDisplayName: getDisplayName(user)
    }
  };
}

function normalizeThreadUpdateInput(input) {
  const updates = [];
  const values = [];

  if (Object.hasOwn(input, 'status')) {
    const status = cleanText(input.status, { maxLength: 80, lowercase: true });

    if (!STATUSES.has(status)) {
      return { error: 'Choose a valid status.' };
    }

    values.push(status);
    updates.push(`status = $${values.length}`);
  }

  if (Object.hasOwn(input, 'priority')) {
    const priority = cleanText(input.priority, { maxLength: 80, lowercase: true });

    if (!PRIORITIES.has(priority)) {
      return { error: 'Choose a valid priority.' };
    }

    values.push(priority);
    updates.push(`priority = $${values.length}`);
  }

  return { updates, values };
}

function normalizeRelatedRecord(input) {
  const relatedRecordId = cleanText(input.relatedRecordId, { maxLength: MAX_SHORT_TEXT_LENGTH }) || null;
  const relatedRecordLabel = cleanText(input.relatedRecordLabel, { maxLength: MAX_SHORT_TEXT_LENGTH }) || null;
  let relatedRecordType = cleanText(input.relatedRecordType, {
    maxLength: MAX_SHORT_TEXT_LENGTH,
    lowercase: true
  }) || null;

  if (!relatedRecordType && (relatedRecordId || relatedRecordLabel)) {
    relatedRecordType = 'general';
  }

  if (relatedRecordType && !RELATED_RECORD_TYPES.has(relatedRecordType)) {
    return { error: 'Choose a valid record type.' };
  }

  return {
    data: {
      relatedRecordType,
      relatedRecordId,
      relatedRecordLabel
    }
  };
}

async function getThreadById(id, userId) {
  const result = await pool.query(
    `
      ${threadSelectSql('$1')}
      where t.id = $2
      limit 1
    `,
    [userId, id]
  );

  return result.rows[0] || null;
}

async function getPostsForThread(threadId) {
  const result = await pool.query(
    `
      select
        id,
        thread_id as "threadId",
        body,
        created_by_user_id as "createdByUserId",
        created_by_display_name as "createdByDisplayName",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from internal_message_posts
      where thread_id = $1
      order by created_at asc, id asc
    `,
    [threadId]
  );

  return result.rows;
}

async function getThreadSummary() {
  const result = await pool.query(
    `
      select
        count(*) filter (where status = 'open')::int as "openCount",
        count(*) filter (where status = 'open' and priority = 'needs_attention')::int as "needsAttentionCount",
        count(*) filter (where status = 'open' and priority = 'urgent')::int as "urgentCount",
        count(*) filter (where status in ('resolved', 'archived'))::int as "closedCount"
      from internal_message_threads
    `
  );

  return result.rows[0] || {
    openCount: 0,
    needsAttentionCount: 0,
    urgentCount: 0,
    closedCount: 0
  };
}

async function markThreadRead(client, threadId, userId) {
  await client.query(
    `
      insert into internal_message_read_states (
        thread_id,
        user_id,
        last_read_at
      )
      values ($1, $2, now())
      on conflict (thread_id, user_id)
      do update set last_read_at = excluded.last_read_at
    `,
    [threadId, userId]
  );
}

function formatThread(thread) {
  return {
    ...thread,
    statusLabel: labelFor(STATUS_OPTIONS, thread.status),
    priorityLabel: labelFor(PRIORITY_OPTIONS, thread.priority),
    relatedRecordTypeLabel: labelFor(RELATED_RECORD_TYPE_OPTIONS, thread.relatedRecordType),
    lastPostSnippet: toSnippet(thread.lastPostBody),
    unread: Boolean(thread.unread)
  };
}

function formatPost(post) {
  return {
    ...post,
    createdByDisplayName: post.createdByDisplayName || 'Unknown staff'
  };
}

function getOptionPayload() {
  return {
    statuses: toOptionObjects(STATUS_OPTIONS),
    priorities: toOptionObjects(PRIORITY_OPTIONS),
    relatedRecordTypes: toOptionObjects(RELATED_RECORD_TYPE_OPTIONS)
  };
}

function getCurrentUserId(req) {
  return readUuid(req.session?.user?.id);
}

function getDisplayName(user) {
  return cleanText(user?.displayName || user?.username || 'Staff', {
    maxLength: MAX_SHORT_TEXT_LENGTH
  }) || 'Staff';
}

function cleanText(value, { maxLength = MAX_SHORT_TEXT_LENGTH, lowercase = false } = {}) {
  const text = String(value ?? '').trim();
  const normalized = lowercase ? text.toLowerCase() : text;

  return normalized.slice(0, maxLength);
}

function readBoolean(value) {
  return value === true || value === 'true' || value === '1' || value === 'yes';
}

function readUuid(value) {
  const text = String(value || '').trim();
  return UUID_PATTERN.test(text) ? text : null;
}

function labelFor(options, value) {
  return options.find(([optionValue]) => optionValue === value)?.[1] || value || '';
}

function toOptionObjects(options) {
  return options.map(([value, label]) => ({ value, label }));
}

function toSnippet(value) {
  const text = cleanText(value, { maxLength: 160 });
  return text.length > 157 ? `${text.slice(0, 157)}...` : text;
}

function isValidationConstraintError(error) {
  return ['23502', '23503', '23514'].includes(error?.code);
}
