const endpoints = {
  bootstrap: '/api/apps/warranty-service-tickets/bootstrap',
  tickets: '/api/apps/warranty-service-tickets/tickets',
  ticket: (id) => `/api/apps/warranty-service-tickets/tickets/${id}`,
  summary: '/api/apps/warranty-service-tickets/summary',
  contacts: '/api/apps/customers-contacts/contacts'
};

const fallbackStatusLabels = {
  open: 'Open',
  in_progress: 'In progress',
  needs_attention: 'Needs attention',
  waiting_on_customer: 'Waiting on customer',
  resolved: 'Resolved',
  cancelled: 'Cancelled'
};

const fallbackPriorityLabels = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent'
};

const state = {
  issueTypes: [],
  statuses: [],
  priorities: [],
  tickets: [],
  contactResults: [],
  selectedContact: null,
  searchTimer: null,
  contactSearchTimer: null
};

const elements = {
  form: document.getElementById('ticketForm'),
  formMessage: document.getElementById('ticketFormMessage'),
  resetFormButton: document.getElementById('resetTicketForm'),
  saveTicketButton: document.getElementById('saveTicketButton'),
  issueTypeSelect: document.getElementById('issueTypeSelect'),
  customIssueTypeField: document.getElementById('customIssueTypeField'),
  contactSearch: document.getElementById('ticketContactSearch'),
  contactResults: document.getElementById('ticketContactResults'),
  selectedContact: document.getElementById('ticketContactSelected'),
  clearContactButton: document.getElementById('clearTicketContactLink'),
  statusSelect: document.getElementById('statusSelect'),
  prioritySelect: document.getElementById('prioritySelect'),
  list: document.getElementById('ticketList'),
  listStatus: document.getElementById('ticketListStatus'),
  refreshButton: document.getElementById('refreshTickets'),
  search: document.getElementById('ticketSearch'),
  statusFilter: document.getElementById('statusFilter'),
  priorityFilter: document.getElementById('priorityFilter'),
  issueTypeFilter: document.getElementById('issueTypeFilter'),
  warrantyFilter: document.getElementById('warrantyFilter'),
  followUpDueFilter: document.getElementById('followUpDueFilter'),
  includeClosedFilter: document.getElementById('includeClosedFilter'),
  summary: {
    openCount: document.getElementById('openTicketCount'),
    needsAttentionCount: document.getElementById('needsAttentionCount'),
    waitingOnCustomerCount: document.getElementById('waitingOnCustomerCount'),
    followUpDueCount: document.getElementById('followUpDueCount'),
    resolvedCount: document.getElementById('resolvedTicketCount'),
    cancelledCount: document.getElementById('cancelledTicketCount')
  }
};

initWarrantyServiceTickets();

function initWarrantyServiceTickets() {
  bindEvents();
  loadApp();
}

function bindEvents() {
  elements.form.addEventListener('submit', handleCreateTicket);
  elements.resetFormButton.addEventListener('click', resetTicketForm);
  elements.issueTypeSelect.addEventListener('change', toggleCustomIssueTypeField);
  elements.contactSearch.addEventListener('input', () => {
    window.clearTimeout(state.contactSearchTimer);
    state.contactSearchTimer = window.setTimeout(searchContactsForLink, 240);
  });
  elements.contactResults.addEventListener('click', handleContactResultClick);
  elements.clearContactButton.addEventListener('click', clearSelectedContact);
  elements.refreshButton.addEventListener('click', () => {
    loadSummary();
    loadTickets();
  });
  elements.list.addEventListener('click', handleTicketAction);
  elements.search.addEventListener('input', () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(loadTickets, 240);
  });

  for (const filter of [
    elements.statusFilter,
    elements.priorityFilter,
    elements.issueTypeFilter,
    elements.warrantyFilter,
    elements.followUpDueFilter,
    elements.includeClosedFilter
  ]) {
    filter.addEventListener('change', loadTickets);
  }
}

