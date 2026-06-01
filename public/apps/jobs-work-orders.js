const endpoints = {
  bootstrap: '/api/apps/jobs-work-orders/bootstrap',
  workOrders: '/api/apps/jobs-work-orders/work-orders',
  workOrder: (id) => `/api/apps/jobs-work-orders/work-orders/${id}`,
  status: (id) => `/api/apps/jobs-work-orders/work-orders/${id}/status`,
  visits: (id) => `/api/apps/jobs-work-orders/work-orders/${id}/visits`,
  visit: (id, visitId) => `/api/apps/jobs-work-orders/work-orders/${id}/visits/${visitId}`,
  completeVisit: (id, visitId) => `/api/apps/jobs-work-orders/work-orders/${id}/visits/${visitId}/complete`,
  cancelVisit: (id, visitId) => `/api/apps/jobs-work-orders/work-orders/${id}/visits/${visitId}/cancel`,
  complete: (id) => `/api/apps/jobs-work-orders/work-orders/${id}/complete`,
  cancel: (id) => `/api/apps/jobs-work-orders/work-orders/${id}/cancel`,
  archive: (id) => `/api/apps/jobs-work-orders/work-orders/${id}/archive`,
  reactivate: (id) => `/api/apps/jobs-work-orders/work-orders/${id}/reactivate`,
  summary: '/api/apps/jobs-work-orders/summary',
  contacts: '/api/apps/customers-contacts/contacts',
  properties: (contactId) => `/api/apps/customers-contacts/contacts/${contactId}/properties`
};

const CONTACT_ADDRESS_OPTION_VALUE = '__contact_address__';

const fallbackStatusLabels = {
  quoted: 'Quoted',
  to_be_scheduled: 'To be scheduled',
  booked: 'Booked',
  completed: 'Completed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled'
};

const lifecycleDetails = {
  quoted: 'Quoted work that has not been scheduled yet.',
  to_be_scheduled: 'Ready for office follow-up and scheduling.',
  booked: 'A booked visit is on the schedule.',
  completed: 'Crew/service work is done.',
  invoiced: 'Office has invoiced the job; payment is still outstanding.',
  paid: 'Job is fully done and payment/paperwork is finalized.',
  cancelled: 'Work order is cancelled but retained for history.'
};

const lifecycleLabels = {
  completed: 'Work done',
  invoiced: 'Outstanding / not paid',
  paid: 'Closed / paid',
  cancelled: 'Cancelled',
  booked: 'Booked visit',
  quoted: 'Quoted',
  to_be_scheduled: 'Needs scheduling'
};

const statusNextActions = {
  quoted: ['to_be_scheduled', 'booked', 'cancelled'],
  to_be_scheduled: ['booked', 'cancelled'],
  booked: ['completed', 'cancelled'],
  completed: ['invoiced'],
  invoiced: ['paid'],
  paid: [],
  cancelled: ['to_be_scheduled']
};

const fallbackAssignmentLabels = {
  hbs_internal: 'HBS Internal',
  hbs_external: 'HBS External'
};

const state = {
  workTypes: [],
  statuses: [],
  locationModes: [],
  scheduleStates: [],
  visitTypes: [],
  arrivalWindows: [],
  assignments: [],
  cancellationReasons: [],
  workOrders: [],
  contactResults: [],
  selectedContact: null,
  properties: [],
  searchTimer: null,
  cityTimer: null,
  contactSearchTimer: null,
  deepLink: readInitialWorkOrderDeepLink(),
  highlightedWorkOrderId: ''
};

