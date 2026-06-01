import express from 'express';
import { pool } from '../../src/db.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT_LENGTH = 3000;
const MAX_SHORT_TEXT_LENGTH = 260;

const STATUS_OPTIONS = [
  ['open', 'Open'],
  ['scheduled', 'Scheduled'],
  ['in_progress', 'In progress'],
  ['waiting_on_customer', 'Waiting on customer'],
  ['waiting_on_parts', 'Waiting on parts'],
  ['completed', 'Completed'],
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
const ACTIVE_STATUSES = new Set(['open', 'scheduled', 'in_progress', 'waiting_on_customer', 'waiting_on_parts']);
const WAITING_STATUSES = new Set(['waiting_on_customer', 'waiting_on_parts']);

const workOrderSelectSql = `
  select
    w.id,
    w.work_order_number as "workOrderNumber",
    w.customer_contact_id as "customerContactId",
    cc.contact_number as "customerContactNumber",
    cc.display_name as "customerContactName",
    cc.company_name as "customerContactCompanyName",
    w.customer_name as "customerName",
    w.customer_company as "customerCompany",
    w.customer_phone as "customerPhone",
    w.customer_email as "customerEmail",
    w.job_type_id as "jobTypeId",
    jt.name as "jobTypeName",
    jt.slug as "jobTypeSlug",
    w.job_type_other as "jobTypeOther",
    w.title,
    w.source_reference as "sourceReference",
    w.product_or_table_involved as "productOrTableInvolved",
    w.service_address_line_1 as "serviceAddressLine1",
    w.service_address_line_2 as "serviceAddressLine2",
    w.service_city as "serviceCity",
    w.service_province as "serviceProvince",
    w.service_postal_code as "servicePostalCode",
    w.service_location_name as "serviceLocationName",
    w.access_notes as "accessNotes",
    w.service_details as "serviceDetails",
    w.scheduled_date as "scheduledDate",
    w.assigned_to_text as "assignedToText",
    w.job_notes as "jobNotes",
    w.internal_notes as "internalNotes",
    w.completion_notes as "completionNotes",
    w.cancellation_reason as "cancellationReason",
    w.priority,
    w.status,
    w.completed_at as "completedAt",
    w.cancelled_at as "cancelledAt",
    w.archived_at as "archivedAt",
    w.created_at as "createdAt",
    w.updated_at as "updatedAt"
  from job_work_orders w
  left join job_work_order_types jt on jt.id = w.job_type_id
  left join customer_contacts cc on cc.id = w.customer_contact_id
`;

export const jobsWorkOrdersApiRouter = express.Router();

jobsWorkOrdersApiRouter.get('/bootstrap', async (req, res, next) => {
  try {
    res.json({
      jobTypes: await getJobTypes(),
      statuses: toOptionObjects(STATUS_OPTIONS),
      priorities: toOptionObjects(PRIORITY_OPTIONS)
    });
  } catch (error) {
    next(error);
  }
});

jobsWorkOrdersApiRouter.get('/work-orders', async (req, res, next) => {
  try {
    const { whereSql, values } = buildWorkOrderFilters(req.query || {});
    const result = await pool.query(
      `
        ${workOrderSelectSql}
        ${whereSql}
        order by
          case
            when w.archived_at is null and w.status in ('open', 'scheduled', 'in_progress', 'waiting_on_customer', 'waiting_on_parts') and w.priority = 'urgent' then 0
            when w.archived_at is null and w.status in ('open', 'scheduled', 'in_progress', 'waiting_on_customer', 'waiting_on_parts') and w.priority = 'high' then 1
            when w.archived_at is null and w.status in ('open', 'scheduled', 'in_progress', 'waiting_on_customer', 'waiting_on_parts') then 2
            else 3
          end,
          case when w.scheduled_date is null then 1 else 0 end,
          w.scheduled_date asc,
          w.updated_at desc,
          w.created_at desc
        limit 150
      `,
      values
    );

    res.json({ workOrders: result.rows.map(formatWorkOrder) });
  } catch (error) {
    next(error);
  }
});

jobsWorkOrdersApiRouter.get('/work-orders/:id', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid work order id is required.' });
    }

    const workOrder = await getWorkOrderById(id);

    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found.' });
    }

    return res.json({ workOrder: formatWorkOrder(workOrder) });
  } catch (error) {
    return next(error);
  }
});

