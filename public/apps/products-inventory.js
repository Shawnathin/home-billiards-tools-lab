const endpoints = {
  bootstrap: '/api/apps/products-inventory/bootstrap',
  products: '/api/apps/products-inventory/products',
  product: (id) => `/api/apps/products-inventory/products/${id}`,
  archiveProduct: (id) => `/api/apps/products-inventory/products/${id}/archive`,
  reactivateProduct: (id) => `/api/apps/products-inventory/products/${id}/reactivate`,
  adjustments: '/api/apps/products-inventory/inventory/adjustments'
};

const state = {
  categories: [],
  locations: [],
  productStatuses: [],
  productTypes: [],
  stockUnits: [],
  inventoryConfidenceValues: [],
  adjustmentTypes: [],
  products: [],
  productDetails: new Map(),
  editingProductId: null,
  expandedProductId: null,
  searchTimer: null
};

const elements = {
  form: document.getElementById('productForm'),
  formMessage: document.getElementById('productFormMessage'),
  resetFormButton: document.getElementById('resetProductForm'),
  saveProductButton: document.getElementById('saveProductButton'),
  categorySelect: document.getElementById('productCategorySelect'),
  statusSelect: document.getElementById('productStatusSelect'),
  typeSelect: document.getElementById('productTypeSelect'),
  stockUnitSelect: document.getElementById('stockUnitSelect'),
  list: document.getElementById('productList'),
  listStatus: document.getElementById('productListStatus'),
  refreshButton: document.getElementById('refreshProducts'),
  search: document.getElementById('productSearch'),
  categoryFilter: document.getElementById('categoryFilter'),
  statusFilter: document.getElementById('statusFilter'),
  typeFilter: document.getElementById('typeFilter'),
  locationFilter: document.getElementById('locationFilter'),
  trackedFilter: document.getElementById('trackedFilter'),
  lowStockFilter: document.getElementById('lowStockFilter'),
  taxableFilter: document.getElementById('taxableFilter'),
  includeArchivedFilter: document.getElementById('includeArchivedFilter'),
  summary: {
    productCount: document.getElementById('productCount'),
    trackedCount: document.getElementById('trackedCount'),
    lowStockCount: document.getElementById('lowStockCount'),
    reviewCount: document.getElementById('reviewCount'),
    archivedCount: document.getElementById('archivedCount')
  }
};

initProductsInventory();

function initProductsInventory() {
  bindEvents();
  loadApp();
}

function bindEvents() {
  elements.form.addEventListener('submit', handleSaveProduct);
  elements.resetFormButton.addEventListener('click', resetProductForm);
  elements.refreshButton.addEventListener('click', loadProducts);
  elements.list.addEventListener('click', handleProductAction);
  elements.list.addEventListener('submit', handleAdjustmentSubmit);
  elements.search.addEventListener('input', () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(loadProducts, 240);
  });

  for (const filter of [
    elements.categoryFilter,
    elements.statusFilter,
    elements.typeFilter,
    elements.locationFilter,
    elements.trackedFilter,
    elements.lowStockFilter,
    elements.taxableFilter,
    elements.includeArchivedFilter
  ]) {
    filter.addEventListener('change', loadProducts);
  }
}

async function loadApp() {
  try {
    setListStatus('Loading product references...');
    const bootstrap = await fetchJson(endpoints.bootstrap);
    state.categories = bootstrap.categories || [];
    state.locations = bootstrap.locations || [];
    state.productStatuses = bootstrap.productStatuses || [];
    state.productTypes = bootstrap.productTypes || [];
    state.stockUnits = bootstrap.stockUnits || [];
    state.inventoryConfidenceValues = bootstrap.inventoryConfidenceValues || [];
    state.adjustmentTypes = bootstrap.adjustmentTypes || [];
    renderReferenceOptions();
    resetProductForm();
    await loadProducts();
  } catch (error) {
    setListStatus(error.message || 'Products / Inventory could not load.');
    elements.list.replaceChildren(createEmptyState('Products / Inventory data could not load.'));
  }
}

