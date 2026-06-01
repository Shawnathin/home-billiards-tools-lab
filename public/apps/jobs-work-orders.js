const endpoints = {
  bootstrap: '/api/apps/jobs-work-orders/bootstrap',
  workOrders: '/api/apps/jobs-work-orders/work-orders',
  workOrder: (id) => `/api/apps/jobs-work-orders/work-orders/${id}`,
  complete: (id) => `/api/apps/jobs-work-orders/work-orders/${id}/complete`,
  cancel: (id) => `/api/apps/jobs-work-orders/work-orders/${id}/cancel`,
  archive: (id) => `/api/apps/jobs-work-orders/work-orders/${id}/archive`,
  reactivate: (id) => `/api/apps/jobs-work-orders/work-orders/${id}/reactivate`,
  summary: '/api/apps/jobs-work-orders/summary',
  contacts: '/api/apps/customers-contacts/contacts'
};

const fallbackStatusLabels = {
  open: 'Open',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  waiting_on_customer: 'Waiting on customer',
  waiting_on_parts: 'Waiting on parts',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

const fallbackPriorityLabels = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent'
};

const state = {
  jobTypes: [],
  statuses: [],
  priorities: [],
  workOrders: [],
  contactResults: [],
  selectedContact: null,
  searchTimer: null,
  contactSearchTimer: null
};

const elements = {
  form: document.getElementById('workOrderForm'),
  formMessage: document.getElementById('workOrderFormMessage'),
  resetFormButton: document.getElementById('resetWorkOrderForm'),
  saveWorkOrderButton: document.getElementById('saveWorkOrderButton'),
  jobTypeSelect: document.getElementById('jobTypeSelect'),
  customJobTypeField: document.getElementById('customJobTypeField'),
  statusSelect: document.getElementById('statusSelect'),
  prioritySelect: document.getElementById('prioritySelect'),
  contactSearch: document.getElementById('workOrderContactSearch'),
  contactResults: document.getElementById('workOrderContactResults'),
  selectedContact: document.getElementById('workOrderContactSelected'),
  clearContactButton: document.getElementById('clearWorkOrderContactLink'),
  list: document.getElementById('workOrderList'),
  listStatus: document.getElementById('workOrderListStatus'),
  refreshButton: document.getElementById('refreshWorkOrders'),
  search: document.getElementById('workOrderSearch'),
  statusFilter: document.getElementById('statusFilter'),
  priorityFilter: document.getElementById('priorityFilter'),
  jobTypeFilter: document.getElementById('jobTypeFilter'),
  scheduledDateFilter: document.getElementById('scheduledDateFilter'),
  includeArchivedFilter: document.getElementById('includeArchivedFilter'),
  summary: {
    openCount: document.getElementById('openWorkOrderCount'),
    scheduledCount: document.getElementById('scheduledWorkOrderCount'),
    inProgressCount: document.getElementById('inProgressWorkOrderCount'),
    waitingCount: document.getElementById('waitingWorkOrderCount'),
    urgentActiveCount: document.getElementById('urgentActiveWorkOrderCount'),
    completedCount: document.getElementById('completedWorkOrderCount'),
    cancelledCount: document.getElementById('cancelledWorkOrderCount'),
    archivedCount: document.getElementById('archivedWorkOrderCount')
  }
};

initJobsWorkOrders();

function initJobsWorkOrders() {
  bindEvents();
  loadApp();
}

function bindEvents() {
  elements.form.addEventListener('submit', handleCreateWorkOrder);
  elements.resetFormButton.addEventListener('click', resetWorkOrderForm);
  elements.jobTypeSelect.addEventListener('change', toggleCustomJobTypeField);
  elements.contactSearch.addEventListener('input', () => {
    window.clearTimeout(state.contactSearchTimer);
    state.contactSearchTimer = window.setTimeout(searchContactsForLink, 240);
  });
  elements.contactResults.addEventListener('click', handleContactResultClick);
  elements.clearContactButton.addEventListener('click', clearSelectedContact);
  elements.refreshButton.addEventListener('click', () => {
    loadSummary();
    loadWorkOrders();
  });
  elements.list.addEventListener('click', handleWorkOrderAction);
  elements.search.addEventListener('input', () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(loadWorkOrders, 240);
  });

  for (const filter of [
    elements.statusFilter,
    elements.priorityFilter,
    elements.jobTypeFilter,
    elements.scheduledDateFilter,
    elements.includeArchivedFilter
  ]) {
    filter.addEventListener('change', loadWorkOrders);
  }
}