async function loadApp() {
  try {
    setFormMessage('');
    setListStatus('Loading ticket references...');

    const bootstrap = await fetchJson(endpoints.bootstrap);
    state.issueTypes = bootstrap.issueTypes || [];
    state.statuses = bootstrap.statuses || [];
    state.priorities = bootstrap.priorities || [];

    renderReferenceOptions();
    resetTicketForm();
    await Promise.all([loadSummary(), loadTickets()]);
  } catch (error) {
    setListStatus(error.message || 'Warranty / Service Tickets could not load.');
    elements.list.replaceChildren(createEmptyState('Warranty / Service Tickets data could not load.'));
  }
}

async function loadSummary() {
  const payload = await fetchJson(endpoints.summary);
  const summary = payload.summary || {};

  for (const [key, element] of Object.entries(elements.summary)) {
    element.textContent = String(summary[key] || 0);
  }
}

async function loadTickets() {
  const params = new URLSearchParams();
  const search = clean(elements.search.value);
  const status = elements.statusFilter.value;
  const priority = elements.priorityFilter.value;
  const issueTypeId = elements.issueTypeFilter.value;
  const isWarranty = elements.warrantyFilter.value;

  if (search) {
    params.set('search', search);
  }

  if (status) {
    params.set('status', status);
  }

  if (priority) {
    params.set('priority', priority);
  }

  if (issueTypeId) {
    params.set('issueTypeId', issueTypeId);
  }

  if (isWarranty) {
    params.set('isWarranty', isWarranty);
  }

  if (elements.followUpDueFilter.checked) {
    params.set('followUpDue', 'true');
  }

  if (elements.includeClosedFilter.checked) {
    params.set('includeClosed', 'true');
  }

  const url = `${endpoints.tickets}${params.toString() ? `?${params}` : ''}`;
  setListStatus('Loading tickets...');

  try {
    const payload = await fetchJson(url);
    state.tickets = payload.tickets || [];
    renderTicketList();
  } catch (error) {
    setListStatus(error.message || 'Tickets could not load.');
    elements.list.replaceChildren(createEmptyState('Tickets could not load.'));
  }
}

function renderReferenceOptions() {
  replaceSelectOptions(elements.issueTypeSelect, state.issueTypes.map((issueType) => ({
    value: issueType.id,
    label: issueType.name
  })), 'Select issue type');
  elements.issueTypeSelect.append(createOption('custom', 'Custom issue type'));

  replaceSelectOptions(elements.issueTypeFilter, state.issueTypes.map((issueType) => ({
    value: issueType.id,
    label: issueType.name
  })), 'All types');
  elements.issueTypeFilter.append(createOption('custom', 'Custom issue types'));

  replaceSelectOptions(elements.statusSelect, state.statuses, 'Select status');
  replaceSelectOptions(elements.prioritySelect, state.priorities, 'Select priority');
  replaceSelectOptions(elements.priorityFilter, state.priorities, 'Any priority');

  elements.statusFilter.replaceChildren(
    createOption('', 'Open statuses'),
    createOption('all', 'All statuses')
  );

  for (const status of state.statuses) {
    elements.statusFilter.append(createOption(status.value, status.label));
  }
}

function resetTicketForm() {
  elements.form.reset();
  resetContactLinkSearch();
  elements.statusSelect.value = 'open';
  elements.prioritySelect.value = 'normal';
  toggleCustomIssueTypeField();
  setFormMessage('');
}