function renderReferenceOptions() {
  replaceSelectOptions(elements.categorySelect, state.categories.map((category) => ({
    value: category.id,
    label: category.name
  })), 'Select category');
  replaceSelectOptions(elements.categoryFilter, state.categories.map((category) => ({
    value: category.id,
    label: category.name
  })), 'All categories');

  replaceSelectOptions(elements.statusSelect, state.productStatuses, 'Select status');
  replaceSelectOptions(elements.statusFilter, state.productStatuses, 'Open statuses');

  replaceSelectOptions(elements.typeSelect, state.productTypes, 'Select type');
  replaceSelectOptions(elements.typeFilter, state.productTypes, 'All types');

  replaceSelectOptions(elements.stockUnitSelect, state.stockUnits, 'Select unit');

  replaceSelectOptions(elements.locationFilter, state.locations.map((location) => ({
    value: location.id,
    label: location.name
  })), 'All locations');
}

async function loadProducts() {
  const params = new URLSearchParams();
  const search = elements.search.value.trim();
  const filters = [
    ['categoryId', elements.categoryFilter.value],
    ['status', elements.statusFilter.value],
    ['productType', elements.typeFilter.value],
    ['locationId', elements.locationFilter.value],
    ['inventoryTracked', elements.trackedFilter.value],
    ['lowStock', elements.lowStockFilter.value],
    ['taxable', elements.taxableFilter.value]
  ];

  if (search) {
    params.set('search', search);
  }

  for (const [key, value] of filters) {
    if (value) {
      params.set(key, value);
    }
  }

  if (elements.includeArchivedFilter.checked) {
    params.set('includeArchived', 'true');
  }

  setListStatus('Loading products...');

  try {
    const payload = await fetchJson(`${endpoints.products}${params.toString() ? `?${params}` : ''}`);
    state.products = payload.products || [];
    renderSummary(payload.summary || {});
    renderProductList();
  } catch (error) {
    setListStatus(error.message || 'Products could not load.');
    elements.list.replaceChildren(createEmptyState('Products could not load.'));
  }
}

function renderSummary(summary) {
  for (const [key, element] of Object.entries(elements.summary)) {
    element.textContent = String(summary[key] || 0);
  }
}

function renderProductList() {
  elements.list.replaceChildren();

  if (state.products.length === 0) {
    setListStatus('No products found.');
    elements.list.append(createEmptyState('No products match the current filters.'));
    return;
  }

  setListStatus(`${state.products.length} product${state.products.length === 1 ? '' : 's'} shown.`);

  for (const product of state.products) {
    elements.list.append(createProductCard(product));
  }
}

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = `product-card${product.isArchived ? ' is-archived' : ''}`;
  card.dataset.productId = product.id;

  const header = document.createElement('div');
  header.className = 'product-card-header';

  const title = document.createElement('div');
  title.className = 'product-title-copy';

  const titleLine = document.createElement('div');
  titleLine.className = 'product-title-line';
  const name = document.createElement('h3');
  name.textContent = product.name;
  titleLine.append(name);

  if (product.internalSku) {
    const sku = document.createElement('span');
    sku.className = 'sku-chip';
    sku.textContent = product.internalSku;
    titleLine.append(sku);
  }

  const muted = document.createElement('p');
  muted.className = 'product-muted';
  muted.textContent = [product.categoryName, formatOptionLabel(state.productTypes, product.productType)]
    .filter(Boolean)
    .join(' / ');

  title.append(titleLine, muted);

  const statusArea = document.createElement('div');
  statusArea.className = 'product-title-line';
  statusArea.append(createStatusPill(product.status));

  if (product.inventorySummary?.lowStockLocationCount > 0) {
    const lowStock = document.createElement('span');
    lowStock.className = 'low-stock-pill';
    lowStock.textContent = 'Low stock';
    statusArea.append(lowStock);
  }

  header.append(title, statusArea);

  const meta = document.createElement('div');
  meta.className = 'product-card-meta';
  meta.append(
    createMetaItem('Retail', product.formattedRetailPrice),
    createMetaItem('Inventory', product.inventorySummary?.label || 'Not tracked'),
    createMetaItem('Brand / model', [product.brand, product.model].filter(Boolean).join(' / ') || 'Not set'),
    createMetaItem('Tax', product.isTaxable ? 'Taxable' : 'Not taxable')
  );

  const description = document.createElement('p');
  description.className = 'product-muted';
  description.textContent = product.shortDescription || 'No short description added.';

  const actions = document.createElement('div');
  actions.className = 'product-card-actions';
  actions.append(
    createActionButton(
      state.expandedProductId === product.id ? 'Hide details' : 'Details',
      'details',
      product.id
    ),
    createActionButton('Edit', 'edit', product.id)
  );

  if (product.isArchived) {
    actions.append(createActionButton('Reactivate', 'reactivate', product.id, 'secondary-action compact-action'));
  } else {
    actions.append(createActionButton('Archive', 'archive', product.id, 'secondary-action compact-action danger-action'));
  }

  card.append(header, meta, description, actions);

  if (state.expandedProductId === product.id) {
    card.append(createProductDetail(product));
  }

  return card;
}

