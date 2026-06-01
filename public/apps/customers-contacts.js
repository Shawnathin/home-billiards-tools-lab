const endpoints = {
  bootstrap: '/api/apps/customers-contacts/bootstrap',
  contacts: '/api/apps/customers-contacts/contacts',
  contact: (id) => `/api/apps/customers-contacts/contacts/${id}`,
  related: (id) => `/api/apps/customers-contacts/contacts/${id}/related`,
  archive: (id) => `/api/apps/customers-contacts/contacts/${id}/archive`,
  reactivate: (id) => `/api/apps/customers-contacts/contacts/${id}/reactivate`,
  summary: '/api/apps/customers-contacts/summary'
};

const fallbackStatusLabels = {
  active: 'Active',
  inactive: 'Inactive',
  review_needed: 'Review needed',
  archived: 'Archived'
};

const fallbackPreferredContactMethodLabels = {
  phone: 'Phone',
  email: 'Email',
  text: 'Text',
  unknown: 'Unknown'
};

const state = {
  contactTypes: [],
  statuses: [],
  preferredContactMethods: [],
  contacts: [],
  relatedByContact: new Map(),
  searchTimer: null,
  cityTimer: null
};

const elements = {
  form: document.getElementById('contactForm'),
  formMessage: document.getElementById('contactFormMessage'),
  resetFormButton: document.getElementById('resetContactForm'),
  saveContactButton: document.getElementById('saveContactButton'),
  contactTypeSelect: document.getElementById('contactTypeSelect'),
  customContactTypeField: document.getElementById('customContactTypeField'),
  preferredContactMethodSelect: document.getElementById('preferredContactMethodSelect'),
  statusSelect: document.getElementById('statusSelect'),
  list: document.getElementById('contactList'),
  listStatus: document.getElementById('contactListStatus'),
  refreshButton: document.getElementById('refreshContacts'),
  search: document.getElementById('contactSearch'),
  statusFilter: document.getElementById('statusFilter'),
  contactTypeFilter: document.getElementById('contactTypeFilter'),
  preferredContactMethodFilter: document.getElementById('preferredContactMethodFilter'),
  cityFilter: document.getElementById('cityFilter'),
  reviewNeededFilter: document.getElementById('reviewNeededFilter'),
  includeArchivedFilter: document.getElementById('includeArchivedFilter'),
  summary: {
    activeCount: document.getElementById('activeContactCount'),
    reviewNeededCount: document.getElementById('reviewNeededContactCount'),
    archivedCount: document.getElementById('archivedContactCount'),
    missingEmailCount: document.getElementById('missingEmailContactCount'),
    missingPhoneCount: document.getElementById('missingPhoneContactCount')
  }
};

initCustomersContacts();

function initCustomersContacts() {
  bindEvents();
  loadApp();
}

function bindEvents() {
  elements.form.addEventListener('submit', handleCreateContact);
  elements.resetFormButton.addEventListener('click', resetContactForm);
  elements.contactTypeSelect.addEventListener('change', toggleCustomContactTypeField);
  elements.refreshButton.addEventListener('click', () => {
    loadSummary();
    loadContacts();
  });
  elements.list.addEventListener('click', handleContactAction);
  elements.list.addEventListener('change', handleContactCardChange);
  elements.list.addEventListener('toggle', handleRelatedActivityToggle, true);
  elements.search.addEventListener('input', () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(loadContacts, 240);
  });
  elements.cityFilter.addEventListener('input', () => {
    window.clearTimeout(state.cityTimer);
    state.cityTimer = window.setTimeout(loadContacts, 240);
  });

  for (const filter of [
    elements.statusFilter,
    elements.contactTypeFilter,
    elements.preferredContactMethodFilter,
    elements.reviewNeededFilter,
    elements.includeArchivedFilter
  ]) {
    filter.addEventListener('change', loadContacts);
  }
}