jobsWorkOrdersApiRouter.post('/work-orders', async (req, res, next) => {
  try {
    const normalized = await normalizeWorkOrderInput(req.body || {}, null);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const workOrder = await insertWorkOrder(normalized.data);
    return res.status(201).json({ workOrder: formatWorkOrder(workOrder) });
  } catch (error) {
    if (isValidationConstraintError(error) || error.code === '23505') {
      return res.status(400).json({ error: 'Work order could not be saved. Check required fields and work order number uniqueness.' });
    }

    return next(error);
  }
});

jobsWorkOrdersApiRouter.patch('/work-orders/:id', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid work order id is required.' });
    }

    const existing = await getWorkOrderById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Work order not found.' });
    }

    const normalized = await normalizeWorkOrderInput(req.body || {}, existing);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const workOrder = await updateWorkOrder(id, existing, normalized.data);
    return res.json({ workOrder: formatWorkOrder(workOrder) });
  } catch (error) {
    if (isValidationConstraintError(error) || error.code === '23505') {
      return res.status(400).json({ error: 'Work order update is missing required information.' });
    }

    return next(error);
  }
});

jobsWorkOrdersApiRouter.post('/work-orders/:id/complete', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid work order id is required.' });
    }

    const existing = await getWorkOrderById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Work order not found.' });
    }

    const completionNotes = hasInput(req.body || {}, 'completionNotes')
      ? cleanText(getInput(req.body || {}, 'completionNotes'), { maxLength: MAX_TEXT_LENGTH })
      : existing.completionNotes;

    if (!completionNotes) {
      return res.status(400).json({ error: 'Completion notes are required before completing a work order.' });
    }

    const workOrder = await completeWorkOrder(id, completionNotes);
    return res.json({ workOrder: formatWorkOrder(workOrder) });
  } catch (error) {
    return next(error);
  }
});

jobsWorkOrdersApiRouter.post('/work-orders/:id/cancel', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid work order id is required.' });
    }

    const existing = await getWorkOrderById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Work order not found.' });
    }

    const cancellationReason = hasInput(req.body || {}, 'cancellationReason')
      ? cleanText(getInput(req.body || {}, 'cancellationReason'), { maxLength: MAX_TEXT_LENGTH })
      : existing.cancellationReason;

    const workOrder = await cancelWorkOrder(id, cancellationReason);
    return res.json({ workOrder: formatWorkOrder(workOrder) });
  } catch (error) {
    return next(error);
  }
});

jobsWorkOrdersApiRouter.post('/work-orders/:id/archive', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid work order id is required.' });
    }

    const existing = await getWorkOrderById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Work order not found.' });
    }

    const workOrder = await archiveWorkOrder(id);
    return res.json({ workOrder: formatWorkOrder(workOrder) });
  } catch (error) {
    return next(error);
  }
});

jobsWorkOrdersApiRouter.post('/work-orders/:id/reactivate', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid work order id is required.' });
    }

    const existing = await getWorkOrderById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Work order not found.' });
    }

    const workOrder = await reactivateWorkOrder(id);
    return res.json({ workOrder: formatWorkOrder(workOrder) });
  } catch (error) {
    return next(error);
  }
});