function createProductDetail(product) {
  const detail = document.createElement('div');
  detail.className = 'product-detail';
  const loaded = state.productDetails.get(product.id);

  if (!loaded) {
    detail.append(createEmptyState('Loading product details...'));
    return detail;
  }

  const detailProduct = loaded.product || product;
  const detailGrid = document.createElement('div');
  detailGrid.className = 'product-detail-grid';
  detailGrid.append(
    createDetailBlock('Cost', detailProduct.formattedCost),
    createDetailBlock('MSRP', detailProduct.formattedMsrp),
    createDetailBlock('Manufacturer', detailProduct.manufacturer || 'Not set')
  );

  const notes = document.createElement('div');
  notes.className = 'product-notes-block';

  if (detailProduct.staffNotes) {
    notes.append(createDetailBlock('Internal notes', detailProduct.staffNotes));
  }

  if (detailProduct.shortDescription) {
    notes.append(createDetailBlock('Description', detailProduct.shortDescription));
  }

  detail.append(detailGrid, createInventorySection(detailProduct));

  if (notes.childElementCount > 0) {
    detail.append(notes);
  }

  detail.append(createAdjustmentPanel(detailProduct, loaded.adjustments || []));
  return detail;
}

function createInventorySection(product) {
  const section = document.createElement('div');
  section.className = 'product-detail-block';

  const heading = document.createElement('h4');
  heading.textContent = 'Inventory by location';
  section.append(heading);

  const grid = document.createElement('div');
  grid.className = 'inventory-location-grid';

  if (!product.inventoryTrackingEnabled) {
    grid.append(createEmptyState('Not tracked.'));
    section.append(grid);
    return section;
  }

  for (const location of state.locations) {
    const inventoryRow = (product.inventory || []).find((row) => row.locationId === location.id);
    grid.append(createInventoryLocationRow(location, inventoryRow, product.stockUnit));
  }

  section.append(grid);
  return section;
}

function createInventoryLocationRow(location, inventoryRow, stockUnit) {
  const row = document.createElement('div');
  row.className = 'inventory-location-row';

  if (!inventoryRow) {
    row.classList.add('is-missing');
  } else if (inventoryRow.isLowStock) {
    row.classList.add('is-low-stock');
  }

  const main = document.createElement('div');
  main.className = 'inventory-location-main';

  const locationName = document.createElement('strong');
  locationName.textContent = location.name;

  const quantity = document.createElement('strong');
  quantity.textContent = inventoryRow
    ? `${formatQuantity(inventoryRow.quantityOnHand)} ${stockUnit || 'unit'}`
    : 'Missing inventory row';

  main.append(locationName, quantity);

  const details = document.createElement('div');
  details.className = 'inventory-row-grid';

  if (inventoryRow) {
    details.append(
      createInlineFact('Threshold', inventoryRow.lowStockThreshold === null ? 'Not set' : formatQuantity(inventoryRow.lowStockThreshold)),
      createConfidencePill(inventoryRow.inventoryConfidence),
      createInlineFact('Last counted', formatDate(inventoryRow.lastCountedAt))
    );
  } else {
    details.append(createInlineFact('Status', 'No quantity row has been created for this location.'));
  }

  row.append(main, details);
  return row;
}

function createAdjustmentPanel(product, adjustments) {
  const panel = document.createElement('div');
  panel.className = 'adjustment-panel';

  const heading = document.createElement('h4');
  heading.textContent = 'Inventory adjustment';
  panel.append(heading);

  if (!product.inventoryTrackingEnabled) {
    panel.append(createEmptyState('Not tracked.'));
  } else if (product.isArchived) {
    panel.append(createEmptyState('Archived products cannot be adjusted.'));
  } else {
    panel.append(createAdjustmentForm(product));
  }

  const historyHeading = document.createElement('h4');
  historyHeading.textContent = 'Adjustment history';
  panel.append(historyHeading);

  const history = document.createElement('div');
  history.className = 'adjustment-history';

  if (adjustments.length === 0) {
    history.append(createEmptyState('No adjustments recorded yet.'));
  } else {
    for (const adjustment of adjustments) {
      history.append(createAdjustmentRow(adjustment, product.stockUnit));
    }
  }

  panel.append(history);
  return panel;
}

