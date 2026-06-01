const endpoints = {
  categories: '/api/apps/services-and-quotes/categories',
  services: '/api/apps/services-and-quotes/services',
  quotePreview: '/api/apps/services-and-quotes/quote-preview'
};

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

const state = {
  categories: [],
  services: [],
  lineItems: new Map(),
  preview: null
};

const elements = {
  catalog: document.getElementById('serviceCatalog'),
  catalogStatus: document.getElementById('catalogStatus'),
  quoteLines: document.getElementById('quoteLines'),
  quoteSubtotal: document.getElementById('quoteSubtotal'),
  quoteMessage: document.getElementById('quoteMessage')
};

initServicesAndQuotes();

async function initServicesAndQuotes() {
  try {
    const [categoriesPayload, servicesPayload] = await Promise.all([
      fetchJson(endpoints.categories),
      fetchJson(endpoints.services)
    ]);

    state.categories = categoriesPayload.categories || [];
    state.services = servicesPayload.services || [];

    renderCatalog();
    renderQuoteLines();
    setMessage('');
  } catch (error) {
    elements.catalog.replaceChildren(createEmptyState(error.message || 'Service catalog could not load.'));
    elements.catalogStatus.textContent = 'Unable to load services.';
  }
}

elements.catalog.addEventListener('click', (event) => {
  const button = event.target.closest('[data-add-service-id]');

  if (!button) {
    return;
  }

  const serviceId = button.dataset.addServiceId;
  const currentQuantity = state.lineItems.get(serviceId) || 0;
  setQuantity(serviceId, currentQuantity + 1);
});

elements.quoteLines.addEventListener('click', (event) => {
  const decreaseButton = event.target.closest('[data-decrease-service-id]');
  const increaseButton = event.target.closest('[data-increase-service-id]');
  const removeButton = event.target.closest('[data-remove-service-id]');

  if (decreaseButton) {
    const serviceId = decreaseButton.dataset.decreaseServiceId;
    setQuantity(serviceId, (state.lineItems.get(serviceId) || 1) - 1);
    return;
  }

  if (increaseButton) {
    const serviceId = increaseButton.dataset.increaseServiceId;
    setQuantity(serviceId, (state.lineItems.get(serviceId) || 0) + 1);
    return;
  }

  if (removeButton) {
    state.lineItems.delete(removeButton.dataset.removeServiceId);
    refreshPreview();
  }
});

elements.quoteLines.addEventListener('input', (event) => {
  const input = event.target.closest('[data-quantity-service-id]');

  if (!input) {
    return;
  }

  const serviceId = input.dataset.quantityServiceId;
  const quantity = Number(input.value);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    setMessage('Quantities must be whole numbers from 1 to 99.');
    return;
  }

  state.lineItems.set(serviceId, quantity);
  refreshPreview();
});

function renderCatalog() {
  elements.catalog.replaceChildren();

  if (state.services.length === 0) {
    elements.catalog.append(createEmptyState('No active services are available yet.'));
    elements.catalogStatus.textContent = 'No active services found.';
    return;
  }

  elements.catalogStatus.textContent = `${state.services.length} active service${state.services.length === 1 ? '' : 's'} available.`;

  const servicesByCategory = new Map();
  const uncategorizedServices = [];

  for (const service of state.services) {
    if (service.categoryId) {
      const services = servicesByCategory.get(service.categoryId) || [];
      services.push(service);
      servicesByCategory.set(service.categoryId, services);
    } else {
      uncategorizedServices.push(service);
    }
  }

  for (const category of state.categories) {
    const services = servicesByCategory.get(category.id) || [];

    if (services.length === 0) {
      continue;
    }

    elements.catalog.append(createCategoryGroup(category, services));
  }

  if (uncategorizedServices.length > 0) {
    elements.catalog.append(createCategoryGroup({
      name: 'Uncategorized',
      description: ''
    }, uncategorizedServices));
  }
}

function createCategoryGroup(category, services) {
  const group = document.createElement('article');
  group.className = 'category-group';

  const heading = document.createElement('div');
  heading.className = 'category-heading';

  const title = document.createElement('h3');
  title.textContent = category.name;
  heading.append(title);

  if (category.description) {
    const description = document.createElement('p');
    description.textContent = category.description;
    heading.append(description);
  }

  const list = document.createElement('div');
  list.className = 'service-list';

  for (const service of services) {
    list.append(createServiceRow(service));
  }

  group.append(heading, list);
  return group;
}