jobsWorkOrdersApiRouter.get('/summary', async (req, res, next) => {
  try {
    const result = await pool.query(`
      select
        count(*) filter (
          where archived_at is null and status = 'open'
        )::integer as "openCount",
        count(*) filter (
          where archived_at is null and status = 'scheduled'
        )::integer as "scheduledCount",
        count(*) filter (
          where archived_at is null and status = 'in_progress'
        )::integer as "inProgressCount",
        count(*) filter (
          where archived_at is null and status in ('waiting_on_customer', 'waiting_on_parts')
        )::integer as "waitingCount",
        count(*) filter (
          where archived_at is null and status = 'completed'
        )::integer as "completedCount",
        count(*) filter (
          where archived_at is null and status = 'cancelled'
        )::integer as "cancelledCount",
        count(*) filter (
          where archived_at is null
            and status in ('open', 'scheduled', 'in_progress', 'waiting_on_customer', 'waiting_on_parts')
            and priority = 'urgent'
        )::integer as "urgentActiveCount",
        count(*) filter (
          where archived_at is not null
        )::integer as "archivedCount"
      from job_work_orders
    `);

    res.json({ summary: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

function buildWorkOrderFilters(query) {
  const conditions = [];
  const values = [];

  if (readBoolean(query.includeArchived) !== true) {
    conditions.push('w.archived_at is null');
  }

  const status = cleanText(query.status, { maxLength: 80 });

  if (status && status !== 'all' && STATUSES.has(status)) {
    values.push(status);
    conditions.push(`w.status = $${values.length}`);
  }

  const priority = cleanText(query.priority, { maxLength: 80 });

  if (priority && PRIORITIES.has(priority)) {
    values.push(priority);
    conditions.push(`w.priority = $${values.length}`);
  }

  const jobTypeId = cleanText(query.jobTypeId, { maxLength: 80 });

  if (jobTypeId) {
    if (UUID_PATTERN.test(jobTypeId)) {
      values.push(jobTypeId);
      conditions.push(`w.job_type_id = $${values.length}`);
    } else if (jobTypeId === 'custom') {
      conditions.push('w.job_type_id is null');
    }
  }

  const customerContactId = cleanText(query.customerContactId, { maxLength: 80 });

  if (customerContactId && UUID_PATTERN.test(customerContactId)) {
    values.push(customerContactId);
    conditions.push(`w.customer_contact_id = $${values.length}`);
  }

  const scheduledDate = cleanText(query.scheduledDate, { maxLength: 20 });

  if (scheduledDate && isValidDateOnly(scheduledDate)) {
    values.push(scheduledDate);
    conditions.push(`w.scheduled_date = $${values.length}`);
  }

  const search = cleanText(query.search, { maxLength: 160 });

  if (search) {
    values.push(`%${search}%`);
    const index = values.length;
    conditions.push(`(
      w.work_order_number ilike $${index}
      or w.customer_name ilike $${index}
      or coalesce(w.customer_company, '') ilike $${index}
      or coalesce(w.customer_phone, '') ilike $${index}
      or coalesce(w.customer_email, '') ilike $${index}
      or coalesce(cc.contact_number, '') ilike $${index}
      or coalesce(cc.display_name, '') ilike $${index}
      or coalesce(cc.company_name, '') ilike $${index}
      or coalesce(jt.name, '') ilike $${index}
      or coalesce(w.job_type_other, '') ilike $${index}
      or w.title ilike $${index}
      or coalesce(w.source_reference, '') ilike $${index}
      or coalesce(w.product_or_table_involved, '') ilike $${index}
      or coalesce(w.service_address_line_1, '') ilike $${index}
      or coalesce(w.service_address_line_2, '') ilike $${index}
      or coalesce(w.service_city, '') ilike $${index}
      or coalesce(w.service_province, '') ilike $${index}
      or coalesce(w.service_postal_code, '') ilike $${index}
      or coalesce(w.service_location_name, '') ilike $${index}
      or coalesce(w.access_notes, '') ilike $${index}
      or w.service_details ilike $${index}
      or coalesce(w.assigned_to_text, '') ilike $${index}
      or coalesce(w.job_notes, '') ilike $${index}
      or coalesce(w.internal_notes, '') ilike $${index}
      or coalesce(w.completion_notes, '') ilike $${index}
      or coalesce(w.cancellation_reason, '') ilike $${index}
    )`);
  }

  return {
    whereSql: conditions.length > 0 ? `where ${conditions.join(' and ')}` : '',
    values
  };
}

async function insertWorkOrder(data) {
  const timestampFields = getTimestampUpdates({}, data.status);
  const result = await pool.query(
    `
      insert into job_work_orders (
        customer_contact_id,
        customer_name,
        customer_company,
        customer_phone,
        customer_email,
        job_type_id,
        job_type_other,
        title,
        source_reference,
        product_or_table_involved,
        service_address_line_1,
        service_address_line_2,
        service_city,
        service_province,
        service_postal_code,
        service_location_name,
        access_notes,
        service_details,
        scheduled_date,
        assigned_to_text,
        job_notes,
        internal_notes,
        completion_notes,
        cancellation_reason,
        priority,
        status,
        completed_at,
        cancelled_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24,
        $25, $26, $27, $28
      )
      returning id
    `,
    [
      data.customerContactId,
      data.customerName,
      data.customerCompany,
      data.customerPhone,
      data.customerEmail,
      data.jobTypeId,
      data.jobTypeOther,
      data.title,
      data.sourceReference,
      data.productOrTableInvolved,
      data.serviceAddressLine1,
      data.serviceAddressLine2,
      data.serviceCity,
      data.serviceProvince,
      data.servicePostalCode,
      data.serviceLocationName,
      data.accessNotes,
      data.serviceDetails,
      data.scheduledDate,
      data.assignedToText,
      data.jobNotes,
      data.internalNotes,
      data.completionNotes,
      data.cancellationReason,
      data.priority,
      data.status,
      timestampFields.completed_at || null,
      timestampFields.cancelled_at || null
    ]
  );

  return getWorkOrderById(result.rows[0].id);
}

async function updateWorkOrder(id, existing, data) {
  const timestampFields = getTimestampUpdates(existing, data.status);
  const fields = {
    customer_contact_id: data.customerContactId,
    customer_name: data.customerName,
    customer_company: data.customerCompany,
    customer_phone: data.customerPhone,
    customer_email: data.customerEmail,
    job_type_id: data.jobTypeId,
    job_type_other: data.jobTypeOther,
    title: data.title,
    source_reference: data.sourceReference,
    product_or_table_involved: data.productOrTableInvolved,
    service_address_line_1: data.serviceAddressLine1,
    service_address_line_2: data.serviceAddressLine2,
    service_city: data.serviceCity,
    service_province: data.serviceProvince,
    service_postal_code: data.servicePostalCode,
    service_location_name: data.serviceLocationName,
    access_notes: data.accessNotes,
    service_details: data.serviceDetails,
    scheduled_date: data.scheduledDate,
    assigned_to_text: data.assignedToText,
    job_notes: data.jobNotes,
    internal_notes: data.internalNotes,
    completion_notes: data.completionNotes,
    cancellation_reason: data.cancellationReason,
    priority: data.priority,
    status: data.status,
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
      update job_work_orders
      set ${assignments.join(', ')}
      where id = $${values.length}
    `,
    values
  );

  return getWorkOrderById(id);
}

async function completeWorkOrder(id, completionNotes) {
  await pool.query(
    `
      update job_work_orders
      set
        status = 'completed',
        completion_notes = $1,
        completed_at = coalesce(completed_at, now())
      where id = $2
    `,
    [completionNotes, id]
  );

  return getWorkOrderById(id);
}

async function cancelWorkOrder(id, cancellationReason) {
  await pool.query(
    `
      update job_work_orders
      set
        status = 'cancelled',
        cancellation_reason = $1,
        cancelled_at = coalesce(cancelled_at, now())
      where id = $2
    `,
    [cancellationReason, id]
  );

  return getWorkOrderById(id);
}

async function archiveWorkOrder(id) {
  await pool.query(
    `
      update job_work_orders
      set archived_at = coalesce(archived_at, now())
      where id = $1
    `,
    [id]
  );

  return getWorkOrderById(id);
}

async function reactivateWorkOrder(id) {
  await pool.query(
    `
      update job_work_orders
      set archived_at = null
      where id = $1
    `,
    [id]
  );

  return getWorkOrderById(id);
}

function getTimestampUpdates(existing, status) {
  const updates = {};

  if (status === 'completed' && !existing.completedAt) {
    updates.completed_at = new Date();
  }

  if (status === 'cancelled' && !existing.cancelledAt) {
    updates.cancelled_at = new Date();
  }

  return updates;
}

async function getWorkOrderById(id) {
  const result = await pool.query(
    `
      ${workOrderSelectSql}
      where w.id = $1
      limit 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getJobTypes() {
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
    from job_work_order_types
    where is_active = true
    order by sort_order asc, lower(name) asc
  `);

  return result.rows;
}

async function normalizeWorkOrderInput(rawInput, existing) {
  const input = rawInput || {};
  const scheduledDate = readDateOnly(input, existing, 'scheduledDate');

  if (scheduledDate.error) {
    return { error: scheduledDate.error };
  }

  const data = {
    customerContactId: readClean(input, existing, 'customerContactId', { maxLength: 80 }),
    customerName: readClean(input, existing, 'customerName', { maxLength: 180 }),
    customerCompany: readClean(input, existing, 'customerCompany', { maxLength: 180 }),
    customerPhone: readClean(input, existing, 'customerPhone', { maxLength: 80 }),
    customerEmail: readClean(input, existing, 'customerEmail', { maxLength: 240, lowercase: true }),
    jobTypeId: readClean(input, existing, 'jobTypeId', { maxLength: 80 }),
    jobTypeOther: readClean(input, existing, 'jobTypeOther', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    title: readClean(input, existing, 'title', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    sourceReference: readClean(input, existing, 'sourceReference', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    productOrTableInvolved: readClean(input, existing, 'productOrTableInvolved', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    serviceAddressLine1: readClean(input, existing, 'serviceAddressLine1', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    serviceAddressLine2: readClean(input, existing, 'serviceAddressLine2', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    serviceCity: readClean(input, existing, 'serviceCity', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    serviceProvince: readClean(input, existing, 'serviceProvince', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    servicePostalCode: readClean(input, existing, 'servicePostalCode', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    serviceLocationName: readClean(input, existing, 'serviceLocationName', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    accessNotes: readClean(input, existing, 'accessNotes', { maxLength: MAX_TEXT_LENGTH }),
    serviceDetails: readClean(input, existing, 'serviceDetails', { maxLength: MAX_TEXT_LENGTH }),
    scheduledDate: scheduledDate.value,
    assignedToText: readClean(input, existing, 'assignedToText', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    jobNotes: readClean(input, existing, 'jobNotes', { maxLength: MAX_TEXT_LENGTH }),
    internalNotes: readClean(input, existing, 'internalNotes', { maxLength: MAX_TEXT_LENGTH }),
    completionNotes: readClean(input, existing, 'completionNotes', { maxLength: MAX_TEXT_LENGTH }),
    cancellationReason: readClean(input, existing, 'cancellationReason', { maxLength: MAX_TEXT_LENGTH }),
    priority: readClean(input, existing, 'priority', { maxLength: 80 }) || 'normal',
    status: readClean(input, existing, 'status', { maxLength: 80 }) || 'open'
  };

  if (data.jobTypeId === 'custom' || data.jobTypeId === 'other') {
    data.jobTypeId = null;
  }

  const validationError = validateWorkOrderData(data);

  if (validationError) {
    return { error: validationError };
  }

  const jobTypeError = await validateJobType(data, input, existing);

  if (jobTypeError) {
    return { error: jobTypeError };
  }

  const contactError = await validateCustomerContact(data.customerContactId);

  if (contactError) {
    return { error: contactError };
  }

  return { data };
}

function validateWorkOrderData(data) {
  if (!data.customerName) {
    return 'Customer name is required.';
  }

  if (!data.customerPhone && !data.customerEmail) {
    return 'Add at least one contact method: phone or email.';
  }

  if (data.customerContactId && !UUID_PATTERN.test(data.customerContactId)) {
    return 'Choose a valid customer/contact link.';
  }

  if (data.jobTypeId && !UUID_PATTERN.test(data.jobTypeId)) {
    return 'Choose a valid job type.';
  }

  if (!data.jobTypeId && !data.jobTypeOther) {
    return 'Choose a job type or enter a custom job type.';
  }

  if (!data.title) {
    return 'Job title is required.';
  }

  if (!data.serviceDetails) {
    return 'Service details are required.';
  }

  if (!PRIORITIES.has(data.priority)) {
    return 'Choose a valid priority.';
  }

  if (!STATUSES.has(data.status)) {
    return 'Choose a valid status.';
  }

  return '';
}

async function validateJobType(data, input, existing) {
  if (!data.jobTypeId) {
    return '';
  }

  const result = await pool.query(
    `
      select id, is_active as "isActive"
      from job_work_order_types
      where id = $1
      limit 1
    `,
    [data.jobTypeId]
  );
  const jobType = result.rows[0];

  if (!jobType) {
    return 'Selected job type is unavailable.';
  }

  const jobTypeChanged = !existing || hasInput(input, 'jobTypeId');

  if (jobTypeChanged && !jobType.isActive) {
    return 'Selected job type is unavailable.';
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

function readDateOnly(input, existing, fieldName) {
  if (hasInput(input, fieldName)) {
    const value = cleanText(getInput(input, fieldName), { maxLength: 20 });

    if (!value) {
      return { value: null };
    }

    if (!isValidDateOnly(value)) {
      return { error: 'Scheduled date must be a valid date.' };
    }

    return { value };
  }

  if (existing) {
    return { value: existing[fieldName] ?? null };
  }

  return { value: null };
}

function isValidDateOnly(value) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
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

function formatWorkOrder(workOrder) {
  if (!workOrder) {
    return null;
  }

  return {
    ...workOrder,
    isArchived: Boolean(workOrder.archivedAt),
    isActive: !workOrder.archivedAt && ACTIVE_STATUSES.has(workOrder.status),
    isWaiting: WAITING_STATUSES.has(workOrder.status),
    isCompleted: workOrder.status === 'completed',
    isCancelled: workOrder.status === 'cancelled'
  };
}

function isValidationConstraintError(error) {
  return error.code === '23514' || error.code === '23503';
}
