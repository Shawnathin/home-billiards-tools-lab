(() => {
  const endpoints = {
    visits: '/api/apps/schedule-board/visits'
  };

  const fallbackOptions = {
    assignments: [
      { value: 'hbs_internal', label: 'HBS Internal' },
      { value: 'hbs_external', label: 'HBS External' }
    ],
    visitStatuses: [
      { value: 'pending', label: 'Pending' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' }
    ],
    scheduleStates: [
      { value: 'unscheduled', label: 'Unscheduled' },
      { value: 'booked', label: 'Booked' }
    ]
  };

  const sectionConfig = {
    today: {
      list: document.getElementById('todayVisitsList'),
      count: document.getElementById('todayVisitsSectionCount'),
      empty: 'No visits booked for today.'
    },
    upcoming: {
      list: document.getElementById('upcomingVisitsList'),
      count: document.getElementById('upcomingVisitsSectionCount'),
      empty: 'No upcoming booked visits.'
    },
    unscheduled: {
      list: document.getElementById('unscheduledVisitsList'),
      count: document.getElementById('unscheduledVisitsSectionCount'),
      empty: 'No unscheduled visits match these filters.'
    },
    completed: {
      list: document.getElementById('completedVisitsList'),
      count: document.getElementById('completedVisitsSectionCount'),
      empty: 'No completed or follow-up visits match these filters.'
    }
  };

  const state = {
    visits: [],
    options: fallbackOptions,
    searchTimer: null
  };

  const elements = {
    boardStatus: document.getElementById('scheduleBoardStatus'),
    refreshButton: document.getElementById('refreshScheduleBoard'),
    search: document.getElementById('scheduleSearch'),
    viewFilter: document.getElementById('scheduleViewFilter'),
    assignmentFilter: document.getElementById('scheduleAssignmentFilter'),
    visitStatusFilter: document.getElementById('scheduleVisitStatusFilter'),
    scheduleStateFilter: document.getElementById('scheduleStateFilter'),
    dateFromFilter: document.getElementById('scheduleDateFromFilter'),
    dateToFilter: document.getElementById('scheduleDateToFilter'),
    sections: Array.from(document.querySelectorAll('[data-schedule-section]')),
    summary: {
      todayCount: document.getElementById('scheduleTodayCount'),
      upcomingCount: document.getElementById('scheduleUpcomingCount'),
      unscheduledCount: document.getElementById('scheduleUnscheduledCount'),
      completedCount: document.getElementById('scheduleCompletedCount'),
      totalCount: document.getElementById('scheduleTotalCount')
    }
  };

  if (!elements.boardStatus) {
    return;
  }

  initScheduleBoard();

  function initScheduleBoard() {
    bindEvents();
    loadVisits();
  }

  function bindEvents() {
    elements.refreshButton.addEventListener('click', loadVisits);

    for (const filter of [
      elements.viewFilter,
      elements.assignmentFilter,
      elements.visitStatusFilter,
      elements.scheduleStateFilter,
      elements.dateFromFilter,
      elements.dateToFilter
    ]) {
      filter.addEventListener('change', loadVisits);
    }

    elements.search.addEventListener('input', () => {
      window.clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(loadVisits, 240);
    });
  }

  async function loadVisits() {
    try {
      setBoardStatus('Loading visits...');
      const payload = await fetchJson(buildVisitsUrl());
      state.options = {
        assignments: payload.options?.assignments || fallbackOptions.assignments,
        visitStatuses: payload.options?.visitStatuses || fallbackOptions.visitStatuses,
        scheduleStates: payload.options?.scheduleStates || fallbackOptions.scheduleStates
      };
      state.visits = payload.visits || payload.cards || [];

      renderFilterOptions();
      renderSummary(payload.summary || {});
      renderSections();
      setBoardStatus(formatBoardStatus(state.visits.length));
    } catch (error) {
      setBoardStatus(error.message || 'Schedule Board could not load.', true);
      for (const config of Object.values(sectionConfig)) {
        config.list.replaceChildren(createEmptyState('Schedule Board data could not load.'));
        config.count.textContent = '0';
      }
    }
  }

  function buildVisitsUrl() {
    const params = new URLSearchParams();
    const search = clean(elements.search.value);

    if (search) {
      params.set('search', search);
    }

    if (elements.viewFilter.value) {
      params.set('view', elements.viewFilter.value);
    }

    if (elements.assignmentFilter.value) {
      params.set('assignment', elements.assignmentFilter.value);
    }

    if (elements.visitStatusFilter.value) {
      params.set('visitStatus', elements.visitStatusFilter.value);
    }

    if (elements.scheduleStateFilter.value) {
      params.set('scheduleState', elements.scheduleStateFilter.value);
    }

    if (elements.dateFromFilter.value) {
      params.set('dateFrom', elements.dateFromFilter.value);
    }

    if (elements.dateToFilter.value) {
      params.set('dateTo', elements.dateToFilter.value);
    }

    return `${endpoints.visits}${params.toString() ? `?${params}` : ''}`;
  }

  function renderFilterOptions() {
    replaceOptions(elements.assignmentFilter, [
      { value: '', label: 'All assignments' },
      ...state.options.assignments
    ]);
    replaceOptions(elements.visitStatusFilter, [
      { value: '', label: 'Active visits' },
      ...state.options.visitStatuses
    ]);
    replaceOptions(elements.scheduleStateFilter, [
      { value: '', label: 'Any state' },
      ...state.options.scheduleStates
    ]);
  }

  function renderSummary(summary) {
    for (const [key, element] of Object.entries(elements.summary)) {
      element.textContent = String(summary[key] || 0);
    }
  }

  function renderSections() {
    const grouped = {
      today: [],
      upcoming: [],
      unscheduled: [],
      completed: []
    };

    for (const visit of state.visits) {
      const category = grouped[visit.boardCategory] ? visit.boardCategory : 'completed';
      grouped[category].push(visit);
    }

    for (const [category, config] of Object.entries(sectionConfig)) {
      const visits = grouped[category] || [];
      config.count.textContent = String(visits.length);

      if (visits.length === 0) {
        config.list.replaceChildren(createEmptyState(config.empty));
      } else {
        config.list.replaceChildren(...visits.map(renderVisitCard));
      }
    }

    updateVisibleSections();
  }

  function updateVisibleSections() {
    const view = elements.viewFilter.value;

    for (const section of elements.sections) {
      section.hidden = Boolean(view && section.dataset.scheduleSection !== view);
    }
  }

  function renderVisitCard(visit) {
    const card = document.createElement('article');
    card.className = `schedule-visit-card category-${visit.boardCategory} status-${visit.visitStatus}`;
    card.dataset.feedbackRelatedRecordType = 'job_work_order_visit';
    card.dataset.feedbackRelatedRecordId = visit.id;
    card.dataset.feedbackRelatedRecordLabel = `${visit.workOrderNumber || 'Work order'} visit ${visit.visitNumber || ''}`.trim();

    const header = document.createElement('div');
    header.className = 'schedule-card-header';

    const title = document.createElement('div');
    title.className = 'schedule-card-title';

    const eyebrow = document.createElement('span');
    eyebrow.textContent = [visit.workOrderNumber, visit.visitNumber ? `Visit ${visit.visitNumber}` : 'Visit']
      .filter(Boolean)
      .join(' / ');

    const heading = document.createElement('h3');
    heading.textContent = visit.displayTitle || visit.workOrderTitle || 'Work order visit';

    const customer = document.createElement('p');
    customer.textContent = [visit.customerName, visit.customerCompany].filter(Boolean).join(' / ');

    title.append(eyebrow, heading, customer);

    const statusArea = document.createElement('div');
    statusArea.className = 'schedule-status-area';
    statusArea.append(
      createPill(visit.scheduleStateLabel || visit.scheduleState, `state-${visit.scheduleState}`),
      createPill(visit.visitStatusLabel || visit.visitStatus, `status-${visit.visitStatus}`),
      createPill(visit.assignedToLabel || visit.assignedTo, `assignment-${visit.assignedTo}`)
    );

    header.append(title, statusArea);

    const meta = document.createElement('div');
    meta.className = 'schedule-card-meta';
    appendMeta(meta, 'Date', formatDate(visit.scheduledDate));
    appendMeta(meta, 'Window', visit.windowLabel || visit.anytimeLabel || 'Not set');
    appendMeta(meta, 'Time', visit.timeLabel || 'Not set');
    appendMeta(meta, 'Visit type', visit.visitTypeLabel || 'Visit');
    appendMeta(meta, 'Work order status', visit.workOrderStatusLabel || visit.workOrderStatus);
    appendMeta(meta, 'Contact', formatContact(visit));

    const details = document.createElement('div');
    details.className = 'schedule-detail-block';
    appendDetail(details, 'Location', visit.locationSummary);
    appendDetail(details, 'Instructions', visit.visitInstructions || visit.timingNotes || 'No visit instructions.');

    if (visit.completionNotes || visit.cancellationReason) {
      appendDetail(details, 'Follow-up', visit.completionNotes || visit.cancellationReason);
    }

    const actions = document.createElement('div');
    actions.className = 'schedule-card-actions';

    const link = document.createElement('a');
    link.className = 'secondary-action compact-action schedule-open-link';
    link.href = visit.workOrderUrl || '/apps/jobs-work-orders';
    link.textContent = 'Open Work Orders';

    actions.append(link);
    card.append(header, meta, details, actions);
    return card;
  }

  function appendMeta(container, label, value) {
    const item = document.createElement('div');
    item.className = 'schedule-meta-item';

    const labelElement = document.createElement('span');
    labelElement.textContent = label;

    const valueElement = document.createElement('strong');
    valueElement.textContent = value || 'Not set';

    item.append(labelElement, valueElement);
    container.append(item);
  }

  function appendDetail(container, label, value) {
    const detail = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    const text = document.createElement('span');
    text.textContent = value || 'Not set';
    detail.append(strong, text);
    container.append(detail);
  }

  function createPill(label, className) {
    const pill = document.createElement('span');
    pill.className = `schedule-pill ${className}`;
    pill.textContent = label || 'Not set';
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

  function setBoardStatus(message, isError = false) {
    elements.boardStatus.textContent = message;
    elements.boardStatus.classList.toggle('is-error', isError);
  }

  function formatBoardStatus(count) {
    return `${count} visit${count === 1 ? '' : 's'} shown.`;
  }

  function formatContact(visit) {
    return [visit.phone, visit.email].filter(Boolean).join(' / ') || 'Not set';
  }

  function formatDate(value) {
    if (!value) {
      return 'Unscheduled';
    }

    const parts = String(value).split('-').map(Number);

    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
      return value;
    }

    const date = new Date(parts[0], parts[1] - 1, parts[2]);

    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function clean(value) {
    return String(value || '').trim();
  }
})();