function createServiceRow(service) {
  const row = document.createElement('div');
  row.className = 'service-row';

  const copy = document.createElement('div');
  copy.className = 'service-copy';

  const name = document.createElement('h4');
  name.textContent = service.name;

  const description = document.createElement('p');
  description.textContent = service.description || 'No description added yet.';

  copy.append(name, description);

  const actionArea = document.createElement('div');
  actionArea.className = 'service-action-area';

  const price = document.createElement('span');
  price.className = 'service-price';
  price.textContent = `${formatCents(service.basePriceCents)} / ${service.unitLabel}`;

  const addButton = document.createElement('button');
  addButton.className = 'primary-action compact-action';
  addButton.type = 'button';
  addButton.dataset.addServiceId = service.id;
  addButton.textContent = 'Add';

  actionArea.append(price, addButton);
  row.append(copy, actionArea);
  return row;
}

function renderQuoteLines() {
  elements.quoteLines.replaceChildren();

  if (state.lineItems.size === 0) {
    elements.quoteLines.append(createEmptyState('Add services to start a quote preview.'));
    elements.quoteSubtotal.textContent = '$0.00';
    return;
  }

  const previewItemsById = new Map((state.preview?.lineItems || []).map((item) => [item.serviceId, item]));

  for (const [serviceId, quantity] of state.lineItems) {
    const previewItem = previewItemsById.get(serviceId);
    const service = previewItem || state.services.find((item) => item.id === serviceId);

    if (!service) {
      continue;
    }

    elements.quoteLines.append(createQuoteLine(service, serviceId, quantity));
  }

  elements.quoteSubtotal.textContent = state.preview?.formattedSubtotal || calculateClientSubtotal();
}

function createQuoteLine(service, serviceId, quantity) {
  const line = document.createElement('div');
  line.className = 'quote-line';

  const copy = document.createElement('div');
  copy.className = 'quote-line-copy';

  const name = document.createElement('strong');
  name.textContent = service.name;

  const detail = document.createElement('span');
  const unitPrice = service.formattedUnitPrice || formatCents(service.basePriceCents);
  const unitLabel = service.unitLabel || 'service';
  detail.textContent = `${unitPrice} / ${unitLabel}`;

  copy.append(name, detail);

  const controls = document.createElement('div');
  controls.className = 'quantity-controls';

  const decrease = document.createElement('button');
  decrease.type = 'button';
  decrease.className = 'quantity-button';
  decrease.dataset.decreaseServiceId = serviceId;
  decrease.textContent = '-';
  decrease.setAttribute('aria-label', `Decrease ${service.name}`);

  const input = document.createElement('input');
  input.className = 'quantity-input';
  input.type = 'number';
  input.min = '1';
  input.max = '99';
  input.step = '1';
  input.value = String(quantity);
  input.dataset.quantityServiceId = serviceId;
  input.setAttribute('aria-label', `${service.name} quantity`);

  const increase = document.createElement('button');
  increase.type = 'button';
  increase.className = 'quantity-button';
  increase.dataset.increaseServiceId = serviceId;
  increase.textContent = '+';
  increase.setAttribute('aria-label', `Increase ${service.name}`);

  controls.append(decrease, input, increase);

  const lineSubtotal = document.createElement('strong');
  lineSubtotal.className = 'line-subtotal';
  lineSubtotal.textContent = service.formattedLineSubtotal || formatCents((service.basePriceCents || 0) * quantity);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'secondary-action remove-action';
  removeButton.dataset.removeServiceId = serviceId;
  removeButton.textContent = 'Remove';

  line.append(copy, controls, lineSubtotal, removeButton);
  return line;
}

function setQuantity(serviceId, quantity) {
  const normalizedQuantity = Math.max(0, Math.min(99, quantity));

  if (normalizedQuantity < 1) {
    state.lineItems.delete(serviceId);
  } else {
    state.lineItems.set(serviceId, normalizedQuantity);
  }

  refreshPreview();
}

async function refreshPreview() {
  state.preview = null;
  renderQuoteLines();

  if (state.lineItems.size === 0) {
    setMessage('');
    return;
  }

  try {
    const payload = {
      items: [...state.lineItems].map(([serviceId, quantity]) => ({ serviceId, quantity }))
    };

    state.preview = await fetchJson(endpoints.quotePreview, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    renderQuoteLines();
    setMessage('Quote preview updated.');
  } catch (error) {
    setMessage(error.message || 'Quote preview could not be calculated.');
  }
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

function createEmptyState(message) {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.textContent = message;
  return emptyState;
}

function calculateClientSubtotal() {
  let subtotalCents = 0;

  for (const [serviceId, quantity] of state.lineItems) {
    const service = state.services.find((item) => item.id === serviceId);
    subtotalCents += (service?.basePriceCents || 0) * quantity;
  }

  return formatCents(subtotalCents);
}

function formatCents(cents) {
  return moneyFormatter.format(Number(cents || 0) / 100);
}

function setMessage(message) {
  elements.quoteMessage.textContent = message;
}