async function handleCreateTicket(event) {
  event.preventDefault();

  const payload = getCreatePayload();
  const validationError = validateCreatePayload(payload);

  if (validationError) {
    setFormMessage(validationError, true);
    return;
  }

  await withBusyButton(elements.saveTicketButton, async () => {
    try {
      await fetchJson(endpoints.tickets, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      resetTicketForm();
      setFormMessage('Ticket created.');
      await Promise.all([loadSummary(), loadTickets()]);
    } catch (error) {
      setFormMessage(error.message || 'Ticket could not be created.', true);
    }
  });
}

function getCreatePayload() {
  const formData = new FormData(elements.form);
  const payload = {};

  for (const [key, value] of formData.entries()) {
    payload[key] = value;
  }

  payload.isWarranty = Boolean(elements.form.elements.isWarranty.checked);

  if (payload.issueTypeId === 'custom') {
    payload.issueTypeId = null;
  }

  return payload;
}

function validateCreatePayload(payload) {
  if (!clean(payload.customerName)) {
    return 'Customer name is required.';
  }

  if (!clean(payload.customerPhone) && !clean(payload.customerEmail)) {
    return 'Add a phone number or email.';
  }

  if (!clean(payload.issueTypeId) && !clean(payload.issueTypeOther)) {
    return 'Choose an issue type or enter a custom issue type.';
  }

  if (!clean(payload.issueDescription)) {
    return 'Issue description is required.';
  }

  return '';
}

function renderTicketList() {
  elements.list.replaceChildren();

  if (state.tickets.length === 0) {
    elements.list.append(createEmptyState('No tickets match the current filters.'));
    setListStatus('No tickets found.');
    return;
  }

  setListStatus(`${state.tickets.length} ticket${state.tickets.length === 1 ? '' : 's'} shown.`);

  for (const ticket of state.tickets) {
    elements.list.append(createTicketCard(ticket));
  }
}

function createTicketCard(ticket) {
  const card = document.createElement('article');
  card.className = `warranty-ticket-card${ticket.isClosed ? ' is-closed' : ''}`;
  card.dataset.ticketId = ticket.id;

  const header = document.createElement('div');
  header.className = 'warranty-card-header';

  const title = document.createElement('div');
  title.className = 'warranty-card-title';
  const ticketNumber = document.createElement('span');
  ticketNumber.textContent = ticket.ticketNumber;
  const customer = document.createElement('h3');
  customer.textContent = ticket.customerName;
  title.append(ticketNumber, customer);

  const statusArea = document.createElement('div');
  statusArea.className = 'warranty-status-area';
  statusArea.append(createPriorityPill(ticket.priority), createStatusPill(ticket.status));

  header.append(title, statusArea);

  const meta = document.createElement('div');
  meta.className = 'warranty-card-meta';
  meta.append(
    createMetaItem('Contact', [ticket.customerPhone, ticket.customerEmail].filter(Boolean).join(' / ')),
    createMetaItem('Linked contact', formatLinkedContact(ticket)),
    createMetaItem('Issue type', formatIssueType(ticket)),
    createMetaItem('Product', ticket.productInvolved),
    createMetaItem('Reference', ticket.orderOrJobReference),
    createMetaItem('Warranty', ticket.isWarranty ? 'Yes' : 'No'),
    createMetaItem('Follow-up', formatDate(ticket.followUpAt))
  );

  const timestamps = document.createElement('div');
  timestamps.className = 'warranty-timestamp-row';
  const timestampItems = [
    createTimestamp('Resolved', ticket.resolvedAt),
    createTimestamp('Cancelled', ticket.cancelledAt),
    createTimestamp('Updated', ticket.updatedAt)
  ].filter(Boolean);

  if (timestampItems.length > 0) {
    timestamps.append(...timestampItems);
  } else {
    timestamps.classList.add('is-hidden');
  }

  const notes = createNotesBlock(ticket);
  const controls = createTicketControls(ticket);

  card.append(header, meta, timestamps, notes, controls);
  return card;
}

function createStatusPill(status) {
  const pill = document.createElement('span');
  pill.className = `warranty-status-pill status-${status}`;
  pill.textContent = formatStatus(status);
  return pill;
}

function createPriorityPill(priority) {
  const pill = document.createElement('span');
  pill.className = `warranty-priority-pill priority-${priority}`;
  pill.textContent = formatPriority(priority);
  return pill;
}

function createTicketControls(ticket) {
  const controls = document.createElement('div');
  controls.className = 'warranty-card-controls';

  const topGrid = document.createElement('div');
  topGrid.className = 'warranty-control-grid';

  const statusLabel = document.createElement('label');
  statusLabel.textContent = 'Status';
  const statusSelect = document.createElement('select');
  statusSelect.dataset.statusInput = ticket.id;
  appendOptions(statusSelect, state.statuses, ticket.status);
  statusLabel.append(statusSelect);

  const priorityLabel = document.createElement('label');
  priorityLabel.textContent = 'Priority';
  const prioritySelect = document.createElement('select');
  prioritySelect.dataset.priorityInput = ticket.id;
  appendOptions(prioritySelect, state.priorities, ticket.priority);
  priorityLabel.append(prioritySelect);

  const followUpLabel = document.createElement('label');
  followUpLabel.textContent = 'Follow-up date';
  const followUpInput = document.createElement('input');
  followUpInput.type = 'datetime-local';
  followUpInput.dataset.followUpInput = ticket.id;
  followUpInput.value = toDateTimeLocal(ticket.followUpAt);
  followUpLabel.append(followUpInput);

  topGrid.append(statusLabel, priorityLabel, followUpLabel);

  const notesGrid = document.createElement('div');
  notesGrid.className = 'warranty-control-notes-grid';

  const internalLabel = document.createElement('label');
  internalLabel.textContent = 'Internal notes';
  const internalNotes = document.createElement('textarea');
  internalNotes.rows = 3;
  internalNotes.dataset.internalNotesInput = ticket.id;
  internalNotes.value = ticket.internalNotes || '';
  internalLabel.append(internalNotes);

  const resolutionLabel = document.createElement('label');
  resolutionLabel.textContent = 'Resolution notes';
  const resolutionNotes = document.createElement('textarea');
  resolutionNotes.rows = 3;
  resolutionNotes.dataset.resolutionNotesInput = ticket.id;
  resolutionNotes.value = ticket.resolutionNotes || '';
  resolutionLabel.append(resolutionNotes);

  notesGrid.append(internalLabel, resolutionLabel);

  const actions = document.createElement('div');
  actions.className = 'warranty-card-actions';
  actions.append(
    createActionButton('Save', 'save', ticket.id, 'primary-action compact-action'),
    createActionButton('Resolve', 'resolve', ticket.id),
    createActionButton('Cancel', 'cancel', ticket.id, 'secondary-action compact-action danger-action')
  );

  controls.append(topGrid, notesGrid, actions);
  return controls;
}

async function handleTicketAction(event) {
  const button = event.target.closest('[data-ticket-action]');

  if (!button) {
    return;
  }

  const ticketId = button.dataset.ticketId;
  const action = button.dataset.ticketAction;
  const payload = buildPatchPayload(ticketId, action);

  if (!payload) {
    return;
  }

  await withBusyButton(button, async () => {
    try {
      await fetchJson(endpoints.ticket(ticketId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      await Promise.all([loadSummary(), loadTickets()]);
    } catch (error) {
      setListStatus(error.message || 'Ticket could not be updated.');
    }
  });
}

function buildPatchPayload(ticketId, action) {
  const statusInput = elements.list.querySelector(`[data-status-input="${ticketId}"]`);
  const priorityInput = elements.list.querySelector(`[data-priority-input="${ticketId}"]`);
  const followUpInput = elements.list.querySelector(`[data-follow-up-input="${ticketId}"]`);
  const internalNotesInput = elements.list.querySelector(`[data-internal-notes-input="${ticketId}"]`);
  const resolutionNotesInput = elements.list.querySelector(`[data-resolution-notes-input="${ticketId}"]`);

  const payload = {
    status: statusInput?.value || 'open',
    priority: priorityInput?.value || 'normal',
    followUpAt: followUpInput?.value || '',
    internalNotes: internalNotesInput?.value || '',
    resolutionNotes: resolutionNotesInput?.value || ''
  };

  if (action === 'resolve') {
    payload.status = 'resolved';
  } else if (action === 'cancel') {
    payload.status = 'cancelled';
  } else if (action !== 'save') {
    return null;
  }

  return payload;
}

async function searchContactsForLink() {
  const search = clean(elements.contactSearch.value);
  state.contactResults = [];
  elements.contactResults.replaceChildren();

  if (search.length < 2) {
    return;
  }

  const params = new URLSearchParams({ search });

  try {
    const payload = await fetchJson(`${endpoints.contacts}?${params}`);
    renderContactResults(payload.contacts || []);
  } catch (error) {
    elements.contactResults.replaceChildren(createContactResultStatus(error.message || 'Contacts could not load.'));
  }
}

function renderContactResults(contacts) {
  elements.contactResults.replaceChildren();
  state.contactResults = contacts.slice(0, 8);

  if (state.contactResults.length === 0) {
    elements.contactResults.append(createContactResultStatus('No matching contacts.'));
    return;
  }

  for (const contact of state.contactResults) {
    elements.contactResults.append(createContactResultButton(contact));
  }
}

function createContactResultButton(contact) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'warranty-contact-result';
  button.dataset.contactId = contact.id;

  const title = document.createElement('strong');
  title.textContent = formatContactLinkTitle(contact);

  const meta = document.createElement('span');
  meta.textContent = [contact.companyName, contact.phone, contact.email].filter(Boolean).join(' / ') || 'No extra contact info';

  button.append(title, meta);
  return button;
}

function createContactResultStatus(message) {
  const status = document.createElement('p');
  status.className = 'warranty-contact-result-status';
  status.textContent = message;
  return status;
}

function handleContactResultClick(event) {
  const button = event.target.closest('[data-contact-id]');

  if (!button) {
    return;
  }

  const contact = state.contactResults.find((item) => item.id === button.dataset.contactId);

  if (contact) {
    selectContactForTicket(contact);
  }
}

function selectContactForTicket(contact) {
  state.selectedContact = contact;
  elements.form.elements.customerContactId.value = contact.id || '';
  elements.form.elements.customerName.value = contact.displayName || '';
  elements.form.elements.customerPhone.value = contact.phone || '';
  elements.form.elements.customerEmail.value = contact.email || '';
  renderSelectedContact(contact);
  elements.clearContactButton.disabled = false;
  elements.contactResults.replaceChildren();
}

function renderSelectedContact(contact) {
  elements.selectedContact.replaceChildren();

  if (!contact) {
    elements.selectedContact.classList.add('is-hidden');
    return;
  }

  const title = document.createElement('strong');
  title.textContent = formatContactLinkTitle(contact);

  const meta = document.createElement('span');
  meta.textContent = [contact.companyName, contact.phone, contact.email].filter(Boolean).join(' / ') || 'Linked contact';

  elements.selectedContact.append(title, meta);
  elements.selectedContact.classList.remove('is-hidden');
}

function clearSelectedContact() {
  state.selectedContact = null;
  elements.form.elements.customerContactId.value = '';
  elements.clearContactButton.disabled = true;
  renderSelectedContact(null);
}

function resetContactLinkSearch() {
  clearSelectedContact();
  elements.contactSearch.value = '';
  state.contactResults = [];
  elements.contactResults.replaceChildren();
}

function createNotesBlock(ticket) {
  const notes = document.createElement('div');
  notes.className = 'warranty-notes-block';

  notes.append(createNote('Issue', ticket.issueDescription || 'Not set'));

  if (ticket.internalNotes) {
    notes.append(createNote('Internal notes', ticket.internalNotes));
  }

  if (ticket.resolutionNotes) {
    notes.append(createNote('Resolution', ticket.resolutionNotes));
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
  item.className = 'warranty-meta-item';

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

function createActionButton(label, action, ticketId, className = 'secondary-action compact-action') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.ticketAction = action;
  button.dataset.ticketId = ticketId;
  button.textContent = label;
  return button;
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

function toggleCustomIssueTypeField() {
  const showCustom = elements.issueTypeSelect.value === 'custom';
  elements.customIssueTypeField.classList.toggle('is-hidden', !showCustom);
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
  elements.formMessage.classList.toggle('is-error', isError);
}

function setListStatus(message) {
  elements.listStatus.textContent = message;
}

function formatIssueType(ticket) {
  if (ticket.issueTypeName && ticket.issueTypeOther) {
    return `${ticket.issueTypeName}: ${ticket.issueTypeOther}`;
  }

  return ticket.issueTypeName || ticket.issueTypeOther || 'Not set';
}

function formatLinkedContact(ticket) {
  return [ticket.customerContactNumber, ticket.customerContactName].filter(Boolean).join(' / ') || 'Not linked';
}

function formatContactLinkTitle(contact) {
  return [contact.contactNumber, contact.displayName].filter(Boolean).join(' / ') || 'Contact';
}

function formatStatus(status) {
  const match = state.statuses.find((option) => option.value === status);
  return match?.label || fallbackStatusLabels[status] || String(status || '').replaceAll('_', ' ');
}

function formatPriority(priority) {
  const match = state.priorities.find((option) => option.value === priority);
  return match?.label || fallbackPriorityLabels[priority] || String(priority || '').replaceAll('_', ' ');
}

function formatDate(value) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function toDateTimeLocal(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function clean(value) {
  return String(value || '').trim();
}