const elements = {
  form: document.getElementById('workOrderForm'),
  formMessage: document.getElementById('workOrderFormMessage'),
  resetFormButton: document.getElementById('resetWorkOrderForm'),
  saveWorkOrderButton: document.getElementById('saveWorkOrderButton'),
  jobTypeSelect: document.getElementById('jobTypeSelect'),
  locationModeSelect: document.getElementById('locationModeSelect'),
  statusSelect: document.getElementById('statusSelect'),
  visitTypeSelect: document.getElementById('visitTypeSelect'),
  scheduleStateSelect: document.getElementById('scheduleStateSelect'),
  arrivalWindowSelect: document.getElementById('arrivalWindowSelect'),
  assignedToSelect: document.getElementById('assignedToSelect'),
  anytimeVisit: document.getElementById('anytimeVisit'),
  contactSearch: document.getElementById('workOrderContactSearch'),
  contactResults: document.getElementById('workOrderContactResults'),
  selectedContact: document.getElementById('workOrderContactSelected'),
  contactAddressOption: document.getElementById('workOrderContactAddressOption'),
  clearContactButton: document.getElementById('clearWorkOrderContactLink'),
  addQuickPropertyButton: document.getElementById('addQuickProperty'),
  quickProperty: {
    role: document.getElementById('quickPropertyRole'),
    label: document.getElementById('quickPropertyLabel'),
    addressLine1: document.getElementById('quickPropertyAddressLine1'),
    addressLine2: document.getElementById('quickPropertyAddressLine2'),
    city: document.getElementById('quickPropertyCity'),
    province: document.getElementById('quickPropertyProvince'),
    postalCode: document.getElementById('quickPropertyPostalCode'),
    siteAccessNotes: document.getElementById('quickPropertySiteAccessNotes'),
    parkingNotes: document.getElementById('quickPropertyParkingNotes'),
    stairsElevatorNotes: document.getElementById('quickPropertyStairsElevatorNotes'),
    roomLocationNotes: document.getElementById('quickPropertyRoomLocationNotes')
  },
  list: document.getElementById('workOrderList'),
  listStatus: document.getElementById('workOrderListStatus'),
  refreshButton: document.getElementById('refreshWorkOrders'),
  search: document.getElementById('workOrderSearch'),
  statusFilter: document.getElementById('statusFilter'),
  jobTypeFilter: document.getElementById('jobTypeFilter'),
  assignedToFilter: document.getElementById('assignedToFilter'),
  scheduledDateFilter: document.getElementById('scheduledDateFilter'),
  cityFilter: document.getElementById('cityFilter'),
  unscheduledFilter: document.getElementById('unscheduledFilter'),
  includeArchivedFilter: document.getElementById('includeArchivedFilter'),
  summary: {
    quotedCount: document.getElementById('quotedWorkOrderCount'),
    toBeScheduledCount: document.getElementById('toBeScheduledWorkOrderCount'),
    bookedCount: document.getElementById('bookedWorkOrderCount'),
    bookedVisitsCount: document.getElementById('bookedVisitsCount'),
    completedCount: document.getElementById('completedWorkOrderCount'),
    invoicedCount: document.getElementById('invoicedWorkOrderCount'),
    paidCount: document.getElementById('paidWorkOrderCount'),
    cancelledCount: document.getElementById('cancelledWorkOrderCount'),
    unscheduledCount: document.getElementById('unscheduledWorkOrderCount'),
    hbsInternalCount: document.getElementById('hbsInternalWorkOrderCount'),
    hbsExternalCount: document.getElementById('hbsExternalWorkOrderCount')
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
  elements.jobTypeSelect.addEventListener('change', handleWorkTypeChange);
  elements.locationModeSelect.addEventListener('change', updateLocationModePanels);
  elements.statusSelect.addEventListener('change', syncScheduleFromStatus);
  elements.scheduleStateSelect.addEventListener('change', syncStatusFromSchedule);
  elements.anytimeVisit.addEventListener('change', syncAnytimeWindow);
  elements.arrivalWindowSelect.addEventListener('change', syncArrivalWindow);
  elements.contactSearch.addEventListener('input', () => {
    window.clearTimeout(state.contactSearchTimer);
    state.contactSearchTimer = window.setTimeout(searchContactsForLink, 240);
  });
  elements.contactResults.addEventListener('click', handleContactResultClick);
  elements.contactAddressOption.addEventListener('click', handleContactAddressOptionClick);
  elements.clearContactButton.addEventListener('click', clearSelectedContact);
  elements.addQuickPropertyButton.addEventListener('click', handleQuickAddProperty);
  document.querySelectorAll('[data-property-select]').forEach((select) => {
    select.addEventListener('change', () => handlePropertySelect(select));
  });
  elements.refreshButton.addEventListener('click', () => {
    loadSummary();
    loadWorkOrders();
  });
  elements.list.addEventListener('click', handleWorkOrderAction);
  elements.search.addEventListener('input', () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(loadWorkOrders, 240);
  });
  elements.cityFilter.addEventListener('input', () => {
    window.clearTimeout(state.cityTimer);
    state.cityTimer = window.setTimeout(loadWorkOrders, 240);
  });

  for (const filter of [
    elements.statusFilter,
    elements.jobTypeFilter,
    elements.assignedToFilter,
    elements.scheduledDateFilter,
    elements.unscheduledFilter,
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
    state.workTypes = bootstrap.workTypes || bootstrap.jobTypes || [];
    state.statuses = bootstrap.statuses || [];
    state.locationModes = bootstrap.locationModes || [];
    state.scheduleStates = bootstrap.scheduleStates || [];
    state.visitTypes = bootstrap.visitTypes || [];
    state.arrivalWindows = bootstrap.arrivalWindows || [];
    state.assignments = bootstrap.assignments || [];
    state.cancellationReasons = bootstrap.cancellationReasons || [];

    renderReferenceOptions();
    resetWorkOrderForm();
    await Promise.all([loadSummary(), loadWorkOrders()]);
    await handleInitialWorkOrderDeepLink();
  } catch (error) {
    setListStatus(error.message || 'Work Orders could not load.', true);
    elements.list.replaceChildren(createEmptyState('Work Orders data could not load.'));
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
  const workTypeId = elements.jobTypeFilter.value;
  const assignedTo = elements.assignedToFilter.value;
  const scheduledDate = elements.scheduledDateFilter.value;
  const city = clean(elements.cityFilter.value);

  if (search) {
    params.set('search', search);
  }

  if (status) {
    params.set('status', status);
  }

  if (workTypeId) {
    params.set('workTypeId', workTypeId);
  }

  if (assignedTo) {
    params.set('assignedTo', assignedTo);
  }

  if (scheduledDate) {
    params.set('scheduledDate', scheduledDate);
  }

  if (city) {
    params.set('city', city);
  }

  if (elements.unscheduledFilter.checked) {
    params.set('unscheduled', 'true');
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
    setListStatus(error.message || 'Work orders could not load.', true);
    elements.list.replaceChildren(createEmptyState('Work orders could not load.'));
  }
}

function renderReferenceOptions() {
  replaceSelectOptions(elements.jobTypeSelect, state.workTypes.map((workType) => ({
    value: workType.id,
    label: `${workType.abbreviation ? `${workType.abbreviation} - ` : ''}${workType.name}`
  })), 'Select work type');
  replaceSelectOptions(elements.jobTypeFilter, state.workTypes.map((workType) => ({
    value: workType.id,
    label: workType.name
  })), 'All types');

  replaceSelectOptions(elements.statusSelect, state.statuses, 'Select status');
  replaceSelectOptions(elements.visitTypeSelect, state.visitTypes, 'Select visit type');
  replaceSelectOptions(elements.scheduleStateSelect, state.scheduleStates, 'Select schedule');
  replaceSelectOptions(elements.arrivalWindowSelect, state.arrivalWindows, 'Select window');
  replaceSelectOptions(elements.assignedToSelect, state.assignments, 'Select team');
  replaceSelectOptions(elements.assignedToFilter, state.assignments, 'Any team');

  elements.statusFilter.replaceChildren(createOption('', 'Any status'));

  for (const status of state.statuses) {
    elements.statusFilter.append(createOption(status.value, status.label));
  }
}

function resetWorkOrderForm() {
  elements.form.reset();
  resetContactLinkSearch();
  state.properties = [];
  elements.statusSelect.value = 'to_be_scheduled';
  elements.visitTypeSelect.value = 'service';
  elements.scheduleStateSelect.value = 'unscheduled';
  elements.arrivalWindowSelect.value = '';
  elements.assignedToSelect.value = 'hbs_internal';
  elements.locationModeSelect.value = 'service';
  setLocationField('service.province', 'BC');
  setLocationField('pickup.province', 'BC');
  setLocationField('delivery.province', 'BC');
  elements.form.elements.workTypeAbbreviation.value = '';
  renderPropertyOptions();
  updateLocationModePanels();
  syncAnytimeWindow();
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
      await saveCheckedLocationProperties(payload);

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

  const selectedWorkType = getSelectedWorkType();

  payload.customerContactId = elements.form.elements.customerContactId.value;
  payload.locationMode = elements.locationModeSelect.value || 'service';
  payload.workTypeAbbreviation = clean(payload.workTypeAbbreviation) || selectedWorkType?.abbreviation || '';
  payload.locations = getLocationPayload(payload.locationMode);
  payload.primaryVisit = getPrimaryVisitPayload();
  payload.customerDisplaySnapshot = formatSelectedCustomerSnapshot();

  if (state.selectedContact) {
    payload.customerName = state.selectedContact.displayName || '';
    payload.customerCompany = state.selectedContact.companyName || '';
    payload.customerPhone = state.selectedContact.phone || '';
    payload.customerEmail = state.selectedContact.email || '';
  }

  return payload;
}

function getPrimaryVisitPayload() {
  return {
    visitNumber: 1,
    visitType: elements.visitTypeSelect.value || 'service',
    scheduleState: elements.scheduleStateSelect.value || 'unscheduled',
    scheduledDate: elements.form.elements.scheduledDate.value,
    arrivalWindowLabel: elements.arrivalWindowSelect.value,
    startTime: elements.form.elements.startTime.value,
    endTime: elements.form.elements.endTime.value,
    anytime: elements.anytimeVisit.checked,
    assignedTo: elements.assignedToSelect.value || 'hbs_internal',
    visitInstructions: elements.form.elements.visitInstructions.value,
    timingNotes: elements.form.elements.timingNotes.value
  };
}

function getLocationPayload(locationMode) {
  const roles = locationMode === 'pickup_delivery' ? ['pickup', 'delivery'] : ['service'];
  return roles.map((role) => {
    const propertySelect = document.querySelector(`[data-property-select="${role}"]`);
    const selectedPropertyId = propertySelect?.value || '';
    return {
      role,
      customerContactPropertyId: selectedPropertyId === CONTACT_ADDRESS_OPTION_VALUE ? null : selectedPropertyId || null,
      label: readLocationField(role, 'label'),
      addressLine1: readLocationField(role, 'addressLine1'),
      addressLine2: readLocationField(role, 'addressLine2'),
      city: readLocationField(role, 'city'),
      province: readLocationField(role, 'province') || 'BC',
      postalCode: readLocationField(role, 'postalCode'),
      country: 'Canada',
      siteAccessNotes: readLocationField(role, 'siteAccessNotes'),
      parkingNotes: readLocationField(role, 'parkingNotes'),
      stairsElevatorNotes: readLocationField(role, 'stairsElevatorNotes'),
      roomLocationNotes: readLocationField(role, 'roomLocationNotes')
    };
  }).filter(locationHasContent);
}

function validateCreatePayload(payload) {
  if (!clean(payload.customerContactId)) {
    return 'Choose a customer before creating a work order.';
  }

  if (!clean(payload.jobTypeId)) {
    return 'Choose a work type.';
  }

  if (!clean(payload.serviceDetails)) {
    return 'Add a work description.';
  }

  const needsBookedReadiness = ['booked', 'completed', 'invoiced', 'paid'].includes(payload.status);

  if (needsBookedReadiness) {
    if (payload.locationMode === 'pickup_delivery') {
      const pickup = payload.locations.find((location) => location.role === 'pickup');
      const delivery = payload.locations.find((location) => location.role === 'delivery');

      if (!locationHasAddress(pickup) || !locationHasAddress(delivery)) {
        return 'Pickup + delivery work orders need both pickup and delivery addresses before booking.';
      }
    } else if (!locationHasAddress(payload.locations.find((location) => location.role === 'service'))) {
      return 'Add a service address before booking.';
    }

    if (payload.primaryVisit.scheduleState !== 'booked' || !payload.primaryVisit.scheduledDate) {
      return 'Booked work orders need a booked visit date.';
    }

    if (!payload.primaryVisit.anytime && !payload.primaryVisit.arrivalWindowLabel && !payload.primaryVisit.startTime) {
      return 'Booked work orders need an arrival window, Anytime, or a start time.';
    }
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
  card.className = `jobs-work-order-card${workOrder.isArchived ? ' is-archived' : ''}${workOrder.isPaid || workOrder.isCancelled ? ' is-closed' : ''}${workOrder.id === state.highlightedWorkOrderId ? ' is-linked-target' : ''}`;
  card.dataset.workOrderId = workOrder.id;

  const header = document.createElement('div');
  header.className = 'jobs-card-header';

  const title = document.createElement('div');
  title.className = 'jobs-card-title';
  const workOrderNumber = document.createElement('span');
  workOrderNumber.textContent = workOrder.workOrderNumber;
  const heading = document.createElement('h3');
  heading.textContent = workOrder.displayTitle || workOrder.title || 'Work order';
  title.append(workOrderNumber, heading);

  const statusArea = document.createElement('div');
  statusArea.className = 'jobs-status-area';
  statusArea.append(createTypePill(workOrder.workTypeAbbreviation), createStatusPill(workOrder.status));

  if (workOrder.lifecycleLabel) {
    statusArea.append(createLifecyclePill(workOrder));
  }

  if (workOrder.isArchived) {
    statusArea.append(createArchivePill());
  }

  header.append(title, statusArea);

  const meta = document.createElement('div');
  meta.className = 'jobs-card-meta';
  meta.append(
    createMetaItem('Customer', formatCustomer(workOrder)),
    createMetaItem('Contact person', formatContactPerson(workOrder)),
    createMetaItem('Work type', formatWorkType(workOrder)),
    createMetaItem('City', workOrder.city),
    createMetaItem('Location', workOrder.locationSummary),
    createMetaItem('Schedule', workOrder.scheduleSummary),
    createMetaItem('Assigned', workOrder.assignedToLabel),
    createMetaItem('Lifecycle', formatLifecycleDetail(workOrder)),
    createMetaItem('Reference', formatReference(workOrder)),
    createMetaItem('Product / table', workOrder.productOrTableInvolved)
  );

  const visits = createVisitsBlock(workOrder);
  const notes = createNotesBlock(workOrder);
  const timestamps = createTimestampRow(workOrder);
  const controls = createWorkOrderControls(workOrder);

  card.append(header, meta, visits, notes, timestamps, controls);
  return card;
}

function createStatusPill(status) {
  const pill = document.createElement('span');
  pill.className = `jobs-status-pill status-${status}`;
  pill.textContent = formatStatus(status);
  return pill;
}

function createLifecyclePill(workOrder) {
  const pill = document.createElement('span');
  pill.className = `jobs-lifecycle-pill lifecycle-${workOrder.status}`;
  pill.textContent = workOrder.lifecycleLabel || formatLifecycleLabel(workOrder.status);
  return pill;
}

function createTypePill(abbreviation) {
  const pill = document.createElement('span');
  pill.className = 'jobs-type-pill';
  pill.textContent = abbreviation || 'WO';
  return pill;
}

function createArchivePill() {
  const pill = document.createElement('span');
  pill.className = 'jobs-archive-pill';
  pill.textContent = 'Archived';
  return pill;
}

function createVisitsBlock(workOrder) {
  const block = document.createElement('div');
  block.className = 'jobs-visits-block';

  const title = document.createElement('strong');
  title.textContent = 'Visits';
  block.append(title);

  if (!workOrder.visits || workOrder.visits.length === 0) {
    block.append(createRelatedLine('No visits set.'));
    return block;
  }

  for (const visit of workOrder.visits) {
    const row = document.createElement('div');
    row.className = 'jobs-visit-row';

    const summary = document.createElement('span');
    summary.textContent = [
      `#${visit.visitNumber}`,
      formatVisitType(visit.visitType),
      formatSchedule(visit),
      formatAssignment(visit.assignedTo),
      formatStatusText(visit.visitStatus)
    ].filter(Boolean).join(' / ');

    const actions = document.createElement('div');
    actions.className = 'jobs-inline-actions';

    if (visit.visitStatus !== 'completed') {
      actions.append(createActionButton('Complete visit', 'completeVisit', workOrder.id, undefined, visit.id));
    }

    if (visit.visitStatus !== 'cancelled') {
      actions.append(createActionButton('Cancel visit', 'cancelVisit', workOrder.id, 'secondary-action compact-action danger-action', visit.id));
    }

    row.append(summary, actions);
    block.append(row);
  }

  return block;
}

function createNotesBlock(workOrder) {
  const notes = document.createElement('div');
  notes.className = 'jobs-notes-block';
  notes.append(createNote('Work', workOrder.workDescription || workOrder.serviceDetails || 'Not set'));

  const primaryVisit = workOrder.primaryVisit || {};

  if (primaryVisit.visitInstructions) {
    notes.append(createNote('Visit instructions', primaryVisit.visitInstructions));
  }

  if (primaryVisit.timingNotes) {
    notes.append(createNote('Timing notes', primaryVisit.timingNotes));
  }

  const accessNotes = formatAccessNotes(workOrder.locations || []);

  if (accessNotes) {
    notes.append(createNote('Site/access', accessNotes));
  }

  if (workOrder.internalNotes) {
    notes.append(createNote('Office notes', workOrder.internalNotes));
  }

  if (workOrder.completionNotes) {
    notes.append(createNote('Completion', workOrder.completionNotes));
  }

  if (workOrder.cancellationReason) {
    notes.append(createNote('Cancellation', workOrder.cancellationReason));
  }

  return notes;
}

function createTimestampRow(workOrder) {
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

  return timestamps;
}

function createWorkOrderControls(workOrder) {
  const panels = document.createElement('div');
  panels.className = 'jobs-card-panels';
  panels.append(createWorkOrderEditPanel(workOrder), createStatusUpdatePanel(workOrder));
  return panels;
}

function createWorkOrderEditPanel(workOrder) {
  const details = document.createElement('details');
  details.className = 'jobs-card-controls';

  const summary = document.createElement('summary');
  summary.textContent = 'Edit Work Order';

  const controls = document.createElement('div');
  controls.className = 'jobs-card-control-body';

  const primaryVisit = workOrder.primaryVisit || {};
  const message = createCardMessage();
  const linkedCustomer = document.createElement('p');
  linkedCustomer.className = 'jobs-linked-customer-line';
  linkedCustomer.textContent = [
    'Customer',
    formatCustomer(workOrder),
    workOrder.customerPhone || workOrder.customerEmail
      ? [workOrder.customerPhone, workOrder.customerEmail].filter(Boolean).join(' / ')
      : ''
  ].filter(Boolean).join(': ');

  const workDetailsGrid = document.createElement('div');
  workDetailsGrid.className = 'jobs-control-grid';
  workDetailsGrid.append(
    createSelectControl('Work type', 'jobTypeId', getWorkTypeOptionsForWorkOrder(workOrder), workOrder.jobTypeId || ''),
    createInputControl('Abbreviation', 'workTypeAbbreviation', workOrder.workTypeAbbreviation || ''),
    createInputControl('Title', 'title', workOrder.title || ''),
    createInputControl('Product / table details', 'productOrTableInvolved', workOrder.productOrTableInvolved || ''),
    createInputControl('Reference number', 'referenceNumber', workOrder.referenceNumber || ''),
    createInputControl('Old system reference', 'oldSystemReference', workOrder.oldSystemReference || ''),
    createInputControl('Customer reference', 'customerReferenceNumber', workOrder.customerReferenceNumber || ''),
    createInputControl('Contact person', 'contactPersonName', workOrder.contactPersonName || ''),
    createInputControl('Contact phone', 'contactPersonPhone', workOrder.contactPersonPhone || '', 'tel'),
    createInputControl('Contact email', 'contactPersonEmail', workOrder.contactPersonEmail || '', 'email')
  );

  const locationControls = createCardLocationControls(workOrder);
  const scheduleGrid = document.createElement('div');
  scheduleGrid.className = 'jobs-control-grid';
  scheduleGrid.append(
    createSelectControl('Visit type', 'visitType', state.visitTypes, primaryVisit.visitType || 'service'),
    createSelectControl('Schedule', 'scheduleState', state.scheduleStates, primaryVisit.scheduleState || 'unscheduled'),
    createInputControl('Booked date', 'scheduledDate', toDateInput(primaryVisit.scheduledDate), 'date'),
    createSelectControl('Arrival window', 'arrivalWindowLabel', state.arrivalWindows, primaryVisit.arrivalWindowLabel || ''),
    createCheckboxControl('Anytime', 'anytime', Boolean(primaryVisit.anytime)),
    createInputControl('Start time', 'startTime', primaryVisit.startTime || '', 'time'),
    createInputControl('End time', 'endTime', primaryVisit.endTime || '', 'time'),
    createSelectControl('Assigned', 'assignedTo', state.assignments, primaryVisit.assignedTo || 'hbs_internal')
  );

  const hiddenVisitId = document.createElement('input');
  hiddenVisitId.type = 'hidden';
  hiddenVisitId.dataset.workOrderField = 'primaryVisitId';
  hiddenVisitId.value = primaryVisit.id || '';

  const notesGrid = document.createElement('div');
  notesGrid.className = 'jobs-control-notes-grid';
  notesGrid.append(
    createTextareaControl('Work description', 'serviceDetails', workOrder.workDescription || workOrder.serviceDetails || ''),
    createTextareaControl('Visit instructions', 'visitInstructions', primaryVisit.visitInstructions || ''),
    createTextareaControl('Timing notes', 'timingNotes', primaryVisit.timingNotes || ''),
    createTextareaControl('Office notes', 'internalNotes', workOrder.internalNotes || '')
  );

  const addVisit = createAddVisitPanel(workOrder);
  const actions = document.createElement('div');
  actions.className = 'jobs-card-actions';
  actions.append(
    createActionButton('Save edits', 'save', workOrder.id, 'primary-action compact-action'),
    workOrder.isArchived
      ? createActionButton('Reactivate', 'reactivate', workOrder.id)
      : createActionButton('Archive', 'archive', workOrder.id)
  );

  controls.append(message, linkedCustomer, hiddenVisitId, workDetailsGrid, locationControls, scheduleGrid, notesGrid, addVisit, actions);
  details.append(summary, controls);
  return details;
}

function createStatusUpdatePanel(workOrder) {
  const details = document.createElement('details');
  details.className = 'jobs-status-update-panel';

  const summary = document.createElement('summary');
  summary.textContent = 'Update Status';

  const controls = document.createElement('div');
  controls.className = 'jobs-status-update-body';

  const message = createCardMessage();
  const current = document.createElement('div');
  current.className = 'jobs-status-current';
  current.append(createStatusPill(workOrder.status), createLifecyclePill(workOrder));

  const detail = document.createElement('p');
  detail.textContent = formatLifecycleDetail(workOrder);
  current.append(detail);

  const nextActions = document.createElement('div');
  nextActions.className = 'jobs-status-next-actions';
  const nextStatuses = statusNextActions[workOrder.status] || [];

  if (nextStatuses.length > 0) {
    for (const status of nextStatuses) {
      nextActions.append(createStatusActionButton(status, workOrder.id));
    }
  } else {
    const done = document.createElement('p');
    done.className = 'jobs-related-line';
    done.textContent = 'No next status action needed.';
    nextActions.append(done);
  }

  const manual = document.createElement('div');
  manual.className = 'jobs-status-manual';
  manual.append(
    createStatusSelect(workOrder.status),
    createActionButton('Apply status', 'status', workOrder.id, 'primary-action compact-action')
  );

  const notesGrid = document.createElement('div');
  notesGrid.className = 'jobs-control-notes-grid';
  notesGrid.append(
    createTextareaControl('Completion notes', 'completionNotes', workOrder.completionNotes || ''),
    createSelectControl('Cancellation reason', 'cancellationReasonCode', state.cancellationReasons, workOrder.cancellationReasonCode || ''),
    createTextareaControl('Cancellation notes', 'cancellationReason', workOrder.cancellationReason || '')
  );

  controls.append(message, current, nextActions, manual, notesGrid);
  details.append(summary, controls);
  return details;
}

function createCardMessage() {
  const message = document.createElement('p');
  message.className = 'jobs-card-message';
  message.dataset.cardMessage = 'true';
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  return message;
}

function getWorkTypeOptionsForWorkOrder(workOrder) {
  const options = state.workTypes.map((workType) => ({
    value: workType.id,
    label: `${workType.abbreviation ? `${workType.abbreviation} - ` : ''}${workType.name}`
  }));

  if (workOrder.jobTypeId && !options.some((option) => option.value === workOrder.jobTypeId)) {
    options.push({
      value: workOrder.jobTypeId,
      label: workOrder.jobTypeName || 'Existing work type'
    });
  }

  return options;
}

function createCardLocationControls(workOrder) {
  const wrapper = document.createElement('div');
  wrapper.className = 'jobs-card-location-controls';
  const locations = workOrder.locations || [];

  wrapper.append(
    createSelectControl('Location mode', 'locationMode', state.locationModes, workOrder.locationMode || 'service'),
    createCardLocationGroup('service', locations.find((location) => location.role === 'service')),
    createCardLocationGroup('pickup', locations.find((location) => location.role === 'pickup')),
    createCardLocationGroup('delivery', locations.find((location) => location.role === 'delivery'))
  );

  return wrapper;
}

function createCardLocationGroup(role, location = {}) {
  const group = document.createElement('div');
  group.className = 'jobs-card-location-group';

  const heading = document.createElement('strong');
  heading.textContent = `${formatStatusText(role)} address`;

  const propertyId = document.createElement('input');
  propertyId.type = 'hidden';
  propertyId.dataset.workOrderLocationField = `${role}.customerContactPropertyId`;
  propertyId.value = location?.customerContactPropertyId || '';

  const grid = document.createElement('div');
  grid.className = 'jobs-control-grid';
  grid.append(
    createCardLocationInput(role, 'label', 'Label', location?.label || ''),
    createCardLocationInput(role, 'addressLine1', 'Address line 1', location?.addressLine1 || ''),
    createCardLocationInput(role, 'addressLine2', 'Address line 2', location?.addressLine2 || ''),
    createCardLocationInput(role, 'city', 'City', location?.city || ''),
    createCardLocationInput(role, 'province', 'Province', location?.province || 'BC'),
    createCardLocationInput(role, 'postalCode', 'Postal code', location?.postalCode || ''),
    createCardLocationInput(role, 'siteAccessNotes', 'Site/access notes', location?.siteAccessNotes || ''),
    createCardLocationInput(role, 'parkingNotes', 'Parking notes', location?.parkingNotes || ''),
    createCardLocationInput(role, 'stairsElevatorNotes', 'Stairs/elevator notes', location?.stairsElevatorNotes || ''),
    createCardLocationInput(role, 'roomLocationNotes', 'Room/location notes', location?.roomLocationNotes || '')
  );

  group.append(heading, propertyId, grid);
  return group;
}

function createCardLocationInput(role, fieldName, label, value) {
  const control = createInputControl(label, `${role}.${fieldName}`, value);
  const input = control.querySelector('input');
  input.dataset.workOrderLocationField = `${role}.${fieldName}`;
  delete input.dataset.workOrderField;
  return control;
}

function createStatusActionButton(status, workOrderId) {
  const button = createActionButton(`Mark ${formatStatus(status)}`, 'status', workOrderId, 'secondary-action compact-action');
  button.dataset.statusValue = status;
  return button;
}

function createStatusSelect(selectedValue) {
  const labelElement = document.createElement('label');
  labelElement.textContent = 'Status';

  const select = document.createElement('select');
  select.dataset.workOrderStatusField = 'status';
  appendOptions(select, state.statuses, selectedValue, 'Select status');

  labelElement.append(select);
  return labelElement;
}

function createAddVisitPanel(workOrder) {
  const details = document.createElement('details');
  details.className = 'jobs-add-visit-panel';

  const summary = document.createElement('summary');
  summary.textContent = 'Add visit';

  const grid = document.createElement('div');
  grid.className = 'jobs-control-grid';
  grid.append(
    createNewVisitSelect('Visit type', 'visitType', state.visitTypes, 'service'),
    createNewVisitSelect('Schedule', 'scheduleState', state.scheduleStates, 'unscheduled'),
    createNewVisitInput('Booked date', 'scheduledDate', '', 'date'),
    createNewVisitSelect('Arrival window', 'arrivalWindowLabel', state.arrivalWindows, ''),
    createNewVisitCheckbox('Anytime', 'anytime', false),
    createNewVisitInput('Start time', 'startTime', '', 'time'),
    createNewVisitInput('End time', 'endTime', '', 'time'),
    createNewVisitSelect('Assigned', 'assignedTo', state.assignments, 'hbs_internal')
  );

  const notes = document.createElement('div');
  notes.className = 'jobs-control-notes-grid';
  notes.append(
    createNewVisitTextarea('Visit instructions', 'visitInstructions', ''),
    createNewVisitTextarea('Timing notes', 'timingNotes', '')
  );
  const action = createActionButton('Add visit', 'addVisit', workOrder.id, 'secondary-action compact-action');

  details.append(summary, grid, notes, action);
  return details;
}

async function handleWorkOrderAction(event) {
  const button = event.target.closest('[data-work-order-action]');

  if (!button) {
    return;
  }

  const workOrderId = button.dataset.workOrderId;
  const visitId = button.dataset.visitId;
  const action = button.dataset.workOrderAction;
  const request = buildActionRequest(workOrderId, action, visitId, button);

  if (!request) {
    return;
  }

  if (request.error) {
    setCardMessage(workOrderId, request.error, true);
    setListStatus(request.error, true);
    return;
  }

  await withBusyButton(button, async () => {
    try {
      await fetchJson(request.url, request.options);
      await Promise.all([loadSummary(), loadWorkOrders()]);
      setListStatus(request.successMessage || 'Work order updated.');
    } catch (error) {
      setCardMessage(workOrderId, error.message || 'Work order could not be updated.', true);
      setListStatus(error.message || 'Work order could not be updated.', true);
    }
  });
}

function buildActionRequest(workOrderId, action, visitId, button) {
  if (action === 'save') {
    const payload = buildPatchPayload(workOrderId);
    const validationError = validateEditPayload(payload, findWorkOrder(workOrderId));

    if (validationError) {
      return { error: validationError };
    }

    return {
      url: endpoints.workOrder(workOrderId),
      options: {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      },
      successMessage: 'Work order details saved.'
    };
  }

  if (action === 'status') {
    const status = button?.dataset.statusValue || readStatusField(workOrderId);
    const validationError = validateStatusPayload(workOrderId, status);

    if (validationError) {
      return { error: validationError };
    }

    const body = { status };
    const completionNotes = readCardField(workOrderId, 'completionNotes');
    const cancellationReason = readCardField(workOrderId, 'cancellationReason');
    const cancellationReasonCode = readCardField(workOrderId, 'cancellationReasonCode');

    if (completionNotes || status === 'completed') {
      body.completionNotes = completionNotes;
    }

    if (cancellationReason || status === 'cancelled') {
      body.cancellationReason = cancellationReason;
    }

    if (cancellationReasonCode || status === 'cancelled') {
      body.cancellationReasonCode = cancellationReasonCode;
    }

    return {
      url: endpoints.status(workOrderId),
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      },
      successMessage: `Status updated to ${formatStatus(status)}.`
    };
  }

  if (action === 'complete') {
    return {
      url: endpoints.complete(workOrderId),
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completionNotes: readCardField(workOrderId, 'completionNotes') })
      },
      successMessage: 'Work order marked completed.'
    };
  }

  if (action === 'cancel') {
    return {
      url: endpoints.cancel(workOrderId),
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancellationReason: readCardField(workOrderId, 'cancellationReason'),
          cancellationReasonCode: readCardField(workOrderId, 'cancellationReasonCode')
        })
      },
      successMessage: 'Work order cancelled.'
    };
  }

  if (action === 'archive') {
    return { url: endpoints.archive(workOrderId), options: { method: 'POST' }, successMessage: 'Work order archived.' };
  }

  if (action === 'reactivate') {
    return { url: endpoints.reactivate(workOrderId), options: { method: 'POST' }, successMessage: 'Work order reactivated.' };
  }

  if (action === 'addVisit') {
    return {
      url: endpoints.visits(workOrderId),
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildNewVisitPayload(workOrderId))
      },
      successMessage: 'Visit added.'
    };
  }

  if (action === 'completeVisit' && visitId) {
    return {
      url: endpoints.completeVisit(workOrderId, visitId),
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completionNotes: readCardField(workOrderId, 'completionNotes') })
      },
      successMessage: 'Visit completed.'
    };
  }

  if (action === 'cancelVisit' && visitId) {
    return {
      url: endpoints.cancelVisit(workOrderId, visitId),
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancellationReason: readCardField(workOrderId, 'cancellationReason') })
      },
      successMessage: 'Visit cancelled.'
    };
  }

  return null;
}

