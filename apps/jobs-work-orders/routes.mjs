import express from 'express';
import { pool } from '../../src/db.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;
const MAX_TEXT_LENGTH = 3000;
const MAX_SHORT_TEXT_LENGTH = 260;

const STATUS_OPTIONS = [
  ['quoted', 'Quoted'],
  ['to_be_scheduled', 'To be scheduled'],
  ['booked', 'Booked'],
  ['completed', 'Completed'],
  ['invoiced', 'Invoiced'],
  ['paid', 'Paid'],
  ['cancelled', 'Cancelled']
];

const LOCATION_MODE_OPTIONS = [
  ['service', 'Service address'],
  ['pickup_delivery', 'Pickup + delivery']
];

const SCHEDULE_STATE_OPTIONS = [
  ['unscheduled', 'Unscheduled'],
  ['booked', 'Booked']
];

const VISIT_TYPE_OPTIONS = [
  ['service', 'Service'],
  ['pickup', 'Pickup'],
  ['delivery', 'Delivery'],
  ['pickup_delivery', 'Pickup + delivery'],
  ['install', 'Install'],
  ['inspection', 'Inspection'],
  ['follow_up', 'Follow-up'],
  ['warranty_service', 'Warranty / Service'],
  ['other', 'Other']
];

const ARRIVAL_WINDOW_OPTIONS = [
  ['9am-11am', '9am-11am'],
  ['11am-1pm', '11am-1pm'],
  ['1pm-3pm', '1pm-3pm'],
  ['3pm-5pm', '3pm-5pm'],
  ['morning', 'Morning'],
  ['afternoon', 'Afternoon'],
  ['anytime', 'Anytime'],
  ['custom', 'Custom']
];

const ASSIGNED_TO_OPTIONS = [
  ['hbs_internal', 'HBS Internal'],
  ['hbs_external', 'HBS External']
];

