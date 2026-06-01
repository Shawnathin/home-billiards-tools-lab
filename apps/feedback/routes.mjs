import express from 'express';
import { pool } from '../../src/db.mjs';
import { canReviewFeedback } from '../../src/utils/feedback-access.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TEXT_LENGTH = 2000;
const MAX_SHORT_TEXT_LENGTH = 260;

const CATEGORY_OPTIONS = [
  ['bug', 'Bug'],
  ['confusing', 'Confusing'],
  ['missing_field', 'Missing field'],
  ['workflow_issue', 'Workflow issue'],
  ['feature_idea', 'Feature idea'],
  ['data_issue', 'Data issue'],
  ['other', 'Other']
];

const SEVERITY_OPTIONS = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
  ['blocking', 'Blocking']
];

const STATUS_OPTIONS = [
  ['new', 'New'],
  ['reviewing', 'Reviewing'],
  ['accepted', 'Accepted'],
  ['deferred', 'Deferred'],
  ['resolved', 'Resolved'],
  ['dismissed', 'Dismissed']
];

const CATEGORIES = new Set(CATEGORY_OPTIONS.map(([value]) => value));
const SEVERITIES = new Set(SEVERITY_OPTIONS.map(([value]) => value));
const STATUSES = new Set(STATUS_OPTIONS.map(([value]) => value));
const ACTIVE_STATUSES = ['new', 'reviewing', 'accepted', 'deferred'];

const feedbackSelectSql = `
  select
    id,
    message,
    category,
    severity,
    status,
    source_app_slug as "sourceAppSlug",
    source_app_label as "sourceAppLabel",
    source_path as "sourcePath",
    source_url as "sourceUrl",
    source_page_title as "sourcePageTitle",
    related_record_type as "relatedRecordType",
    related_record_id as "relatedRecordId",
    related_record_label as "relatedRecordLabel",
    submitted_by_user_id as "submittedByUserId",
    submitted_by_display_name as "submittedByDisplayName",
    submitted_by_username as "submittedByUsername",
    user_agent as "userAgent",
    admin_note as "adminNote",
    reviewed_by_user_id as "reviewedByUserId",
    reviewed_at as "reviewedAt",
    created_at as "createdAt",
    updated_at as "updatedAt"
  from feedback_submissions
`;

export const feedbackApiRouter = express.Router();

feedbackApiRouter.post('/submissions', async (req, res, next) => {
  try {
    const normalized = normalizeSubmissionInput(req.body || {}, req.session.user, req.get('user-agent') || null);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const result = await pool.query(
      `
        insert into feedback_submissions (
          message,
          category,
          severity,
          source_app_slug,
          source_app_label,
          source_path,
          source_url,
          source_page_title,
          related_record_type,
          related_record_id,
          related_record_label,
          submitted_by_user_id,
          submitted_by_display_name,
          submitted_by_username,
          user_agent
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15
        )
        returning id, created_at as "createdAt"
      `,
      [
        normalized.data.message,
        normalized.data.category,
        normalized.data.severity,
        normalized.data.sourceAppSlug,
        normalized.data.sourceAppLabel,
        normalized.data.sourcePath,
        normalized.data.sourceUrl,
        normalized.data.sourcePageTitle,
        normalized.data.relatedRecordType,
        normalized.data.relatedRecordId,
        normalized.data.relatedRecordLabel,
        normalized.data.submittedByUserId,
        normalized.data.submittedByDisplayName,
        normalized.data.submittedByUsername,
        normalized.data.userAgent
      ]
    );

    return res.status(201).json({
      success: true,
      submission: result.rows[0]
    });
  } catch (error) {
    return next(error);
  }
});

feedbackApiRouter.get('/submissions', requireFeedbackReviewer, async (req, res, next) => {
  try {
    const { whereSql, values } = buildSubmissionFilters(req.query || {});
    const result = await pool.query(
      `
        ${feedbackSelectSql}
        ${whereSql}
        order by
          case when status in ('new', 'reviewing', 'accepted', 'deferred') then 0 else 1 end,
          case when severity = 'blocking' then 0 when severity = 'high' then 1 else 2 end,
          created_at desc
        limit 250
      `,
      values
    );

    const [summary, sourceApps] = await Promise.all([getSubmissionSummary(), getSourceApps()]);

    return res.json({
      submissions: result.rows.map(formatSubmission),
      summary,
      sourceApps,
      options: {
        categories: toOptionObjects(CATEGORY_OPTIONS),
        severities: toOptionObjects(SEVERITY_OPTIONS),
        statuses: toOptionObjects(STATUS_OPTIONS)
      }
    });
  } catch (error) {
    return next(error);
  }
});