async function loadApp() {
  try {
    setFormMessage('');
    setListStatus('Loading work order references...');

    const bootstrap = await fetchJson(endpoints.bootstrap);
    state.jobTypes = bootstrap.jobTypes || [];
    state.statuses = bootstrap.statuses || [];
    state.priorities = bootstrap.priorities || [];

    renderReferenceOptions();
    resetWorkOrderForm();
    await Promise.all([loadSummary(), loadWorkOrders()]);
  } catch (error) {
    setListStatus(error.message || 'Jobs / Work Orders could not load.');
    elements.list.replaceChildren(createEmptyState('Jobs / Work Orders data could not load.'));
  }
}

async function loadSummary() {
  const payload = await fetchJson(endpoints.summary);
  const summary = payload.summary || {};

  for (const [key, element] of Object.entries(elements.summary)) {
    element.textContent = String(summary[key] || 0);
  }
}

async function loadWorkOrders() {
  const params = new URLSearchParams();
  const search = clean(elements.search.value);
  const status = elements.statusFilter.value;
  const priority = elements.priorityFilter.value;
  const jobTypeId = elements.jobTypeFilter.value;
  const scheduledDate = elements.scheduledDateFilter.value;

  if (search) {
    params.set('search', search);
  }

  if (status) {
    params.set('status', status);
  }

  if (priority) {
    params.set('priority', priority);
  }

  if (jobTypeId) {
    params.set('jobTypeId', jobTypeId);
  }

  if (scheduledDate) {
    params.set('scheduledDate', scheduledDate);
  }

  if (elements.includeArchivedFilter.checked) {
    params.set('includeArchived', 'true');
  }

  const url = `${endpoints.workOrders}${params.toString() ? `?${params}` : ''}`;
  setListStatus('Loading work orders...');

  try {
    const payload = await fetchJson(url);
    state.workOrders = payload.workOrders || [];
    renderWorkOrderList();
  } catch (error) {
    setListStatus(error.message || 'Work orders could not load.');
    elements.list.replaceChildren(createEmptyState('Work orders could not load.'));
  }
}

function renderReferenceOptions() {
  replaceSelectOptions(elements.jobTypeSelect, state.jobTypes.map((jobType) => ({
    value: jobType.id,
    label: jobType.name
  })), 'Select job type');
  elements.jobTypeSelect.append(createOption('custom', 'Custom job type'));

  replaceSelectOptions(elements.jobTypeFilter, state.jobTypes.map((jobType) => ({
    value: jobType.id,
    label: jobType.name
  })), 'All types');
  elements.jobTypeFilter.append(createOption('custom', 'Custom job types'));

  replaceSelectOptions(elements.statusSelect, state.statuses, 'Select status');
  replaceSelectOptions(elements.prioritySelect, state.priorities, 'Select priority');
  replaceSelectOptions(elements.priorityFilter, state.priorities, 'Any priority');

  elements.statusFilter.replaceChildren(createOption('', 'Any status'));

  for (const status of state.statuses) {
    elements.statusFilter.append(createOption(status.value, status.label));
  }
}

function resetWorkOrderForm() {
  elements.form.reset();
  resetContactLinkSearch();
  elements.statusSelect.value = 'open';
  elements.prioritySelect.value = 'normal';
  toggleCustomJobTypeField();
  setFormMessage('');
}

