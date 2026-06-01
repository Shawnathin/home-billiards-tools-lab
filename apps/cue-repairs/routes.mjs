import express from 'express';
import {
  ContactCaptureValidationError,
  resolveIntakeCustomerContact
} from '../../src/customer-contact-capture.mjs';
import { pool } from '../../src/db.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TEXT_LENGTH = 2000;
const MAX_MONEY_CENTS = 99999999;
const STATUSES = new Set([
  'received',
  'in_progress',
  'needs_attention',
  'ready_for_pickup',
  'picked_up',
  'cancelled'
]);
const CLOSED_STATUSES = new Set(['picked_up', 'cancelled']);

const repairSelect = `
  select
    j.id,
    j.repair_number as "repairNumber",
    j.customer_name as "customerName",
    j.customer_phone as "customerPhone",
    j.customer_email as "customerEmail",
    j.customer_contact_id as "customerContactId",
    cc.contact_number as "customerContactNumber",
    cc.display_name as "customerContactName",
    cc.company_name as "customerContactCompanyName",
    j.cue_brand as "cueBrand",
    j.cue_model as "cueModel",
    j.cue_description as "cueDescription",
    j.repair_type_id as "repairTypeId",
    t.name as "repairTypeName",
    j.repair_type_other as "repairTypeOther",
    j.intake_notes as "intakeNotes",
    j.internal_notes as "internalNotes",
    j.status,
    j.estimate_cents as "estimateCents",
    j.final_price_cents as "finalPriceCents",
    j.estimate_approved as "estimateApproved",
    j.completed_at as "completedAt",
    j.customer_contacted_at as "customerContactedAt",
    j.picked_up_at as "pickedUpAt",
    j.cancelled_at as "cancelledAt",
    j.created_at as "createdAt",
    j.updated_at as "updatedAt"
  from cue_repair_jobs j
  left join cue_repair_types t on t.id = j.repair_type_id
  left join customer_contacts cc on cc.id = j.customer_contact_id
`;

export const cueRepairsApiRouter = express.Router();

cueRepairsApiRouter.get('/types', async (req, res, next) => {
  try {
    const result = await pool.query(`
      select
        id,
        name,
        description,
        default_price_cents as "defaultPriceCents",
        is_active as "isActive",
        sort_order as "sortOrder",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from cue_repair_types
      where is_active = true
      order by sort_order asc, lower(name) asc
    `);

    res.json({ types: result.rows });
  } catch (error) {
    next(error);
  }
});

cueRepairsApiRouter.get('/repairs', async (req, res, next) => {
  try {
    const { whereSql, values } = buildRepairFilters(req.query || {});
    const result = await pool.query(
      `
        ${repairSelect}
        ${whereSql}
        order by j.created_at desc, j.repair_number desc
        limit 150
      `,
      values
    );

    res.json({ repairs: result.rows.map(formatRepair) });
  } catch (error) {
    next(error);
  }
});

cueRepairsApiRouter.post('/repairs', async (req, res, next) => {
  try {
    const normalized = await normalizeRepairInput(req.body || {}, null);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const repair = await insertRepair(normalized.data);
    return res.status(201).json({ repair: formatRepair(repair) });
  } catch (error) {
    if (error instanceof ContactCaptureValidationError) {
      return res.status(400).json({ error: error.message });
    }

    if (isValidationConstraintError(error)) {
      return res.status(400).json({ error: 'Repair intake is missing required information.' });
    }

    return next(error);
  }
});

cueRepairsApiRouter.patch('/repairs/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();

    if (!UUID_PATTERN.test(id)) {
      return res.status(400).json({ error: 'A valid repair id is required.' });
    }

    const existing = await getRepairById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Repair not found.' });
    }

    const normalized = await normalizeRepairInput(req.body || {}, existing);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const repair = await updateRepair(id, existing, normalized.data, req.body || {});
    return res.json({ repair: formatRepair(repair) });
  } catch (error) {
    if (isValidationConstraintError(error)) {
      return res.status(400).json({ error: 'Repair update is missing required information.' });
    }

    return next(error);
  }
});

