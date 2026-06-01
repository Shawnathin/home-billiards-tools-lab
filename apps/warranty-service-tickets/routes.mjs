import express from 'express';
import {
  ContactCaptureValidationError,
  resolveIntakeCustomerContact
} from '../../src/customer-contact-capture.mjs';
import { pool } from '../../src/db.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TEXT_LENGTH = 2000;
const MAX_SHORT_TEXT_LENGTH = 260;

const STATUS_OPTIONS = [
  ['open', 'Open'],
  ['in_progress', 'In progress'],
  ['needs_attention', 'Needs attention'],
  ['waiting_on_customer', 'Waiting on customer'],
  ['resolved', 'Resolved'],
  ['cancelled', 'Cancelled']
];

const PRIORITY_OPTIONS = [
  ['low', 'Low'],
  ['normal', 'Normal'],
  ['high', 'High'],
  ['urgent', 'Urgent']
];

const STATUSES = new Set(STATUS_OPTIONS.map(([value]) => value));
const PRIORITIES = new Set(PRIORITY_OPTIONS.map(([value]) => value));
const OPEN_STATUSES = new Set(['open', 'in_progress', 'needs_attention', 'waiting_on_customer']);
const CLOSED_STATUSES = new Set(['resolved', 'cancelled']);

const ticketSelectSql = `
  select
    t.id,
    t.ticket_number as "ticketNumber",
    t.customer_name as "customerName",
    t.customer_phone as "customerPhone",
    t.customer_email as "customerEmail",
    t.customer_contact_id as "customerContactId",
    cc.contact_number as "customerContactNumber",
    cc.display_name as "customerContactName",
    cc.company_name as "customerContactCompanyName",
    t.issue_type_id as "issueTypeId",
    i.name as "issueTypeName",
    i.slug as "issueTypeSlug",
    t.issue_type_other as "issueTypeOther",
    t.product_involved as "productInvolved",
    t.order_or_job_reference as "orderOrJobReference",
    t.is_warranty as "isWarranty",
    t.issue_description as "issueDescription",
    t.internal_notes as "internalNotes",
    t.resolution_notes as "resolutionNotes",
    t.priority,
    t.status,
    t.follow_up_at as "followUpAt",
    t.resolved_at as "resolvedAt",
    t.cancelled_at as "cancelledAt",
    t.created_at as "createdAt",
    t.updated_at as "updatedAt"
  from warranty_service_tickets t
  left join warranty_ticket_issue_types i on i.id = t.issue_type_id
  left join customer_contacts cc on cc.id = t.customer_contact_id
`;

export const warrantyServiceTicketsApiRouter = express.Router();

warrantyServiceTicketsApiRouter.get('/bootstrap', async (req, res, next) => {
  try {
    const issueTypes = await getIssueTypes();

    res.json({
      issueTypes,
      statuses: toOptionObjects(STATUS_OPTIONS),
      priorities: toOptionObjects(PRIORITY_OPTIONS)
    });
  } catch (error) {
    next(error);
  }
});

warrantyServiceTicketsApiRouter.get('/tickets', async (req, res, next) => {
  try {
    const { whereSql, values } = buildTicketFilters(req.query || {});
    const result = await pool.query(
      `
        ${ticketSelectSql}
        ${whereSql}
        order by
          case when t.status = 'needs_attention' then 0 else 1 end,
          case when t.follow_up_at is not null and t.follow_up_at <= now() and t.status in ('open', 'in_progress', 'needs_attention', 'waiting_on_customer') then 0 else 1 end,
          case t.priority
            when 'urgent' then 0
            when 'high' then 1
            when 'normal' then 2
            when 'low' then 3
            else 4
          end,
          t.updated_at desc,
          t.created_at desc
        limit 150
      `,
      values
    );

    res.json({ tickets: result.rows.map(formatTicket) });
  } catch (error) {
    next(error);
  }
});

warrantyServiceTicketsApiRouter.get('/tickets/:id', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid ticket id is required.' });
    }

    const ticket = await getTicketById(id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    return res.json({ ticket: formatTicket(ticket) });
  } catch (error) {
    return next(error);
  }
});

warrantyServiceTicketsApiRouter.post('/tickets', async (req, res, next) => {
  try {
    const normalized = await normalizeTicketInput(req.body || {}, null);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const ticket = await insertTicket(normalized.data);
    return res.status(201).json({ ticket: formatTicket(ticket) });
  } catch (error) {
    if (error instanceof ContactCaptureValidationError) {
      return res.status(400).json({ error: error.message });
    }

    if (isValidationConstraintError(error) || error.code === '23505') {
      return res.status(400).json({ error: 'Ticket could not be saved. Check required fields and ticket number uniqueness.' });
    }

    return next(error);
  }
});

