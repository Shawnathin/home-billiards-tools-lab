const endpoints = {
  types: '/api/apps/cue-repairs/types',
  repairs: '/api/apps/cue-repairs/repairs',
  summary: '/api/apps/cue-repairs/summary'
};

const statusLabels = {
  received: 'Received',
  assessing: 'Assessing',
  waiting_approval: 'Waiting approval',
  approved: 'Approved',
  in_progress: 'In progress',
  waiting_for_parts: 'Waiting for parts',
  ready_for_pickup: 'Ready for pickup',
  picked_up: 'Picked up',
  cancelled: 'Cancelled'
};

const statusOptions = Object.entries(statusLabels);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const moneyFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD'
});

const state = {
  types: [],
  repairs: [],
  searchTimer: null
};

const elements = {
  form: document.getElementById('repairForm'),
  formMessage: document.getElementById('cueFormMessage'),
  typeSelect: document.getElementById('repairTypeSelect'),
  otherRepairTypeField: document.getElementById('otherRepairTypeField'),
  list: document.getElementById('repairList'),
  listStatus: document.getElementById('cueListStatus'),
  refreshButton: document.getElementById('refreshRepairs'),
  search: document.getElementById('repairSearch'),
  statusFilter: document.getElementById('statusFilter'),
  repairTypeFilter: document.getElementById('repairTypeFilter'),
  summary: {
    openRepairCount: document.getElementById('openRepairCount'),
    waitingApprovalCount: document.getElementById('waitingApprovalCount'),
    readyForPickupCount: document.getElementById('readyForPickupCount'),
    contactedNotPickedUpCount: document.getElementById('contactedNotPickedUpCount'),
    completedCount: document.getElementById('completedCount'),
    cancelledCount: document.getElementById('cancelledCount')
  }
};

initCueRepairs();

function initCueRepairs() {
  bindEvents();
  loadApp();
}

function bindEvents() {
  elements.form.addEventListener('submit', handleCreateRepair);
  elements.typeSelect.addEventListener('change', () => {
    toggleOtherRepairTypeField();
    fillEstimateFromSelectedType();
  });
  elements.refreshButton.addEventListener('click', () => {
    loadSummary();
    loadRepairs();
  });
  elements.statusFilter.addEventListener('change', loadRepairs);
  elements.repairTypeFilter.addEventListener('change', loadRepairs);
  elements.search.addEventListener('input', () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(loadRepairs, 240);
  });
  elements.list.addEventListener('click', handleRepairAction);
}

async function loadApp() {
  try {
    setFormMessage('');
    setListStatus('Loading repair types...');

    const typePayload = await fetchJson(endpoints.types);
    state.types = typePayload.types || [];
    renderTypeOptions();

    await Promise.all([loadSummary(), loadRepairs()]);
  } catch (error) {
    setListStatus(error.message || 'Cue Repairs could not load.');
    elements.list.replaceChildren(createEmptyState('Cue Repairs data could not load.'));
  }
}

async function loadSummary() {
  const payload = await fetchJson(endpoints.summary);
  const summary = payload.summary || {};

  for (const [key, element] of Object.entries(elements.summary)) {
    element.textContent = String(summary[key] || 0);
  }
}

async function loadRepairs() {
  const params = new URLSearchParams();
  const search = elements.search.value.trim();
  const status = elements.statusFilter.value;
  const repairTypeId = elements.repairTypeFilter.value;

  if (search) {
    params.set('search', search);
  }

  if (status) {
    params.set('status', status);
  }

  if (repairTypeId) {
    params.set('repairTypeId', repairTypeId);
  }

  const url = `${endpoints.repairs}${params.toString() ? `?${params}` : ''}`;
  setListStatus('Loading repairs...');

  try {
    const payload = await fetchJson(url);
    state.repairs = payload.repairs || [];
    renderRepairList();
  } catch (error) {
    setListStatus(error.message || 'Repairs could not load.');
    elements.list.replaceChildren(createEmptyState('Repairs could not load.'));
  }
}