async function loadApp() {
  try {
    setFormMessage('');
    setListStatus('Loading contact references...');

    const bootstrap = await fetchJson(endpoints.bootstrap);
    state.contactTypes = bootstrap.contactTypes || [];
    state.statuses = bootstrap.statuses || [];
    state.preferredContactMethods = bootstrap.preferredContactMethods || [];

    renderReferenceOptions();
    resetContactForm();
    await Promise.all([loadSummary(), loadContacts()]);
  } catch (error) {
    setListStatus(error.message || 'Customers / Contacts could not load.');
    elements.list.replaceChildren(createEmptyState('Customers / Contacts data could not load.'));
  }
}

async function loadSummary() {
  const payload = await fetchJson(endpoints.summary);
  const summary = payload.summary || {};

  for (const [key, element] of Object.entries(elements.summary)) {
    element.textContent = String(summary[key] || 0);
  }
}

async function loadContacts() {
  const params = new URLSearchParams();
  const search = clean(elements.search.value);
  const status = elements.statusFilter.value;
  const contactTypeId = elements.contactTypeFilter.value;
  const preferredContactMethod = elements.preferredContactMethodFilter.value;
  const city = clean(elements.cityFilter.value);

  if (search) {
    params.set('search', search);
  }

  if (status) {
    params.set('status', status);
  }

  if (contactTypeId) {
    params.set('contactTypeId', contactTypeId);
  }

  if (preferredContactMethod) {
    params.set('preferredContactMethod', preferredContactMethod);
  }

  if (city) {
    params.set('city', city);
  }

  if (elements.reviewNeededFilter.checked) {
    params.set('reviewNeeded', 'true');
  }

  if (elements.includeArchivedFilter.checked) {
    params.set('includeArchived', 'true');
  }

  const url = `${endpoints.contacts}${params.toString() ? `?${params}` : ''}`;
  setListStatus('Loading contacts...');

  try {
    const payload = await fetchJson(url);
    state.contacts = payload.contacts || [];
    renderContactList();
  } catch (error) {
    setListStatus(error.message || 'Contacts could not load.');
    elements.list.replaceChildren(createEmptyState('Contacts could not load.'));
  }
}

function renderReferenceOptions() {
  replaceSelectOptions(elements.contactTypeSelect, state.contactTypes.map((contactType) => ({
    value: contactType.id,
    label: contactType.name
  })), 'Select contact type');
  elements.contactTypeSelect.append(createOption('custom', 'Custom / other'));

  replaceSelectOptions(elements.contactTypeFilter, state.contactTypes.map((contactType) => ({
    value: contactType.id,
    label: contactType.name
  })), 'All types');
  elements.contactTypeFilter.append(createOption('custom', 'Custom / other'));

  replaceSelectOptions(elements.preferredContactMethodSelect, state.preferredContactMethods, 'Select method');
  replaceSelectOptions(elements.preferredContactMethodFilter, state.preferredContactMethods, 'Any method');
  replaceSelectOptions(elements.statusSelect, state.statuses, 'Select status');

  elements.statusFilter.replaceChildren(
    createOption('', 'Active directory'),
    createOption('all', 'All statuses')
  );

  for (const status of state.statuses) {
    elements.statusFilter.append(createOption(status.value, status.label));
  }
}

function resetContactForm() {
  elements.form.reset();
  elements.statusSelect.value = 'active';
  elements.preferredContactMethodSelect.value = 'unknown';
  elements.form.elements.country.value = 'Canada';
  toggleCustomContactTypeField();
  setFormMessage('');
}