function buildPatchPayload(workOrderId) {
  const primaryVisitId = readCardField(workOrderId, 'primaryVisitId');
  const primaryVisit = {
    id: primaryVisitId || undefined,
    visitNumber: 1,
    visitType: readCardField(workOrderId, 'visitType') || 'service',
    scheduleState: readCardField(workOrderId, 'scheduleState') || 'unscheduled',
    scheduledDate: readCardField(workOrderId, 'scheduledDate'),
    arrivalWindowLabel: readCardField(workOrderId, 'arrivalWindowLabel'),
    startTime: readCardField(workOrderId, 'startTime'),
    endTime: readCardField(workOrderId, 'endTime'),
    anytime: readCardChecked(workOrderId, 'anytime'),
    assignedTo: readCardField(workOrderId, 'assignedTo') || 'hbs_internal',
    visitInstructions: readCardField(workOrderId, 'visitInstructions'),
    timingNotes: readCardField(workOrderId, 'timingNotes')
  };

  return {
    contactPersonName: readCardField(workOrderId, 'contactPersonName'),
    contactPersonPhone: readCardField(workOrderId, 'contactPersonPhone'),
    contactPersonEmail: readCardField(workOrderId, 'contactPersonEmail'),
    jobTypeId: readCardField(workOrderId, 'jobTypeId'),
    workTypeAbbreviation: readCardField(workOrderId, 'workTypeAbbreviation'),
    locationMode: readCardField(workOrderId, 'locationMode') || 'service',
    locations: buildCardLocationPayload(workOrderId),
    title: readCardField(workOrderId, 'title'),
    productOrTableInvolved: readCardField(workOrderId, 'productOrTableInvolved'),
    referenceNumber: readCardField(workOrderId, 'referenceNumber'),
    oldSystemReference: readCardField(workOrderId, 'oldSystemReference'),
    customerReferenceNumber: readCardField(workOrderId, 'customerReferenceNumber'),
    serviceDetails: readCardField(workOrderId, 'serviceDetails'),
    internalNotes: readCardField(workOrderId, 'internalNotes'),
    visits: [primaryVisit]
  };
}