function createAdjustmentForm(product) {
  const form = document.createElement('form');
  form.className = 'adjustment-form';
  form.dataset.adjustmentProductId = product.id;

  const topGrid = document.createElement('div');
  topGrid.className = 'adjustment-field-grid';
  topGrid.append(
    createSelectField('Location', 'locationId', state.locations.map((location) => ({
      value: location.id,
      label: location.name
    })), true),
    createSelectField('Type', 'adjustmentType', state.adjustmentTypes
      .filter((option) => option.value !== 'location_transfer')
      .map((option) => ({ value: option.value, label: option.label })), true),
    createInputField('Delta', 'quantityDelta', {
      type: 'number',
      step: '0.01',
      placeholder: '0.00',
      required: true
    })
  );

  const bottomGrid = document.createElement('div');
  bottomGrid.className = 'adjustment-field-grid';
  bottomGrid.append(
    createSelectField('Confidence', 'inventoryConfidence', state.inventoryConfidenceValues, false, 'Keep current'),
    createInputField('Low threshold', 'lowStockThreshold', {
      type: 'number',
      min: '0',
      step: '0.01',
      placeholder: 'Optional'
    }),
    createInputField('Last counted', 'lastCountedAt', {
      type: 'date'
    })
  );

  const reason = createInputField('Reason', 'reason', {
    type: 'text',
    required: true
  });

  const notesLabel = document.createElement('label');
  notesLabel.textContent = 'Notes';
  const notes = document.createElement('textarea');
  notes.name = 'notes';
  notes.rows = 2;
  notesLabel.append(notes);

  const button = document.createElement('button');
  button.className = 'primary-action compact-action';
  button.type = 'submit';
  button.textContent = 'Create adjustment';

  form.append(topGrid, bottomGrid, reason, notesLabel, button);
  return form;
}

function createAdjustmentRow(adjustment, stockUnit) {
  const row = document.createElement('div');
  row.className = 'adjustment-row';

  const top = document.createElement('div');
  top.className = 'adjustment-row-top';

  const label = document.createElement('strong');
  label.textContent = formatOptionLabel(state.adjustmentTypes, adjustment.adjustmentType);

  const delta = document.createElement('strong');
  delta.className = adjustment.quantityDelta >= 0 ? 'adjustment-delta-positive' : 'adjustment-delta-negative';
  delta.textContent = `${adjustment.quantityDelta >= 0 ? '+' : ''}${formatQuantity(adjustment.quantityDelta)} ${stockUnit || adjustment.stockUnit || 'unit'}`;

  top.append(label, delta);

  const location = document.createElement('span');
  location.textContent = `${adjustment.locationName || 'Location'} / ${formatDate(adjustment.createdAt)}`;

  const math = document.createElement('span');
  math.textContent = `${formatQuantity(adjustment.quantityBefore)} to ${formatQuantity(adjustment.quantityAfter)}`;

  const reason = document.createElement('p');
  reason.className = 'product-muted';
  reason.textContent = adjustment.reason;

  row.append(top, location, math, reason);

  if (adjustment.notes) {
    const notes = document.createElement('p');
    notes.className = 'product-muted';
    notes.textContent = adjustment.notes;
    row.append(notes);
  }

  return row;
}

async function handleSaveProduct(event) {
  event.preventDefault();

  const payload = buildProductPayload();
  const validationError = validateProductPayload(payload);

  if (validationError) {
    setFormMessage(validationError, true);
    return;
  }

  const url = state.editingProductId ? endpoints.product(state.editingProductId) : endpoints.products;
  const method = state.editingProductId ? 'PATCH' : 'POST';

  await withBusyButton(elements.saveProductButton, async () => {
    try {
      await fetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setFormMessage(state.editingProductId ? 'Product updated.' : 'Product created.');
      resetProductForm({ keepMessage: true });
      await loadProducts();
    } catch (error) {
      setFormMessage(error.message || 'Product could not be saved.', true);
    }
  });
}