cueRepairsApiRouter.get('/summary', async (req, res, next) => {
  try {
    const result = await pool.query(`
      select
        count(*) filter (
          where status not in ('picked_up', 'cancelled')
            and picked_up_at is null
            and cancelled_at is null
        )::integer as "openRepairCount",
        count(*) filter (
          where status = 'needs_attention'
            and picked_up_at is null
            and cancelled_at is null
        )::integer as "needsAttentionCount",
        count(*) filter (
          where status = 'ready_for_pickup'
            and picked_up_at is null
            and cancelled_at is null
        )::integer as "readyForPickupCount",
        count(*) filter (
          where customer_contacted_at is not null
            and picked_up_at is null
            and cancelled_at is null
        )::integer as "contactedNotPickedUpCount",
        count(*) filter (
          where (status = 'picked_up' or picked_up_at is not null)
            and cancelled_at is null
        )::integer as "pickedUpCount",
        count(*) filter (
          where status = 'cancelled'
            or cancelled_at is not null
        )::integer as "cancelledCount"
      from cue_repair_jobs
    `);

    res.json({ summary: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

function buildRepairFilters(query) {
  const conditions = [];
  const values = [];

  const status = cleanText(query.status, { maxLength: 80 });

  if (status && status !== 'all') {
    if (status === 'open') {
      conditions.push("j.status not in ('picked_up', 'cancelled')");
      conditions.push('j.picked_up_at is null');
      conditions.push('j.cancelled_at is null');
    } else if (STATUSES.has(status)) {
      values.push(status);
      conditions.push(`j.status = $${values.length}`);
    }
  }

  const repairTypeId = cleanText(query.repairTypeId, { maxLength: 80 });

  if (repairTypeId) {
    if (UUID_PATTERN.test(repairTypeId)) {
      values.push(repairTypeId);
      conditions.push(`j.repair_type_id = $${values.length}`);
    } else if (repairTypeId === 'custom') {
      conditions.push('j.repair_type_id is null');
    }
  }

  const search = cleanText(query.search, { maxLength: 160 });

  if (search) {
    values.push(`%${search}%`);
    const index = values.length;
    conditions.push(`(
      j.repair_number ilike $${index}
      or j.customer_name ilike $${index}
      or coalesce(j.customer_phone, '') ilike $${index}
      or coalesce(j.customer_email, '') ilike $${index}
      or coalesce(cc.contact_number, '') ilike $${index}
      or coalesce(cc.display_name, '') ilike $${index}
      or coalesce(j.cue_brand, '') ilike $${index}
      or coalesce(j.cue_model, '') ilike $${index}
      or coalesce(j.cue_description, '') ilike $${index}
      or coalesce(t.name, '') ilike $${index}
      or coalesce(j.repair_type_other, '') ilike $${index}
    )`);
  }

  return {
    whereSql: conditions.length > 0 ? `where ${conditions.join(' and ')}` : '',
    values
  };
}

async function insertRepair(data) {
  let lastError = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const client = await pool.connect();
    let repairId = null;

    try {
      await client.query('begin');

      const customerContactId = await resolveIntakeCustomerContact(client, data, {
        saveCustomerContact: data.saveCustomerContact,
        sourceNote: 'Created from Cue Repairs intake.'
      });
      repairId = await insertRepairRow(client, { ...data, customerContactId });

      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch((rollbackError) => {
        console.warn('Cue Repairs transaction rollback failed:', rollbackError.message);
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

    return getRepairById(repairId);
  }

  throw lastError;
}

async function insertRepairRow(client, data) {
  const result = await client.query(
    `
      insert into cue_repair_jobs (
        customer_name,
        customer_phone,
        customer_email,
        customer_contact_id,
        cue_brand,
        cue_model,
        cue_description,
        repair_type_id,
        repair_type_other,
        intake_notes,
        internal_notes,
        status,
        estimate_cents,
        final_price_cents,
        estimate_approved
      )
      values (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15
      )
      returning id
    `,
    [
      data.customerName,
      data.customerPhone,
      data.customerEmail,
      data.customerContactId,
      data.cueBrand,
      data.cueModel,
      data.cueDescription,
      data.repairTypeId,
      data.repairTypeOther,
      data.intakeNotes,
      data.internalNotes,
      data.status,
      data.estimateCents,
      data.finalPriceCents,
      data.estimateApproved
    ]
  );

  return result.rows[0].id;
}

async function updateRepair(id, existing, data, rawBody) {
  const timestampFields = getTimestampUpdates(existing, data.status, rawBody);
  const fields = {
    customer_name: data.customerName,
    customer_phone: data.customerPhone,
    customer_email: data.customerEmail,
    customer_contact_id: data.customerContactId,
    cue_brand: data.cueBrand,
    cue_model: data.cueModel,
    cue_description: data.cueDescription,
    repair_type_id: data.repairTypeId,
    repair_type_other: data.repairTypeOther,
    intake_notes: data.intakeNotes,
    internal_notes: data.internalNotes,
    status: data.status,
    estimate_cents: data.estimateCents,
    final_price_cents: data.finalPriceCents,
    estimate_approved: data.estimateApproved,
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
      update cue_repair_jobs
      set ${assignments.join(', ')}
      where id = $${values.length}
    `,
    values
  );

  return getRepairById(id);
}

function getTimestampUpdates(existing, status, rawBody) {
  const updates = {};
  const markingContacted =
    readBoolean(rawBody.customerContacted) === true ||
    readBoolean(rawBody.markContacted) === true;

  if (markingContacted && !existing.customerContactedAt) {
    updates.customer_contacted_at = new Date();
  }

  if (status === 'ready_for_pickup' && !existing.completedAt) {
    updates.completed_at = new Date();
  }

  if (status === 'picked_up') {
    if (!existing.completedAt) {
      updates.completed_at = new Date();
    }

    if (!existing.pickedUpAt) {
      updates.picked_up_at = new Date();
    }
  }

  if (status === 'cancelled' && !existing.cancelledAt) {
    updates.cancelled_at = new Date();
  }

  return updates;
}

async function getRepairById(id) {
  const result = await pool.query(
    `
      ${repairSelect}
      where j.id = $1
      limit 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function normalizeRepairInput(rawInput, existing) {
  const input = rawInput || {};
  const data = {
    customerName: readClean(input, existing, 'customerName', { maxLength: 180 }),
    customerPhone: readClean(input, existing, 'customerPhone', { maxLength: 80 }),
    customerEmail: readClean(input, existing, 'customerEmail', { maxLength: 240, lowercase: true }),
    customerContactId: readClean(input, existing, 'customerContactId', { maxLength: 80 }),
    saveCustomerContact: readBoolean(hasInput(input, 'saveCustomerContact') ? getInput(input, 'saveCustomerContact') : false),
    cueBrand: readClean(input, existing, 'cueBrand', { maxLength: 140 }),
    cueModel: readClean(input, existing, 'cueModel', { maxLength: 160 }),
    cueDescription: readClean(input, existing, 'cueDescription', { maxLength: MAX_TEXT_LENGTH }),
    repairTypeId: readClean(input, existing, 'repairTypeId', { maxLength: 80 }),
    repairTypeOther: readClean(input, existing, 'repairTypeOther', { maxLength: 240 }),
    intakeNotes: readClean(input, existing, 'intakeNotes', { maxLength: MAX_TEXT_LENGTH }),
    internalNotes: readClean(input, existing, 'internalNotes', { maxLength: MAX_TEXT_LENGTH }),
    status: readClean(input, existing, 'status', { maxLength: 80 }) || 'received',
    estimateCents: readMoney(input, existing, 'estimate'),
    finalPriceCents: readMoney(input, existing, 'finalPrice', { nullable: true }),
    estimateApproved: readExistingBoolean(input, existing, 'estimateApproved', false)
  };

  if (data.repairTypeId === 'custom' || data.repairTypeId === 'other') {
    data.repairTypeId = null;
  }

  if (data.customerContactId && !UUID_PATTERN.test(data.customerContactId)) {
    return { error: 'Choose a valid customer/contact link.' };
  }

  const repairTypeReferenceError = await resolveRepairTypeReference(data);

  if (repairTypeReferenceError) {
    return { error: repairTypeReferenceError };
  }

  const validationError = validateRepairData(data, { isCreate: !existing });

  if (validationError) {
    return { error: validationError };
  }

  const typeError = await validateRepairType(data, input, existing);

  if (typeError) {
    return { error: typeError };
  }

  const contactError = await validateCustomerContact(data.customerContactId);

  if (contactError) {
    return { error: contactError };
  }

  return { data };
}

function validateRepairData(data, { isCreate = false } = {}) {
  if (!data.customerName) {
    return 'Customer name is required.';
  }

  if (!data.customerPhone && !data.customerEmail) {
    return 'Add at least one contact method: phone or email.';
  }

  if (isCreate && !data.cueDescription) {
    return 'Cue description is required.';
  }

  if (!data.cueBrand && !data.cueModel && !data.cueDescription) {
    return 'Add a cue description.';
  }

  if (data.repairTypeId && !UUID_PATTERN.test(data.repairTypeId)) {
    return 'Choose a valid repair type.';
  }

  if (!data.repairTypeId && !data.repairTypeOther) {
    return 'Choose a repair type or enter a custom repair type.';
  }

  if (!STATUSES.has(data.status)) {
    return 'Choose a valid repair status.';
  }

  if (!Number.isInteger(data.estimateCents) || data.estimateCents < 0 || data.estimateCents > MAX_MONEY_CENTS) {
    return 'Estimate must be a valid non-negative amount.';
  }

  if (
    data.finalPriceCents !== null &&
    (!Number.isInteger(data.finalPriceCents) || data.finalPriceCents < 0 || data.finalPriceCents > MAX_MONEY_CENTS)
  ) {
    return 'Final price must be a valid non-negative amount.';
  }

  return '';
}

async function validateRepairType(data, input, existing) {
  if (!data.repairTypeId) {
    return '';
  }

  const result = await pool.query(
    `
      select id, name, is_active as "isActive"
      from cue_repair_types
      where id = $1
      limit 1
    `,
    [data.repairTypeId]
  );
  const repairType = result.rows[0];

  if (!repairType) {
    return 'Selected repair type is unavailable.';
  }

  const repairTypeChanged = hasInput(input, 'repairTypeId');

  if (repairTypeChanged && !repairType.isActive) {
    return 'Selected repair type is unavailable.';
  }

  if (repairType.name.toLowerCase().includes('other') && !data.repairTypeOther) {
    return 'Describe the custom repair type.';
  }

  if (!repairTypeChanged && existing?.repairTypeId === data.repairTypeId && existing?.repairTypeOther) {
    return '';
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

async function resolveRepairTypeReference(data) {
  if (!data.repairTypeId || UUID_PATTERN.test(data.repairTypeId)) {
    return '';
  }

  const submittedValue = data.repairTypeId;
  const result = await pool.query(
    `
      select id
      from cue_repair_types
      where lower(name) = lower($1)
        and is_active = true
      limit 2
    `,
    [submittedValue]
  );

  if (result.rows.length === 1) {
    data.repairTypeId = result.rows[0].id;
    console.warn('Cue Repairs resolved repairTypeId from repair type name. Check the client select option value.', {
      submittedValue
    });
    return '';
  }

  return 'Choose a valid repair type. Refresh Cue Repairs and try again if the repair type list looks stale.';
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

function readMoney(input, existing, prefix, options = {}) {
  const centsField = `${prefix}Cents`;
  const dollarsField = `${prefix}Dollars`;

  if (hasInput(input, centsField)) {
    return parseCents(getInput(input, centsField), options);
  }

  if (hasInput(input, dollarsField)) {
    return parseDollars(getInput(input, dollarsField), options);
  }

  if (existing) {
    return existing[centsField] ?? null;
  }

  return options.nullable ? null : 0;
}

function parseCents(value, options = {}) {
  if ((value === '' || value === null || value === undefined) && options.nullable) {
    return null;
  }

  const number = Number(value);

  if (!Number.isInteger(number)) {
    return NaN;
  }

  return number;
}

function parseDollars(value, options = {}) {
  if ((value === '' || value === null || value === undefined) && options.nullable) {
    return null;
  }

  const normalized = String(value || '0').replace(/[$,\s]/g, '');
  const number = Number(normalized || 0);

  if (!Number.isFinite(number)) {
    return NaN;
  }

  return Math.round(number * 100);
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

function formatRepair(repair) {
  if (!repair) {
    return null;
  }

  const estimateCents = Number(repair.estimateCents || 0);
  const finalPriceCents = repair.finalPriceCents === null ? null : Number(repair.finalPriceCents);

  return {
    ...repair,
    estimateCents,
    finalPriceCents,
    formattedEstimate: formatCents(estimateCents),
    formattedFinalPrice: finalPriceCents === null ? null : formatCents(finalPriceCents),
    isOpen: !CLOSED_STATUSES.has(repair.status) && !repair.pickedUpAt && !repair.cancelledAt
  };
}

function formatCents(cents) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD'
  }).format(Number(cents || 0) / 100);
}

function isValidationConstraintError(error) {
  return error.code === '23514' || error.code === '23503';
}
