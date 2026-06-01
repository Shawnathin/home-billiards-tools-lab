import express from 'express';
import { pool } from '../../src/db.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TEXT_LENGTH = 2000;
const MAX_SHORT_TEXT_LENGTH = 260;

const STATUS_OPTIONS = [
  ['active', 'Active'],
  ['inactive', 'Inactive'],
  ['review_needed', 'Review needed'],
  ['archived', 'Archived']
];

const PREFERRED_CONTACT_METHOD_OPTIONS = [
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['text', 'Text'],
  ['unknown', 'Unknown']
];

const STATUSES = new Set(STATUS_OPTIONS.map(([value]) => value));
const PREFERRED_CONTACT_METHODS = new Set(PREFERRED_CONTACT_METHOD_OPTIONS.map(([value]) => value));

const contactSelectSql = `
  select
    c.id,
    c.contact_number as "contactNumber",
    c.contact_type_id as "contactTypeId",
    t.name as "contactTypeName",
    t.slug as "contactTypeSlug",
    c.contact_type_other as "contactTypeOther",
    c.display_name as "displayName",
    c.company_name as "companyName",
    c.phone,
    c.email,
    c.preferred_contact_method as "preferredContactMethod",
    c.address_line_1 as "addressLine1",
    c.address_line_2 as "addressLine2",
    c.city,
    c.province,
    c.postal_code as "postalCode",
    c.country,
    c.notes,
    c.tags,
    c.status,
    c.archived_at as "archivedAt",
    c.created_at as "createdAt",
    c.updated_at as "updatedAt"
  from customer_contacts c
  left join customer_contact_types t on t.id = c.contact_type_id
`;

export const customersContactsApiRouter = express.Router();

customersContactsApiRouter.get('/bootstrap', async (req, res, next) => {
  try {
    res.json({
      contactTypes: await getContactTypes(),
      statuses: toOptionObjects(STATUS_OPTIONS),
      preferredContactMethods: toOptionObjects(PREFERRED_CONTACT_METHOD_OPTIONS)
    });
  } catch (error) {
    next(error);
  }
});

customersContactsApiRouter.get('/contacts', async (req, res, next) => {
  try {
    const { whereSql, values } = buildContactFilters(req.query || {});
    const result = await pool.query(
      `
        ${contactSelectSql}
        ${whereSql}
        order by
          case when c.status = 'review_needed' then 0 else 1 end,
          case when c.status = 'archived' then 1 else 0 end,
          c.updated_at desc,
          lower(c.display_name) asc
        limit 200
      `,
      values
    );

    res.json({ contacts: result.rows.map(formatContact) });
  } catch (error) {
    next(error);
  }
});

customersContactsApiRouter.get('/contacts/:id', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid contact id is required.' });
    }

    const contact = await getContactById(id);

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found.' });
    }

    return res.json({ contact: formatContact(contact) });
  } catch (error) {
    return next(error);
  }
});

customersContactsApiRouter.post('/contacts', async (req, res, next) => {
  try {
    const normalized = await normalizeContactInput(req.body || {}, null);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const contact = await insertContact(normalized.data);
    return res.status(201).json({ contact: formatContact(contact) });
  } catch (error) {
    if (isValidationConstraintError(error) || error.code === '23505') {
      return res.status(400).json({ error: 'Contact could not be saved. Check required fields and contact number uniqueness.' });
    }

    return next(error);
  }
});

customersContactsApiRouter.patch('/contacts/:id', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid contact id is required.' });
    }

    const existing = await getContactById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Contact not found.' });
    }

    const normalized = await normalizeContactInput(req.body || {}, existing);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const contact = await updateContact(id, existing, normalized.data);
    return res.json({ contact: formatContact(contact) });
  } catch (error) {
    if (isValidationConstraintError(error) || error.code === '23505') {
      return res.status(400).json({ error: 'Contact update is missing required information.' });
    }

    return next(error);
  }
});

customersContactsApiRouter.post('/contacts/:id/archive', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid contact id is required.' });
    }

    const contact = await setContactArchived(id);

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found.' });
    }

    return res.json({ contact: formatContact(contact) });
  } catch (error) {
    return next(error);
  }
});

customersContactsApiRouter.post('/contacts/:id/reactivate', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid contact id is required.' });
    }

    const contact = await setContactActive(id);

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found.' });
    }

    return res.json({ contact: formatContact(contact) });
  } catch (error) {
    return next(error);
  }
});

