const ACTIVE_CAPTURE_STATUSES = ['active', 'review_needed'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ContactCaptureValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContactCaptureValidationError';
  }
}

export async function resolveIntakeCustomerContact(client, data, options = {}) {
  const customerContactId = normalizeId(data.customerContactId);

  if (customerContactId) {
    if (!UUID_PATTERN.test(customerContactId)) {
      throw new ContactCaptureValidationError('Choose a valid customer/contact link.');
    }

    const isValid = await customerContactExists(client, customerContactId);

    if (!isValid) {
      throw new ContactCaptureValidationError('Selected customer/contact is unavailable.');
    }

    return customerContactId;
  }

  if (!options.saveCustomerContact) {
    return null;
  }

  const displayName = cleanText(data.customerName);
  const email = normalizeEmail(data.customerEmail);
  const phone = normalizePhone(data.customerPhone);

  if (!displayName) {
    throw new ContactCaptureValidationError('Customer name is required.');
  }

  if (!phone && !email) {
    throw new ContactCaptureValidationError('Add at least one contact method: phone or email.');
  }

  const existingContactId = await findExistingCustomerContact(client, { email, phone });

  if (existingContactId) {
    return existingContactId;
  }

  return createMinimalCustomerContact(client, {
    displayName,
    phone,
    email,
    note: options.sourceNote
  });
}

async function customerContactExists(client, customerContactId) {
  const result = await client.query(
    `
      select id
      from customer_contacts
      where id = $1
      limit 1
    `,
    [customerContactId]
  );

  return Boolean(result.rows[0]);
}

async function findExistingCustomerContact(client, { email, phone }) {
  if (email) {
    const result = await client.query(
      `
        select id
        from customer_contacts
        where status = any($2::text[])
          and lower(btrim(coalesce(email, ''))) = $1
        order by
          case when status = 'active' then 0 else 1 end,
          updated_at desc
        limit 1
      `,
      [email, ACTIVE_CAPTURE_STATUSES]
    );

    if (result.rows[0]) {
      return result.rows[0].id;
    }
  }

  if (phone) {
    const result = await client.query(
      `
        select id
        from customer_contacts
        where status = any($2::text[])
          and btrim(coalesce(phone, '')) = $1
        order by
          case when status = 'active' then 0 else 1 end,
          updated_at desc
        limit 1
      `,
      [phone, ACTIVE_CAPTURE_STATUSES]
    );

    if (result.rows[0]) {
      return result.rows[0].id;
    }
  }

  return null;
}

async function createMinimalCustomerContact(client, data) {
  const contactTypeId = await getCustomerContactTypeId(client);
  const contactTypeOther = contactTypeId ? null : 'Customer';
  const preferredContactMethod = data.phone ? 'phone' : data.email ? 'email' : 'unknown';

  const result = await client.query(
    `
      insert into customer_contacts (
        contact_type_id,
        contact_type_other,
        display_name,
        company_name,
        phone,
        email,
        preferred_contact_method,
        country,
        notes,
        status
      )
      values ($1, $2, $3, null, $4, $5, $6, 'Canada', $7, 'active')
      returning id
    `,
    [
      contactTypeId,
      contactTypeOther,
      data.displayName,
      data.phone,
      data.email,
      preferredContactMethod,
      cleanText(data.note)
    ]
  );

  return result.rows[0].id;
}

async function getCustomerContactTypeId(client) {
  const result = await client.query(`
    select id
    from customer_contact_types
    where is_active = true
      and (slug = 'demo-customer' or lower(name) = 'demo - customer')
    order by
      case when slug = 'demo-customer' then 0 else 1 end,
      sort_order asc,
      lower(name) asc
    limit 1
  `);

  return result.rows[0]?.id || null;
}

function normalizeId(value) {
  return cleanText(value);
}

function normalizeEmail(value) {
  const email = cleanText(value);
  return email ? email.toLowerCase() : null;
}

function normalizePhone(value) {
  return cleanText(value);
}

function cleanText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}