function buildCardLocationPayload(workOrderId) {
  const mode = readCardField(workOrderId, 'locationMode') || 'service';
  const roles = mode === 'pickup_delivery' ? ['pickup', 'delivery'] : ['service'];

  return roles.map((role) => ({
    role,
    customerContactPropertyId: readCardLocationField(workOrderId, role, 'customerContactPropertyId') || null,
    label: readCardLocationField(workOrderId, role, 'label'),
    addressLine1: readCardLocationField(workOrderId, role, 'addressLine1'),
    addressLine2: readCardLocationField(workOrderId, role, 'addressLine2'),
    city: readCardLocationField(workOrderId, role, 'city'),
    province: readCardLocationField(workOrderId, role, 'province') || 'BC',
    postalCode: readCardLocationField(workOrderId, role, 'postalCode'),
    country: 'Canada',
    siteAccessNotes: readCardLocationField(workOrderId, role, 'siteAccessNotes'),
    parkingNotes: readCardLocationField(workOrderId, role, 'parkingNotes'),
    stairsElevatorNotes: readCardLocationField(workOrderId, role, 'stairsElevatorNotes'),
    roomLocationNotes: readCardLocationField(workOrderId, role, 'roomLocationNotes')
  })).filter(locationHasContent);
}

function buildNewVisitPayload(workOrderId) {
  const card = getWorkOrderCard(workOrderId);

  return {
    visitType: readNewVisitField(card, 'visitType') || 'service',
    scheduleState: readNewVisitField(card, 'scheduleState') || 'unscheduled',
    scheduledDate: readNewVisitField(card, 'scheduledDate'),
    arrivalWindowLabel: readNewVisitField(card, 'arrivalWindowLabel'),
    startTime: readNewVisitField(card, 'startTime'),
    endTime: readNewVisitField(card, 'endTime'),
    anytime: Boolean(card?.querySelector('[data-new-visit-field="anytime"]')?.checked),
    assignedTo: readNewVisitField(card, 'assignedTo') || 'hbs_internal',
    visitInstructions: readNewVisitField(card, 'visitInstructions'),
    timingNotes: readNewVisitField(card, 'timingNotes')
  };
}