customersContactsApiRouter.get('/summary', async (req, res, next) => {
  try {
    const result = await pool.query(`
      select
        count(*) filter (
          where status = 'active'
        )::integer as "activeCount",
        count(*) filter (
          where status = 'review_needed'
        )::integer as "reviewNeededCount",
        count(*) filter (
          where status = 'archived'
        )::integer as "archivedCount",
        count(*) filter (
          where status <> 'archived'
            and length(btrim(coalesce(email, ''))) = 0
        )::integer as "missingEmailCount",
        count(*) filter (
          where status <> 'archived'
            and length(btrim(coalesce(phone, ''))) = 0
        )::integer as "missingPhoneCount"
      from customer_contacts
    `);

    res.json({ summary: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

function buildContactFilters(query) {
  const conditions = [];
  const values = [];
  const includeArchived = readBoolean(query.includeArchived);

  if (readBoolean(query.reviewNeeded) === true) {
    conditions.push("c.status = 'review_needed'");
  } else {
    const status = cleanText(query.status, { maxLength: 80 });

    if (status && STATUSES.has(status)) {
      values.push(status);
      conditions.push(`c.status = $${values.length}`);
    } else if (!includeArchived) {
      conditions.push("c.status <> 'archived'");
    }
  }

  const contactTypeId = cleanText(query.contactTypeId, { maxLength: 80 });

  if (contactTypeId) {
    if (UUID_PATTERN.test(contactTypeId)) {
      values.push(contactTypeId);
      conditions.push(`c.contact_type_id = $${values.length}`);
    } else if (contactTypeId === 'custom') {
      conditions.push('c.contact_type_id is null');
    }
  }

  const preferredContactMethod = cleanText(query.preferredContactMethod, { maxLength: 80 });

  if (preferredContactMethod && PREFERRED_CONTACT_METHODS.has(preferredContactMethod)) {
    values.push(preferredContactMethod);
    conditions.push(`c.preferred_contact_method = $${values.length}`);
  }

  const city = cleanText(query.city, { maxLength: 120 });

  if (city) {
    values.push(city.toLowerCase());
    conditions.push(`lower(coalesce(c.city, '')) = $${values.length}`);
  }

  const province = cleanText(query.province, { maxLength: 120 });

  if (province) {
    values.push(province.toLowerCase());
    conditions.push(`lower(coalesce(c.province, '')) = $${values.length}`);
  }

  const search = cleanText(query.search, { maxLength: 160 });

  if (search) {
    values.push(`%${search}%`);
    const index = values.length;
    conditions.push(`(
      c.contact_number ilike $${index}
      or c.display_name ilike $${index}
      or coalesce(c.company_name, '') ilike $${index}
      or coalesce(c.phone, '') ilike $${index}
      or coalesce(c.email, '') ilike $${index}
      or coalesce(c.address_line_1, '') ilike $${index}
      or coalesce(c.address_line_2, '') ilike $${index}
      or coalesce(c.city, '') ilike $${index}
      or coalesce(c.province, '') ilike $${index}
      or coalesce(c.postal_code, '') ilike $${index}
      or coalesce(c.notes, '') ilike $${index}
      or coalesce(c.tags, '') ilike $${index}
      or coalesce(t.name, '') ilike $${index}
      or coalesce(c.contact_type_other, '') ilike $${index}
    )`);
  }

  return {
    whereSql: conditions.length > 0 ? `where ${conditions.join(' and ')}` : '',
    values
  };
}

async function insertContact(data) {
  const result = await pool.query(
    `
      insert into customer_contacts (
        contact_type_id,
        contact_type_other,
        display_name,
        company_name,
        phone,
        email,
        preferred_contact_method,
        address_line_1,
        address_line_2,
        city,
        province,
        postal_code,
        country,
        notes,
        tags,
        status,
        archived_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17
      )
      returning id
    `,
    [
      data.contactTypeId,
      data.contactTypeOther,
      data.displayName,
      data.companyName,
      data.phone,
      data.email,
      data.preferredContactMethod,
      data.addressLine1,
      data.addressLine2,
      data.city,
      data.province,
      data.postalCode,
      data.country,
      data.notes,
      data.tags,
      data.status,
      data.status === 'archived' ? new Date() : null
    ]
  );

  return getContactById(result.rows[0].id);
}

async function updateContact(id, existing, data) {
  const fields = {
    contact_type_id: data.contactTypeId,
    contact_type_other: data.contactTypeOther,
    display_name: data.displayName,
    company_name: data.companyName,
    phone: data.phone,
    email: data.email,
    preferred_contact_method: data.preferredContactMethod,
    address_line_1: data.addressLine1,
    address_line_2: data.addressLine2,
    city: data.city,
    province: data.province,
    postal_code: data.postalCode,
    country: data.country,
    notes: data.notes,
    tags: data.tags,
    status: data.status,
    archived_at: getArchivedAtForStatus(existing, data.status)
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
      update customer_contacts
      set ${assignments.join(', ')}
      where id = $${values.length}
    `,
    values
  );

  return getContactById(id);
}

async function setContactArchived(id) {
  const result = await pool.query(
    `
      update customer_contacts
      set
        status = 'archived',
        archived_at = coalesce(archived_at, now())
      where id = $1
      returning id
    `,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  return getContactById(id);
}

async function setContactActive(id) {
  const result = await pool.query(
    `
      update customer_contacts
      set
        status = 'active',
        archived_at = null
      where id = $1
      returning id
    `,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  return getContactById(id);
}

function getArchivedAtForStatus(existing, status) {
  if (status === 'archived') {
    return existing.archivedAt || new Date();
  }

  return null;
}

async function getContactById(id) {
  const result = await pool.query(
    `
      ${contactSelectSql}
      where c.id = $1
      limit 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getContactTypes() {
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
    from customer_contact_types
    where is_active = true
    order by sort_order asc, lower(name) asc
  `);

  return result.rows;
}

async function normalizeContactInput(rawInput, existing) {
  const input = rawInput || {};
  const data = {
    contactTypeId: readClean(input, existing, 'contactTypeId', { maxLength: 80 }),
    contactTypeOther: readClean(input, existing, 'contactTypeOther', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    displayName: readClean(input, existing, 'displayName', { maxLength: 180 }),
    companyName: readClean(input, existing, 'companyName', { maxLength: 180 }),
    phone: readClean(input, existing, 'phone', { maxLength: 80 }),
    email: readClean(input, existing, 'email', { maxLength: 240, lowercase: true }),
    preferredContactMethod: readClean(input, existing, 'preferredContactMethod', { maxLength: 80 }) || 'unknown',
    addressLine1: readClean(input, existing, 'addressLine1', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    addressLine2: readClean(input, existing, 'addressLine2', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    city: readClean(input, existing, 'city', { maxLength: 120 }),
    province: readClean(input, existing, 'province', { maxLength: 120 }),
    postalCode: readClean(input, existing, 'postalCode', { maxLength: 40 }),
    country: readClean(input, existing, 'country', { maxLength: 120 }) || 'Canada',
    notes: readClean(input, existing, 'notes', { maxLength: MAX_TEXT_LENGTH }),
    tags: readClean(input, existing, 'tags', { maxLength: MAX_SHORT_TEXT_LENGTH }),
    status: readClean(input, existing, 'status', { maxLength: 80 }) || 'active'
  };

  if (data.contactTypeId === 'custom' || data.contactTypeId === 'other') {
    data.contactTypeId = null;
  }

  if (data.contactTypeId) {
    data.contactTypeOther = null;
  }

  const validationError = validateContactData(data);

  if (validationError) {
    return { error: validationError };
  }

  const contactTypeError = await validateContactType(data, existing);

  if (contactTypeError) {
    return { error: contactTypeError };
  }

  return { data };
}

function validateContactData(data) {
  if (!data.displayName) {
    return 'Display name is required.';
  }

  if (!data.phone && !data.email) {
    return 'Add at least one contact method: phone or email.';
  }

  if (data.contactTypeId && !UUID_PATTERN.test(data.contactTypeId)) {
    return 'Choose a valid contact type.';
  }

  if (!data.contactTypeId && !data.contactTypeOther) {
    return 'Choose a contact type or enter another contact type.';
  }

  if (!PREFERRED_CONTACT_METHODS.has(data.preferredContactMethod)) {
    return 'Choose a valid preferred contact method.';
  }

  if (!STATUSES.has(data.status)) {
    return 'Choose a valid status.';
  }

  if (!data.country) {
    return 'Country is required.';
  }

  return '';
}

async function validateContactType(data, existing) {
  if (!data.contactTypeId) {
    return '';
  }

  const result = await pool.query(
    `
      select id, is_active as "isActive"
      from customer_contact_types
      where id = $1
      limit 1
    `,
    [data.contactTypeId]
  );
  const contactType = result.rows[0];

  if (!contactType) {
    return 'Selected contact type is unavailable.';
  }

  const contactTypeChanged = !existing || data.contactTypeId !== existing.contactTypeId;

  if (!contactType.isActive && contactTypeChanged) {
    return 'Selected contact type is unavailable.';
  }

  return '';
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

function formatContact(contact) {
  if (!contact) {
    return null;
  }

  return {
    ...contact,
    isArchived: contact.status === 'archived'
  };
}

function isValidationConstraintError(error) {
  return error.code === '23514' || error.code === '23503';
}
