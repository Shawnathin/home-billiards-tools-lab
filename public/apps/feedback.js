(() => {
  const endpoints = {
    submissions: '/api/apps/feedback/submissions',
    submission: (id) => `/api/apps/feedback/submissions/${id}`
  };

  const fallbackOptions = {
    categories: [
      { value: 'bug', label: 'Bug' },
      { value: 'confusing', label: 'Confusing' },
      { value: 'missing_field', label: 'Missing field' },
      { value: 'workflow_issue', label: 'Workflow issue' },
      { value: 'feature_idea', label: 'Feature idea' },
      { value: 'data_issue', label: 'Data issue' },
      { value: 'other', label: 'Other' }
    ],
    severities: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'blocking', label: 'Blocking' }
    ],
    statuses: [
      { value: 'new', label: 'New' },
      { value: 'reviewing', label: 'Reviewing' },
      { value: 'accepted', label: 'Accepted' },
      { value: 'deferred', label: 'Deferred' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'dismissed', label: 'Dismissed' }
    ]
  };

  const state = {
    options: fallbackOptions,
    sourceApps: [],
    submissions: [],
    searchTimer: null
  };

  const elements = {
    list: document.getElementById('feedbackList'),
    listStatus: document.getElementById('feedbackListStatus'),
    refreshButton: document.getElementById('refreshFeedback'),
    search: document.getElementById('feedbackSearch'),
    statusFilter: document.getElementById('feedbackStatusFilter'),
    categoryFilter: document.getElementById('feedbackCategoryFilter'),
    severityFilter: document.getElementById('feedbackSeverityFilter'),
    appFilter: document.getElementById('feedbackAppFilter'),
    summary: {
      newCount: document.getElementById('feedbackNewCount'),
      reviewingCount: document.getElementById('feedbackReviewingCount'),
      acceptedCount: document.getElementById('feedbackAcceptedCount'),
      highBlockingCount: document.getElementById('feedbackHighBlockingCount'),
      resolvedCount: document.getElementById('feedbackResolvedCount')
    }
  };

  if (!elements.list) {
    return;
  }

  initFeedbackInbox();

  function initFeedbackInbox() {
    bindEvents();
    loadFeedback();
  }

  function bindEvents() {
    elements.refreshButton.addEventListener('click', loadFeedback);
    elements.list.addEventListener('click', handleFeedbackCardClick);

    for (const filter of [
      elements.statusFilter,
      elements.categoryFilter,
      elements.severityFilter,
      elements.appFilter
    ]) {
      filter.addEventListener('change', loadFeedback);
    }

    elements.search.addEventListener('input', () => {
      window.clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(loadFeedback, 240);
    });
  }

  async function loadFeedback() {
    try {
      setListStatus('Loading feedback...');
      const payload = await fetchJson(buildListUrl());
      state.options = {
        categories: payload.options?.categories || fallbackOptions.categories,
        severities: payload.options?.severities || fallbackOptions.severities,
        statuses: payload.options?.statuses || fallbackOptions.statuses
      };
      state.sourceApps = payload.sourceApps || [];
      state.submissions = payload.submissions || [];

      renderFilterOptions();
      renderSummary(payload.summary || {});
      renderSubmissions();
      setListStatus(formatListStatus(state.submissions.length));
    } catch (error) {
      setListStatus(error.message || 'Feedback could not load.', true);
      elements.list.replaceChildren(createEmptyState('Feedback could not load.'));
    }
  }

  function buildListUrl() {
    const params = new URLSearchParams();

    if (elements.statusFilter.value) {
      params.set('status', elements.statusFilter.value);
    }

    if (elements.categoryFilter.value) {
      params.set('category', elements.categoryFilter.value);
    }

    if (elements.severityFilter.value) {
      params.set('severity', elements.severityFilter.value);
    }

    if (elements.appFilter.value) {
      params.set('sourceAppSlug', elements.appFilter.value);
    }

    const search = clean(elements.search.value);

    if (search) {
      params.set('search', search);
    }

    return `${endpoints.submissions}${params.toString() ? `?${params}` : ''}`;
  }

  function renderFilterOptions() {
    replaceOptions(elements.statusFilter, [
      { value: 'active', label: 'Active' },
      { value: '', label: 'All statuses' },
      ...state.options.statuses
    ]);
    replaceOptions(elements.categoryFilter, [
      { value: '', label: 'All categories' },
      ...state.options.categories
    ]);
    replaceOptions(elements.severityFilter, [
      { value: '', label: 'Any severity' },
      ...state.options.severities
    ]);
    replaceOptions(elements.appFilter, [
      { value: '', label: 'All apps' },
      ...state.sourceApps
    ]);
  }

  function renderSummary(summary) {
    for (const [key, element] of Object.entries(elements.summary)) {
      element.textContent = String(summary[key] || 0);
    }
  }

  function renderSubmissions() {
    if (state.submissions.length === 0) {
      elements.list.replaceChildren(createEmptyState('No feedback matches these filters.'));
      return;
    }

    elements.list.replaceChildren(...state.submissions.map(renderSubmissionCard));
  }

  function renderSubmissionCard(submission) {
    const card = document.createElement('article');
    card.className = `feedback-card severity-${submission.severity} status-${submission.status}`;
    card.dataset.feedbackCard = submission.id;

    const header = document.createElement('div');
    header.className = 'feedback-card-header';

    const title = document.createElement('div');
    title.className = 'feedback-card-title';

    const eyebrow = document.createElement('span');
    eyebrow.textContent = formatSource(submission);

    const heading = document.createElement('h3');
    heading.textContent = submission.message || 'Feedback';

    title.append(eyebrow, heading);

    const statusArea = document.createElement('div');
    statusArea.className = 'feedback-status-area';
    statusArea.append(
      createPill(submission.severityLabel || submission.severity, `severity-${submission.severity}`),
      createPill(submission.categoryLabel || submission.category, `category-${submission.category}`),
      createPill(submission.statusLabel || submission.status, `status-${submission.status}`)
    );

    header.append(title, statusArea);

    const meta = document.createElement('div');
    meta.className = 'feedback-card-meta';
    appendMeta(meta, 'Submitted by', formatSubmitter(submission));
    appendMeta(meta, 'Submitted', formatTimestamp(submission.createdAt));
    appendMeta(meta, 'Page', submission.sourcePath || 'Not captured');
    appendMeta(meta, 'Related', submission.relatedRecordLabel || 'None');

    const details = document.createElement('div');
    details.className = 'feedback-notes-block';
    appendNote(details, 'Message', submission.message);
    appendNote(details, 'Admin note', submission.adminNote || 'No admin note yet.');

    const controls = renderCardControls(submission);
    const message = document.createElement('p');
    message.className = 'feedback-card-message';
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');

    card.append(header, meta, details, controls, message);
    return card;
  }

  function renderCardControls(submission) {
    const controls = document.createElement('div');
    controls.className = 'feedback-card-controls';

    controls.append(
      createSelectField('Status', 'status', state.options.statuses, submission.status),
      createSelectField('Category', 'category', state.options.categories, submission.category),
      createSelectField('Severity', 'severity', state.options.severities, submission.severity),
      createTextareaField('Admin note', 'adminNote', submission.adminNote || '')
    );

    const actions = document.createElement('div');
    actions.className = 'feedback-card-actions';

    const save = document.createElement('button');
    save.className = 'primary-action compact-action';
    save.type = 'button';
    save.dataset.feedbackAction = 'save';
    save.textContent = 'Save update';

    actions.append(save);
    controls.append(actions);
    return controls;
  }

  async function handleFeedbackCardClick(event) {
    const actionButton = event.target.closest('[data-feedback-action="save"]');

    if (!actionButton) {
      return;
    }

    const card = actionButton.closest('[data-feedback-card]');
    const id = card?.dataset.feedbackCard;

    if (!id) {
      return;
    }

    const status = card.querySelector('[data-feedback-field="status"]')?.value;
    const category = card.querySelector('[data-feedback-field="category"]')?.value;
    const severity = card.querySelector('[data-feedback-field="severity"]')?.value;
    const adminNote = card.querySelector('[data-feedback-field="adminNote"]')?.value || '';
    const message = card.querySelector('.feedback-card-message');

    try {
      setCardMessage(message, '');
      await withBusyButton(actionButton, () => fetchJson(endpoints.submission(id), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          category,
          severity,
          adminNote
        })
      }));
      setCardMessage(message, 'Feedback updated.');
      await loadFeedback();
    } catch (error) {
      setCardMessage(message, error.message || 'Feedback could not be updated.', true);
    }
  }

  function createSelectField(label, name, options, value) {
    const labelElement = document.createElement('label');
    labelElement.textContent = label;

    const select = document.createElement('select');
    select.dataset.feedbackField = name;

    for (const option of options) {
      select.append(createOption(option.value, option.label, option.value === value));
    }

    labelElement.append(select);
    return labelElement;
  }

  function createTextareaField(label, name, value) {
    const labelElement = document.createElement('label');
    labelElement.textContent = label;

    const textarea = document.createElement('textarea');
    textarea.dataset.feedbackField = name;
    textarea.rows = 3;
    textarea.value = value;

    labelElement.append(textarea);
    return labelElement;
  }

  function appendMeta(container, label, value) {
    const item = document.createElement('div');
    item.className = 'feedback-meta-item';

    const labelElement = document.createElement('span');
    labelElement.textContent = label;

    const valueElement = document.createElement('strong');
    valueElement.textContent = value || 'Not set';

    item.append(labelElement, valueElement);
    container.append(item);
  }

  function appendNote(container, label, value) {
    const note = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    const text = document.createElement('span');
    text.textContent = value || 'Not set';
    note.append(strong, text);
    container.append(note);
  }

  function createPill(label, className) {
    const pill = document.createElement('span');
    pill.className = `feedback-pill ${className}`;
    pill.textContent = label;
    return pill;
  }

  function replaceOptions(select, options) {
    const selected = select.value;
    select.replaceChildren(...options.map((option) => createOption(option.value, option.label, option.value === selected)));

    if (options.some((option) => option.value === selected)) {
      select.value = selected;
    }
  }

  function createOption(value, label, selected = false) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = selected;
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
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Saving...';

    try {
      return await callback();
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function setListStatus(message, isError = false) {
    elements.listStatus.textContent = message;
    elements.listStatus.classList.toggle('is-error', isError);
  }

  function setCardMessage(element, message, isError = false) {
    if (!element) {
      return;
    }

    element.textContent = message || '';
    element.classList.toggle('is-error', isError);
  }

  function formatListStatus(count) {
    return `${count} feedback note${count === 1 ? '' : 's'} shown.`;
  }

  function formatSource(submission) {
    return [submission.sourceAppLabel || submission.sourceAppSlug || 'Unknown app', submission.sourcePageTitle]
      .filter(Boolean)
      .join(' / ');
  }

  function formatSubmitter(submission) {
    return submission.submittedByDisplayName || submission.submittedByUsername || 'Unknown staff';
  }

  function formatTimestamp(value) {
    if (!value) {
      return 'Not captured';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Not captured';
    }

    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function clean(value) {
    return String(value || '').trim();
  }
})();