const VISIT_STATUS_OPTIONS = [
  ['pending', 'Pending'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled']
];

const CANCELLATION_REASON_OPTIONS = [
  ['customer_cancelled', 'Customer cancelled'],
  ['found_better_price', 'Found better price'],
  ['schedule_conflict', 'Schedule conflict'],
  ['not_serviceable', 'Not serviceable'],
  ['duplicate', 'Duplicate'],
  ['no_longer_needed', 'No longer needed'],
  ['other', 'Other']
];

const STATUSES = new Set(STATUS_OPTIONS.map(([value]) => value));
const LOCATION_MODES = new Set(LOCATION_MODE_OPTIONS.map(([value]) => value));
const SCHEDULE_STATES = new Set(SCHEDULE_STATE_OPTIONS.map(([value]) => value));
const VISIT_TYPES = new Set(VISIT_TYPE_OPTIONS.map(([value]) => value));
const ARRIVAL_WINDOWS = new Set(ARRIVAL_WINDOW_OPTIONS.map(([value]) => value));
const ASSIGNMENTS = new Set(ASSIGNED_TO_OPTIONS.map(([value]) => value));
const VISIT_STATUSES = new Set(VISIT_STATUS_OPTIONS.map(([value]) => value));
const CANCELLATION_REASONS = new Set(CANCELLATION_REASON_OPTIONS.map(([value]) => value));
const LOCATION_ROLES = new Set(['service', 'pickup', 'delivery']);
const VISIT_LOCATION_ROLES = new Set(['service', 'pickup', 'delivery', 'pickup_delivery']);
const BOOKING_REQUIRED_STATUSES = new Set(['booked', 'completed', 'invoiced', 'paid']);
const ACTIVE_STATUSES = new Set(['quoted', 'to_be_scheduled', 'booked', 'completed', 'invoiced']);

const workOrderBaseSelectSql = `
  select
    w.id,
    w.work_order_number as "workOrderNumber",
    w.customer_contact_id as "customerContactId",
    cc.contact_number as "customerContactNumber",
    cc.display_name as "customerContactName",
    cc.company_name as "customerContactCompanyName",
    w.customer_display_snapshot as "customerDisplaySnapshot",
    w.contact_person_name as "contactPersonName",
    w.contact_person_phone as "contactPersonPhone",
    w.contact_person_email as "contactPersonEmail",
    w.customer_name as "customerName",
    w.customer_company as "customerCompany",
    w.customer_phone as "customerPhone",
    w.customer_email as "customerEmail",
    w.job_type_id as "jobTypeId",
    jt.name as "jobTypeName",
    jt.slug as "jobTypeSlug",
    jt.abbreviation as "jobTypeAbbreviation",
    jt.commonly_uses_pickup_delivery as "jobTypeUsesPickupDelivery",
    w.job_type_other as "jobTypeOther",
    w.work_type_abbreviation as "workTypeAbbreviation",
    w.location_mode as "locationMode",
    w.title,
    w.calendar_title as "calendarTitle",
    w.source_reference as "sourceReference",
    w.reference_number as "referenceNumber",
    w.old_system_reference as "oldSystemReference",
    w.customer_reference_number as "customerReferenceNumber",
    w.source_warranty_service_ticket_id as "sourceWarrantyServiceTicketId",
    st.ticket_number as "sourceWarrantyServiceTicketNumber",
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
    w.cancellation_reason_code as "cancellationReasonCode",
    w.priority,
    w.status,
    w.legacy_status as "legacyStatus",
    w.completed_at as "completedAt",
    w.cancelled_at as "cancelledAt",
    w.archived_at as "archivedAt",
    w.created_at as "createdAt",
    w.updated_at as "updatedAt"
  from job_work_orders w
  left join job_work_order_types jt on jt.id = w.job_type_id
  left join customer_contacts cc on cc.id = w.customer_contact_id
  left join warranty_service_tickets st on st.id = w.source_warranty_service_ticket_id
`;

export const jobsWorkOrdersApiRouter = express.Router();

jobsWorkOrdersApiRouter.get('/bootstrap', async (req, res, next) => {
  try {
    const workTypes = await getWorkTypes();

    res.json({
      workTypes,
      jobTypes: workTypes,
      statuses: toOptionObjects(STATUS_OPTIONS),
      locationModes: toOptionObjects(LOCATION_MODE_OPTIONS),
      scheduleStates: toOptionObjects(SCHEDULE_STATE_OPTIONS),
      visitTypes: toOptionObjects(VISIT_TYPE_OPTIONS),
      arrivalWindows: toOptionObjects(ARRIVAL_WINDOW_OPTIONS),
      assignments: toOptionObjects(ASSIGNED_TO_OPTIONS),
      visitStatuses: toOptionObjects(VISIT_STATUS_OPTIONS),
      cancellationReasons: toOptionObjects(CANCELLATION_REASON_OPTIONS)
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
        ${workOrderBaseSelectSql}
        ${whereSql}
        order by
          case
            when w.archived_at is not null then 8
            when w.status = 'quoted' then 0
            when w.status = 'to_be_scheduled' then 1
            when w.status = 'booked' then 2
            when w.status = 'completed' then 3
            when w.status = 'invoiced' then 4
            when w.status = 'paid' then 5
            when w.status = 'cancelled' then 7
            else 6
          end,
          coalesce((
            select min(v.scheduled_date)
            from job_work_order_visits v
            where v.work_order_id = w.id
              and v.visit_status <> 'cancelled'
          ), w.scheduled_date) asc nulls last,
          w.updated_at desc,
          w.created_at desc
        limit 150
      `,
      values
    );

    const workOrders = await attachWorkOrderChildren(result.rows);
    res.json({ workOrders: workOrders.map(formatWorkOrder) });
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
      return res.status(400).json({ error: 'Work order could not be saved. Check required fields and references.' });
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
      return res.status(400).json({ error: 'Work order update is missing required workflow information.' });
    }

    return next(error);
  }
});

jobsWorkOrdersApiRouter.get('/work-orders/:id/visits', async (req, res, next) => {
  try {
    const workOrderId = readUuid(req.params.id);

    if (!workOrderId) {
      return res.status(400).json({ error: 'A valid work order id is required.' });
    }

    const workOrder = await getWorkOrderById(workOrderId);

    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found.' });
    }

    return res.json({ visits: workOrder.visits || [] });
  } catch (error) {
    return next(error);
  }
});

jobsWorkOrdersApiRouter.post('/work-orders/:id/visits', async (req, res, next) => {
  try {
    const workOrderId = readUuid(req.params.id);

    if (!workOrderId) {
      return res.status(400).json({ error: 'A valid work order id is required.' });
    }

    const workOrder = await getWorkOrderById(workOrderId);

    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found.' });
    }

    const normalized = normalizeVisitInput(req.body || {}, null, (workOrder.visits || []).length + 1);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const client = await pool.connect();

    try {
      await client.query('begin');
      const visit = await insertWorkOrderVisit(client, workOrderId, normalized.data);
      await client.query('commit');
      const refreshed = await getWorkOrderById(workOrderId);
      return res.status(201).json({ visit, workOrder: formatWorkOrder(refreshed) });
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (isValidationConstraintError(error) || error.code === '23505') {
      return res.status(400).json({ error: 'Visit could not be saved. Check required schedule fields.' });
    }

    return next(error);
  }
});

jobsWorkOrdersApiRouter.patch('/work-orders/:id/visits/:visitId', async (req, res, next) => {
  try {
    const workOrderId = readUuid(req.params.id);
    const visitId = readUuid(req.params.visitId);

    if (!workOrderId || !visitId) {
      return res.status(400).json({ error: 'Valid work order and visit ids are required.' });
    }

    const existingVisit = await getVisitById(workOrderId, visitId);

    if (!existingVisit) {
      return res.status(404).json({ error: 'Visit not found.' });
    }

    const normalized = normalizeVisitInput(req.body || {}, existingVisit, existingVisit.visitNumber);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const client = await pool.connect();

    try {
      await client.query('begin');
      const visit = await updateWorkOrderVisit(client, workOrderId, normalized.data);
      await client.query('commit');
      const refreshed = await getWorkOrderById(workOrderId);
      return res.json({ visit, workOrder: formatWorkOrder(refreshed) });
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (isValidationConstraintError(error) || error.code === '23505') {
      return res.status(400).json({ error: 'Visit update is missing required schedule fields.' });
    }

    return next(error);
  }
});

jobsWorkOrdersApiRouter.post('/work-orders/:id/visits/:visitId/complete', async (req, res, next) => {
  try {
    const workOrderId = readUuid(req.params.id);
    const visitId = readUuid(req.params.visitId);

    if (!workOrderId || !visitId) {
      return res.status(400).json({ error: 'Valid work order and visit ids are required.' });
    }

    const completionNotes = cleanText(getInput(req.body || {}, 'completionNotes'), { maxLength: MAX_TEXT_LENGTH });
    const visit = await completeVisit(workOrderId, visitId, completionNotes);

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found.' });
    }

    const refreshed = await getWorkOrderById(workOrderId);
    return res.json({ visit, workOrder: formatWorkOrder(refreshed) });
  } catch (error) {
    return next(error);
  }
});

jobsWorkOrdersApiRouter.post('/work-orders/:id/visits/:visitId/cancel', async (req, res, next) => {
  try {
    const workOrderId = readUuid(req.params.id);
    const visitId = readUuid(req.params.visitId);

    if (!workOrderId || !visitId) {
      return res.status(400).json({ error: 'Valid work order and visit ids are required.' });
    }

    const cancellationReason = cleanText(getInput(req.body || {}, 'cancellationReason'), { maxLength: MAX_TEXT_LENGTH });
    const visit = await cancelVisit(workOrderId, visitId, cancellationReason);

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found.' });
    }

    const refreshed = await getWorkOrderById(workOrderId);
    return res.json({ visit, workOrder: formatWorkOrder(refreshed) });
  } catch (error) {
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
    const cancellationReasonCode = hasInput(req.body || {}, 'cancellationReasonCode')
      ? cleanText(getInput(req.body || {}, 'cancellationReasonCode'), { maxLength: 80 })
      : existing.cancellationReasonCode;

    if (cancellationReasonCode && !CANCELLATION_REASONS.has(cancellationReasonCode)) {
      return res.status(400).json({ error: 'Choose a valid cancellation reason.' });
    }

    const workOrder = await cancelWorkOrder(id, cancellationReason, cancellationReasonCode);
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
        count(*) filter (where w.archived_at is null and w.status = 'quoted')::integer as "quotedCount",
        count(*) filter (where w.archived_at is null and w.status = 'to_be_scheduled')::integer as "toBeScheduledCount",
        count(*) filter (where w.archived_at is null and w.status = 'booked')::integer as "bookedCount",
        count(*) filter (where w.archived_at is null and w.status = 'completed')::integer as "completedCount",
        count(*) filter (where w.archived_at is null and w.status = 'invoiced')::integer as "invoicedCount",
        count(*) filter (where w.archived_at is null and w.status = 'paid')::integer as "paidCount",
        count(*) filter (where w.archived_at is null and w.status = 'cancelled')::integer as "cancelledCount",
        (
          select count(*)::integer
          from job_work_order_visits v
          join job_work_orders vw on vw.id = v.work_order_id
          where vw.archived_at is null
            and v.schedule_state = 'booked'
            and v.visit_status <> 'cancelled'
        ) as "bookedVisitsCount",
        count(*) filter (
          where w.archived_at is null
            and not exists (
              select 1
              from job_work_order_visits v
              where v.work_order_id = w.id
                and v.schedule_state = 'booked'
                and v.visit_status <> 'cancelled'
            )
        )::integer as "unscheduledCount",
        count(*) filter (
          where w.archived_at is null
            and exists (
              select 1
              from job_work_order_visits v
              where v.work_order_id = w.id
                and v.assigned_to = 'hbs_internal'
                and v.visit_status <> 'cancelled'
            )
        )::integer as "hbsInternalCount",
        count(*) filter (
          where w.archived_at is null
            and exists (
              select 1
              from job_work_order_visits v
              where v.work_order_id = w.id
                and v.assigned_to = 'hbs_external'
                and v.visit_status <> 'cancelled'
            )
        )::integer as "hbsExternalCount",
        count(*) filter (where w.archived_at is not null)::integer as "archivedCount"
      from job_work_orders w
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

  const workTypeId = cleanText(query.workTypeId || query.jobTypeId, { maxLength: 80 });

  if (workTypeId) {
    if (UUID_PATTERN.test(workTypeId)) {
      values.push(workTypeId);
      conditions.push(`w.job_type_id = $${values.length}`);
    } else if (workTypeId === 'custom') {
      conditions.push('w.job_type_id is null');
    }
  }

  const assignedTo = cleanText(query.assignedTo, { maxLength: 80 });

  if (assignedTo && ASSIGNMENTS.has(assignedTo)) {
    values.push(assignedTo);
    conditions.push(`exists (
      select 1
      from job_work_order_visits v
      where v.work_order_id = w.id
        and v.assigned_to = $${values.length}
        and v.visit_status <> 'cancelled'
    )`);
  }

  const customerContactId = cleanText(query.customerContactId, { maxLength: 80 });

  if (customerContactId && UUID_PATTERN.test(customerContactId)) {
    values.push(customerContactId);
    conditions.push(`w.customer_contact_id = $${values.length}`);
  }

  const scheduledDate = cleanText(query.scheduledDate, { maxLength: 20 });

  if (scheduledDate && isValidDateOnly(scheduledDate)) {
    values.push(scheduledDate);
    conditions.push(`exists (
      select 1
      from job_work_order_visits v
      where v.work_order_id = w.id
        and v.scheduled_date = $${values.length}
    )`);
  }

  if (readBoolean(query.unscheduled) === true) {
    conditions.push(`not exists (
      select 1
      from job_work_order_visits v
      where v.work_order_id = w.id
        and v.schedule_state = 'booked'
        and v.visit_status <> 'cancelled'
    )`);
  }

  const city = cleanText(query.city, { maxLength: 120 });

  if (city) {
    values.push(city.toLowerCase());
    conditions.push(`exists (
      select 1
      from job_work_order_locations l
      where l.work_order_id = w.id
        and lower(coalesce(l.city, '')) = $${values.length}
    )`);
  }

  const search = cleanText(query.search, { maxLength: 160 });

  if (search) {
    values.push(`%${search}%`);
    const index = values.length;
    conditions.push(`(
      w.work_order_number ilike $${index}
      or coalesce(w.customer_display_snapshot, '') ilike $${index}
      or w.customer_name ilike $${index}
      or coalesce(w.customer_company, '') ilike $${index}
      or coalesce(w.contact_person_name, '') ilike $${index}
      or coalesce(w.contact_person_phone, '') ilike $${index}
      or coalesce(w.contact_person_email, '') ilike $${index}
      or coalesce(w.customer_phone, '') ilike $${index}
      or coalesce(w.customer_email, '') ilike $${index}
      or coalesce(cc.contact_number, '') ilike $${index}
      or coalesce(cc.display_name, '') ilike $${index}
      or coalesce(cc.company_name, '') ilike $${index}
      or coalesce(jt.name, '') ilike $${index}
      or coalesce(jt.abbreviation, '') ilike $${index}
      or coalesce(w.job_type_other, '') ilike $${index}
      or w.title ilike $${index}
      or coalesce(w.calendar_title, '') ilike $${index}
      or coalesce(w.reference_number, '') ilike $${index}
      or coalesce(w.old_system_reference, '') ilike $${index}
      or coalesce(w.customer_reference_number, '') ilike $${index}
      or coalesce(w.product_or_table_involved, '') ilike $${index}
      or w.service_details ilike $${index}
      or coalesce(w.internal_notes, '') ilike $${index}
      or exists (
        select 1
        from job_work_order_locations l
        where l.work_order_id = w.id
          and (
            coalesce(l.label, '') ilike $${index}
            or coalesce(l.address_line_1, '') ilike $${index}
            or coalesce(l.address_line_2, '') ilike $${index}
            or coalesce(l.city, '') ilike $${index}
            or coalesce(l.province, '') ilike $${index}
            or coalesce(l.postal_code, '') ilike $${index}
            or coalesce(l.site_access_notes, '') ilike $${index}
            or coalesce(l.parking_notes, '') ilike $${index}
            or coalesce(l.stairs_elevator_notes, '') ilike $${index}
            or coalesce(l.room_location_notes, '') ilike $${index}
          )
      )
      or exists (
        select 1
        from job_work_order_visits v
        where v.work_order_id = w.id
          and (
            coalesce(v.visit_title, '') ilike $${index}
            or coalesce(v.visit_instructions, '') ilike $${index}
            or coalesce(v.completion_notes, '') ilike $${index}
            or coalesce(v.cancellation_reason, '') ilike $${index}
          )
      )
    )`);
  }

  return {
    whereSql: conditions.length > 0 ? `where ${conditions.join(' and ')}` : '',
    values
  };
}

async function insertWorkOrder(data) {
  const client = await pool.connect();

  try {
    await client.query('begin');
    const fields = buildWorkOrderDbFields(data, null);
    const columns = Object.keys(fields);
    const values = Object.values(fields);
    const placeholders = values.map((_, index) => `$${index + 1}`);
    const result = await client.query(
      `
        insert into job_work_orders (${columns.join(', ')})
        values (${placeholders.join(', ')})
        returning id
      `,
      values
    );
    const workOrderId = result.rows[0].id;

    await replaceWorkOrderLocations(client, workOrderId, data.locations);
    await upsertWorkOrderVisits(client, workOrderId, data.visits);
    await client.query('commit');

    return getWorkOrderById(workOrderId);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function updateWorkOrder(id, existing, data) {
  const client = await pool.connect();

  try {
    await client.query('begin');
    const fields = buildWorkOrderDbFields(data, existing);
    const assignments = [];
    const values = [];

    for (const [column, value] of Object.entries(fields)) {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    }

    values.push(id);

    await client.query(
      `
        update job_work_orders
        set ${assignments.join(', ')}
        where id = $${values.length}
      `,
      values
    );

    if (data.locationsProvided) {
      await replaceWorkOrderLocations(client, id, data.locations);
    }

    if (data.visitsProvided) {
      await upsertWorkOrderVisits(client, id, data.visits);
    }

    await client.query('commit');
    return getWorkOrderById(id);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

function buildWorkOrderDbFields(data, existing) {
  const primaryLocation = getLegacyLocationSnapshot(data.locations, data.locationMode);
  const primaryVisit = getPrimaryVisit(data.visits);
  const timestampFields = getTimestampUpdates(existing || {}, data.status);

  return {
    customer_contact_id: data.customerContactId,
    customer_display_snapshot: data.customerDisplaySnapshot,
    contact_person_name: data.contactPersonName,
    contact_person_phone: data.contactPersonPhone,
    contact_person_email: data.contactPersonEmail,
    customer_name: data.customerName,
    customer_company: data.customerCompany,
    customer_phone: data.customerPhone,
    customer_email: data.customerEmail,
    job_type_id: data.jobTypeId,
    job_type_other: data.jobTypeOther,
    work_type_abbreviation: data.workTypeAbbreviation,
    location_mode: data.locationMode,
    title: data.title,
    calendar_title: data.calendarTitle,
    source_reference: data.referenceNumber,
    reference_number: data.referenceNumber,
    old_system_reference: data.oldSystemReference,
    customer_reference_number: data.customerReferenceNumber,
    source_warranty_service_ticket_id: data.sourceWarrantyServiceTicketId,
    product_or_table_involved: data.productOrTableInvolved,
    service_address_line_1: primaryLocation?.addressLine1 || null,
    service_address_line_2: primaryLocation?.addressLine2 || null,
    service_city: primaryLocation?.city || null,
    service_province: primaryLocation?.province || null,
    service_postal_code: primaryLocation?.postalCode || null,
    service_location_name: primaryLocation?.label || null,
    access_notes: primaryLocation?.siteAccessNotes || null,
    service_details: data.serviceDetails,
    scheduled_date: primaryVisit?.scheduledDate || null,
    assigned_to_text: primaryVisit ? formatAssignment(primaryVisit.assignedTo) : null,
    job_notes: data.jobNotes,
    internal_notes: data.internalNotes,
    completion_notes: data.completionNotes,
    cancellation_reason: data.cancellationReason,
    cancellation_reason_code: data.cancellationReasonCode,
    priority: data.priority || 'normal',
    status: data.status,
    ...timestampFields
  };
}

async function replaceWorkOrderLocations(client, workOrderId, locations) {
  await client.query('delete from job_work_order_locations where work_order_id = $1', [workOrderId]);

  for (const location of locations || []) {
    await client.query(
      `
        insert into job_work_order_locations (
          work_order_id,
          role,
          customer_contact_property_id,
          label,
          address_line_1,
          address_line_2,
          city,
          province,
          postal_code,
          country,
          site_access_notes,
          parking_notes,
          stairs_elevator_notes,
          room_location_notes
        )
        values (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14
        )
      `,
      [
        workOrderId,
        location.role,
        location.customerContactPropertyId,
        location.label,
        location.addressLine1,
        location.addressLine2,
        location.city,
        location.province,
        location.postalCode,
        location.country,
        location.siteAccessNotes,
        location.parkingNotes,
        location.stairsElevatorNotes,
        location.roomLocationNotes
      ]
    );
  }
}

async function upsertWorkOrderVisits(client, workOrderId, visits) {
  for (const visit of visits || []) {
    if (visit.id) {
      await updateWorkOrderVisit(client, workOrderId, visit);
    } else {
      await insertWorkOrderVisit(client, workOrderId, visit);
    }
  }
}

async function resolveVisitLocationReferences(client, workOrderId, visit) {
  const explicitPrimary = readUuid(visit.primaryLocationId);
  const explicitSecondary = readUuid(visit.secondaryLocationId);

  if (explicitPrimary || explicitSecondary) {
    const ids = [explicitPrimary, explicitSecondary].filter(Boolean);
    const result = ids.length > 0
      ? await client.query(
        `
          select id
          from job_work_order_locations
          where work_order_id = $1
            and id = any($2::uuid[])
        `,
        [workOrderId, ids]
      )
      : { rows: [] };
    const validIds = new Set(result.rows.map((row) => row.id));

    return {
      primaryLocationId: explicitPrimary && validIds.has(explicitPrimary) ? explicitPrimary : null,
      secondaryLocationId: explicitSecondary && validIds.has(explicitSecondary) ? explicitSecondary : null
    };
  }

  const role = visit.locationRole || inferVisitLocationRole(visit.visitType);
  const roles = role === 'pickup_delivery'
    ? ['pickup', 'delivery']
    : [role || 'service'];
  const result = await client.query(
    `
      select id, role
      from job_work_order_locations
      where work_order_id = $1
        and role = any($2::text[])
    `,
    [workOrderId, roles]
  );
  const byRole = new Map(result.rows.map((location) => [location.role, location.id]));

  return {
    primaryLocationId: byRole.get(roles[0]) || null,
    secondaryLocationId: role === 'pickup_delivery' ? byRole.get('delivery') || null : null
  };
}

async function insertWorkOrderVisit(client, workOrderId, visit) {
  const visitNumber = visit.visitNumber || await getNextVisitNumber(client, workOrderId);
  const locationRefs = await resolveVisitLocationReferences(client, workOrderId, visit);
  const result = await client.query(
    `
      insert into job_work_order_visits (
        work_order_id,
        visit_number,
        visit_title,
        visit_type,
        schedule_state,
        scheduled_date,
        arrival_window_label,
        start_time,
        end_time,
        anytime,
        assigned_to,
        location_role,
        primary_location_id,
        secondary_location_id,
        visit_status,
        visit_instructions,
        timing_notes,
        completion_notes,
        cancellation_reason,
        completed_at,
        cancelled_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21
      )
      returning
        id,
        work_order_id as "workOrderId",
        visit_number as "visitNumber",
        visit_title as "visitTitle",
        visit_type as "visitType",
        schedule_state as "scheduleState",
        scheduled_date as "scheduledDate",
        arrival_window_label as "arrivalWindowLabel",
        start_time as "startTime",
        end_time as "endTime",
        anytime,
        assigned_to as "assignedTo",
        location_role as "locationRole",
        primary_location_id as "primaryLocationId",
        secondary_location_id as "secondaryLocationId",
        visit_status as "visitStatus",
        visit_instructions as "visitInstructions",
        timing_notes as "timingNotes",
        completion_notes as "completionNotes",
        cancellation_reason as "cancellationReason",
        completed_at as "completedAt",
        cancelled_at as "cancelledAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
    [
      workOrderId,
      visitNumber,
      visit.visitTitle,
      visit.visitType,
      visit.scheduleState,
      visit.scheduledDate,
      visit.arrivalWindowLabel,
      visit.startTime,
      visit.endTime,
      visit.anytime,
      visit.assignedTo,
      visit.locationRole,
      locationRefs.primaryLocationId,
      locationRefs.secondaryLocationId,
      visit.visitStatus,
      visit.visitInstructions,
      visit.timingNotes,
      visit.completionNotes,
      visit.cancellationReason,
      visit.completedAt,
      visit.cancelledAt
    ]
  );

  return formatVisit(result.rows[0]);
}

async function updateWorkOrderVisit(client, workOrderId, visit) {
  const locationRefs = await resolveVisitLocationReferences(client, workOrderId, visit);
  const fields = {
    visit_number: visit.visitNumber,
    visit_title: visit.visitTitle,
    visit_type: visit.visitType,
    schedule_state: visit.scheduleState,
    scheduled_date: visit.scheduledDate,
    arrival_window_label: visit.arrivalWindowLabel,
    start_time: visit.startTime,
    end_time: visit.endTime,
    anytime: visit.anytime,
    assigned_to: visit.assignedTo,
    location_role: visit.locationRole,
    primary_location_id: locationRefs.primaryLocationId,
    secondary_location_id: locationRefs.secondaryLocationId,
    visit_status: visit.visitStatus,
    visit_instructions: visit.visitInstructions,
    timing_notes: visit.timingNotes,
    completion_notes: visit.completionNotes,
    cancellation_reason: visit.cancellationReason
  };
  const assignments = [];
  const values = [];

  for (const [column, value] of Object.entries(fields)) {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  }

  values.push(workOrderId, visit.id);
  const result = await client.query(
    `
      update job_work_order_visits
      set ${assignments.join(', ')}
      where work_order_id = $${values.length - 1}
        and id = $${values.length}
      returning
        id,
        work_order_id as "workOrderId",
        visit_number as "visitNumber",
        visit_title as "visitTitle",
        visit_type as "visitType",
        schedule_state as "scheduleState",
        scheduled_date as "scheduledDate",
        arrival_window_label as "arrivalWindowLabel",
        start_time as "startTime",
        end_time as "endTime",
        anytime,
        assigned_to as "assignedTo",
        location_role as "locationRole",
        primary_location_id as "primaryLocationId",
        secondary_location_id as "secondaryLocationId",
        visit_status as "visitStatus",
        visit_instructions as "visitInstructions",
        timing_notes as "timingNotes",
        completion_notes as "completionNotes",
        cancellation_reason as "cancellationReason",
        completed_at as "completedAt",
        cancelled_at as "cancelledAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
    values
  );

  return formatVisit(result.rows[0]);
}

async function getNextVisitNumber(client, workOrderId) {
  const result = await client.query(
    `
      select coalesce(max(visit_number), 0) + 1 as "nextVisitNumber"
      from job_work_order_visits
      where work_order_id = $1
    `,
    [workOrderId]
  );

  return Number(result.rows[0]?.nextVisitNumber || 1);
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

async function cancelWorkOrder(id, cancellationReason, cancellationReasonCode) {
  await pool.query(
    `
      update job_work_orders
      set
        status = 'cancelled',
        cancellation_reason = $1,
        cancellation_reason_code = $2,
        cancelled_at = coalesce(cancelled_at, now())
      where id = $3
    `,
    [cancellationReason, cancellationReasonCode, id]
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

async function completeVisit(workOrderId, visitId, completionNotes) {
  const result = await pool.query(
    `
      update job_work_order_visits
      set
        visit_status = 'completed',
        completion_notes = coalesce($3, completion_notes),
        completed_at = coalesce(completed_at, now())
      where work_order_id = $1
        and id = $2
      returning
        id,
        work_order_id as "workOrderId",
        visit_number as "visitNumber",
        visit_title as "visitTitle",
        visit_type as "visitType",
        schedule_state as "scheduleState",
        scheduled_date as "scheduledDate",
        arrival_window_label as "arrivalWindowLabel",
        start_time as "startTime",
        end_time as "endTime",
        anytime,
        assigned_to as "assignedTo",
        location_role as "locationRole",
        primary_location_id as "primaryLocationId",
        secondary_location_id as "secondaryLocationId",
        visit_status as "visitStatus",
        visit_instructions as "visitInstructions",
        timing_notes as "timingNotes",
        completion_notes as "completionNotes",
        cancellation_reason as "cancellationReason",
        completed_at as "completedAt",
        cancelled_at as "cancelledAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
    [workOrderId, visitId, completionNotes]
  );

  return formatVisit(result.rows[0]);
}

async function cancelVisit(workOrderId, visitId, cancellationReason) {
  const result = await pool.query(
    `
      update job_work_order_visits
      set
        visit_status = 'cancelled',
        cancellation_reason = coalesce($3, cancellation_reason),
        cancelled_at = coalesce(cancelled_at, now())
      where work_order_id = $1
        and id = $2
      returning
        id,
        work_order_id as "workOrderId",
        visit_number as "visitNumber",
        visit_title as "visitTitle",
        visit_type as "visitType",
        schedule_state as "scheduleState",
        scheduled_date as "scheduledDate",
        arrival_window_label as "arrivalWindowLabel",
        start_time as "startTime",
        end_time as "endTime",
        anytime,
        assigned_to as "assignedTo",
        location_role as "locationRole",
        primary_location_id as "primaryLocationId",
        secondary_location_id as "secondaryLocationId",
        visit_status as "visitStatus",
        visit_instructions as "visitInstructions",
        timing_notes as "timingNotes",
        completion_notes as "completionNotes",
        cancellation_reason as "cancellationReason",
        completed_at as "completedAt",
        cancelled_at as "cancelledAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
    [workOrderId, visitId, cancellationReason]
  );

  return formatVisit(result.rows[0]);
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
      ${workOrderBaseSelectSql}
      where w.id = $1
      limit 1
    `,
    [id]
  );

  const rows = await attachWorkOrderChildren(result.rows);
  return rows[0] || null;
}

async function attachWorkOrderChildren(rows) {
  const ids = rows.map((row) => row.id).filter(Boolean);

  if (ids.length === 0) {
    return rows;
  }

  const [locationsResult, visitsResult] = await Promise.all([
    pool.query(
      `
        select
          id,
          work_order_id as "workOrderId",
          role,
          customer_contact_property_id as "customerContactPropertyId",
          label,
          address_line_1 as "addressLine1",
          address_line_2 as "addressLine2",
          city,
          province,
          postal_code as "postalCode",
          country,
          site_access_notes as "siteAccessNotes",
          parking_notes as "parkingNotes",
          stairs_elevator_notes as "stairsElevatorNotes",
          room_location_notes as "roomLocationNotes",
          created_at as "createdAt",
          updated_at as "updatedAt"
        from job_work_order_locations
        where work_order_id = any($1::uuid[])
        order by
          case role
            when 'service' then 0
            when 'pickup' then 1
            when 'delivery' then 2
            else 3
          end,
          created_at asc
      `,
      [ids]
    ),
    pool.query(
      `
        select
          id,
          work_order_id as "workOrderId",
          visit_number as "visitNumber",
          visit_title as "visitTitle",
          visit_type as "visitType",
          schedule_state as "scheduleState",
          scheduled_date as "scheduledDate",
          arrival_window_label as "arrivalWindowLabel",
          start_time as "startTime",
          end_time as "endTime",
          anytime,
          assigned_to as "assignedTo",
          location_role as "locationRole",
          primary_location_id as "primaryLocationId",
          secondary_location_id as "secondaryLocationId",
          visit_status as "visitStatus",
          visit_instructions as "visitInstructions",
          timing_notes as "timingNotes",
          completion_notes as "completionNotes",
          cancellation_reason as "cancellationReason",
          completed_at as "completedAt",
          cancelled_at as "cancelledAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
        from job_work_order_visits
        where work_order_id = any($1::uuid[])
        order by visit_number asc, created_at asc
      `,
      [ids]
    )
  ]);

  const locationsByWorkOrder = groupBy(locationsResult.rows.map(formatLocation), 'workOrderId');
  const visitsByWorkOrder = groupBy(visitsResult.rows.map(formatVisit), 'workOrderId');

  return rows.map((row) => ({
    ...row,
    locations: locationsByWorkOrder.get(row.id) || [],
    visits: visitsByWorkOrder.get(row.id) || []
  }));
}

async function getWorkTypes() {
  const result = await pool.query(`
    select
      id,
      name,
      slug,
      abbreviation,
      commonly_uses_pickup_delivery as "commonlyUsesPickupDelivery",
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

async function getCustomerContactById(id) {
  const result = await pool.query(
    `
      select
        id,
        contact_number as "contactNumber",
        display_name as "displayName",
        company_name as "companyName",
        phone,
        email,
        status
      from customer_contacts
      where id = $1
      limit 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getCustomerPropertyById(id) {
  const result = await pool.query(
    `
      select
        id,
        customer_contact_id as "customerContactId",
        label,
        property_type as "propertyType",
        address_line_1 as "addressLine1",
        address_line_2 as "addressLine2",
        city,
        province,
        postal_code as "postalCode",
        country,
        site_access_notes as "siteAccessNotes",
        parking_notes as "parkingNotes",
        stairs_elevator_notes as "stairsElevatorNotes",
        room_location_notes as "roomLocationNotes",
        is_default_service_address as "isDefaultServiceAddress",
        is_billing_address as "isBillingAddress",
        archived_at as "archivedAt"
      from customer_contact_properties
      where id = $1
      limit 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getWorkTypeById(id) {
  const result = await pool.query(
    `
      select
        id,
        name,
        slug,
        abbreviation,
        commonly_uses_pickup_delivery as "commonlyUsesPickupDelivery",
        is_active as "isActive"
      from job_work_order_types
      where id = $1
      limit 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getVisitById(workOrderId, visitId) {
  const result = await pool.query(
    `
      select
        id,
        work_order_id as "workOrderId",
        visit_number as "visitNumber",
        visit_title as "visitTitle",
        visit_type as "visitType",
        schedule_state as "scheduleState",
        scheduled_date as "scheduledDate",
        arrival_window_label as "arrivalWindowLabel",
        start_time as "startTime",
        end_time as "endTime",
        anytime,
        assigned_to as "assignedTo",
        location_role as "locationRole",
        primary_location_id as "primaryLocationId",
        secondary_location_id as "secondaryLocationId",
        visit_status as "visitStatus",
        visit_instructions as "visitInstructions",
        timing_notes as "timingNotes",
        completion_notes as "completionNotes",
        cancellation_reason as "cancellationReason",
        completed_at as "completedAt",
        cancelled_at as "cancelledAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from job_work_order_visits
      where work_order_id = $1
        and id = $2
      limit 1
    `,
    [workOrderId, visitId]
  );

  return formatVisit(result.rows[0]);
}

async function validateWarrantyServiceTicket(sourceWarrantyServiceTicketId) {
  if (!sourceWarrantyServiceTicketId) {
    return '';
  }

  try {
    const result = await pool.query(
      `
        select id
        from warranty_service_tickets
        where id = $1
        limit 1
      `,
      [sourceWarrantyServiceTicketId]
    );

    return result.rows[0] ? '' : 'Selected warranty/service ticket is unavailable.';
  } catch (error) {
    if (error.code === '42P01') {
      return 'Warranty/service ticket links are unavailable until that schema is installed.';
    }

    throw error;
  }
}

async function normalizeWorkOrderInput(rawInput, existing) {
  const input = rawInput || {};
  const customerContactId = readClean(input, existing, 'customerContactId', { maxLength: 80 });

  if (!customerContactId) {
    return { error: 'Choose a customer/contact before creating a work order.' };
  }

  if (!UUID_PATTERN.test(customerContactId)) {
    return { error: 'Choose a valid customer/contact link.' };
  }

  const contact = await getCustomerContactById(customerContactId);

  if (!contact) {
    return { error: 'Selected customer/contact is unavailable.' };
  }

  const jobTypeId = readClean(input, existing, 'jobTypeId', { maxLength: 80 });
  let workType = null;
  let jobTypeOther = readClean(input, existing, 'jobTypeOther', { maxLength: MAX_SHORT_TEXT_LENGTH });

  if (jobTypeId && jobTypeId !== 'custom' && jobTypeId !== 'other') {
    if (!UUID_PATTERN.test(jobTypeId)) {
      return { error: 'Choose a valid work type.' };
    }

    workType = await getWorkTypeById(jobTypeId);

    if (!workType) {
      return { error: 'Selected work type is unavailable.' };
    }

    if (!workType.isActive && (!existing || hasInput(input, 'jobTypeId'))) {
      return { error: 'Selected work type is unavailable.' };
    }
  }

  const normalizedJobTypeId = workType ? workType.id : null;

  if (!normalizedJobTypeId && !jobTypeOther) {
    return { error: 'Choose a work type.' };
  }

  const locationMode = normalizeLocationMode(
    readClean(input, existing, 'locationMode', { maxLength: 80 }),
    workType,
    existing
  );
  const locationsResult = await normalizeLocations(input, existing, customerContactId, locationMode);

  if (locationsResult.error) {
    return { error: locationsResult.error };
  }

  let status = readClean(input, existing, 'status', { maxLength: 80 });

  if (!status) {
    status = 'to_be_scheduled';
  }

  const visitsResult = normalizeVisits(input, existing, status);

  if (visitsResult.error) {
    return { error: visitsResult.error };
  }

  if (!hasInput(input, 'status') && !existing && visitsResult.data.some((visit) => visit.scheduleState === 'booked')) {
    status = 'booked';
  }

  const sourceWarrantyServiceTicketId = readClean(input, existing, 'sourceWarrantyServiceTicketId', { maxLength: 80 });

  if (sourceWarrantyServiceTicketId && !UUID_PATTERN.test(sourceWarrantyServiceTicketId)) {
    return { error: 'Choose a valid warranty/service ticket source.' };
  }

  const sourceTicketError = await validateWarrantyServiceTicket(sourceWarrantyServiceTicketId);

  if (sourceTicketError) {
    return { error: sourceTicketError };
  }

  const contactPersonName = readClean(input, existing, 'contactPersonName', { maxLength: MAX_SHORT_TEXT_LENGTH });
  const contactPersonPhone = readClean(input, existing, 'contactPersonPhone', { maxLength: 80 });
  const contactPersonEmail = readClean(input, existing, 'contactPersonEmail', { maxLength: 240, lowercase: true });
  const customerDisplaySnapshot = readClean(input, existing, 'customerDisplaySnapshot', { maxLength: MAX_SHORT_TEXT_LENGTH })
    || formatCustomerDisplaySnapshot(contact);
  const customerName = readClean(input, existing, 'customerName', { maxLength: 180 }) || contact.displayName;
  const customerCompany = readClean(input, existing, 'customerCompany', { maxLength: 180 }) || contact.companyName;
  const customerPhone = readClean(input, existing, 'customerPhone', { maxLength: 80 }) || contact.phone;
  const customerEmail = readClean(input, existing, 'customerEmail', { maxLength: 240, lowercase: true }) || contact.email;
  const workTypeAbbreviation = readClean(input, existing, 'workTypeAbbreviation', { maxLength: 24 })
    || workType?.abbreviation
    || existing?.workTypeAbbreviation
    || 'WO';
  const serviceDetails = readClean(input, existing, 'serviceDetails', { maxLength: MAX_TEXT_LENGTH })
    || readClean(input, existing, 'workDescription', { maxLength: MAX_TEXT_LENGTH });
  const title = readClean(input, existing, 'title', { maxLength: MAX_SHORT_TEXT_LENGTH })
    || generateWorkOrderTitle({ contact, workType, workTypeAbbreviation, locations: locationsResult.data });
  const calendarTitle = readClean(input, existing, 'calendarTitle', { maxLength: MAX_SHORT_TEXT_LENGTH })
    || generateCalendarTitle({ title, contact, workTypeAbbreviation, locations: locationsResult.data, visits: visitsResult.data });
  const referenceNumber = readClean(input, existing, 'referenceNumber', { maxLength: MAX_SHORT_TEXT_LENGTH })
    || readClean(input, existing, 'sourceReference', { maxLength: MAX_SHORT_TEXT_LENGTH });

  const data = {
    customerContactId,
    customerDisplaySnapshot,
    contactPersonName,
    contactPersonPhone,
    contactPersonEmail,
    customerName,
    customerCompany,
    customerPhone,
    customerEmail,
    jobTypeId: normalizedJobTypeId,
    jobTypeOther: normalizedJobTypeId ? null : jobTypeOther,
    workTypeAbbreviation,
    locationMode,
    title,
    calendarTitle,
    referenceNumber,
    oldSystemReference: readClean(input, existing, 'oldSystemReference', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    customerReferenceNumber: readClean(input, existing, 'customerReferenceNumber', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    sourceWarrantyServiceTicketId,
    productOrTableInvolved: readClean(input, existing, 'productOrTableInvolved', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    serviceDetails,
    jobNotes: readClean(input, existing, 'jobNotes', { maxLength: MAX_TEXT_LENGTH }),
    internalNotes: readClean(input, existing, 'internalNotes', { maxLength: MAX_TEXT_LENGTH }),
    completionNotes: readClean(input, existing, 'completionNotes', { maxLength: MAX_TEXT_LENGTH }),
    cancellationReason: readClean(input, existing, 'cancellationReason', { maxLength: MAX_TEXT_LENGTH }),
    cancellationReasonCode: readClean(input, existing, 'cancellationReasonCode', { maxLength: 80 }),
    priority: readClean(input, existing, 'priority', { maxLength: 80 }) || 'normal',
    status,
    locations: locationsResult.data,
    locationsProvided: locationsResult.provided,
    visits: visitsResult.data,
    visitsProvided: visitsResult.provided
  };

  const validationError = validateWorkOrderData(data);

  if (validationError) {
    return { error: validationError };
  }

  return { data };
}

function normalizeLocationMode(value, workType, existing) {
  if (value && LOCATION_MODES.has(value)) {
    return value;
  }

  if (existing?.locationMode && LOCATION_MODES.has(existing.locationMode)) {
    return existing.locationMode;
  }

  return workType?.commonlyUsesPickupDelivery ? 'pickup_delivery' : 'service';
}

async function normalizeLocations(input, existing, customerContactId, locationMode) {
  const provided = hasInput(input, 'locations') || hasLegacyLocationInput(input);
  const rawLocations = provided
    ? parseLocationPayload(getInput(input, 'locations'), input)
    : existing?.locations || [];
  const normalized = [];

  for (const rawLocation of rawLocations) {
    const normalizedLocation = await normalizeLocation(rawLocation, customerContactId);

    if (normalizedLocation.error) {
      return { error: normalizedLocation.error };
    }

    if (normalizedLocation.data && locationHasContent(normalizedLocation.data)) {
      normalized.push(normalizedLocation.data);
    }
  }

  const filtered = normalized.filter((location) => {
    if (locationMode === 'pickup_delivery') {
      return location.role === 'pickup' || location.role === 'delivery';
    }

    return location.role === 'service';
  });

  return {
    data: filtered,
    provided
  };
}

function parseLocationPayload(rawLocations, input) {
  if (Array.isArray(rawLocations)) {
    return rawLocations;
  }

  if (rawLocations && typeof rawLocations === 'object') {
    return ['service', 'pickup', 'delivery']
      .map((role) => rawLocations[role] ? { role, ...rawLocations[role] } : null)
      .filter(Boolean);
  }

  if (hasLegacyLocationInput(input)) {
    return [{
      role: 'service',
      label: getInput(input, 'serviceLocationName'),
      addressLine1: getInput(input, 'serviceAddressLine1'),
      addressLine2: getInput(input, 'serviceAddressLine2'),
      city: getInput(input, 'serviceCity'),
      province: getInput(input, 'serviceProvince'),
      postalCode: getInput(input, 'servicePostalCode'),
      country: 'Canada',
      siteAccessNotes: getInput(input, 'accessNotes')
    }];
  }

  return [];
}

async function normalizeLocation(rawLocation, customerContactId) {
  const role = cleanText(readAny(rawLocation, 'role'), { maxLength: 40 }) || 'service';

  if (!LOCATION_ROLES.has(role)) {
    return { error: 'Choose a valid location role.' };
  }

  const customerContactPropertyId = cleanText(readAny(rawLocation, 'customerContactPropertyId'), { maxLength: 80 });
  let property = null;

  if (customerContactPropertyId) {
    if (!UUID_PATTERN.test(customerContactPropertyId)) {
      return { error: 'Choose a valid saved property.' };
    }

    property = await getCustomerPropertyById(customerContactPropertyId);

    if (!property || property.customerContactId !== customerContactId || property.archivedAt) {
      return { error: 'Selected property is unavailable for this customer.' };
    }
  }

  const data = {
    id: readUuid(readAny(rawLocation, 'id')),
    role,
    customerContactPropertyId: property?.id || customerContactPropertyId || null,
    label: cleanText(readAny(rawLocation, 'label'), { maxLength: MAX_SHORT_TEXT_LENGTH }) || property?.label || null,
    addressLine1: cleanText(readAny(rawLocation, 'addressLine1'), { maxLength: MAX_SHORT_TEXT_LENGTH }) || property?.addressLine1 || null,
    addressLine2: cleanText(readAny(rawLocation, 'addressLine2'), { maxLength: MAX_SHORT_TEXT_LENGTH }) || property?.addressLine2 || null,
    city: cleanText(readAny(rawLocation, 'city'), { maxLength: 120 }) || property?.city || null,
    province: cleanText(readAny(rawLocation, 'province'), { maxLength: 120 }) || property?.province || 'BC',
    postalCode: cleanText(readAny(rawLocation, 'postalCode'), { maxLength: 40 }) || property?.postalCode || null,
    country: cleanText(readAny(rawLocation, 'country'), { maxLength: 120 }) || property?.country || 'Canada',
    siteAccessNotes: cleanText(readAny(rawLocation, 'siteAccessNotes'), { maxLength: MAX_TEXT_LENGTH }) || property?.siteAccessNotes || null,
    parkingNotes: cleanText(readAny(rawLocation, 'parkingNotes'), { maxLength: MAX_TEXT_LENGTH }) || property?.parkingNotes || null,
    stairsElevatorNotes: cleanText(readAny(rawLocation, 'stairsElevatorNotes'), { maxLength: MAX_TEXT_LENGTH }) || property?.stairsElevatorNotes || null,
    roomLocationNotes: cleanText(readAny(rawLocation, 'roomLocationNotes'), { maxLength: MAX_TEXT_LENGTH }) || property?.roomLocationNotes || null
  };

  return { data };
}

function normalizeVisits(input, existing, status) {
  const provided = hasInput(input, 'visits') || hasInput(input, 'primaryVisit') || hasTopLevelVisitInput(input);
  let rawVisits = [];

  if (hasInput(input, 'visits')) {
    const visits = getInput(input, 'visits');
    rawVisits = Array.isArray(visits) ? visits : [];
  } else if (hasInput(input, 'primaryVisit')) {
    rawVisits = [getInput(input, 'primaryVisit')];
  } else if (hasTopLevelVisitInput(input)) {
    rawVisits = [buildTopLevelVisitInput(input, existing)];
  } else if (existing?.visits?.length) {
    rawVisits = existing.visits;
  } else {
    rawVisits = [buildTopLevelVisitInput(input, existing, status)];
  }

  const normalized = [];

  for (const [index, rawVisit] of rawVisits.entries()) {
    const normalizedVisit = normalizeVisitInput(rawVisit, rawVisit, index + 1, status);

    if (normalizedVisit.error) {
      return { error: normalizedVisit.error };
    }

    normalized.push(normalizedVisit.data);
  }

  return {
    data: normalized,
    provided
  };
}

function buildTopLevelVisitInput(input, existing, status) {
  const scheduledDate = getInput(input, 'scheduledDate') || existing?.scheduledDate || null;
  return {
    id: existing?.visits?.[0]?.id,
    visitNumber: existing?.visits?.[0]?.visitNumber || 1,
    visitTitle: getInput(input, 'visitTitle') || existing?.visits?.[0]?.visitTitle,
    visitType: getInput(input, 'visitType') || existing?.visits?.[0]?.visitType,
    scheduleState: getInput(input, 'scheduleState') || (scheduledDate || status === 'booked' ? 'booked' : 'unscheduled'),
    scheduledDate,
    arrivalWindowLabel: getInput(input, 'arrivalWindowLabel') || existing?.visits?.[0]?.arrivalWindowLabel,
    startTime: getInput(input, 'startTime') || existing?.visits?.[0]?.startTime,
    endTime: getInput(input, 'endTime') || existing?.visits?.[0]?.endTime,
    anytime: getInput(input, 'anytime') ?? existing?.visits?.[0]?.anytime,
    assignedTo: getInput(input, 'assignedTo') || existing?.visits?.[0]?.assignedTo,
    visitStatus: existing?.visits?.[0]?.visitStatus,
    visitInstructions: getInput(input, 'visitInstructions') || existing?.visits?.[0]?.visitInstructions,
    timingNotes: getInput(input, 'timingNotes') || existing?.visits?.[0]?.timingNotes
  };
}

function normalizeVisitInput(rawVisit, existingVisit, fallbackVisitNumber, status = 'to_be_scheduled') {
  const scheduledDate = normalizeDate(readAny(rawVisit, 'scheduledDate'), existingVisit?.scheduledDate);

  if (scheduledDate.error) {
    return { error: scheduledDate.error };
  }

  const startTime = normalizeTime(readAny(rawVisit, 'startTime'), existingVisit?.startTime);

  if (startTime.error) {
    return { error: startTime.error };
  }

  const endTime = normalizeTime(readAny(rawVisit, 'endTime'), existingVisit?.endTime);

  if (endTime.error) {
    return { error: endTime.error };
  }

  const rawAnytime = readAny(rawVisit, 'anytime');
  const arrivalWindowLabel = normalizeArrivalWindow(
    readAny(rawVisit, 'arrivalWindowLabel') || readAny(rawVisit, 'arrivalWindow'),
    existingVisit?.arrivalWindowLabel
  );
  const anytime = rawAnytime === undefined || rawAnytime === null
    ? arrivalWindowLabel === 'anytime' || Boolean(existingVisit?.anytime)
    : readBoolean(rawAnytime);
  const scheduleState = normalizeScheduleState(
    cleanText(readAny(rawVisit, 'scheduleState'), { maxLength: 80 }),
    existingVisit,
    scheduledDate.value,
    status
  );
  const assignedTo = cleanText(readAny(rawVisit, 'assignedTo'), { maxLength: 80 }) || existingVisit?.assignedTo || 'hbs_internal';
  const visitStatus = cleanText(readAny(rawVisit, 'visitStatus'), { maxLength: 80 }) || existingVisit?.visitStatus || 'pending';
  const visitType = normalizeVisitType(
    cleanText(readAny(rawVisit, 'visitType'), { maxLength: 80 }) || existingVisit?.visitType
  );
  const locationRole = normalizeVisitLocationRole(
    cleanText(readAny(rawVisit, 'locationRole'), { maxLength: 80 }) || existingVisit?.locationRole,
    visitType
  );
  const visitNumber = Number(cleanText(readAny(rawVisit, 'visitNumber'), { maxLength: 20 }) || existingVisit?.visitNumber || fallbackVisitNumber || 1);

  if (!SCHEDULE_STATES.has(scheduleState)) {
    return { error: 'Choose a valid schedule state.' };
  }

  if (!ASSIGNMENTS.has(assignedTo)) {
    return { error: 'Choose HBS Internal or HBS External for assignment.' };
  }

  if (!VISIT_STATUSES.has(visitStatus)) {
    return { error: 'Choose a valid visit status.' };
  }

  if (!VISIT_TYPES.has(visitType)) {
    return { error: 'Choose a valid visit type.' };
  }

  if (locationRole && !VISIT_LOCATION_ROLES.has(locationRole)) {
    return { error: 'Choose a valid visit location role.' };
  }

  if (!Number.isInteger(visitNumber) || visitNumber < 1) {
    return { error: 'Visit number must be a positive number.' };
  }

  const finalArrivalWindow = anytime ? 'anytime' : arrivalWindowLabel;

  if (finalArrivalWindow && !ARRIVAL_WINDOWS.has(finalArrivalWindow)) {
    return { error: 'Choose a valid arrival window.' };
  }

  if (scheduleState === 'booked' && !scheduledDate.value) {
    return { error: 'Booked visits need a scheduled date.' };
  }

  if (scheduleState === 'booked' && !anytime && !finalArrivalWindow && !startTime.value) {
    return { error: 'Booked visits need an arrival window, Anytime, or a start time.' };
  }

  return {
    data: {
      id: readUuid(readAny(rawVisit, 'id')),
      visitNumber,
      visitTitle: cleanText(readAny(rawVisit, 'visitTitle'), { maxLength: MAX_SHORT_TEXT_LENGTH }) || existingVisit?.visitTitle || null,
      visitType,
      scheduleState,
      scheduledDate: scheduledDate.value,
      arrivalWindowLabel: finalArrivalWindow,
      startTime: anytime ? null : startTime.value,
      endTime: anytime ? null : endTime.value,
      anytime,
      assignedTo,
      locationRole,
      primaryLocationId: readUuid(readAny(rawVisit, 'primaryLocationId')) || existingVisit?.primaryLocationId || null,
      secondaryLocationId: readUuid(readAny(rawVisit, 'secondaryLocationId')) || existingVisit?.secondaryLocationId || null,
      visitStatus,
      visitInstructions: cleanText(readAny(rawVisit, 'visitInstructions'), { maxLength: MAX_TEXT_LENGTH }) || existingVisit?.visitInstructions || null,
      timingNotes: cleanText(readAny(rawVisit, 'timingNotes'), { maxLength: MAX_TEXT_LENGTH }) || existingVisit?.timingNotes || null,
      completionNotes: cleanText(readAny(rawVisit, 'completionNotes'), { maxLength: MAX_TEXT_LENGTH }) || existingVisit?.completionNotes || null,
      cancellationReason: cleanText(readAny(rawVisit, 'cancellationReason'), { maxLength: MAX_TEXT_LENGTH }) || existingVisit?.cancellationReason || null,
      completedAt: existingVisit?.completedAt || null,
      cancelledAt: existingVisit?.cancelledAt || null
    }
  };
}

function validateWorkOrderData(data) {
  if (!data.customerContactId || !UUID_PATTERN.test(data.customerContactId)) {
    return 'Choose a customer/contact before creating a work order.';
  }

  if (!data.customerName) {
    return 'Customer snapshot is required.';
  }

  if (!data.customerPhone && !data.customerEmail && !data.contactPersonPhone && !data.contactPersonEmail) {
    return 'Add at least one phone number or email for this customer or contact person.';
  }

  if (data.jobTypeId && !UUID_PATTERN.test(data.jobTypeId)) {
    return 'Choose a valid work type.';
  }

  if (!data.jobTypeId && !data.jobTypeOther) {
    return 'Choose a work type.';
  }

  if (!data.title) {
    return 'Work order title is required.';
  }

  if (!data.serviceDetails) {
    return 'Work description is required.';
  }

  if (!STATUSES.has(data.status)) {
    return 'Choose a valid work order status.';
  }

  if (!LOCATION_MODES.has(data.locationMode)) {
    return 'Choose a valid location mode.';
  }

  if (data.cancellationReasonCode && !CANCELLATION_REASONS.has(data.cancellationReasonCode)) {
    return 'Choose a valid cancellation reason.';
  }

  if (BOOKING_REQUIRED_STATUSES.has(data.status)) {
    const locationError = validateRequiredLocations(data);

    if (locationError) {
      return locationError;
    }

    const visitError = validateRequiredBookedVisit(data);

    if (visitError) {
      return visitError;
    }
  }

  return '';
}

function validateRequiredLocations(data) {
  const needsPickupDelivery = data.locationMode === 'pickup_delivery' ||
    data.visits.some((visit) => ['pickup', 'delivery', 'pickup_delivery'].includes(visit.visitType));

  if (needsPickupDelivery) {
    const pickup = data.locations.find((location) => location.role === 'pickup');
    const delivery = data.locations.find((location) => location.role === 'delivery');

    if (!locationHasBookableAddress(pickup) || !locationHasBookableAddress(delivery)) {
      return 'Pickup + delivery work orders need both pickup and delivery addresses before booking.';
    }

    return '';
  }

  const service = data.locations.find((location) => location.role === 'service');

  if (!locationHasBookableAddress(service)) {
    return 'Service work orders need a service address before booking.';
  }

  return '';
}

function validateRequiredBookedVisit(data) {
  const bookedVisit = data.visits.find((visit) => visit.scheduleState === 'booked' && visit.visitStatus !== 'cancelled');

  if (!bookedVisit) {
    return 'Booked work orders need at least one booked visit.';
  }

  if (!bookedVisit.scheduledDate) {
    return 'Booked visits need a scheduled date.';
  }

  if (!bookedVisit.anytime && !bookedVisit.arrivalWindowLabel && !bookedVisit.startTime) {
    return 'Booked visits need an arrival window, Anytime, or a start time.';
  }

  return '';
}

function hasLegacyLocationInput(input) {
  return [
    'serviceAddressLine1',
    'serviceAddressLine2',
    'serviceCity',
    'serviceProvince',
    'servicePostalCode',
    'serviceLocationName',
    'accessNotes'
  ].some((fieldName) => hasInput(input, fieldName));
}

function hasTopLevelVisitInput(input) {
  return [
    'scheduleState',
    'scheduledDate',
    'arrivalWindowLabel',
    'arrivalWindow',
    'startTime',
    'endTime',
    'anytime',
    'assignedTo',
    'visitInstructions',
    'visitType',
    'timingNotes',
    'visitTitle'
  ].some((fieldName) => hasInput(input, fieldName));
}

function normalizeScheduleState(value, existingVisit, scheduledDate, status) {
  if (value && SCHEDULE_STATES.has(value)) {
    return value;
  }

  if (existingVisit?.scheduleState && SCHEDULE_STATES.has(existingVisit.scheduleState)) {
    return existingVisit.scheduleState;
  }

  if (scheduledDate || status === 'booked') {
    return 'booked';
  }

  return 'unscheduled';
}

function normalizeVisitType(value) {
  if (value && VISIT_TYPES.has(value)) {
    return value;
  }

  return 'service';
}

function normalizeVisitLocationRole(value, visitType) {
  if (value && VISIT_LOCATION_ROLES.has(value)) {
    return value;
  }

  return inferVisitLocationRole(visitType);
}

function inferVisitLocationRole(visitType) {
  if (visitType === 'pickup') {
    return 'pickup';
  }

  if (visitType === 'delivery') {
    return 'delivery';
  }

  if (visitType === 'pickup_delivery') {
    return 'pickup_delivery';
  }

  return 'service';
}

function normalizeArrivalWindow(value, existingValue) {
  const normalized = cleanText(value, { maxLength: 80 });

  if (!normalized) {
    return existingValue || null;
  }

  const lower = normalized.toLowerCase();
  const aliases = {
    '9-11': '9am-11am',
    '9am-11am': '9am-11am',
    '11-1': '11am-1pm',
    '11am-1pm': '11am-1pm',
    '1-3': '1pm-3pm',
    '1pm-3pm': '1pm-3pm',
    '3-5': '3pm-5pm',
    '3pm-5pm': '3pm-5pm',
    morning: 'morning',
    afternoon: 'afternoon',
    anytime: 'anytime',
    custom: 'custom'
  };

  return aliases[lower] || lower;
}

function normalizeDate(value, fallbackValue) {
  const normalized = cleanText(value, { maxLength: 20 });

  if (!normalized) {
    return { value: fallbackValue ? String(fallbackValue).slice(0, 10) : null };
  }

  if (!isValidDateOnly(normalized)) {
    return { error: 'Scheduled date must be a valid date.' };
  }

  return { value: normalized };
}

function normalizeTime(value, fallbackValue) {
  const normalized = cleanText(value, { maxLength: 20 });

  if (!normalized) {
    return { value: fallbackValue || null };
  }

  if (!TIME_PATTERN.test(normalized)) {
    return { error: 'Visit time must use HH:MM format.' };
  }

  return { value: normalized.slice(0, 5) };
}

function getLegacyLocationSnapshot(locations, locationMode) {
  if (!Array.isArray(locations)) {
    return null;
  }

  if (locationMode === 'pickup_delivery') {
    return locations.find((location) => location.role === 'pickup') || locations[0] || null;
  }

  return locations.find((location) => location.role === 'service') || locations[0] || null;
}

function getPrimaryVisit(visits) {
  if (!Array.isArray(visits) || visits.length === 0) {
    return null;
  }

  return visits.find((visit) => visit.visitNumber === 1) || visits[0];
}

function locationHasContent(location) {
  return Boolean(location && [
    location.customerContactPropertyId,
    location.label,
    location.addressLine1,
    location.addressLine2,
    location.city,
    location.postalCode,
    location.siteAccessNotes,
    location.parkingNotes,
    location.stairsElevatorNotes,
    location.roomLocationNotes
  ].some(Boolean));
}

function locationHasBookableAddress(location) {
  return Boolean(location?.addressLine1 && location?.city);
}

function generateWorkOrderTitle({ contact, workType, workTypeAbbreviation, locations }) {
  return [
    firstLocationCity(locations),
    workType?.name || workTypeAbbreviation || 'Work Order',
    contact.companyName || contact.displayName
  ].filter(Boolean).join(' - ').slice(0, MAX_SHORT_TEXT_LENGTH);
}

function generateCalendarTitle({ title, contact, workTypeAbbreviation, locations, visits }) {
  const visit = visits?.find((item) => item.scheduleState === 'booked') || visits?.[0];
  return [
    firstLocationCity(locations),
    workTypeAbbreviation,
    contact.companyName || contact.displayName,
    formatVisitWindow(visit)
  ].filter(Boolean).join(' - ').slice(0, MAX_SHORT_TEXT_LENGTH) || title;
}

function firstLocationCity(locations) {
  return (locations || []).find((location) => location.city)?.city || '';
}

function formatCustomerDisplaySnapshot(contact) {
  return [contact.companyName, contact.displayName].filter(Boolean).join(' / ') || contact.displayName;
}

function formatAssignment(value) {
  const match = ASSIGNED_TO_OPTIONS.find(([assignment]) => assignment === value);
  return match?.[1] || '';
}

function formatVisitWindow(visit) {
  if (!visit) {
    return '';
  }

  if (visit.anytime || visit.arrivalWindowLabel === 'anytime') {
    return 'Anytime';
  }

  return visit.arrivalWindowLabel || [visit.startTime, visit.endTime].filter(Boolean).join('-');
}

function formatWorkOrder(workOrder) {
  if (!workOrder) {
    return null;
  }

  const locations = workOrder.locations || [];
  const visits = workOrder.visits || [];
  const primaryVisit = getPrimaryVisit(visits);
  const nextVisit = visits.find((visit) => visit.scheduleState === 'booked' && visit.visitStatus === 'pending')
    || visits.find((visit) => visit.scheduleState === 'booked')
    || primaryVisit;
  const workTypeAbbreviation = workOrder.workTypeAbbreviation || workOrder.jobTypeAbbreviation || '';

  return {
    ...workOrder,
    locations,
    visits,
    primaryVisit,
    nextVisit,
    displayTitle: workOrder.calendarTitle || workOrder.title,
    workDescription: workOrder.serviceDetails,
    workTypeName: workOrder.jobTypeName || workOrder.jobTypeOther || 'Work order',
    workTypeAbbreviation,
    city: firstLocationCity(locations) || workOrder.serviceCity || '',
    locationSummary: formatLocationSummary(locations, workOrder),
    scheduleSummary: formatScheduleSummary(nextVisit),
    assignedTo: nextVisit?.assignedTo || null,
    assignedToLabel: nextVisit ? formatAssignment(nextVisit.assignedTo) : '',
    isArchived: Boolean(workOrder.archivedAt),
    isActive: !workOrder.archivedAt && ACTIVE_STATUSES.has(workOrder.status),
    isCompleted: workOrder.status === 'completed',
    isCancelled: workOrder.status === 'cancelled',
    isPaid: workOrder.status === 'paid'
  };
}

function formatLocationSummary(locations, workOrder) {
  if (locations.length === 0) {
    return formatLegacyLocation(workOrder) || 'No location set';
  }

  if (workOrder.locationMode === 'pickup_delivery') {
    const pickup = locations.find((location) => location.role === 'pickup');
    const delivery = locations.find((location) => location.role === 'delivery');
    return [
      pickup ? `Pickup: ${formatAddressLine(pickup)}` : '',
      delivery ? `Delivery: ${formatAddressLine(delivery)}` : ''
    ].filter(Boolean).join(' -> ');
  }

  const service = locations.find((location) => location.role === 'service') || locations[0];
  return service ? formatAddressLine(service) : 'No location set';
}

function formatLegacyLocation(workOrder) {
  return [
    workOrder.serviceLocationName,
    workOrder.serviceAddressLine1,
    [workOrder.serviceCity, workOrder.serviceProvince, workOrder.servicePostalCode].filter(Boolean).join(', ')
  ].filter(Boolean).join(' / ');
}

function formatAddressLine(location) {
  return [
    location.label,
    location.addressLine1,
    [location.city, location.province, location.postalCode].filter(Boolean).join(', ')
  ].filter(Boolean).join(' / ');
}

function formatScheduleSummary(visit) {
  if (!visit || visit.scheduleState === 'unscheduled') {
    return 'Unscheduled';
  }

  return [formatDateOnly(visit.scheduledDate), formatVisitWindow(visit)].filter(Boolean).join(' / ');
}

function formatLocation(location) {
  return location ? { ...location } : null;
}

function formatVisit(visit) {
  return visit ? {
    ...visit,
    visitType: visit.visitType || 'service',
    locationRole: visit.locationRole || inferVisitLocationRole(visit.visitType || 'service'),
    scheduledDate: visit.scheduledDate ? String(visit.scheduledDate).slice(0, 10) : null,
    startTime: visit.startTime ? String(visit.startTime).slice(0, 5) : null,
    endTime: visit.endTime ? String(visit.endTime).slice(0, 5) : null
  } : null;
}

function groupBy(rows, key) {
  const map = new Map();

  for (const row of rows) {
    const groupKey = row[key];

    if (!map.has(groupKey)) {
      map.set(groupKey, []);
    }

    map.get(groupKey).push(row);
  }

  return map;
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

function readAny(input, fieldName) {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(input, fieldName)) {
    return input[fieldName];
  }

  return input[toSnakeCase(fieldName)];
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

function formatDateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

function isValidationConstraintError(error) {
  return error.code === '23514' || error.code === '23503' || error.code === '23502';
}