function buildProductPayload() {
  const formData = new FormData(elements.form);
  const payload = {};

  for (const [key, value] of formData.entries()) {
    payload[key] = value;
  }

  payload.inventoryTrackingEnabled = formData.has('inventoryTrackingEnabled');
  payload.isTaxable = formData.has('isTaxable');
  return payload;
}

function validateProductPayload(payload) {
  if (!clean(payload.name)) {
    return 'Product name is required.';
  }

  if (!clean(payload.categoryId)) {
    return 'Choose a category.';
  }

  if (!clean(payload.productType)) {
    return 'Choose a product type.';
  }

  if (!clean(payload.status)) {
    return 'Choose a status.';
  }

  if (payload.inventoryTrackingEnabled && !clean(payload.stockUnit)) {
    return 'Choose a stock unit.';
  }

  return '';
}

async function handleProductAction(event) {
  const button = event.target.closest('[data-product-action]');

  if (!button) {
    return;
  }

  const productId = button.dataset.productId;
  const action = button.dataset.productAction;
  const product = state.products.find((item) => item.id === productId) || state.productDetails.get(productId)?.product;

  if (!product) {
    return;
  }

  if (action === 'edit') {
    fillProductForm(product);
    return;
  }

  if (action === 'details') {
    await toggleProductDetails(productId);
    return;
  }

  if (action === 'archive') {
    await postProductAction(button, endpoints.archiveProduct(productId));
    return;
  }

  if (action === 'reactivate') {
    await postProductAction(button, endpoints.reactivateProduct(productId));
  }
}

async function toggleProductDetails(productId) {
  if (state.expandedProductId === productId) {
    state.expandedProductId = null;
    renderProductList();
    return;
  }

  state.expandedProductId = productId;
  renderProductList();

  if (!state.productDetails.has(productId)) {
    try {
      const payload = await fetchJson(endpoints.product(productId));
      state.productDetails.set(productId, payload);
      renderProductList();
    } catch (error) {
      setListStatus(error.message || 'Product details could not load.');
    }
  }
}

async function postProductAction(button, url) {
  await withBusyButton(button, async () => {
    try {
      await fetchJson(url, { method: 'POST' });
      state.productDetails.clear();
      await loadProducts();
    } catch (error) {
      setListStatus(error.message || 'Product could not be updated.');
    }
  });
}