function validateEditPayload(payload, workOrder) {
  if (!clean(payload.jobTypeId) && !clean(workOrder?.jobTypeOther)) {
    return 'Choose a work type.';
  }

  if (!clean(payload.serviceDetails)) {
    return 'Add a work description.';
  }

  if (['booked', 'completed', 'invoiced', 'paid'].includes(workOrder?.status)) {
    return validateBookingReadiness({
      locationMode: payload.locationMode,
      locations: payload.locations,
      primaryVisit: payload.visits?.[0]
    });
  }

  return '';
}

function validateStatusPayload(workOrderId, status) {
  if (!clean(status)) {
    return 'Choose a status to apply.';
  }

  const workOrder = findWorkOrder(workOrderId);

  if (status === 'booked' && workOrder) {
    return validateBookingReadiness({
      locationMode: workOrder.locationMode,
      locations: workOrder.locations || [],
      primaryVisit: workOrder.visits?.find((visit) => visit.scheduleState === 'booked' && visit.visitStatus !== 'cancelled') || workOrder.primaryVisit
    });
  }

  return '';
}

function validateBookingReadiness({ locationMode, locations, primaryVisit }) {
  if (locationMode === 'pickup_delivery') {
    const pickup = locations.find((location) => location.role === 'pickup');
    const delivery = locations.find((location) => location.role === 'delivery');

    if (!locationHasAddress(pickup) || !locationHasAddress(delivery)) {
      return 'Pickup + delivery work orders need both pickup and delivery addresses before booking.';
    }
  } else if (!locationHasAddress(locations.find((location) => location.role === 'service'))) {
    return 'Add a service address before booking.';
  }

  if (primaryVisit?.scheduleState !== 'booked' || !primaryVisit?.scheduledDate) {
    return 'Booked work orders need a booked visit date.';
  }

  if (!primaryVisit.anytime && !primaryVisit.arrivalWindowLabel && !primaryVisit.startTime) {
    return 'Booked work orders need an arrival window, Anytime, or a start time.';
  }

  return '';
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

async function selectContactForWorkOrder(contact) {
  state.selectedContact = contact;
  elements.form.elements.customerContactId.value = contact.id || '';
  renderSelectedContact(contact);
  elements.clearContactButton.disabled = false;
  elements.contactResults.replaceChildren();
  await loadPropertiesForSelectedContact();
}

function renderSelectedContact(contact) {
  elements.selectedContact.replaceChildren();

  if (!contact) {
    elements.selectedContact.classList.add('is-hidden');
    renderContactAddressOption(null);
    return;
  }

  const title = document.createElement('strong');
  title.textContent = formatContactLinkTitle(contact);

  const details = document.createElement('div');
  details.className = 'jobs-selected-contact-grid';
  details.append(
    createMiniField('Name', contact.displayName),
    createMiniField('Company', contact.companyName),
    createMiniField('Phone', contact.phone),
    createMiniField('Email', contact.email),
    createMiniField('Address', formatContactAddress(contact))
  );

  elements.selectedContact.append(title, details);
  elements.selectedContact.classList.remove('is-hidden');
  renderContactAddressOption(contact);
}

function clearSelectedContact() {
  state.selectedContact = null;
  state.properties = [];
  elements.form.elements.customerContactId.value = '';
  elements.clearContactButton.disabled = true;
  renderSelectedContact(null);
  renderPropertyOptions();
}

function resetContactLinkSearch() {
  clearSelectedContact();
  elements.contactSearch.value = '';
  state.contactResults = [];
  elements.contactResults.replaceChildren();
}

async function loadPropertiesForSelectedContact() {
  state.properties = [];
  renderPropertyOptions();

  if (!state.selectedContact?.id) {
    return;
  }

  try {
    const payload = await fetchJson(endpoints.properties(state.selectedContact.id));
    state.properties = payload.properties || [];
    renderPropertyOptions();
    chooseDefaultServiceProperty();
  } catch (error) {
    setFormMessage(error.message || 'Saved properties could not load.', true);
  }
}

function renderPropertyOptions() {
  const contactAddress = getContactAddressProperty();

  document.querySelectorAll('[data-property-select]').forEach((select) => {
    const currentValue = select.value;
    select.replaceChildren(createOption('', state.properties.length ? 'Select saved property' : 'No saved properties'));

    if (contactAddress && select.dataset.propertySelect === 'service') {
      select.append(createOption(CONTACT_ADDRESS_OPTION_VALUE, 'Use contact address as service address'));
    }

    for (const property of state.properties) {
      const option = createOption(property.id, formatPropertyLabel(property));
      select.append(option);
    }

    if (currentValue === CONTACT_ADDRESS_OPTION_VALUE && contactAddress && select.dataset.propertySelect === 'service') {
      select.value = currentValue;
    } else if (state.properties.some((property) => property.id === currentValue)) {
      select.value = currentValue;
    }
  });
}

function chooseDefaultServiceProperty() {
  const defaultProperty = state.properties.find((property) => property.isDefaultServiceAddress);
  const serviceSelect = document.querySelector('[data-property-select="service"]');

  if (defaultProperty && serviceSelect && !serviceSelect.value) {
    serviceSelect.value = defaultProperty.id;
    fillLocationFromProperty('service', defaultProperty);
    return;
  }

  if (state.properties.length === 0 && serviceSelect && !serviceSelect.value && getContactAddressProperty()) {
    serviceSelect.value = CONTACT_ADDRESS_OPTION_VALUE;
    fillLocationFromContactAddress('service');
    setFormMessage('Contact address filled as the service address.');
  }
}

function handlePropertySelect(select) {
  const role = select.dataset.propertySelect;

  if (select.value === CONTACT_ADDRESS_OPTION_VALUE) {
    fillLocationFromContactAddress(role);
    return;
  }

  const property = state.properties.find((item) => item.id === select.value);

  if (role && property) {
    fillLocationFromProperty(role, property);
  }
}

function handleContactAddressOptionClick(event) {
  const button = event.target.closest('[data-contact-address-action]');

  if (!button) {
    return;
  }

  fillLocationFromContactAddress('service');
  const serviceSelect = document.querySelector('[data-property-select="service"]');

  if (serviceSelect && getContactAddressProperty()) {
    serviceSelect.value = CONTACT_ADDRESS_OPTION_VALUE;
  }
}

function renderContactAddressOption(contact) {
  elements.contactAddressOption.replaceChildren();

  if (!contactHasAddress(contact)) {
    elements.contactAddressOption.classList.add('is-hidden');
    return;
  }

  const text = document.createElement('span');
  text.textContent = formatContactAddress(contact);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-action compact-action';
  button.dataset.contactAddressAction = 'useServiceAddress';
  button.textContent = 'Use contact address as service address';

  elements.contactAddressOption.append(text, button);
  elements.contactAddressOption.classList.remove('is-hidden');
}

function createMiniField(label, value) {
  const item = document.createElement('span');
  const labelElement = document.createElement('b');
  labelElement.textContent = `${label}: `;
  const valueElement = document.createElement('span');
  valueElement.textContent = value || 'Not set';
  item.append(labelElement, valueElement);
  return item;
}

function getContactAddressProperty() {
  if (!contactHasAddress(state.selectedContact)) {
    return null;
  }

  return {
    id: CONTACT_ADDRESS_OPTION_VALUE,
    label: 'Contact address',
    propertyType: 'service',
    addressLine1: state.selectedContact.addressLine1 || '',
    addressLine2: state.selectedContact.addressLine2 || '',
    city: state.selectedContact.city || '',
    province: state.selectedContact.province || 'BC',
    postalCode: state.selectedContact.postalCode || '',
    country: state.selectedContact.country || 'Canada',
    siteAccessNotes: '',
    parkingNotes: '',
    stairsElevatorNotes: '',
    roomLocationNotes: ''
  };
}

function contactHasAddress(contact) {
  return Boolean(contact?.addressLine1 && contact?.city);
}

function fillLocationFromContactAddress(role) {
  const contactAddress = getContactAddressProperty();

  if (role && contactAddress) {
    fillLocationFromProperty(role, contactAddress);
  }
}

async function saveCheckedLocationProperties(payload) {
  if (!state.selectedContact?.id) {
    return;
  }

  for (const location of payload.locations || []) {
    const checkbox = document.querySelector(`[data-save-property-role="${location.role}"]`);

    if (!checkbox?.checked || location.customerContactPropertyId) {
      continue;
    }

    if (!locationHasAddress(location)) {
      throw new Error('Add address line 1 and city before saving this address to customer properties.');
    }

    const result = await fetchJson(endpoints.properties(state.selectedContact.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: clean(location.label) || formatStatusText(location.role),
        propertyType: 'service',
        addressLine1: location.addressLine1,
        addressLine2: location.addressLine2,
        city: location.city,
        province: location.province || 'BC',
        postalCode: location.postalCode,
        country: location.country || 'Canada',
        siteAccessNotes: location.siteAccessNotes,
        parkingNotes: location.parkingNotes,
        stairsElevatorNotes: location.stairsElevatorNotes,
        roomLocationNotes: location.roomLocationNotes,
        isDefaultServiceAddress: location.role === 'service' && state.properties.length === 0
      })
    });

    if (result.property?.id) {
      location.customerContactPropertyId = result.property.id;
      state.properties.push(result.property);
      const select = document.querySelector(`[data-property-select="${location.role}"]`);
      renderPropertyOptions();

      if (select) {
        select.value = result.property.id;
      }
    }
  }
}