warrantyServiceTicketsApiRouter.patch('/tickets/:id', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid ticket id is required.' });
    }

    const existing = await getTicketById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const normalized = await normalizeTicketInput(req.body || {}, existing);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const ticket = await updateTicket(id, existing, normalized.data);
    return res.json({ ticket: formatTicket(ticket) });
  } catch (error) {
    if (isValidationConstraintError(error) || error.code === '23505') {
      return res.status(400).json({ error: 'Ticket update is missing required information.' });
    }

    return next(error);
  }
});

warrantyServiceTicketsApiRouter.get('/summary', async (req, res, next) => {
  try {
    const result = await pool.query(`
      select
        count(*) filter (
          where status in ('open', 'in_progress', 'needs_attention', 'waiting_on_customer')
        )::integer as "openCount",
        count(*) filter (
          where status = 'needs_attention'
        )::integer as "needsAttentionCount",
        count(*) filter (
          where status = 'waiting_on_customer'
        )::integer as "waitingOnCustomerCount",
        count(*) filter (
          where status in ('open', 'in_progress', 'needs_attention', 'waiting_on_customer')
            and follow_up_at is not null
            and follow_up_at <= now()
        )::integer as "followUpDueCount",
        count(*) filter (
          where status = 'resolved'
        )::integer as "resolvedCount",
        count(*) filter (
          where status = 'cancelled'
        )::integer as "cancelledCount"
      from warranty_service_tickets
    `);

    res.json({ summary: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

function buildTicketFilters(query) {
  const conditions = [];
  const values = [];

  const status = cleanText(query.status, { maxLength: 80 });

  if (status && status !== 'all') {
    if (status === 'open') {
      conditions.push("t.status in ('open', 'in_progress', 'needs_attention', 'waiting_on_customer')");
    } else if (STATUSES.has(status)) {
      values.push(status);
      conditions.push(`t.status = $${values.length}`);
    }
  } else if (status !== 'all' && readBoolean(query.includeClosed) !== true) {
    conditions.push("t.status in ('open', 'in_progress', 'needs_attention', 'waiting_on_customer')");
  }

  const priority = cleanText(query.priority, { maxLength: 80 });

  if (priority && PRIORITIES.has(priority)) {
    values.push(priority);
    conditions.push(`t.priority = $${values.length}`);
  }

  const issueTypeId = cleanText(query.issueTypeId, { maxLength: 80 });

  if (issueTypeId) {
    if (UUID_PATTERN.test(issueTypeId)) {
      values.push(issueTypeId);
      conditions.push(`t.issue_type_id = $${values.length}`);
    } else if (issueTypeId === 'custom') {
      conditions.push('t.issue_type_id is null');
    }
  }

  if (query.isWarranty !== undefined && query.isWarranty !== '') {
    values.push(readBoolean(query.isWarranty));
    conditions.push(`t.is_warranty = $${values.length}`);
  }

  if (readBoolean(query.followUpDue) === true) {
    conditions.push('t.follow_up_at is not null');
    conditions.push('t.follow_up_at <= now()');
    conditions.push("t.status in ('open', 'in_progress', 'needs_attention', 'waiting_on_customer')");
  }

  const search = cleanText(query.search, { maxLength: 160 });

  if (search) {
    values.push(`%${search}%`);
    const index = values.length;
    conditions.push(`(
      t.ticket_number ilike $${index}
      or t.customer_name ilike $${index}
      or coalesce(t.customer_phone, '') ilike $${index}
      or coalesce(t.customer_email, '') ilike $${index}
      or coalesce(cc.contact_number, '') ilike $${index}
      or coalesce(cc.display_name, '') ilike $${index}
      or coalesce(t.product_involved, '') ilike $${index}
      or coalesce(t.order_or_job_reference, '') ilike $${index}
      or coalesce(t.issue_description, '') ilike $${index}
      or coalesce(t.internal_notes, '') ilike $${index}
      or coalesce(t.resolution_notes, '') ilike $${index}
      or coalesce(i.name, '') ilike $${index}
      or coalesce(t.issue_type_other, '') ilike $${index}
    )`);
  }

  return {
    whereSql: conditions.length > 0 ? `where ${conditions.join(' and ')}` : '',
    values
  };
}

async function insertTicket(data) {
  let lastError = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const client = await pool.connect();
    let ticketId = null;

    try {
      await client.query('begin');

      const customerContactId = await resolveIntakeCustomerContact(client, data, {
        saveCustomerContact: data.saveCustomerContact,
        sourceNote: 'Created from Warranty / Service Tickets intake.'
      });
      ticketId = await insertTicketRow(client, { ...data, customerContactId });

      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch((rollbackError) => {
        console.warn('Warranty / Service Tickets transaction rollback failed:', rollbackError.message);
      });

      if (error instanceof ContactCaptureValidationError) {
        throw error;
      }

      lastError = error;

      if (error.code !== '23505') {
        throw error;
      }

      continue;
    } finally {
      client.release();
    }

    return getTicketById(ticketId);
  }

  throw lastError;
}

async function insertTicketRow(client, data) {
  const timestampFields = getTimestampUpdates({}, data.status);
  const result = await client.query(
    `
      insert into warranty_service_tickets (
        customer_name,
        customer_phone,
        customer_email,
        customer_contact_id,
        issue_type_id,
        issue_type_other,
        product_involved,
        order_or_job_reference,
        is_warranty,
        issue_description,
        internal_notes,
        resolution_notes,
        priority,
        status,
        follow_up_at,
        resolved_at,
        cancelled_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16, $17
      )
      returning id
    `,
    [
      data.customerName,
      data.customerPhone,
      data.customerEmail,
      data.customerContactId,
      data.issueTypeId,
      data.issueTypeOther,
      data.productInvolved,
      data.orderOrJobReference,
      data.isWarranty,
      data.issueDescription,
      data.internalNotes,
      data.resolutionNotes,
      data.priority,
      data.status,
      data.followUpAt,
      timestampFields.resolved_at || null,
      timestampFields.cancelled_at || null
    ]
  );

  return result.rows[0].id;
}

async function updateTicket(id, existing, data) {
  const timestampFields = getTimestampUpdates(existing, data.status);
  const fields = {
    customer_name: data.customerName,
    customer_phone: data.customerPhone,
    customer_email: data.customerEmail,
    customer_contact_id: data.customerContactId,
    issue_type_id: data.issueTypeId,
    issue_type_other: data.issueTypeOther,
    product_involved: data.productInvolved,
    order_or_job_reference: data.orderOrJobReference,
    is_warranty: data.isWarranty,
    issue_description: data.issueDescription,
    internal_notes: data.internalNotes,
    resolution_notes: data.resolutionNotes,
    priority: data.priority,
    status: data.status,
    follow_up_at: data.followUpAt,
    ...timestampFields
  };

  const assignments = [];
  const values = [];

  for (const [column, value] of Object.entries(fields)) {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  }

  values.push(id);

  await pool.query(
    `
      update warranty_service_tickets
      set ${assignments.join(', ')}
      where id = $${values.length}
    `,
    values
  );

  return getTicketById(id);
}

function getTimestampUpdates(existing, status) {
  const updates = {};

  if (status === 'resolved' && !existing.resolvedAt) {
    updates.resolved_at = new Date();
  }

  if (status === 'cancelled' && !existing.cancelledAt) {
    updates.cancelled_at = new Date();
  }

  return updates;
}

async function getTicketById(id) {
  const result = await pool.query(
    `
      ${ticketSelectSql}
      where t.id = $1
      limit 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getIssueTypes() {
  const result = await pool.query(`
    select
      id,
      name,
      slug,
      description,
      sort_order as "sortOrder",
      is_active as "isActive",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from warranty_ticket_issue_types
    where is_active = true
    order by sort_order asc, lower(name) asc
  `);

  return result.rows;
}

async function normalizeTicketInput(rawInput, existing) {
  const input = rawInput || {};
  const followUpAt = readDateTime(input, existing, 'followUpAt');

  if (followUpAt.error) {
    return { error: followUpAt.error };
  }

  const data = {
    customerName: readClean(input, existing, 'customerName', { maxLength: 180 }),
    customerPhone: readClean(input, existing, 'customerPhone', { maxLength: 80 }),
    customerEmail: readClean(input, existing, 'customerEmail', { maxLength: 240, lowercase: true }),
    customerContactId: readClean(input, existing, 'customerContactId', { maxLength: 80 }),
    saveCustomerContact: readBoolean(hasInput(input, 'saveCustomerContact') ? getInput(input, 'saveCustomerContact') : false),
    issueTypeId: readClean(input, existing, 'issueTypeId', { maxLength: 80 }),
    issueTypeOther: readClean(input, existing, 'issueTypeOther', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    productInvolved: readClean(input, existing, 'productInvolved', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    orderOrJobReference: readClean(input, existing, 'orderOrJobReference', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    isWarranty: readExistingBoolean(input, existing, 'isWarranty', false),
    issueDescription: readClean(input, existing, 'issueDescription', { maxLength: MAX_TEXT_LENGTH }),
    internalNotes: readClean(input, existing, 'internalNotes', { maxLength: MAX_TEXT_LENGTH }),
    resolutionNotes: readClean(input, existing, 'resolutionNotes', { maxLength: MAX_TEXT_LENGTH }),
    priority: readClean(input, existing, 'priority', { maxLength: 80 }) || 'normal',
    status: readClean(input, existing, 'status', { maxLength: 80 }) || 'open',
    followUpAt: followUpAt.value
  };

  if (data.issueTypeId === 'custom' || data.issueTypeId === 'other') {
    data.issueTypeId = null;
  }

  if (data.customerContactId && !UUID_PATTERN.test(data.customerContactId)) {
    return { error: 'Choose a valid customer/contact link.' };
  }

  const validationError = validateTicketData(data);

  if (validationError) {
    return { error: validationError };
  }

  const issueTypeError = await validateIssueType(data, input, existing);

  if (issueTypeError) {
    return { error: issueTypeError };
  }

  const contactError = await validateCustomerContact(data.customerContactId);

  if (contactError) {
    return { error: contactError };
  }

  return { data };
}

function validateTicketData(data) {
  if (!data.customerName) {
    return 'Customer name is required.';
  }

  if (!data.customerPhone && !data.customerEmail) {
    return 'Add at least one contact method: phone or email.';
  }

  if (data.issueTypeId && !UUID_PATTERN.test(data.issueTypeId)) {
    return 'Choose a valid issue type.';
  }

  if (!data.issueTypeId && !data.issueTypeOther) {
    return 'Choose an issue type or enter a custom issue type.';
  }

  if (!data.issueDescription) {
    return 'Issue description is required.';
  }

  if (!PRIORITIES.has(data.priority)) {
    return 'Choose a valid priority.';
  }

  if (!STATUSES.has(data.status)) {
    return 'Choose a valid status.';
  }

  return '';
}

async function validateIssueType(data, input, existing) {
  if (!data.issueTypeId) {
    return '';
  }

  const result = await pool.query(
    `
      select id, is_active as "isActive"
      from warranty_ticket_issue_types
      where id = $1
      limit 1
    `,
    [data.issueTypeId]
  );
  const issueType = result.rows[0];

  if (!issueType) {
    return 'Selected issue type is unavailable.';
  }

  const issueTypeChanged = !existing || hasInput(input, 'issueTypeId');

  if (issueTypeChanged && !issueType.isActive) {
    return 'Selected issue type is unavailable.';
  }

  return '';
}

async function validateCustomerContact(customerContactId) {
  if (!customerContactId) {
    return '';
  }

  const result = await pool.query(
    `
      select id
      from customer_contacts
      where id = $1
      limit 1
    `,
    [customerContactId]
  );

  return result.rows[0] ? '' : 'Selected customer/contact is unavailable.';
}

function readUuid(value) {
  const id = String(value || '').trim();
  return UUID_PATTERN.test(id) ? id : null;
}

function readClean(input, existing, fieldName, options = {}) {
  if (hasInput(input, fieldName)) {
    return cleanText(getInput(input, fieldName), options);
  }

  if (existing) {
    return existing[fieldName] ?? null;
  }

  return null;
}

function readDateTime(input, existing, fieldName) {
  if (hasInput(input, fieldName)) {
    const value = cleanText(getInput(input, fieldName), { maxLength: 80 });

    if (!value) {
      return { value: null };
    }

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return { error: 'Follow-up date must be a valid date and time.' };
    }

    return { value: date };
  }

  if (existing) {
    return { value: existing[fieldName] ?? null };
  }

  return { value: null };
}

function cleanText(value, options = {}) {
  if (value === undefined || value === null) {
    return null;
  }

  let normalized = String(value).trim();

  if (!normalized) {
    return null;
  }

  if (options.lowercase) {
    normalized = normalized.toLowerCase();
  }

  return normalized.slice(0, options.maxLength || MAX_TEXT_LENGTH);
}

function readExistingBoolean(input, existing, fieldName, fallback) {
  if (hasInput(input, fieldName)) {
    return readBoolean(getInput(input, fieldName));
  }

  if (existing) {
    return Boolean(existing[fieldName]);
  }

  return fallback;
}

function readBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  const normalized = String(value || '').trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off', ''].includes(normalized)) {
    return false;
  }

  return false;
}

function hasInput(input, fieldName) {
  return Object.prototype.hasOwnProperty.call(input, fieldName) ||
    Object.prototype.hasOwnProperty.call(input, toSnakeCase(fieldName));
}

function getInput(input, fieldName) {
  if (Object.prototype.hasOwnProperty.call(input, fieldName)) {
    return input[fieldName];
  }

  return input[toSnakeCase(fieldName)];
}

function toSnakeCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toOptionObjects(options) {
  return options.map(([value, label]) => ({ value, label }));
}

function formatTicket(ticket) {
  if (!ticket) {
    return null;
  }

  return {
    ...ticket,
    isWarranty: Boolean(ticket.isWarranty),
    isOpen: OPEN_STATUSES.has(ticket.status),
    isClosed: CLOSED_STATUSES.has(ticket.status)
  };
}

function isValidationConstraintError(error) {
  return error.code === '23514' || error.code === '23503';
}