async function handleAdjustmentSubmit(event) {
  const form = event.target.closest('[data-adjustment-product-id]');

  if (!form) {
    return;
  }

  event.preventDefault();
  const productId = form.dataset.adjustmentProductId;
  const payload = buildAdjustmentPayload(form, productId);
  const validationError = validateAdjustmentPayload(payload);

  if (validationError) {
    setListStatus(validationError);
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  await withBusyButton(button, async () => {
    try {
      await fetchJson(endpoints.adjustments, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      form.reset();
      state.productDetails.delete(productId);
      const detailsPayload = await fetchJson(endpoints.product(productId));
      state.productDetails.set(productId, detailsPayload);
      await loadProducts();
      setListStatus('Inventory adjustment created.');
    } catch (error) {
      setListStatus(error.message || 'Inventory adjustment could not be created.');
    }
  });
}

function buildAdjustmentPayload(form, productId) {
  const formData = new FormData(form);
  const payload = { productId };

  for (const [key, value] of formData.entries()) {
    if (['lowStockThreshold', 'lastCountedAt', 'inventoryConfidence', 'notes'].includes(key) && !clean(value)) {
      continue;
    }

    payload[key] = value;
  }

  return payload;
}

function validateAdjustmentPayload(payload) {
  if (!clean(payload.locationId)) {
    return 'Choose a location for the adjustment.';
  }

  if (!clean(payload.adjustmentType)) {
    return 'Choose an adjustment type.';
  }

  const delta = Number(payload.quantityDelta);

  if (!Number.isFinite(delta) || delta === 0) {
    return 'Enter a non-zero quantity delta.';
  }

  if (!clean(payload.reason)) {
    return 'Add a reason for the adjustment.';
  }

  return '';
}

function fillProductForm(product) {
  state.editingProductId = product.id;
  elements.form.elements.name.value = product.name || '';
  elements.form.elements.categoryId.value = product.categoryId || '';
  elements.form.elements.status.value = product.status || 'draft';
  elements.form.elements.productType.value = product.productType || 'physical_product';
  elements.form.elements.internalSku.value = product.internalSku || '';
  elements.form.elements.brand.value = product.brand || '';
  elements.form.elements.manufacturer.value = product.manufacturer || '';
  elements.form.elements.model.value = product.model || '';
  elements.form.elements.costDollars.value = centsToDollars(product.costCents);
  elements.form.elements.retailPriceDollars.value = centsToDollars(product.retailPriceCents);
  elements.form.elements.msrpDollars.value = centsToDollars(product.msrpCents);
  elements.form.elements.stockUnit.value = product.stockUnit || 'each';
  elements.form.elements.inventoryTrackingEnabled.checked = Boolean(product.inventoryTrackingEnabled);
  elements.form.elements.isTaxable.checked = Boolean(product.isTaxable);
  elements.form.elements.shortDescription.value = product.shortDescription || '';
  elements.form.elements.staffNotes.value = product.staffNotes || '';
  elements.saveProductButton.textContent = 'Save product';
  setFormMessage(`Editing ${product.name}.`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetProductForm(options = {}) {
  state.editingProductId = null;
  elements.form.reset();
  elements.form.elements.status.value = 'active';
  elements.form.elements.productType.value = 'physical_product';
  elements.form.elements.stockUnit.value = 'each';
  elements.form.elements.isTaxable.checked = true;
  elements.saveProductButton.textContent = 'Create product';

  if (!options.keepMessage) {
    setFormMessage('');
  }
}

function createDetailBlock(label, value) {
  const block = document.createElement('div');
  block.className = 'product-detail-block';

  const heading = document.createElement('h4');
  heading.textContent = label;

  const text = document.createElement('p');
  text.textContent = value || 'Not set';

  block.append(heading, text);
  return block;
}

function createMetaItem(label, value) {
  const item = document.createElement('div');
  item.className = 'product-meta-item';

  const labelElement = document.createElement('span');
  labelElement.textContent = label;

  const valueElement = document.createElement('strong');
  valueElement.textContent = value || 'Not set';

  item.append(labelElement, valueElement);
  return item;
}

function createInlineFact(label, value) {
  const item = document.createElement('div');
  item.className = 'product-meta-item';

  const labelElement = document.createElement('span');
  labelElement.textContent = label;

  const valueElement = document.createElement('strong');
  valueElement.textContent = value || 'Not set';

  item.append(labelElement, valueElement);
  return item;
}

function createStatusPill(status) {
  const pill = document.createElement('span');
  pill.className = `product-status-pill status-${status}`;
  pill.textContent = formatOptionLabel(state.productStatuses, status);
  return pill;
}

function createConfidencePill(confidence) {
  const pill = document.createElement('span');
  pill.className = `confidence-pill confidence-${confidence}`;
  pill.textContent = formatOptionLabel(state.inventoryConfidenceValues, confidence);
  return pill;
}

function createActionButton(label, action, productId, className = 'secondary-action compact-action') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.productAction = action;
  button.dataset.productId = productId;
  button.textContent = label;
  return button;
}

function createSelectField(label, name, options, required = false, placeholder = 'Select') {
  const wrapper = document.createElement('label');
  wrapper.textContent = label;
  const select = document.createElement('select');
  select.name = name;
  select.required = required;
  replaceSelectOptions(select, options, placeholder);
  wrapper.append(select);
  return wrapper;
}

function createInputField(label, name, attributes = {}) {
  const wrapper = document.createElement('label');
  wrapper.textContent = label;
  const input = document.createElement('input');
  input.name = name;

  for (const [key, value] of Object.entries(attributes)) {
    if (value === true) {
      input.setAttribute(key, '');
    } else if (value !== false && value !== null && value !== undefined) {
      input.setAttribute(key, value);
    }
  }

  wrapper.append(input);
  return wrapper;
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

function createEmptyState(message) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = message;
  return empty;
}

function formatOptionLabel(options, value) {
  const match = options.find((option) => option.value === value);
  return match?.label || String(value || 'Not set').replaceAll('_', ' ');
}

function formatDate(value) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium'
  }).format(date);
}

function formatQuantity(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(number);
}

function centsToDollars(cents) {
  if (cents === null || cents === undefined) {
    return '';
  }

  return (Number(cents || 0) / 100).toFixed(2);
}

function clean(value) {
  return String(value || '').trim();
}