async function handleQuickAddProperty() {
  if (!state.selectedContact?.id) {
    setFormMessage('Choose a customer before adding a property.', true);
    return;
  }

  const payload = {
    label: clean(elements.quickProperty.label.value),
    addressLine1: clean(elements.quickProperty.addressLine1.value),
    addressLine2: clean(elements.quickProperty.addressLine2.value),
    city: clean(elements.quickProperty.city.value),
    province: clean(elements.quickProperty.province.value) || 'BC',
    postalCode: clean(elements.quickProperty.postalCode.value),
    country: 'Canada',
    siteAccessNotes: clean(elements.quickProperty.siteAccessNotes.value),
    parkingNotes: clean(elements.quickProperty.parkingNotes.value),
    stairsElevatorNotes: clean(elements.quickProperty.stairsElevatorNotes.value),
    roomLocationNotes: clean(elements.quickProperty.roomLocationNotes.value)
  };

  if (!payload.addressLine1 || !payload.city) {
    setFormMessage('Quick properties need address line 1 and city.', true);
    return;
  }

  await withBusyButton(elements.addQuickPropertyButton, async () => {
    try {
      const result = await fetchJson(endpoints.properties(state.selectedContact.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await loadPropertiesForSelectedContact();
      const role = elements.quickProperty.role.value || 'service';
      const select = document.querySelector(`[data-property-select="${role}"]`);

      if (select && result.property?.id) {
        select.value = result.property.id;
        fillLocationFromProperty(role, result.property);
      }

      resetQuickPropertyFields();
      setFormMessage('Property added.');
    } catch (error) {
      setFormMessage(error.message || 'Property could not be added.', true);
    }
  });
}

function fillLocationFromProperty(role, property) {
  setLocationField(`${role}.label`, property.label || '');
  setLocationField(`${role}.addressLine1`, property.addressLine1 || '');
  setLocationField(`${role}.addressLine2`, property.addressLine2 || '');
  setLocationField(`${role}.city`, property.city || '');
  setLocationField(`${role}.province`, property.province || 'BC');
  setLocationField(`${role}.postalCode`, property.postalCode || '');
  setLocationField(`${role}.siteAccessNotes`, property.siteAccessNotes || '');
  setLocationField(`${role}.parkingNotes`, property.parkingNotes || '');
  setLocationField(`${role}.stairsElevatorNotes`, property.stairsElevatorNotes || '');
  setLocationField(`${role}.roomLocationNotes`, property.roomLocationNotes || '');
}

function resetQuickPropertyFields() {
  for (const field of Object.values(elements.quickProperty)) {
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.value = field.id === 'quickPropertyProvince' ? 'BC' : '';
    }
  }
}

function handleWorkTypeChange() {
  const workType = getSelectedWorkType();
  elements.form.elements.workTypeAbbreviation.value = workType?.abbreviation || '';

  if (workType?.commonlyUsesPickupDelivery) {
    elements.locationModeSelect.value = 'pickup_delivery';
    elements.visitTypeSelect.value = 'pickup_delivery';
    updateLocationModePanels();
  }
}

function updateLocationModePanels() {
  const mode = elements.locationModeSelect.value || 'service';

  if (mode === 'service' && ['pickup', 'delivery', 'pickup_delivery'].includes(elements.visitTypeSelect.value)) {
    elements.visitTypeSelect.value = 'service';
  }

  document.querySelectorAll('[data-location-panel]').forEach((panel) => {
    const role = panel.dataset.locationPanel;
    const shouldShow = mode === 'pickup_delivery'
      ? role === 'pickup' || role === 'delivery'
      : role === 'service';
    panel.classList.toggle('is-hidden', !shouldShow);
  });
}

function syncScheduleFromStatus() {
  if (elements.statusSelect.value === 'booked' && elements.scheduleStateSelect.value !== 'booked') {
    elements.scheduleStateSelect.value = 'booked';
  }
}

function syncStatusFromSchedule() {
  if (elements.scheduleStateSelect.value === 'booked' && elements.statusSelect.value === 'to_be_scheduled') {
    elements.statusSelect.value = 'booked';
  }
}

function syncAnytimeWindow() {
  if (elements.anytimeVisit.checked) {
    elements.arrivalWindowSelect.value = 'anytime';
    elements.form.elements.startTime.value = '';
    elements.form.elements.endTime.value = '';
  }
}

function syncArrivalWindow() {
  elements.anytimeVisit.checked = elements.arrivalWindowSelect.value === 'anytime';
  syncAnytimeWindow();
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

function createNote(label, value) {
  const note = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = `${label}: `;
  const text = document.createElement('span');
  text.textContent = value;
  note.append(strong, text);
  return note;
}

function createRelatedLine(message) {
  const line = document.createElement('p');
  line.className = 'jobs-related-line';
  line.textContent = message;
  return line;
}

function createTimestamp(label, value) {
  if (!value) {
    return null;
  }

  const item = document.createElement('span');
  item.textContent = `${label}: ${formatTimestamp(value)}`;
  return item;
}

function createActionButton(label, action, workOrderId, className = 'secondary-action compact-action', visitId = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.workOrderAction = action;
  button.dataset.workOrderId = workOrderId;
  if (visitId) {
    button.dataset.visitId = visitId;
  }
  button.textContent = label;
  return button;
}

function createInputControl(label, fieldName, value, type = 'text') {
  const labelElement = document.createElement('label');
  labelElement.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  input.value = value || '';
  input.dataset.workOrderField = fieldName;
  labelElement.append(input);
  return labelElement;
}

function createTextareaControl(label, fieldName, value) {
  const labelElement = document.createElement('label');
  labelElement.textContent = label;
  const textarea = document.createElement('textarea');
  textarea.rows = 3;
  textarea.value = value || '';
  textarea.dataset.workOrderField = fieldName;
  labelElement.append(textarea);
  return labelElement;
}

function createSelectControl(label, fieldName, options, selectedValue) {
  const labelElement = document.createElement('label');
  labelElement.textContent = label;
  const select = document.createElement('select');
  select.dataset.workOrderField = fieldName;
  appendOptions(select, options, selectedValue, 'Select');
  labelElement.append(select);
  return labelElement;
}

function createCheckboxControl(label, fieldName, checked) {
  const labelElement = document.createElement('label');
  labelElement.className = 'jobs-checkbox-row compact-checkbox';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = Boolean(checked);
  input.dataset.workOrderField = fieldName;
  labelElement.append(input, document.createTextNode(label));
  return labelElement;
}

function createNewVisitInput(label, fieldName, value, type = 'text') {
  const control = createInputControl(label, fieldName, value, type);
  control.querySelector('input').dataset.newVisitField = fieldName;
  delete control.querySelector('input').dataset.workOrderField;
  return control;
}

function createNewVisitTextarea(label, fieldName, value) {
  const control = createTextareaControl(label, fieldName, value);
  control.querySelector('textarea').dataset.newVisitField = fieldName;
  delete control.querySelector('textarea').dataset.workOrderField;
  return control;
}

function createNewVisitSelect(label, fieldName, options, selectedValue) {
  const control = createSelectControl(label, fieldName, options, selectedValue);
  control.querySelector('select').dataset.newVisitField = fieldName;
  delete control.querySelector('select').dataset.workOrderField;
  return control;
}

function createNewVisitCheckbox(label, fieldName, checked) {
  const control = createCheckboxControl(label, fieldName, checked);
  control.querySelector('input').dataset.newVisitField = fieldName;
  delete control.querySelector('input').dataset.workOrderField;
  return control;
}

function appendOptions(select, options, selectedValue, placeholder = '') {
  select.replaceChildren();

  if (placeholder) {
    select.append(createOption('', placeholder));
  }

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

function setCardMessage(workOrderId, message, isError = false) {
  const card = getWorkOrderCard(workOrderId);

  if (!card) {
    return;
  }

  card.querySelectorAll('[data-card-message]').forEach((element) => {
    element.textContent = message || '';
    element.classList.toggle('is-error', Boolean(isError));
  });
}

async function handleInitialWorkOrderDeepLink() {
  const deepLink = state.deepLink;

  if (!deepLink.workOrderId && !deepLink.workOrderNumber) {
    return;
  }

  try {
    const workOrder = await loadDeepLinkedWorkOrder(deepLink);

    if (!workOrder) {
      setListStatus(`Could not load work order ${formatDeepLinkWorkOrderLabel(deepLink)} from Schedule Board.`, true);
      return;
    }

    ensureWorkOrderVisible(workOrder);
    state.highlightedWorkOrderId = workOrder.id;
    renderWorkOrderList();
    setListStatus(`Loaded work order ${workOrder.workOrderNumber || formatDeepLinkWorkOrderLabel(deepLink)} from Schedule Board.`);
    scrollToWorkOrder(workOrder.id);
  } catch (error) {
    setListStatus(error.message || `Could not load work order ${formatDeepLinkWorkOrderLabel(deepLink)} from Schedule Board.`, true);
  }
}

async function loadDeepLinkedWorkOrder(deepLink) {
  const existing = deepLink.workOrderId
    ? findWorkOrder(deepLink.workOrderId)
    : findWorkOrderByNumber(deepLink.workOrderNumber);

  if (existing) {
    return existing;
  }

  if (deepLink.workOrderId) {
    try {
      const payload = await fetchJson(endpoints.workOrder(deepLink.workOrderId));
      return payload.workOrder || null;
    } catch (error) {
      if (!deepLink.workOrderNumber) {
        throw error;
      }
    }
  }

  if (deepLink.workOrderNumber) {
    const params = new URLSearchParams({ search: deepLink.workOrderNumber });
    const payload = await fetchJson(`${endpoints.workOrders}?${params}`);
    const matches = payload.workOrders || [];
    return matches.find((workOrder) => workOrder.workOrderNumber === deepLink.workOrderNumber) || matches[0] || null;
  }

  return null;
}

function ensureWorkOrderVisible(workOrder) {
  const existingIndex = state.workOrders.findIndex((item) => item.id === workOrder.id);

  if (existingIndex >= 0) {
    state.workOrders[existingIndex] = workOrder;
    return;
  }

  state.workOrders = [workOrder, ...state.workOrders];
}

function scrollToWorkOrder(workOrderId) {
  window.requestAnimationFrame(() => {
    const card = getWorkOrderCard(workOrderId);

    if (!card) {
      return;
    }

    card.setAttribute('tabindex', '-1');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.focus({ preventScroll: true });
  });
}

function readInitialWorkOrderDeepLink() {
  const params = new URLSearchParams(window.location.search);

  return {
    workOrderId: clean(params.get('workOrderId')),
    workOrderNumber: clean(params.get('workOrderNumber'))
  };
}

function formatDeepLinkWorkOrderLabel(deepLink) {
  return deepLink.workOrderNumber || deepLink.workOrderId || 'requested work order';
}

function readLocationField(role, fieldName) {
  return document.querySelector(`[data-location-field="${role}.${fieldName}"]`)?.value || '';
}

function setLocationField(key, value) {
  const input = document.querySelector(`[data-location-field="${key}"]`);

  if (input) {
    input.value = value || '';
  }
}

function readCardField(workOrderId, fieldName) {
  return getWorkOrderCard(workOrderId)?.querySelector(`[data-work-order-field="${fieldName}"]`)?.value || '';
}

function readStatusField(workOrderId) {
  return getWorkOrderCard(workOrderId)?.querySelector('[data-work-order-status-field="status"]')?.value || '';
}

function readCardLocationField(workOrderId, role, fieldName) {
  return getWorkOrderCard(workOrderId)?.querySelector(`[data-work-order-location-field="${role}.${fieldName}"]`)?.value || '';
}

function readCardChecked(workOrderId, fieldName) {
  return Boolean(getWorkOrderCard(workOrderId)?.querySelector(`[data-work-order-field="${fieldName}"]`)?.checked);
}

function readNewVisitField(card, fieldName) {
  return card?.querySelector(`[data-new-visit-field="${fieldName}"]`)?.value || '';
}

function getWorkOrderCard(workOrderId) {
  return Array.from(elements.list.querySelectorAll('[data-work-order-id]'))
    .find((card) => card.dataset.workOrderId === workOrderId);
}

function findWorkOrder(workOrderId) {
  return state.workOrders.find((workOrder) => workOrder.id === workOrderId) || null;
}

function findWorkOrderByNumber(workOrderNumber) {
  return state.workOrders.find((workOrder) => workOrder.workOrderNumber === workOrderNumber) || null;
}

function getSelectedWorkType() {
  return state.workTypes.find((workType) => workType.id === elements.jobTypeSelect.value) || null;
}

function formatSelectedCustomerSnapshot() {
  if (!state.selectedContact) {
    return '';
  }

  return [state.selectedContact.companyName, state.selectedContact.displayName].filter(Boolean).join(' / ');
}

function formatCustomer(workOrder) {
  return workOrder.customerDisplaySnapshot || [workOrder.customerCompany, workOrder.customerName].filter(Boolean).join(' / ');
}

function formatContactPerson(workOrder) {
  return [
    workOrder.contactPersonName,
    workOrder.contactPersonPhone,
    workOrder.contactPersonEmail
  ].filter(Boolean).join(' / ');
}

function formatWorkType(workOrder) {
  return [
    workOrder.workTypeAbbreviation,
    workOrder.workTypeName || workOrder.jobTypeName || workOrder.jobTypeOther
  ].filter(Boolean).join(' / ');
}

function formatReference(workOrder) {
  return [
    workOrder.referenceNumber,
    workOrder.oldSystemReference,
    workOrder.customerReferenceNumber,
    workOrder.sourceWarrantyServiceTicketNumber
  ].filter(Boolean).join(' / ');
}

function formatAccessNotes(locations) {
  return locations
    .map((location) => [
      formatStatusText(location.role),
      location.siteAccessNotes,
      location.parkingNotes,
      location.stairsElevatorNotes,
      location.roomLocationNotes
    ].filter(Boolean).join(': '))
    .filter(Boolean)
    .join(' / ');
}

function formatContactLinkTitle(contact) {
  return [contact.contactNumber, contact.displayName].filter(Boolean).join(' / ') || 'Customer';
}

function formatPropertyLabel(property) {
  return [
    property.label,
    property.addressLine1,
    [property.city, property.province].filter(Boolean).join(', ')
  ].filter(Boolean).join(' / ');
}

function formatContactAddress(contact) {
  const locality = [contact?.city, contact?.province, contact?.postalCode].filter(Boolean).join(', ');
  return [
    contact?.addressLine1,
    contact?.addressLine2,
    locality,
    contact?.country
  ].filter(Boolean).join(' / ');
}

function formatStatus(status) {
  const match = state.statuses.find((option) => option.value === status);
  return match?.label || fallbackStatusLabels[status] || formatStatusText(status);
}

function formatLifecycleLabel(status) {
  return lifecycleLabels[status] || formatStatus(status);
}

function formatLifecycleDetail(workOrderOrStatus) {
  const status = typeof workOrderOrStatus === 'string' ? workOrderOrStatus : workOrderOrStatus?.status;
  return workOrderOrStatus?.lifecycleDetail || lifecycleDetails[status] || formatLifecycleLabel(status);
}

function formatAssignment(value) {
  const match = state.assignments.find((option) => option.value === value);
  return match?.label || fallbackAssignmentLabels[value] || formatStatusText(value);
}

function formatVisitType(value) {
  const match = state.visitTypes.find((option) => option.value === value);
  return match?.label || formatStatusText(value || 'service');
}

function formatSchedule(visit) {
  if (!visit || visit.scheduleState === 'unscheduled') {
    return 'Unscheduled';
  }

  return [formatDateOnly(visit.scheduledDate), formatWindow(visit)].filter(Boolean).join(' / ');
}

function formatWindow(visit) {
  if (!visit) {
    return '';
  }

  if (visit.anytime || visit.arrivalWindowLabel === 'anytime') {
    return 'Anytime';
  }

  const windowOption = state.arrivalWindows.find((option) => option.value === visit.arrivalWindowLabel);
  return windowOption?.label || visit.arrivalWindowLabel || [visit.startTime, visit.endTime].filter(Boolean).join('-');
}

function formatDateOnly(value) {
  if (!value) {
    return '';
  }

  const text = String(value).slice(0, 10);
  const parts = text.split('-').map((part) => Number(part));

  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return '';
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' }).format(date);
}

function formatTimestamp(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatStatusText(value) {
  return clean(value).replaceAll('_', ' ');
}

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
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

function locationHasAddress(location) {
  return Boolean(location?.addressLine1 && location?.city);
}

function clean(value) {
  return String(value || '').trim();
}