feedbackApiRouter.get('/submissions/:id', requireFeedbackReviewer, async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid feedback id is required.' });
    }

    const submission = await getSubmissionById(id);

    if (!submission) {
      return res.status(404).json({ error: 'Feedback not found.' });
    }

    return res.json({ submission: formatSubmission(submission) });
  } catch (error) {
    return next(error);
  }
});

feedbackApiRouter.patch('/submissions/:id', requireFeedbackReviewer, async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid feedback id is required.' });
    }

    const normalized = normalizeReviewInput(req.body || {});

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    if (normalized.updates.length === 0) {
      return res.status(400).json({ error: 'Choose at least one feedback field to update.' });
    }

    const submission = await updateSubmission(id, normalized, req.session.user);

    if (!submission) {
      return res.status(404).json({ error: 'Feedback not found.' });
    }

    return res.json({ submission: formatSubmission(submission) });
  } catch (error) {
    return next(error);
  }
});

function requireFeedbackReviewer(req, res, next) {
  if (canReviewFeedback(req.session?.user)) {
    return next();
  }

  return res.status(403).json({ error: 'Feedback Inbox is only available to reviewers.' });
}

function normalizeSubmissionInput(input, user, userAgent) {
  const message = cleanText(input.message, { maxLength: MAX_MESSAGE_LENGTH });

  if (!message) {
    return { error: 'Tell us what happened before sending feedback.' };
  }

  const category = cleanText(input.category, { maxLength: MAX_SHORT_TEXT_LENGTH }) || 'other';
  const severity = cleanText(input.severity, { maxLength: MAX_SHORT_TEXT_LENGTH }) || 'medium';

  if (!CATEGORIES.has(category)) {
    return { error: 'Choose a valid feedback category.' };
  }

  if (!SEVERITIES.has(severity)) {
    return { error: 'Choose a valid feedback severity.' };
  }

  return {
    data: {
      message,
      category,
      severity,
      sourceAppSlug: cleanText(input.sourceAppSlug, { maxLength: MAX_SHORT_TEXT_LENGTH, lowercase: true }),
      sourceAppLabel: cleanText(input.sourceAppLabel, { maxLength: MAX_SHORT_TEXT_LENGTH }),
      sourcePath: cleanText(input.sourcePath, { maxLength: MAX_SHORT_TEXT_LENGTH }),
      sourceUrl: cleanText(input.sourceUrl, { maxLength: MAX_TEXT_LENGTH }),
      sourcePageTitle: cleanText(input.sourcePageTitle, { maxLength: MAX_SHORT_TEXT_LENGTH }),
      relatedRecordType: cleanText(input.relatedRecordType, { maxLength: MAX_SHORT_TEXT_LENGTH, lowercase: true }),
      relatedRecordId: cleanText(input.relatedRecordId, { maxLength: MAX_SHORT_TEXT_LENGTH }),
      relatedRecordLabel: cleanText(input.relatedRecordLabel, { maxLength: MAX_SHORT_TEXT_LENGTH }),
      submittedByUserId: readUuid(user?.id),
      submittedByDisplayName: cleanText(user?.displayName, { maxLength: MAX_SHORT_TEXT_LENGTH }),
      submittedByUsername: cleanText(user?.username, { maxLength: MAX_SHORT_TEXT_LENGTH, lowercase: true }),
      userAgent: cleanText(userAgent, { maxLength: MAX_TEXT_LENGTH })
    }
  };
}

function normalizeReviewInput(input) {
  const updates = [];
  const values = [];
  let reviewTouched = false;

  if (Object.hasOwn(input, 'status')) {
    const status = cleanText(input.status, { maxLength: MAX_SHORT_TEXT_LENGTH });

    if (!STATUSES.has(status)) {
      return { error: 'Choose a valid feedback status.' };
    }

    values.push(status);
    updates.push(`status = $${values.length}`);
    reviewTouched = true;
  }

  if (Object.hasOwn(input, 'adminNote')) {
    const adminNote = cleanText(input.adminNote, { maxLength: MAX_TEXT_LENGTH }) || null;
    values.push(adminNote);
    updates.push(`admin_note = $${values.length}`);
    reviewTouched = true;
  }

  if (Object.hasOwn(input, 'category')) {
    const category = cleanText(input.category, { maxLength: MAX_SHORT_TEXT_LENGTH });

    if (!CATEGORIES.has(category)) {
      return { error: 'Choose a valid feedback category.' };
    }

    values.push(category);
    updates.push(`category = $${values.length}`);
  }

  if (Object.hasOwn(input, 'severity')) {
    const severity = cleanText(input.severity, { maxLength: MAX_SHORT_TEXT_LENGTH });

    if (!SEVERITIES.has(severity)) {
      return { error: 'Choose a valid feedback severity.' };
    }

    values.push(severity);
    updates.push(`severity = $${values.length}`);
  }

  return {
    updates,
    values,
    reviewTouched
  };
}

