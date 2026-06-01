import express from 'express';
import { pool } from '../../src/db.mjs';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SHORT_TEXT_LENGTH = 260;
const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 400;

const ASSIGNMENT_OPTIONS = [
  ['hbs_internal', 'HBS Internal'],
  ['hbs_external', 'HBS External']
];

const VISIT_STATUS_OPTIONS = [
  ['pending', 'Pending'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled']
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

const VIEW_OPTIONS = [
  ['today', 'Today'],
  ['upcoming', 'Upcoming'],
  ['unscheduled', 'Unscheduled'],
  ['completed', 'Completed / follow-up']
];

const ASSIGNMENTS = new Set(ASSIGNMENT_OPTIONS.map(([value]) => value));
const VISIT_STATUSES = new Set(VISIT_STATUS_OPTIONS.map(([value]) => value));
const SCHEDULE_STATES = new Set(SCHEDULE_STATE_OPTIONS.map(([value]) => value));
const BOARD_VIEWS = new Set(VIEW_OPTIONS.map(([value]) => value));

const boardCategorySql = `
  case
    when v.visit_status = 'cancelled' or w.status = 'cancelled' then 'completed'
    when v.visit_status = 'completed' then 'completed'
    when v.schedule_state <> 'booked' or v.scheduled_date is null then 'unscheduled'
    when v.scheduled_date = current_date then 'today'
    when v.scheduled_date > current_date then 'upcoming'
    else 'completed'
  end
`;

export const scheduleBoardApiRouter = express.Router();

scheduleBoardApiRouter.get('/visits', async (req, res, next) => {
  try {
    const { whereSql, values, limit } = buildVisitFilters(req.query || {});
    const [visitsResult, summaryResult] = await Promise.all([
      pool.query(
        `
          select
            v.id,
            v.work_order_id as "workOrderId",
            v.visit_number as "visitNumber",
            v.visit_title as "visitTitle",
            v.visit_type as "visitType",
            v.schedule_state as "scheduleState",
            v.scheduled_date as "scheduledDate",
            v.arrival_window_label as "arrivalWindowLabel",
            v.start_time as "startTime",
            v.end_time as "endTime",
            v.anytime,
            v.assigned_to as "assignedTo",
            v.location_role as "locationRole",
            v.primary_location_id as "primaryLocationId",
            v.secondary_location_id as "secondaryLocationId",
            v.visit_status as "visitStatus",
            v.visit_instructions as "visitInstructions",
            v.timing_notes as "timingNotes",
            v.completion_notes as "completionNotes",
            v.cancellation_reason as "cancellationReason",
            v.completed_at as "completedAt",
            v.cancelled_at as "cancelledAt",
            v.created_at as "createdAt",
            v.updated_at as "updatedAt",
            ${boardCategorySql} as "boardCategory",
            w.work_order_number as "workOrderNumber",
            w.title as "workOrderTitle",
            w.calendar_title as "calendarTitle",
            w.customer_display_snapshot as "customerDisplaySnapshot",
            w.contact_person_name as "contactPersonName",
            w.contact_person_phone as "contactPersonPhone",
            w.contact_person_email as "contactPersonEmail",
            w.customer_name as "customerName",
            w.customer_company as "customerCompany",
            w.customer_phone as "customerPhone",
            w.customer_email as "customerEmail",
            w.status as "workOrderStatus",
            w.priority as "workOrderPriority",
            w.location_mode as "locationMode",
            w.service_details as "serviceDetails",
            w.service_location_name as "legacyLocationName",
            w.service_address_line_1 as "legacyAddressLine1",
            w.service_address_line_2 as "legacyAddressLine2",
            w.service_city as "legacyCity",
            w.service_province as "legacyProvince",
            w.service_postal_code as "legacyPostalCode",
            jt.name as "jobTypeName",
            jt.abbreviation as "jobTypeAbbreviation",
            cc.contact_number as "customerContactNumber",
            cc.display_name as "customerContactName",
            cc.company_name as "customerContactCompanyName",
            coalesce(pl.role, fl.role) as "primaryLocationRole",
            coalesce(pl.label, fl.label) as "primaryLocationLabel",
            coalesce(pl.address_line_1, fl.address_line_1) as "primaryAddressLine1",
            coalesce(pl.address_line_2, fl.address_line_2) as "primaryAddressLine2",
            coalesce(pl.city, fl.city) as "primaryCity",
            coalesce(pl.province, fl.province) as "primaryProvince",
            coalesce(pl.postal_code, fl.postal_code) as "primaryPostalCode",
            coalesce(pl.site_access_notes, fl.site_access_notes) as "primarySiteAccessNotes",
            coalesce(pl.parking_notes, fl.parking_notes) as "primaryParkingNotes",
            coalesce(pl.stairs_elevator_notes, fl.stairs_elevator_notes) as "primaryStairsElevatorNotes",
            coalesce(pl.room_location_notes, fl.room_location_notes) as "primaryRoomLocationNotes",
            sl.role as "secondaryLocationRole",
            sl.label as "secondaryLocationLabel",
            sl.address_line_1 as "secondaryAddressLine1",
            sl.address_line_2 as "secondaryAddressLine2",
            sl.city as "secondaryCity",
            sl.province as "secondaryProvince",
            sl.postal_code as "secondaryPostalCode"
          from job_work_order_visits v
          join job_work_orders w on w.id = v.work_order_id
          left join job_work_order_types jt on jt.id = w.job_type_id
          left join customer_contacts cc on cc.id = w.customer_contact_id
          left join job_work_order_locations pl on pl.id = v.primary_location_id
          left join job_work_order_locations sl on sl.id = v.secondary_location_id
          left join lateral (
            select
              l.role,
              l.label,
              l.address_line_1,
              l.address_line_2,
              l.city,
              l.province,
              l.postal_code,
              l.site_access_notes,
              l.parking_notes,
              l.stairs_elevator_notes,
              l.room_location_notes
            from job_work_order_locations l
            where l.work_order_id = w.id
            order by
              case when l.role = coalesce(v.location_role, 'service') then 0 else 1 end,
              case l.role
                when 'service' then 0
                when 'pickup' then 1
                when 'delivery' then 2
                else 3
              end,
              l.created_at asc
            limit 1
          ) fl on true
          ${whereSql}
          order by
            case (${boardCategorySql})
              when 'today' then 0
              when 'upcoming' then 1
              when 'unscheduled' then 2
              else 3
            end,
            v.scheduled_date asc nulls last,
            v.start_time asc nulls last,
            w.work_order_number asc,
            v.visit_number asc
          limit ${limit}
        `,
        values
      ),
      pool.query(
        `
          select
            count(*) filter (where board_category = 'today')::integer as "todayCount",
            count(*) filter (where board_category = 'upcoming')::integer as "upcomingCount",
            count(*) filter (where board_category = 'unscheduled')::integer as "unscheduledCount",
            count(*) filter (where board_category = 'completed')::integer as "completedCount",
            count(*)::integer as "totalCount"
          from (
            select ${boardCategorySql} as board_category
            from job_work_order_visits v
            join job_work_orders w on w.id = v.work_order_id
            left join job_work_order_types jt on jt.id = w.job_type_id
            left join customer_contacts cc on cc.id = w.customer_contact_id
            ${whereSql}
          ) categorized
        `,
        values
      )
    ]);

    const visits = visitsResult.rows.map(formatScheduleVisit);
    const summary = summaryResult.rows[0] || summarizeVisits(visits);

    return res.json({
      visits,
      cards: visits,
      summary,
      options: {
        views: toOptionObjects(VIEW_OPTIONS),
        assignments: toOptionObjects(ASSIGNMENT_OPTIONS),
        visitStatuses: toOptionObjects(VISIT_STATUS_OPTIONS),
        scheduleStates: toOptionObjects(SCHEDULE_STATE_OPTIONS),
        visitTypes: toOptionObjects(VISIT_TYPE_OPTIONS)
      },
      limit
    });
  } catch (error) {
    return next(error);
  }
});

function buildVisitFilters(query) {
  const conditions = ['w.archived_at is null'];
  const values = [];

  const visitStatus = cleanText(query.visitStatus, { maxLength: 80 });

  if (visitStatus && VISIT_STATUSES.has(visitStatus)) {
    values.push(visitStatus);
    conditions.push(`v.visit_status = $${values.length}`);
  } else {
    conditions.push("v.visit_status <> 'cancelled'");
    conditions.push("w.status <> 'cancelled'");
  }

  const assignment = cleanText(query.assignment || query.assignedTo, { maxLength: 80 });

  if (assignment && ASSIGNMENTS.has(assignment)) {
    values.push(assignment);
    conditions.push(`v.assigned_to = $${values.length}`);
  }

  const scheduleState = cleanText(query.scheduleState, { maxLength: 80 });

  if (scheduleState && SCHEDULE_STATES.has(scheduleState)) {
    values.push(scheduleState);
    conditions.push(`v.schedule_state = $${values.length}`);
  }

  const view = cleanText(query.view, { maxLength: 80 });

  if (view && BOARD_VIEWS.has(view)) {
    if (view === 'today') {
      conditions.push("v.schedule_state = 'booked'");
      conditions.push('v.scheduled_date = current_date');
      conditions.push("v.visit_status <> 'cancelled'");
    } else if (view === 'upcoming') {
      conditions.push("v.schedule_state = 'booked'");
      conditions.push('v.scheduled_date > current_date');
      conditions.push("v.visit_status <> 'cancelled'");
    } else if (view === 'unscheduled') {
      conditions.push("(v.schedule_state = 'unscheduled' or v.scheduled_date is null)");
      conditions.push("v.visit_status <> 'cancelled'");
    } else if (view === 'completed') {
      conditions.push(`(
        v.visit_status = 'completed'
        or (
          v.schedule_state = 'booked'
          and v.scheduled_date < current_date
          and v.visit_status <> 'cancelled'
        )
      )`);
    }
  }

  const dateFrom = cleanText(query.dateFrom, { maxLength: 20 });

  if (isValidDateOnly(dateFrom)) {
    values.push(dateFrom);
    conditions.push(`v.scheduled_date >= $${values.length}`);
  }

  const dateTo = cleanText(query.dateTo, { maxLength: 20 });

  if (isValidDateOnly(dateTo)) {
    values.push(dateTo);
    conditions.push(`v.scheduled_date <= $${values.length}`);
  }

  const search = cleanText(query.search, { maxLength: 160 });

  if (search) {
    values.push(`%${search}%`);
    const index = values.length;
    conditions.push(`(
      w.work_order_number ilike $${index}
      or w.title ilike $${index}
      or coalesce(w.calendar_title, '') ilike $${index}
      or coalesce(w.customer_display_snapshot, '') ilike $${index}
      or w.customer_name ilike $${index}
      or coalesce(w.customer_company, '') ilike $${index}
      or coalesce(w.contact_person_name, '') ilike $${index}
      or coalesce(w.contact_person_phone, '') ilike $${index}
      or coalesce(w.contact_person_email, '') ilike $${index}
      or coalesce(w.customer_phone, '') ilike $${index}
      or coalesce(w.customer_email, '') ilike $${index}
      or coalesce(w.service_details, '') ilike $${index}
      or coalesce(jt.name, '') ilike $${index}
      or coalesce(jt.abbreviation, '') ilike $${index}
      or coalesce(cc.contact_number, '') ilike $${index}
      or coalesce(cc.display_name, '') ilike $${index}
      or coalesce(cc.company_name, '') ilike $${index}
      or coalesce(v.visit_title, '') ilike $${index}
      or coalesce(v.visit_instructions, '') ilike $${index}
      or coalesce(v.timing_notes, '') ilike $${index}
      or coalesce(v.completion_notes, '') ilike $${index}
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
    )`);
  }

  return {
    whereSql: conditions.length > 0 ? `where ${conditions.join(' and ')}` : '',
    values,
    limit: readLimit(query.limit)
  };
}

function formatScheduleVisit(row) {
  const primaryLocation = formatLocation(row, 'primary');
  const secondaryLocation = formatLocation(row, 'secondary');
  const customerName = row.customerDisplaySnapshot
    || row.customerContactName
    || row.customerName
    || row.contactPersonName
    || 'Customer not set';
  const customerCompany = row.customerCompany || row.customerContactCompanyName || '';
  const phone = row.contactPersonPhone || row.customerPhone || '';
  const email = row.contactPersonEmail || row.customerEmail || '';
  const visitWindow = formatVisitWindow(row);
  const locationSummary = formatLocationSummary(row, primaryLocation, secondaryLocation);
  const title = row.visitTitle || row.calendarTitle || row.workOrderTitle || row.workOrderNumber;

  return {
    id: row.id,
    workOrderId: row.workOrderId,
    boardCategory: row.boardCategory || 'unscheduled',
    visitNumber: row.visitNumber,
    visitTitle: row.visitTitle,
    visitType: row.visitType || 'service',
    visitTypeLabel: formatVisitType(row.visitType || 'service'),
    scheduleState: row.scheduleState || 'unscheduled',
    scheduleStateLabel: formatScheduleState(row.scheduleState || 'unscheduled'),
    scheduledDate: formatDateOnly(row.scheduledDate),
    arrivalWindowLabel: row.arrivalWindowLabel || '',
    anytime: Boolean(row.anytime),
    anytimeLabel: row.anytime || row.arrivalWindowLabel === 'anytime' ? 'Anytime' : '',
    startTime: formatTime(row.startTime),
    endTime: formatTime(row.endTime),
    timeLabel: [formatTime(row.startTime), formatTime(row.endTime)].filter(Boolean).join(' - '),
    windowLabel: visitWindow,
    assignedTo: row.assignedTo || 'hbs_internal',
    assignedToLabel: formatAssignment(row.assignedTo || 'hbs_internal'),
    locationRole: row.locationRole || row.primaryLocationRole || '',
    primaryLocation,
    secondaryLocation,
    locationSummary,
    visitStatus: row.visitStatus || 'pending',
    visitStatusLabel: formatVisitStatus(row.visitStatus || 'pending'),
    visitInstructions: row.visitInstructions || '',
    timingNotes: row.timingNotes || '',
    completionNotes: row.completionNotes || '',
    cancellationReason: row.cancellationReason || '',
    completedAt: row.completedAt || null,
    cancelledAt: row.cancelledAt || null,
    workOrderNumber: row.workOrderNumber,
    workOrderTitle: row.workOrderTitle,
    calendarTitle: row.calendarTitle,
    displayTitle: title,
    customerName,
    customerCompany,
    phone,
    email,
    jobTypeName: row.jobTypeName || 'Work order',
    jobTypeAbbreviation: row.jobTypeAbbreviation || '',
    serviceDetails: row.serviceDetails || '',
    workOrderStatus: row.workOrderStatus,
    workOrderStatusLabel: formatWorkOrderStatus(row.workOrderStatus),
    workOrderPriority: row.workOrderPriority || '',
    workOrderUrl: buildWorkOrderUrl(row),
    scheduleSummary: [formatDateOnly(row.scheduledDate), visitWindow].filter(Boolean).join(' / ') || 'Unscheduled',
    updatedAt: row.updatedAt || null,
    createdAt: row.createdAt || null
  };
}

function buildWorkOrderUrl(row) {
  const params = new URLSearchParams();

  if (row.workOrderId) {
    params.set('workOrderId', row.workOrderId);
  }

  if (row.workOrderNumber) {
    params.set('workOrderNumber', row.workOrderNumber);
  }

  return `/apps/jobs-work-orders${params.toString() ? `?${params}` : ''}`;
}

function formatLocation(row, prefix) {
  const label = row[`${prefix}LocationLabel`];
  const addressLine1 = row[`${prefix}AddressLine1`];
  const city = row[`${prefix}City`];
  const province = row[`${prefix}Province`];
  const postalCode = row[`${prefix}PostalCode`];

  if (![label, addressLine1, city, province, postalCode].some(Boolean)) {
    return null;
  }

  return {
    role: row[`${prefix}LocationRole`] || '',
    label: label || '',
    addressLine1: addressLine1 || '',
    addressLine2: row[`${prefix}AddressLine2`] || '',
    city: city || '',
    province: province || '',
    postalCode: postalCode || '',
    siteAccessNotes: row[`${prefix}SiteAccessNotes`] || '',
    parkingNotes: row[`${prefix}ParkingNotes`] || '',
    stairsElevatorNotes: row[`${prefix}StairsElevatorNotes`] || '',
    roomLocationNotes: row[`${prefix}RoomLocationNotes`] || ''
  };
}

function formatLocationSummary(row, primaryLocation, secondaryLocation) {
  if (primaryLocation && secondaryLocation) {
    return [
      `${formatLocationRole(primaryLocation.role)}: ${formatAddressLine(primaryLocation)}`,
      `${formatLocationRole(secondaryLocation.role)}: ${formatAddressLine(secondaryLocation)}`
    ].join(' -> ');
  }

  if (primaryLocation) {
    return formatAddressLine(primaryLocation);
  }

  return [
    row.legacyLocationName,
    row.legacyAddressLine1,
    [row.legacyCity, row.legacyProvince, row.legacyPostalCode].filter(Boolean).join(', ')
  ].filter(Boolean).join(' / ') || 'No location set';
}

function formatAddressLine(location) {
  return [
    location.label,
    location.addressLine1,
    [location.city, location.province, location.postalCode].filter(Boolean).join(', ')
  ].filter(Boolean).join(' / ');
}

function summarizeVisits(visits) {
  return {
    todayCount: visits.filter((visit) => visit.boardCategory === 'today').length,
    upcomingCount: visits.filter((visit) => visit.boardCategory === 'upcoming').length,
    unscheduledCount: visits.filter((visit) => visit.boardCategory === 'unscheduled').length,
    completedCount: visits.filter((visit) => visit.boardCategory === 'completed').length,
    totalCount: visits.length
  };
}

function readLimit(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function isValidDateOnly(value) {
  return DATE_PATTERN.test(value || '');
}

function cleanText(value, { maxLength = MAX_SHORT_TEXT_LENGTH } = {}) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim().slice(0, maxLength);
}

function formatDateOnly(value) {
  return value ? String(value).slice(0, 10) : null;
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : '';
}

function formatVisitWindow(visit) {
  if (visit.anytime || visit.arrivalWindowLabel === 'anytime') {
    return 'Anytime';
  }

  if (visit.arrivalWindowLabel) {
    return formatStatusText(visit.arrivalWindowLabel);
  }

  return [formatTime(visit.startTime), formatTime(visit.endTime)].filter(Boolean).join(' - ');
}

function formatAssignment(value) {
  return findLabel(ASSIGNMENT_OPTIONS, value) || formatStatusText(value);
}

function formatVisitStatus(value) {
  return findLabel(VISIT_STATUS_OPTIONS, value) || formatStatusText(value);
}

function formatScheduleState(value) {
  return findLabel(SCHEDULE_STATE_OPTIONS, value) || formatStatusText(value);
}

function formatVisitType(value) {
  return findLabel(VISIT_TYPE_OPTIONS, value) || formatStatusText(value);
}

function formatWorkOrderStatus(value) {
  const labels = {
    quoted: 'Quoted',
    to_be_scheduled: 'To be scheduled',
    booked: 'Booked',
    completed: 'Completed',
    invoiced: 'Invoiced',
    paid: 'Paid',
    cancelled: 'Cancelled'
  };

  return labels[value] || formatStatusText(value);
}

function formatLocationRole(value) {
  return formatStatusText(value || 'location');
}

function formatStatusText(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function findLabel(options, value) {
  return options.find(([optionValue]) => optionValue === value)?.[1] || '';
}

function toOptionObjects(options) {
  return options.map(([value, label]) => ({ value, label }));
}