function renderTypeOptions() {
  elements.typeSelect.replaceChildren(createOption('', 'Select repair type'));
  elements.repairTypeFilter.replaceChildren(createOption('', 'All types'));

  for (const repairType of state.types) {
    const repairTypeId = clean(repairType.id);
    const formOption = createOption(repairTypeId, repairType.name);
    formOption.dataset.repairTypeId = repairTypeId;
    formOption.dataset.defaultPriceCents = String(repairType.defaultPriceCents || 0);
    formOption.dataset.requiresOther = String(requiresOtherText(repairType.name));
    elements.typeSelect.append(formOption);

    elements.repairTypeFilter.append(createOption(repairTypeId, repairType.name));
  }

  const customOption = createOption('custom', 'Custom repair type');
  customOption.dataset.defaultPriceCents = '0';
  customOption.dataset.requiresOther = 'true';
  elements.typeSelect.append(customOption);
  elements.repairTypeFilter.append(createOption('custom', 'Custom repairs'));
  toggleOtherRepairTypeField();
}

async function handleCreateRepair(event) {
  event.preventDefault();

  const payload = getCreatePayload();
  const validationError = validateCreatePayload(payload);

  if (validationError) {
    setFormMessage(validationError, true);
    return;
  }

  const submitButton = elements.form.querySelector('button[type="submit"]');
  await withBusyButton(submitButton, async () => {
    try {
      await fetchJson(endpoints.repairs, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      elements.form.reset();
      renderTypeOptions();
      setFormMessage('Repair created.');
      await Promise.all([loadSummary(), loadRepairs()]);
    } catch (error) {
      setFormMessage(error.message || 'Repair could not be created.', true);
    }
  });
}

function getCreatePayload() {
  const formData = new FormData(elements.form);
  const payload = {};

  for (const [key, value] of formData.entries()) {
    payload[key] = value;
  }

  payload.estimateApproved = elements.form.elements.estimateApproved.checked;
  payload.repairTypeId = getSelectedRepairTypeId(payload.repairTypeId);

  if (payload.repairTypeId === 'custom') {
    payload.repairTypeId = null;
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

  if (!clean(payload.cueBrand) && !clean(payload.cueModel) && !clean(payload.cueDescription)) {
    return 'Add a cue brand, model, or description.';
  }

  const selectedOption = elements.typeSelect.selectedOptions[0];
  const needsOther = selectedOption?.dataset.requiresOther === 'true';
  const selectedRepairTypeId = clean(payload.repairTypeId);

  if (!selectedRepairTypeId && !clean(payload.repairTypeOther)) {
    return 'Choose a repair type or enter a custom repair type.';
  }

  if (selectedRepairTypeId && !UUID_PATTERN.test(selectedRepairTypeId)) {
    return 'Repair type did not include a valid id. Refresh Cue Repairs and try again.';
  }

  if (needsOther && !clean(payload.repairTypeOther)) {
    return 'Describe the custom repair type.';
  }

  return '';
}

function renderRepairList() {
  elements.list.replaceChildren();

  if (state.repairs.length === 0) {
    elements.list.append(createEmptyState('No repairs match the current filters.'));
    setListStatus('No repairs found.');
    return;
  }

  setListStatus(`${state.repairs.length} repair${state.repairs.length === 1 ? '' : 's'} shown.`);

  for (const repair of state.repairs) {
    elements.list.append(createRepairCard(repair));
  }
}

function createRepairCard(repair) {
  const card = document.createElement('article');
  card.className = `cue-repair-card${repair.isOpen ? '' : ' is-closed'}`;
  card.dataset.repairId = repair.id;

  const header = document.createElement('div');
  header.className = 'cue-card-header';

  const title = document.createElement('div');
  title.className = 'cue-card-title';
  const repairNumber = document.createElement('span');
  repairNumber.textContent = repair.repairNumber;
  const customer = document.createElement('h3');
  customer.textContent = repair.customerName;
  title.append(repairNumber, customer);

  const status = document.createElement('span');
  status.className = `cue-status-pill status-${repair.status}`;
  status.textContent = formatStatus(repair.status);

  header.append(title, status);

  const meta = document.createElement('div');
  meta.className = 'cue-card-meta';
  meta.append(
    createMetaItem('Contact', [repair.customerPhone, repair.customerEmail].filter(Boolean).join(' / ')),
    createMetaItem('Cue', formatCue(repair)),
    createMetaItem('Repair type', formatRepairType(repair)),
    createMetaItem('Estimate', repair.formattedEstimate),
    createMetaItem('Final price', repair.formattedFinalPrice || 'Not set'),
    createMetaItem('Created', formatDate(repair.createdAt))
  );

  const timestamps = document.createElement('div');
  timestamps.className = 'cue-timestamp-row';
  timestamps.append(
    createTimestamp('Contacted', repair.customerContactedAt),
    createTimestamp('Completed', repair.completedAt),
    createTimestamp('Picked up', repair.pickedUpAt),
    createTimestamp('Cancelled', repair.cancelledAt)
  );

  const notes = createNotesBlock(repair);
  const controls = createRepairControls(repair);

  card.append(header, meta, timestamps, notes, controls);
  return card;
}

function createRepairControls(repair) {
  const controls = document.createElement('div');
  controls.className = 'cue-card-controls';

  const statusLabel = document.createElement('label');
  statusLabel.textContent = 'Status';
  const statusSelect = document.createElement('select');
  statusSelect.dataset.statusInput = repair.id;

  for (const [value, label] of statusOptions) {
    const option = createOption(value, label);

    if (value === repair.status) {
      option.selected = true;
    }

    statusSelect.append(option);
  }

  statusLabel.append(statusSelect);

  const finalPriceLabel = document.createElement('label');
  finalPriceLabel.textContent = 'Final price';
  const finalPriceInput = document.createElement('input');
  finalPriceInput.type = 'number';
  finalPriceInput.min = '0';
  finalPriceInput.step = '0.01';
  finalPriceInput.inputMode = 'decimal';
  finalPriceInput.placeholder = '0.00';
  finalPriceInput.value = repair.finalPriceCents === null ? '' : centsToDollars(repair.finalPriceCents);
  finalPriceInput.dataset.finalPriceInput = repair.id;
  finalPriceLabel.append(finalPriceInput);

  const notesLabel = document.createElement('label');
  notesLabel.className = 'cue-notes-control';
  notesLabel.textContent = 'Internal notes';
  const notesInput = document.createElement('textarea');
  notesInput.rows = 2;
  notesInput.dataset.internalNotesInput = repair.id;
  notesInput.value = repair.internalNotes || '';
  notesLabel.append(notesInput);

  const estimateApprovedLabel = document.createElement('label');
  estimateApprovedLabel.className = 'cue-checkbox-row compact-checkbox';
  const estimateApprovedInput = document.createElement('input');
  estimateApprovedInput.type = 'checkbox';
  estimateApprovedInput.checked = Boolean(repair.estimateApproved);
  estimateApprovedInput.dataset.estimateApprovedInput = repair.id;
  const estimateApprovedText = document.createElement('span');
  estimateApprovedText.textContent = 'Estimate approved';
  estimateApprovedLabel.append(estimateApprovedInput, estimateApprovedText);

  const actions = document.createElement('div');
  actions.className = 'cue-card-actions';
  actions.append(
    createActionButton('Save', 'save', repair.id, 'primary-action compact-action'),
    createActionButton('Contacted', 'contacted', repair.id),
    createActionButton('Ready', 'ready', repair.id),
    createActionButton('Picked up', 'picked-up', repair.id),
    createActionButton('Cancel', 'cancel', repair.id, 'secondary-action compact-action danger-action')
  );

  controls.append(statusLabel, finalPriceLabel, notesLabel, estimateApprovedLabel, actions);
  return controls;
}

async function handleRepairAction(event) {
  const button = event.target.closest('[data-repair-action]');

  if (!button) {
    return;
  }

  const repairId = button.dataset.repairId;
  const action = button.dataset.repairAction;
  const payload = buildPatchPayload(repairId, action);

  if (!payload) {
    return;
  }

  await withBusyButton(button, async () => {
    try {
      await fetchJson(`${endpoints.repairs}/${repairId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      await Promise.all([loadSummary(), loadRepairs()]);
    } catch (error) {
      setListStatus(error.message || 'Repair could not be updated.');
    }
  });
}

function buildPatchPayload(repairId, action) {
  const statusInput = elements.list.querySelector(`[data-status-input="${repairId}"]`);
  const finalPriceInput = elements.list.querySelector(`[data-final-price-input="${repairId}"]`);
  const internalNotesInput = elements.list.querySelector(`[data-internal-notes-input="${repairId}"]`);
  const estimateApprovedInput = elements.list.querySelector(`[data-estimate-approved-input="${repairId}"]`);

  if (action === 'contacted') {
    return { customerContacted: true };
  }

  if (action === 'ready') {
    return { status: 'ready_for_pickup' };
  }

  if (action === 'picked-up') {
    return { status: 'picked_up' };
  }

  if (action === 'cancel') {
    return { status: 'cancelled' };
  }

  if (action === 'save') {
    return {
      status: statusInput?.value || 'received',
      finalPriceDollars: finalPriceInput?.value || '',
      internalNotes: internalNotesInput?.value || '',
      estimateApproved: Boolean(estimateApprovedInput?.checked)
    };
  }

  return null;
}

function createNotesBlock(repair) {
  const notes = document.createElement('div');
  notes.className = 'cue-notes-block';

  if (repair.intakeNotes) {
    notes.append(createNote('Intake', repair.intakeNotes));
  }

  if (repair.internalNotes) {
    notes.append(createNote('Staff', repair.internalNotes));
  }

  if (!repair.intakeNotes && !repair.internalNotes) {
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
  item.className = 'cue-meta-item';

  const labelElement = document.createElement('span');
  labelElement.textContent = label;

  const valueElement = document.createElement('strong');
  valueElement.textContent = value || 'Not set';

  item.append(labelElement, valueElement);
  return item;
}

function createTimestamp(label, value) {
  const item = document.createElement('span');
  item.textContent = `${label}: ${value ? formatDate(value) : 'Not set'}`;
  return item;
}

function createActionButton(label, action, repairId, className = 'secondary-action compact-action') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.repairAction = action;
  button.dataset.repairId = repairId;
  button.textContent = label;
  return button;
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

function toggleOtherRepairTypeField() {
  const selectedOption = elements.typeSelect.selectedOptions[0];
  const showOther = selectedOption?.dataset.requiresOther === 'true';
  elements.otherRepairTypeField.classList.toggle('is-hidden', !showOther);
}

function fillEstimateFromSelectedType() {
  const selectedOption = elements.typeSelect.selectedOptions[0];
  const estimateInput = elements.form.elements.estimateDollars;

  if (!selectedOption || estimateInput.value) {
    return;
  }

  const defaultPriceCents = Number(selectedOption.dataset.defaultPriceCents || 0);

  if (defaultPriceCents > 0) {
    estimateInput.value = centsToDollars(defaultPriceCents);
  }
}

function getSelectedRepairTypeId(formValue) {
  const selectedOption = elements.typeSelect.selectedOptions[0];
  const selectedValue = clean(selectedOption?.value || formValue);

  if (!selectedValue || selectedValue === 'custom') {
    return selectedValue || null;
  }

  const selectedDataId = clean(selectedOption?.dataset.repairTypeId);

  if (UUID_PATTERN.test(selectedDataId)) {
    return selectedDataId;
  }

  if (UUID_PATTERN.test(selectedValue)) {
    return selectedValue;
  }

  const matchingType = state.types.find((repairType) => {
    return clean(repairType.id) === selectedValue || clean(repairType.name) === selectedValue;
  });
  const matchingTypeId = clean(matchingType?.id);

  if (UUID_PATTERN.test(matchingTypeId)) {
    return matchingTypeId;
  }

  console.warn('Cue Repairs repair type select produced a non-UUID value.', {
    selectedValue,
    selectedLabel: selectedOption?.textContent || ''
  });
  return selectedValue;
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

function requiresOtherText(name) {
  const normalized = String(name || '').toLowerCase();
  return normalized.includes('other') || normalized.includes('custom');
}

function formatRepairType(repair) {
  if (repair.repairTypeName && repair.repairTypeOther) {
    return `${repair.repairTypeName}: ${repair.repairTypeOther}`;
  }

  return repair.repairTypeName || repair.repairTypeOther || 'Not set';
}

function formatCue(repair) {
  const brandModel = [repair.cueBrand, repair.cueModel].filter(Boolean).join(' ');

  if (brandModel && repair.cueDescription) {
    return `${brandModel} - ${repair.cueDescription}`;
  }

  return brandModel || repair.cueDescription || 'Not set';
}

function formatStatus(status) {
  return statusLabels[status] || String(status || '').replaceAll('_', ' ');
}

function formatDate(value) {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function centsToDollars(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function clean(value) {
  return String(value || '').trim();
}