async function handleCreateContact(event) {
  event.preventDefault();

  const payload = getCreatePayload();
  const validationError = validateContactPayload(payload);

  if (validationError) {
    setFormMessage(validationError, true);
    return;
  }

  await withBusyButton(elements.saveContactButton, async () => {
    try {
      await fetchJson(endpoints.contacts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      resetContactForm();
      setFormMessage('Contact created.');
      await Promise.all([loadSummary(), loadContacts()]);
    } catch (error) {
      setFormMessage(error.message || 'Contact could not be created.', true);
    }
  });
}

function getCreatePayload() {
  const formData = new FormData(elements.form);
  const payload = {};

  for (const [key, value] of formData.entries()) {
    payload[key] = value;
  }

  if (payload.contactTypeId === 'custom') {
    payload.contactTypeId = null;
  }

  return payload;
}

function validateContactPayload(payload) {
  if (!clean(payload.displayName)) {
    return 'Display name is required.';
  }

  if (!clean(payload.phone) && !clean(payload.email)) {
    return 'Add a phone number or email.';
  }

  if (!clean(payload.contactTypeId) && !clean(payload.contactTypeOther)) {
    return 'Choose a contact type or enter another contact type.';
  }

  if (!clean(payload.preferredContactMethod)) {
    return 'Choose a preferred contact method.';
  }

  if (!clean(payload.status)) {
    return 'Choose a status.';
  }

  return '';
}

function renderContactList() {
  elements.list.replaceChildren();

  if (state.contacts.length === 0) {
    elements.list.append(createEmptyState('No contacts match the current filters.'));
    setListStatus('No contacts found.');
    return;
  }

  setListStatus(`${state.contacts.length} contact${state.contacts.length === 1 ? '' : 's'} shown.`);

  for (const contact of state.contacts) {
    elements.list.append(createContactCard(contact));
  }
}

function createContactCard(contact) {
  const card = document.createElement('article');
  card.className = `contacts-contact-card${contact.isArchived ? ' is-archived' : ''}`;
  card.dataset.contactId = contact.id;

  const header = document.createElement('div');
  header.className = 'contacts-card-header';

  const title = document.createElement('div');
  title.className = 'contacts-card-title';
  const contactNumber = document.createElement('span');
  contactNumber.textContent = contact.contactNumber;
  const name = document.createElement('h3');
  name.textContent = contact.displayName;
  title.append(contactNumber, name);

  if (contact.companyName) {
    const company = document.createElement('p');
    company.textContent = contact.companyName;
    title.append(company);
  }

  const statusArea = document.createElement('div');
  statusArea.className = 'contacts-status-area';
  statusArea.append(createPreferredPill(contact.preferredContactMethod), createStatusPill(contact.status));

  header.append(title, statusArea);

  const meta = document.createElement('div');
  meta.className = 'contacts-card-meta';
  meta.append(
    createMetaItem('Contact type', formatContactType(contact)),
    createMetaItem('Phone / email', [contact.phone, contact.email].filter(Boolean).join(' / ')),
    createMetaItem('Preferred', formatPreferredContactMethod(contact.preferredContactMethod)),
    createMetaItem('Address', formatAddress(contact)),
    createMetaItem('City / province', [contact.city, contact.province].filter(Boolean).join(', ')),
    createMetaItem('Tags', contact.tags)
  );

  const timestamps = document.createElement('div');
  timestamps.className = 'contacts-timestamp-row';
  const timestampItems = [
    createTimestamp('Created', contact.createdAt),
    createTimestamp('Updated', contact.updatedAt),
    createTimestamp('Archived', contact.archivedAt)
  ].filter(Boolean);

  if (timestampItems.length > 0) {
    timestamps.append(...timestampItems);
  } else {
    timestamps.classList.add('is-hidden');
  }

  const notes = createNotesBlock(contact);
  const relatedActivity = createRelatedActivityPanel(contact);
  const controls = createContactControls(contact);

  card.append(header, meta, timestamps, notes, relatedActivity, controls);
  return card;
}

function createStatusPill(status) {
  const pill = document.createElement('span');
  pill.className = `contacts-status-pill status-${status}`;
  pill.textContent = formatStatus(status);
  return pill;
}

function createPreferredPill(method) {
  const pill = document.createElement('span');
  pill.className = `contacts-preferred-pill preferred-${method || 'unknown'}`;
  pill.textContent = formatPreferredContactMethod(method);
  return pill;
}

function createContactControls(contact) {
  const details = document.createElement('details');
  details.className = 'contacts-edit-panel';

  const summary = document.createElement('summary');
  summary.textContent = 'Edit contact';

  const controls = document.createElement('div');
  controls.className = 'contacts-card-controls';

  const topGrid = document.createElement('div');
  topGrid.className = 'contacts-control-grid';

  topGrid.append(
    createInputControl('Display name', 'displayName', contact.displayName || ''),
    createInputControl('Company name', 'companyName', contact.companyName || ''),
    createInputControl('Phone', 'phone', contact.phone || '', 'tel'),
    createInputControl('Email', 'email', contact.email || '', 'email'),
    createSelectControl('Preferred contact method', 'preferredContactMethod', state.preferredContactMethods, contact.preferredContactMethod || 'unknown'),
    createSelectControl('Status', 'status', state.statuses, contact.status || 'active')
  );

  const contactTypeOptions = state.contactTypes.map((contactType) => ({
    value: contactType.id,
    label: contactType.name
  }));

  if (contact.contactTypeId && !contactTypeOptions.some((option) => option.value === contact.contactTypeId)) {
    contactTypeOptions.push({
      value: contact.contactTypeId,
      label: contact.contactTypeName || 'Existing contact type'
    });
  }

  contactTypeOptions.push({ value: 'custom', label: 'Custom / other' });

  const contactTypeSelect = createSelectControl(
    'Contact type',
    'contactTypeId',
    contactTypeOptions,
    contact.contactTypeId || 'custom'
  );

  const customTypeControl = createInputControl('Other contact type', 'contactTypeOther', contact.contactTypeOther || '');
  customTypeControl.dataset.contactTypeOtherField = 'true';
  customTypeControl.classList.toggle('is-hidden', Boolean(contact.contactTypeId));

  const addressGrid = document.createElement('div');
  addressGrid.className = 'contacts-control-grid';
  addressGrid.append(
    contactTypeSelect,
    customTypeControl,
    createInputControl('Address line 1', 'addressLine1', contact.addressLine1 || ''),
    createInputControl('Address line 2', 'addressLine2', contact.addressLine2 || ''),
    createInputControl('City', 'city', contact.city || ''),
    createInputControl('Province', 'province', contact.province || ''),
    createInputControl('Postal code', 'postalCode', contact.postalCode || ''),
    createInputControl('Country', 'country', contact.country || 'Canada')
  );

  const notesGrid = document.createElement('div');
  notesGrid.className = 'contacts-control-notes-grid';
  notesGrid.append(
    createTextareaControl('Notes', 'notes', contact.notes || ''),
    createInputControl('Tags', 'tags', contact.tags || '')
  );

  const actions = document.createElement('div');
  actions.className = 'contacts-card-actions';
  actions.append(createActionButton('Save', 'save', contact.id, 'primary-action compact-action'));

  if (contact.isArchived) {
    actions.append(createActionButton('Reactivate', 'reactivate', contact.id));
  } else {
    actions.append(createActionButton('Archive', 'archive', contact.id, 'secondary-action compact-action danger-action'));
  }

  controls.append(topGrid, addressGrid, notesGrid, actions);
  details.append(summary, controls);
  return details;
}

function createRelatedActivityPanel(contact) {
  const details = document.createElement('details');
  details.className = 'contacts-related-panel';
  details.dataset.relatedContactId = contact.id;

  const summary = document.createElement('summary');
  summary.textContent = 'Related activity';

  const content = document.createElement('div');
  content.className = 'contacts-related-content';
  content.dataset.relatedContent = contact.id;
  content.append(createRelatedStatus('Not loaded.'));

  details.append(summary, content);
  return details;
}

async function handleRelatedActivityToggle(event) {
  const details = event.target;

  if (!details.matches?.('[data-related-contact-id]') || !details.open) {
    return;
  }

  const contactId = details.dataset.relatedContactId;
  const content = details.querySelector('[data-related-content]');

  if (!contactId || !content) {
    return;
  }

  if (state.relatedByContact.has(contactId)) {
    renderRelatedActivity(content, state.relatedByContact.get(contactId));
    return;
  }

  content.replaceChildren(createRelatedStatus('Loading related activity...'));

  try {
    const payload = await fetchJson(endpoints.related(contactId));
    const related = payload.related || {};
    state.relatedByContact.set(contactId, related);
    renderRelatedActivity(content, related);
  } catch (error) {
    content.replaceChildren(createRelatedStatus(error.message || 'Related activity could not load.'));
  }
}

function renderRelatedActivity(content, related) {
  const cueRepairs = related.cueRepairs || [];
  const warrantyServiceTickets = related.warrantyServiceTickets || [];

  content.replaceChildren();

  if (cueRepairs.length === 0 && warrantyServiceTickets.length === 0) {
    content.append(createRelatedStatus('No linked activity.'));
    return;
  }

  if (cueRepairs.length > 0) {
    content.append(createRelatedGroup('Linked cue repairs', cueRepairs.map(createCueRepairRelatedRow)));
  }

  if (warrantyServiceTickets.length > 0) {
    content.append(createRelatedGroup('Linked warranty/service tickets', warrantyServiceTickets.map(createWarrantyTicketRelatedRow)));
  }
}

function createRelatedGroup(titleText, rows) {
  const group = document.createElement('section');
  group.className = 'contacts-related-group';

  const title = document.createElement('h4');
  title.textContent = titleText;

  const list = document.createElement('div');
  list.className = 'contacts-related-list';
  list.append(...rows);

  group.append(title, list);
  return group;
}

function createCueRepairRelatedRow(repair) {
  const row = document.createElement('div');
  row.className = 'contacts-related-row';

  const title = document.createElement('strong');
  title.textContent = repair.repairNumber || 'Cue repair';

  const meta = document.createElement('span');
  meta.textContent = [
    formatStatusText(repair.status),
    formatCueDescription(repair),
    formatRelatedPrice(repair)
  ].filter(Boolean).join(' / ');

  const dates = document.createElement('small');
  dates.textContent = formatRelatedDates(repair);

  row.append(title, meta, dates);
  return row;
}

function createWarrantyTicketRelatedRow(ticket) {
  const row = document.createElement('div');
  row.className = 'contacts-related-row';

  const title = document.createElement('strong');
  title.textContent = ticket.ticketNumber || 'Warranty/service ticket';

  const meta = document.createElement('span');
  meta.textContent = [
    formatStatusText(ticket.status),
    formatStatusText(ticket.priority),
    ticket.productInvolved || '',
    ticket.issueDescriptionSnippet || ''
  ].filter(Boolean).join(' / ');

  const dates = document.createElement('small');
  dates.textContent = formatRelatedDates(ticket);

  row.append(title, meta, dates);
  return row;
}

function createRelatedStatus(message) {
  const status = document.createElement('p');
  status.className = 'contacts-related-status';
  status.textContent = message;
  return status;
}

async function handleContactAction(event) {
  const button = event.target.closest('[data-contact-action]');

  if (!button) {
    return;
  }

  const contactId = button.dataset.contactId;
  const action = button.dataset.contactAction;

  await withBusyButton(button, async () => {
    try {
      if (action === 'archive') {
        await fetchJson(endpoints.archive(contactId), { method: 'POST' });
      } else if (action === 'reactivate') {
        await fetchJson(endpoints.reactivate(contactId), { method: 'POST' });
      } else if (action === 'save') {
        const payload = buildPatchPayload(contactId);
        const validationError = validateContactPayload(payload);

        if (validationError) {
          setListStatus(validationError, true);
          return;
        }

        await fetchJson(endpoints.contact(contactId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        return;
      }

      await Promise.all([loadSummary(), loadContacts()]);
    } catch (error) {
      setListStatus(error.message || 'Contact could not be updated.', true);
    }
  });
}

function handleContactCardChange(event) {
  const input = event.target.closest('[data-contact-field="contactTypeId"]');

  if (!input) {
    return;
  }

  const card = input.closest('[data-contact-id]');
  const customTypeControl = card?.querySelector('[data-contact-type-other-field]');

  if (customTypeControl) {
    customTypeControl.classList.toggle('is-hidden', input.value !== 'custom');
  }
}

function buildPatchPayload(contactId) {
  const card = getContactCard(contactId);
  const contactTypeId = readCardField(card, 'contactTypeId');

  return {
    displayName: readCardField(card, 'displayName'),
    companyName: readCardField(card, 'companyName'),
    phone: readCardField(card, 'phone'),
    email: readCardField(card, 'email'),
    contactTypeId: contactTypeId === 'custom' ? null : contactTypeId,
    contactTypeOther: readCardField(card, 'contactTypeOther'),
    preferredContactMethod: readCardField(card, 'preferredContactMethod'),
    status: readCardField(card, 'status'),
    addressLine1: readCardField(card, 'addressLine1'),
    addressLine2: readCardField(card, 'addressLine2'),
    city: readCardField(card, 'city'),
    province: readCardField(card, 'province'),
    postalCode: readCardField(card, 'postalCode'),
    country: readCardField(card, 'country') || 'Canada',
    notes: readCardField(card, 'notes'),
    tags: readCardField(card, 'tags')
  };
}

function getContactCard(contactId) {
  return Array.from(elements.list.querySelectorAll('[data-contact-id]'))
    .find((card) => card.dataset.contactId === contactId);
}

function readCardField(card, fieldName) {
  return card?.querySelector(`[data-contact-field="${fieldName}"]`)?.value || '';
}

function createNotesBlock(contact) {
  const notes = document.createElement('div');
  notes.className = 'contacts-notes-block';

  if (contact.notes) {
    notes.append(createNote('Notes', contact.notes));
  }

  if (notes.childElementCount === 0) {
    notes.classList.add('is-hidden');
  }

  return notes;
}

function createNote(label, value) {
  const note = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = `${label}: `;
  const text = document.createElement('span');
  text.textContent = value;
  note.append(strong, text);
  return note;
}

function createMetaItem(label, value) {
  const item = document.createElement('div');
  item.className = 'contacts-meta-item';

  const labelElement = document.createElement('span');
  labelElement.textContent = label;

  const valueElement = document.createElement('strong');
  valueElement.textContent = value || 'Not set';

  item.append(labelElement, valueElement);
  return item;
}

function createTimestamp(label, value) {
  if (!value) {
    return null;
  }

  const item = document.createElement('span');
  item.textContent = `${label}: ${formatDate(value)}`;
  return item;
}

function createActionButton(label, action, contactId, className = 'secondary-action compact-action') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.contactAction = action;
  button.dataset.contactId = contactId;
  button.textContent = label;
  return button;
}

function createInputControl(label, fieldName, value, type = 'text') {
  const labelElement = document.createElement('label');
  labelElement.textContent = label;

  const input = document.createElement('input');
  input.type = type;
  input.value = value;
  input.dataset.contactField = fieldName;

  labelElement.append(input);
  return labelElement;
}

function createTextareaControl(label, fieldName, value) {
  const labelElement = document.createElement('label');
  labelElement.textContent = label;

  const textarea = document.createElement('textarea');
  textarea.rows = 3;
  textarea.value = value;
  textarea.dataset.contactField = fieldName;

  labelElement.append(textarea);
  return labelElement;
}

function createSelectControl(label, fieldName, options, selectedValue) {
  const labelElement = document.createElement('label');
  labelElement.textContent = label;

  const select = document.createElement('select');
  select.dataset.contactField = fieldName;
  appendOptions(select, options, selectedValue);

  labelElement.append(select);
  return labelElement;
}

function appendOptions(select, options, selectedValue) {
  select.replaceChildren();

  for (const option of options) {
    const element = createOption(option.value, option.label);

    if (option.value === selectedValue) {
      element.selected = true;
    }

    select.append(element);
  }
}

function replaceSelectOptions(select, options, placeholder) {
  select.replaceChildren(createOption('', placeholder));

  for (const option of options) {
    select.append(createOption(option.value, option.label));
  }
}

function createOption(value, label) {
  const option = document.createElement('option');
  option.value = clean(value);
  option.textContent = label;
  return option;
}

function createEmptyState(message) {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.textContent = message;
  return emptyState;
}

function toggleCustomContactTypeField() {
  const showCustom = elements.contactTypeSelect.value === 'custom';
  elements.customContactTypeField.classList.toggle('is-hidden', !showCustom);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });

  const contentType = response.headers.get('content-type') || '';

  if (response.redirected || contentType.includes('text/html')) {
    window.location.href = '/';
    throw new Error('Please log in again.');
  }

  let payload = null;

  if (contentType.includes('application/json')) {
    payload = await response.json();
  }

  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed.');
  }

  return payload || {};
}