async function handleCreateWorkOrder(event) {
  event.preventDefault();

  const payload = getCreatePayload();
  const validationError = validateCreatePayload(payload);

  if (validationError) {
    setFormMessage(validationError, true);
    return;
  }

  await withBusyButton(elements.saveWorkOrderButton, async () => {
    try {
      const result = await fetchJson(endpoints.workOrders, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      resetWorkOrderForm();
      setFormMessage(`${result.workOrder?.workOrderNumber || 'Work order'} created.`);
      await Promise.all([loadSummary(), loadWorkOrders()]);
    } catch (error) {
      setFormMessage(error.message || 'Work order could not be created.', true);
    }
  });
}

function getCreatePayload() {
  const formData = new FormData(elements.form);
  const payload = {};

  for (const [key, value] of formData.entries()) {
    payload[key] = value;
  }

  if (payload.jobTypeId === 'custom') {
    payload.jobTypeId = null;
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

  if (!clean(payload.jobTypeId) && !clean(payload.jobTypeOther)) {
    return 'Choose a job type or enter a custom job type.';
  }

  if (!clean(payload.title)) {
    return 'Job title is required.';
  }

  if (!clean(payload.serviceDetails)) {
    return 'Service details are required.';
  }

  return '';
}

function renderWorkOrderList() {
  elements.list.replaceChildren();

  if (state.workOrders.length === 0) {
    elements.list.append(createEmptyState('No work orders match the current filters.'));
    setListStatus('No work orders found.');
    return;
  }

  setListStatus(`${state.workOrders.length} work order${state.workOrders.length === 1 ? '' : 's'} shown.`);

  for (const workOrder of state.workOrders) {
    elements.list.append(createWorkOrderCard(workOrder));
  }
}

function createWorkOrderCard(workOrder) {
  const card = document.createElement('article');
  card.className = `jobs-work-order-card${workOrder.isArchived ? ' is-archived' : ''}${workOrder.isCompleted || workOrder.isCancelled ? ' is-closed' : ''}`;
  card.dataset.workOrderId = workOrder.id;

  const header = document.createElement('div');
  header.className = 'jobs-card-header';

  const title = document.createElement('div');
  title.className = 'jobs-card-title';
  const workOrderNumber = document.createElement('span');
  workOrderNumber.textContent = workOrder.workOrderNumber;
  const heading = document.createElement('h3');
  heading.textContent = workOrder.title;
  title.append(workOrderNumber, heading);

  const statusArea = document.createElement('div');
  statusArea.className = 'jobs-status-area';
  statusArea.append(createPriorityPill(workOrder.priority), createStatusPill(workOrder.status));

  if (workOrder.isArchived) {
    statusArea.append(createArchivePill());
  }

  header.append(title, statusArea);

  const meta = document.createElement('div');
  meta.className = 'jobs-card-meta';
  meta.append(
    createMetaItem('Customer', formatCustomer(workOrder)),
    createMetaItem('Contact', [workOrder.customerPhone, workOrder.customerEmail].filter(Boolean).join(' / ')),
    createMetaItem('Linked contact', formatLinkedContact(workOrder)),
    createMetaItem('Job type', formatJobType(workOrder)),
    createMetaItem('Location', formatLocation(workOrder)),
    createMetaItem('Scheduled', formatDateOnly(workOrder.scheduledDate)),
    createMetaItem('Assigned', workOrder.assignedToText),
    createMetaItem('Reference', workOrder.sourceReference),
    createMetaItem('Product / table', workOrder.productOrTableInvolved)
  );

  const timestamps = document.createElement('div');
  timestamps.className = 'jobs-timestamp-row';
  const timestampItems = [
    createTimestamp('Completed', workOrder.completedAt),
    createTimestamp('Cancelled', workOrder.cancelledAt),
    createTimestamp('Archived', workOrder.archivedAt),
    createTimestamp('Updated', workOrder.updatedAt)
  ].filter(Boolean);

  if (timestampItems.length > 0) {
    timestamps.append(...timestampItems);
  } else {
    timestamps.classList.add('is-hidden');
  }

  const notes = createNotesBlock(workOrder);
  const controls = createWorkOrderControls(workOrder);

  card.append(header, meta, timestamps, notes, controls);
  return card;
}

function createStatusPill(status) {
  const pill = document.createElement('span');
  pill.className = `jobs-status-pill status-${status}`;
  pill.textContent = formatStatus(status);
  return pill;
}

function createPriorityPill(priority) {
  const pill = document.createElement('span');
  pill.className = `jobs-priority-pill priority-${priority}`;
  pill.textContent = formatPriority(priority);
  return pill;
}

function createArchivePill() {
  const pill = document.createElement('span');
  pill.className = 'jobs-archive-pill';
  pill.textContent = 'Archived';
  return pill;
}

function createWorkOrderControls(workOrder) {
  const controls = document.createElement('div');
  controls.className = 'jobs-card-controls';

  const topGrid = document.createElement('div');
  topGrid.className = 'jobs-control-grid';

  const statusLabel = document.createElement('label');
  statusLabel.textContent = 'Status';
  const statusSelect = document.createElement('select');
  statusSelect.dataset.statusInput = workOrder.id;
  appendOptions(statusSelect, state.statuses, workOrder.status);
  statusLabel.append(statusSelect);

  const priorityLabel = document.createElement('label');
  priorityLabel.textContent = 'Priority';
  const prioritySelect = document.createElement('select');
  prioritySelect.dataset.priorityInput = workOrder.id;
  appendOptions(prioritySelect, state.priorities, workOrder.priority);
  priorityLabel.append(prioritySelect);

  const scheduledLabel = document.createElement('label');
  scheduledLabel.textContent = 'Scheduled date';
  const scheduledInput = document.createElement('input');
  scheduledInput.type = 'date';
  scheduledInput.dataset.scheduledDateInput = workOrder.id;
  scheduledInput.value = toDateInput(workOrder.scheduledDate);
  scheduledLabel.append(scheduledInput);

  const assignedLabel = document.createElement('label');
  assignedLabel.textContent = 'Assigned to';
  const assignedInput = document.createElement('input');
  assignedInput.type = 'text';
  assignedInput.dataset.assignedToInput = workOrder.id;
  assignedInput.value = workOrder.assignedToText || '';
  assignedLabel.append(assignedInput);

  topGrid.append(statusLabel, priorityLabel, scheduledLabel, assignedLabel);

  const notesGrid = document.createElement('div');
  notesGrid.className = 'jobs-control-notes-grid';
  notesGrid.append(
    createTextareaControl('Job notes', 'jobNotesInput', workOrder.id, workOrder.jobNotes),
    createTextareaControl('Internal notes', 'internalNotesInput', workOrder.id, workOrder.internalNotes),
    createTextareaControl('Completion notes', 'completionNotesInput', workOrder.id, workOrder.completionNotes),
    createTextareaControl('Cancellation reason', 'cancellationReasonInput', workOrder.id, workOrder.cancellationReason)
  );

  const actions = document.createElement('div');
  actions.className = 'jobs-card-actions';
  actions.append(
    createActionButton('Save', 'save', workOrder.id, 'primary-action compact-action'),
    createActionButton('Complete', 'complete', workOrder.id),
    createActionButton('Cancel', 'cancel', workOrder.id, 'secondary-action compact-action danger-action'),
    workOrder.isArchived
      ? createActionButton('Reactivate', 'reactivate', workOrder.id)
      : createActionButton('Archive', 'archive', workOrder.id)
  );

  controls.append(topGrid, notesGrid, actions);
  return controls;
}

function createTextareaControl(label, dataKey, workOrderId, value) {
  const labelElement = document.createElement('label');
  labelElement.textContent = label;
  const textarea = document.createElement('textarea');
  textarea.rows = 3;
  textarea.dataset[dataKey] = workOrderId;
  textarea.value = value || '';
  labelElement.append(textarea);
  return labelElement;
}

async function handleWorkOrderAction(event) {
  const button = event.target.closest('[data-work-order-action]');

  if (!button) {
    return;
  }

  const workOrderId = button.dataset.workOrderId;
  const action = button.dataset.workOrderAction;
  const request = buildActionRequest(workOrderId, action);

  if (!request) {
    return;
  }

  await withBusyButton(button, async () => {
    try {
      await fetchJson(request.url, request.options);
      await Promise.all([loadSummary(), loadWorkOrders()]);
    } catch (error) {
      setListStatus(error.message || 'Work order could not be updated.');
    }
  });
}

function buildActionRequest(workOrderId, action) {
  if (action === 'save') {
    return {
      url: endpoints.workOrder(workOrderId),
      options: {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPatchPayload(workOrderId))
      }
    };
  }

  if (action === 'complete') {
    return {
      url: endpoints.complete(workOrderId),
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completionNotes: readCardField(workOrderId, 'completionNotesInput')
        })
      }
    };
  }

  if (action === 'cancel') {
    return {
      url: endpoints.cancel(workOrderId),
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancellationReason: readCardField(workOrderId, 'cancellationReasonInput')
        })
      }
    };
  }

  if (action === 'archive') {
    return {
      url: endpoints.archive(workOrderId),
      options: { method: 'POST' }
    };
  }

  if (action === 'reactivate') {
    return {
      url: endpoints.reactivate(workOrderId),
      options: { method: 'POST' }
    };
  }

  return null;
}