function buildSubmissionFilters(query) {
  const where = [];
  const values = [];
  const status = cleanText(query.status, { maxLength: MAX_SHORT_TEXT_LENGTH });
  const category = cleanText(query.category, { maxLength: MAX_SHORT_TEXT_LENGTH });
  const severity = cleanText(query.severity, { maxLength: MAX_SHORT_TEXT_LENGTH });
  const sourceAppSlug = cleanText(query.sourceAppSlug, { maxLength: MAX_SHORT_TEXT_LENGTH, lowercase: true });
  const search = cleanText(query.search, { maxLength: MAX_SHORT_TEXT_LENGTH });

  if (status === 'active') {
    values.push(ACTIVE_STATUSES);
    where.push(`status = any($${values.length})`);
  } else if (status) {
    if (!STATUSES.has(status)) {
      return { whereSql: 'where false', values: [] };
    }

    values.push(status);
    where.push(`status = $${values.length}`);
  }

  if (category) {
    if (!CATEGORIES.has(category)) {
      return { whereSql: 'where false', values: [] };
    }

    values.push(category);
    where.push(`category = $${values.length}`);
  }

  if (severity) {
    if (!SEVERITIES.has(severity)) {
      return { whereSql: 'where false', values: [] };
    }

    values.push(severity);
    where.push(`severity = $${values.length}`);
  }

  if (sourceAppSlug) {
    values.push(sourceAppSlug);
    where.push(`source_app_slug = $${values.length}`);
  }

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    where.push(`(
      lower(message) like $${values.length}
      or lower(coalesce(admin_note, '')) like $${values.length}
      or lower(coalesce(source_app_label, '')) like $${values.length}
      or lower(coalesce(source_path, '')) like $${values.length}
      or lower(coalesce(related_record_label, '')) like $${values.length}
      or lower(coalesce(submitted_by_display_name, '')) like $${values.length}
      or lower(coalesce(submitted_by_username, '')) like $${values.length}
    )`);
  }

  return {
    whereSql: where.length > 0 ? `where ${where.join(' and ')}` : '',
    values
  };
}

async function updateSubmission(id, normalized, user) {
  const values = [...normalized.values];
  const updates = [...normalized.updates];

  if (normalized.reviewTouched) {
    values.push(readUuid(user?.id));
    updates.push(`reviewed_by_user_id = $${values.length}`);
    updates.push('reviewed_at = now()');
  }

  values.push(id);

  const result = await pool.query(
    `
      update feedback_submissions
      set ${updates.join(', ')}
      where id = $${values.length}
      returning id
    `,
    values
  );

  return result.rows[0] ? getSubmissionById(result.rows[0].id) : null;
}

async function getSubmissionById(id) {
  const result = await pool.query(
    `
      ${feedbackSelectSql}
      where id = $1
      limit 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getSubmissionSummary() {
  const result = await pool.query(
    `
      select
        count(*) filter (where status = 'new')::int as "newCount",
        count(*) filter (where status = 'reviewing')::int as "reviewingCount",
        count(*) filter (where status = 'accepted')::int as "acceptedCount",
        count(*) filter (
          where severity in ('high', 'blocking')
            and status <> 'dismissed'
        )::int as "highBlockingCount",
        count(*) filter (where status = 'resolved')::int as "resolvedCount"
      from feedback_submissions
    `
  );

  return result.rows[0] || {
    newCount: 0,
    reviewingCount: 0,
    acceptedCount: 0,
    highBlockingCount: 0,
    resolvedCount: 0
  };
}

async function getSourceApps() {
  const result = await pool.query(
    `
      select
        source_app_slug as "value",
        coalesce(max(source_app_label), source_app_slug) as "label"
      from feedback_submissions
      where source_app_slug is not null
        and btrim(source_app_slug) <> ''
      group by source_app_slug
      order by lower(coalesce(max(source_app_label), source_app_slug)) asc
    `
  );

  return result.rows;
}

function formatSubmission(submission) {
  return {
    ...submission,
    categoryLabel: labelFor(CATEGORY_OPTIONS, submission.category),
    severityLabel: labelFor(SEVERITY_OPTIONS, submission.severity),
    statusLabel: labelFor(STATUS_OPTIONS, submission.status)
  };
}

function cleanText(value, { maxLength = MAX_TEXT_LENGTH, lowercase = false } = {}) {
  const text = String(value ?? '').trim();
  const normalized = lowercase ? text.toLowerCase() : text;

  return normalized.slice(0, maxLength);
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