async function withBusyButton(button, callback) {
  if (!button) {
    await callback();
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Saving...';

  try {
    await callback();
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function setFormMessage(message, isError = false) {
  elements.formMessage.textContent = message;
  elements.formMessage.classList.toggle('is-error', Boolean(isError));
}

function setListStatus(message, isError = false) {
  elements.listStatus.textContent = message;
  elements.listStatus.classList.toggle('is-error', Boolean(isError));
}

function formatContactType(contact) {
  return contact.contactTypeName || contact.contactTypeOther || 'Custom / other';
}

function formatAddress(contact) {
  const locality = [contact.city, contact.province, contact.postalCode].filter(Boolean).join(', ');
  return [
    contact.addressLine1,
    contact.addressLine2,
    locality,
    contact.country
  ].filter(Boolean).join(' / ');
}

function formatStatus(status) {
  const match = state.statuses.find((option) => option.value === status);
  return match?.label || fallbackStatusLabels[status] || clean(status).replaceAll('_', ' ') || 'Unknown';
}

function formatPreferredContactMethod(method) {
  const match = state.preferredContactMethods.find((option) => option.value === method);
  return match?.label || fallbackPreferredContactMethodLabels[method] || clean(method).replaceAll('_', ' ') || 'Unknown';
}

function formatCueDescription(repair) {
  return [
    repair.cueBrand,
    repair.cueModel,
    repair.cueDescription
  ].filter(Boolean).join(' / ');
}

function formatRelatedPrice(repair) {
  const values = [];

  if (Number.isFinite(Number(repair.estimateCents)) && Number(repair.estimateCents) > 0) {
    values.push(`Estimate ${formatCents(repair.estimateCents)}`);
  }

  if (Number.isFinite(Number(repair.finalPriceCents)) && Number(repair.finalPriceCents) > 0) {
    values.push(`Final ${formatCents(repair.finalPriceCents)}`);
  }

  return values.join(' / ');
}

function formatRelatedDates(record) {
  return [
    record.createdAt ? `Created ${formatDate(record.createdAt)}` : '',
    record.updatedAt ? `Updated ${formatDate(record.updatedAt)}` : ''
  ].filter(Boolean).join(' / ');
}

function formatStatusText(value) {
  return clean(value).replaceAll('_', ' ');
}

function formatCents(cents) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD'
  }).format(Number(cents || 0) / 100);
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function clean(value) {
  return String(value || '').trim();
}