function buildPatchPayload(workOrderId) {
  return {
    status: readCardField(workOrderId, 'statusInput') || 'open',
    priority: readCardField(workOrderId, 'priorityInput') || 'normal',
    scheduledDate: readCardField(workOrderId, 'scheduledDateInput'),
    assignedToText: readCardField(workOrderId, 'assignedToInput'),
    jobNotes: readCardField(workOrderId, 'jobNotesInput'),
    internalNotes: readCardField(workOrderId, 'internalNotesInput'),
    completionNotes: readCardField(workOrderId, 'completionNotesInput'),
    cancellationReason: readCardField(workOrderId, 'cancellationReasonInput')
  };
}

function readCardField(workOrderId, dataKey) {
  const field = elements.list.querySelector(`[data-${toKebabCase(dataKey)}="${workOrderId}"]`);
  return field?.value || '';
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
  button.className = 'jobs-contact-result';
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
  status.className = 'jobs-contact-result-status';
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
    selectContactForWorkOrder(contact);
  }
}

function selectContactForWorkOrder(contact) {
  state.selectedContact = contact;
  elements.form.elements.customerContactId.value = contact.id || '';
  elements.form.elements.customerName.value = contact.displayName || '';
  elements.form.elements.customerCompany.value = contact.companyName || '';
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

function createNotesBlock(workOrder) {
  const notes = document.createElement('div');
  notes.className = 'jobs-notes-block';
  notes.append(createNote('Service details', workOrder.serviceDetails || 'Not set'));

  if (workOrder.accessNotes) {
    notes.append(createNote('Access notes', workOrder.accessNotes));
  }

  if (workOrder.jobNotes) {
    notes.append(createNote('Job notes', workOrder.jobNotes));
  }

  if (workOrder.internalNotes) {
    notes.append(createNote('Internal notes', workOrder.internalNotes));
  }

  if (workOrder.completionNotes) {
    notes.append(createNote('Completion', workOrder.completionNotes));
  }

  if (workOrder.cancellationReason) {
    notes.append(createNote('Cancellation', workOrder.cancellationReason));
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
  item.className = 'jobs-meta-item';

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
  item.textContent = `${label}: ${formatTimestamp(value)}`;
  return item;
}

function createActionButton(label, action, workOrderId, className = 'secondary-action compact-action') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.workOrderAction = action;
  button.dataset.workOrderId = workOrderId;
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

function toggleCustomJobTypeField() {
  const showCustom = elements.jobTypeSelect.value === 'custom';
  elements.customJobTypeField.classList.toggle('is-hidden', !showCustom);
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

function formatCustomer(workOrder) {
  return [workOrder.customerName, workOrder.customerCompany].filter(Boolean).join(' / ');
}

function formatJobType(workOrder) {
  if (workOrder.jobTypeName && workOrder.jobTypeOther) {
    return `${workOrder.jobTypeName}: ${workOrder.jobTypeOther}`;
  }

  return workOrder.jobTypeName || workOrder.jobTypeOther || 'Not set';
}

function formatLocation(workOrder) {
  return [
    workOrder.serviceLocationName,
    workOrder.serviceAddressLine1,
    [workOrder.serviceCity, workOrder.serviceProvince, workOrder.servicePostalCode].filter(Boolean).join(', ')
  ].filter(Boolean).join(' / ');
}

function formatLinkedContact(workOrder) {
  return [workOrder.customerContactNumber, workOrder.customerContactName].filter(Boolean).join(' / ') || 'Not linked';
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

function formatDateOnly(value) {
  if (!value) {
    return 'Not set';
  }

  const text = String(value).slice(0, 10);
  const parts = text.split('-').map((part) => Number(part));

  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return 'Not set';
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  if (!Number.isFinite(date.getTime())) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' }).format(date);
}

function formatTimestamp(value) {
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

function toDateInput(value) {
  if (!value) {
    return '';
  }

  return String(value).slice(0, 10);
}

function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function clean(value) {
  return String(value || '').trim();
}
