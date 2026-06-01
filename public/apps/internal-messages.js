(() => {
  const endpoints = {
    bootstrap: '/api/apps/internal-messages/bootstrap',
    threads: '/api/apps/internal-messages/threads',
    thread: (id) => `/api/apps/internal-messages/threads/${id}`,
    posts: (id) => `/api/apps/internal-messages/threads/${id}/posts`,
    read: (id) => `/api/apps/internal-messages/threads/${id}/read`
  };

  const fallbackOptions = {
    statuses: [
      { value: 'open', label: 'Open' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'archived', label: 'Archived' }
    ],
    priorities: [
      { value: 'normal', label: 'Normal' },
      { value: 'needs_attention', label: 'Needs attention' },
      { value: 'urgent', label: 'Urgent' }
    ],
    relatedRecordTypes: [
      { value: 'general', label: 'General' },
      { value: 'work_order', label: 'Work order' },
      { value: 'customer_contact', label: 'Customer contact' },
      { value: 'warranty_service_ticket', label: 'Warranty / service ticket' },
      { value: 'cue_repair', label: 'Cue repair' },
      { value: 'product_inventory', label: 'Product / inventory' }
    ]
  };

  const state = {
    options: fallbackOptions,
    threads: [],
    selectedThreadId: null,
    selectedThread: null,
    selectedPosts: [],
    searchTimer: null
  };

  const elements = {
    list: document.getElementById('internalMessagesThreadList'),
    listStatus: document.getElementById('internalMessagesListStatus'),
    refreshButton: document.getElementById('internalMessagesRefresh'),
    search: document.getElementById('internalMessagesSearch'),
    statusFilter: document.getElementById('internalMessagesStatusFilter'),
    priorityFilter: document.getElementById('internalMessagesPriorityFilter'),
    recordTypeFilter: document.getElementById('internalMessagesRecordTypeFilter'),
    unreadFilter: document.getElementById('internalMessagesUnreadFilter'),
    newForm: document.getElementById('internalMessagesNewForm'),
    newStatus: document.getElementById('internalMessagesNewStatus'),
    createButton: document.getElementById('internalMessagesCreateButton'),
    subject: document.getElementById('internalMessagesSubject'),
    body: document.getElementById('internalMessagesBody'),
    priority: document.getElementById('internalMessagesPriority'),
    relatedRecordType: document.getElementById('internalMessagesRelatedRecordType'),
    relatedRecordId: document.getElementById('internalMessagesRelatedRecordId'),
    relatedRecordLabel: document.getElementById('internalMessagesRelatedRecordLabel'),
    detailEmpty: document.getElementById('internalMessagesDetailEmpty'),
    detailContent: document.getElementById('internalMessagesDetailContent'),
    detailEyebrow: document.getElementById('internalMessagesDetailEyebrow'),
    detailSubject: document.getElementById('internalMessagesDetailSubject'),
    detailMeta: document.getElementById('internalMessagesDetailMeta'),
    detailStatus: document.getElementById('internalMessagesDetailStatus'),
    detailPriority: document.getElementById('internalMessagesDetailPriority'),
    detailStatusMessage: document.getElementById('internalMessagesDetailStatusMessage'),
    posts: document.getElementById('internalMessagesPosts'),
    replyForm: document.getElementById('internalMessagesReplyForm'),
    replyBody: document.getElementById('internalMessagesReplyBody'),
    replyButton: document.getElementById('internalMessagesReplyButton'),
    summary: {
      openCount: document.getElementById('internalMessagesOpenCount'),
      needsAttentionCount: document.getElementById('internalMessagesNeedsAttentionCount'),
      urgentCount: document.getElementById('internalMessagesUrgentCount'),
      closedCount: document.getElementById('internalMessagesClosedCount')
    }
  };

  if (!elements.list) {
    return;
  }

  initInternalMessages();

  async function initInternalMessages() {
    bindEvents();

    try {
      await loadBootstrap();
    } finally {
      loadThreads();
    }
  }

  function bindEvents() {
    elements.refreshButton.addEventListener('click', loadThreads);
    elements.newForm.addEventListener('submit', handleCreateThread);
    elements.list.addEventListener('click', handleThreadListClick);
    elements.replyForm.addEventListener('submit', handleReplySubmit);
    elements.detailStatus.addEventListener('change', () => handleThreadPatch('status', elements.detailStatus.value));
    elements.detailPriority.addEventListener('change', () => handleThreadPatch('priority', elements.detailPriority.value));

    for (const filter of [
      elements.statusFilter,
      elements.priorityFilter,
      elements.recordTypeFilter,
      elements.unreadFilter
    ]) {
      filter.addEventListener('change', loadThreads);
    }

    elements.search.addEventListener('input', () => {
      window.clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(loadThreads, 240);
    });
  }

  async function loadBootstrap() {
    const payload = await fetchJson(endpoints.bootstrap);
    state.options = mergeOptions(payload.options);
    renderFilterOptions();
    renderNewFormOptions();
    renderSummary(payload.summary || {});
  }

  async function loadThreads() {
    try {
      setListStatus('Loading threads...');
      const payload = await fetchJson(buildThreadsUrl());
      state.options = mergeOptions(payload.options);
      state.threads = payload.threads || [];

      renderFilterOptions();
      renderNewFormOptions();
      renderSummary(payload.summary || {});
      renderThreads();
      setListStatus(formatListStatus(state.threads.length));
    } catch (error) {
      setListStatus(error.message || 'Threads could not load.', true);
      elements.list.replaceChildren(createEmptyState('Internal messages could not load.'));
    }
  }

  function buildThreadsUrl() {
    const params = new URLSearchParams();
    const search = clean(elements.search.value);

    if (search) {
      params.set('search', search);
    }

    if (elements.statusFilter.value) {
      params.set('status', elements.statusFilter.value);
    }

    if (elements.priorityFilter.value) {
      params.set('priority', elements.priorityFilter.value);
    }

    if (elements.recordTypeFilter.value) {
      params.set('relatedRecordType', elements.recordTypeFilter.value);
    }

    if (elements.unreadFilter.checked) {
      params.set('unread', 'true');
    }

    return `${endpoints.threads}${params.toString() ? `?${params}` : ''}`;
  }

  function renderFilterOptions() {
    const statusOptions = [
      { value: 'open', label: 'Open' },
      { value: '', label: 'All statuses' },
      ...state.options.statuses.filter((option) => option.value !== 'open')
    ];

    replaceOptions(elements.statusFilter, statusOptions);
    replaceOptions(elements.priorityFilter, [
      { value: '', label: 'Any priority' },
      ...state.options.priorities
    ]);
    replaceOptions(elements.recordTypeFilter, [
      { value: '', label: 'Any record type' },
      ...state.options.relatedRecordTypes
    ]);
  }

  function renderNewFormOptions() {
    replaceOptions(elements.priority, state.options.priorities);
    replaceOptions(elements.relatedRecordType, [
      { value: '', label: 'No record link' },
      ...state.options.relatedRecordTypes
    ]);
  }

  function renderSummary(summary) {
    for (const [key, element] of Object.entries(elements.summary)) {
      element.textContent = String(summary[key] || 0);
    }
  }

  function renderThreads() {
    if (state.threads.length === 0) {
      elements.list.replaceChildren(createEmptyState('No threads match these filters.'));
      return;
    }

    elements.list.replaceChildren(...state.threads.map(renderThreadCard));
  }

  function renderThreadCard(thread) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `internal-messages-thread-card status-${thread.status} priority-${thread.priority}`;
    card.classList.toggle('is-unread', Boolean(thread.unread));
    card.classList.toggle('is-selected', thread.id === state.selectedThreadId);
    card.dataset.threadId = thread.id;

    const header = document.createElement('div');
    header.className = 'internal-messages-thread-card-header';

    const titleBlock = document.createElement('div');
    titleBlock.className = 'internal-messages-thread-title';

    const eyebrow = document.createElement('span');
    eyebrow.textContent = formatRecordLabel(thread);

    const subject = document.createElement('strong');
    subject.textContent = thread.subject || 'Thread';

    titleBlock.append(eyebrow, subject);

    const pillArea = document.createElement('div');
    pillArea.className = 'internal-messages-pill-area';
    pillArea.append(
      createPill(thread.priorityLabel || thread.priority, `priority-${thread.priority}`),
      createPill(thread.statusLabel || thread.status, `status-${thread.status}`)
    );

    header.append(titleBlock, pillArea);

    const snippet = document.createElement('p');
    snippet.className = 'internal-messages-thread-snippet';
    snippet.textContent = thread.lastPostSnippet || 'No messages yet.';

    const meta = document.createElement('div');
    meta.className = 'internal-messages-thread-meta';
    meta.append(
      createMetaItem('Posts', String(thread.postCount || 0)),
      createMetaItem('Last', formatTimestamp(thread.lastMessageAt)),
      createMetaItem('By', thread.lastPostByDisplayName || thread.createdByDisplayName || 'Staff')
    );

    if (thread.unread) {
      const unread = document.createElement('span');
      unread.className = 'internal-messages-unread-marker';
      unread.textContent = 'Unread';
      meta.append(unread);
    }

    card.append(header, snippet, meta);
    return card;
  }

  async function handleThreadListClick(event) {
    const card = event.target.closest('[data-thread-id]');

    if (!card) {
      return;
    }

    await openThread(card.dataset.threadId);
  }

  async function openThread(id) {
    if (!id) {
      return;
    }

    state.selectedThreadId = id;
    renderThreads();
    setDetailStatus('Loading thread...');

    try {
      const payload = await fetchJson(endpoints.thread(id));
      state.selectedThread = payload.thread;
      state.selectedPosts = payload.posts || [];
      state.options = mergeOptions(payload.options);

      renderDetail();
      await markSelectedThreadRead(id);
      await loadThreads();
    } catch (error) {
      setDetailStatus(error.message || 'Thread could not load.', true);
    }
  }

  async function markSelectedThreadRead(id) {
    try {
      await fetchJson(endpoints.read(id), { method: 'POST' });
    } catch (error) {
      setDetailStatus(error.message || 'Thread opened, but read state could not be saved.', true);
    }
  }

  function renderDetail() {
    const thread = state.selectedThread;

    if (!thread) {
      elements.detailEmpty.hidden = false;
      elements.detailContent.hidden = true;
      return;
    }

    elements.detailEmpty.hidden = true;
    elements.detailContent.hidden = false;
    elements.detailSubject.textContent = thread.subject || 'Thread';
    elements.detailEyebrow.textContent = formatRecordLabel(thread);
    elements.detailMeta.textContent = formatThreadMeta(thread);
    setFeedbackContext(thread);

    replaceOptions(elements.detailStatus, state.options.statuses, thread.status);
    replaceOptions(elements.detailPriority, state.options.priorities, thread.priority);

    if (state.selectedPosts.length === 0) {
      elements.posts.replaceChildren(createEmptyState('No posts yet.'));
    } else {
      elements.posts.replaceChildren(...state.selectedPosts.map(renderPost));
    }

    setDetailStatus('');
  }

  function renderPost(post) {
    const article = document.createElement('article');
    article.className = 'internal-messages-post';

    const header = document.createElement('div');
    header.className = 'internal-messages-post-header';

    const author = document.createElement('strong');
    author.textContent = post.createdByDisplayName || 'Staff';

    const timestamp = document.createElement('span');
    timestamp.textContent = formatTimestamp(post.createdAt);

    header.append(author, timestamp);

    const body = document.createElement('p');
    body.textContent = post.body || '';

    article.append(header, body);
    return article;
  }

  async function handleCreateThread(event) {
    event.preventDefault();

    const subject = clean(elements.subject.value);
    const body = clean(elements.body.value);

    if (!subject) {
      setNewStatus('Add a subject before creating a thread.', true);
      elements.subject.focus();
      return;
    }

    if (!body) {
      setNewStatus('Add the first message before creating a thread.', true);
      elements.body.focus();
      return;
    }

    const payload = {
      subject,
      body,
      priority: elements.priority.value,
      relatedRecordType: elements.relatedRecordType.value,
      relatedRecordId: clean(elements.relatedRecordId.value),
      relatedRecordLabel: clean(elements.relatedRecordLabel.value)
    };

    try {
      setNewStatus('');
      const response = await withBusyButton(elements.createButton, 'Creating...', () => fetchJson(endpoints.threads, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }));

      elements.newForm.reset();
      setNewStatus('Thread created.');
      await openThread(response.thread?.id);
    } catch (error) {
      setNewStatus(error.message || 'Thread could not be created.', true);
    }
  }

  async function handleReplySubmit(event) {
    event.preventDefault();

    const body = clean(elements.replyBody.value);

    if (!state.selectedThreadId) {
      setDetailStatus('Select a thread before replying.', true);
      return;
    }

    if (!body) {
      setDetailStatus('Write a reply before posting.', true);
      elements.replyBody.focus();
      return;
    }

    try {
      setDetailStatus('');
      await withBusyButton(elements.replyButton, 'Posting...', () => fetchJson(endpoints.posts(state.selectedThreadId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body })
      }));

      elements.replyForm.reset();
      setDetailStatus('Reply posted.');
      await openThread(state.selectedThreadId);
    } catch (error) {
      setDetailStatus(error.message || 'Reply could not be posted.', true);
    }
  }

  async function handleThreadPatch(field, value) {
    if (!state.selectedThreadId || !field) {
      return;
    }

    try {
      setDetailControlsDisabled(true);
      setDetailStatus('Saving...');
      const response = await fetchJson(endpoints.thread(state.selectedThreadId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [field]: value })
      });

      state.selectedThread = response.thread;
      setDetailStatus('Thread updated.');
      await loadThreads();
    } catch (error) {
      renderDetail();
      setDetailStatus(error.message || 'Thread could not be updated.', true);
    } finally {
      setDetailControlsDisabled(false);
    }
  }

  function setDetailControlsDisabled(disabled) {
    elements.detailStatus.disabled = disabled;
    elements.detailPriority.disabled = disabled;
  }

  function mergeOptions(options = {}) {
    return {
      statuses: options.statuses || fallbackOptions.statuses,
      priorities: options.priorities || fallbackOptions.priorities,
      relatedRecordTypes: options.relatedRecordTypes || fallbackOptions.relatedRecordTypes
    };
  }

  function replaceOptions(select, options, explicitValue) {
    const selected = explicitValue ?? select.value;
    select.replaceChildren(...options.map((option) => createOption(option.value, option.label, option.value === selected)));

    if (options.some((option) => option.value === selected)) {
      select.value = selected;
    } else if (options.length > 0) {
      select.value = options[0].value;
    }
  }

  function createOption(value, label, selected = false) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = selected;
    return option;
  }

  function createPill(label, className) {
    const pill = document.createElement('span');
    pill.className = `internal-messages-pill ${className}`;
    pill.textContent = label || 'Not set';
    return pill;
  }

  function createMetaItem(label, value) {
    const item = document.createElement('span');
    item.textContent = `${label}: ${value || 'Not set'}`;
    return item;
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

  async function withBusyButton(button, busyText, callback) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = busyText;

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

  function setNewStatus(message, isError = false) {
    elements.newStatus.textContent = message;
    elements.newStatus.classList.toggle('is-error', isError);
  }

  function setDetailStatus(message, isError = false) {
    elements.detailStatusMessage.textContent = message || '';
    elements.detailStatusMessage.classList.toggle('is-error', isError);
  }

  function formatListStatus(count) {
    return `${count} thread${count === 1 ? '' : 's'} shown.`;
  }

  function formatRecordLabel(thread) {
    const typeLabel = thread.relatedRecordTypeLabel || labelFor(state.options.relatedRecordTypes, thread.relatedRecordType);
    const recordLabel = thread.relatedRecordLabel || thread.relatedRecordId;

    if (typeLabel && recordLabel) {
      return `${typeLabel} / ${recordLabel}`;
    }

    return typeLabel || recordLabel || 'General';
  }

  function formatThreadMeta(thread) {
    return [
      `Started by ${thread.createdByDisplayName || 'Staff'}`,
      `${thread.postCount || 0} post${thread.postCount === 1 ? '' : 's'}`,
      `Last message ${formatTimestamp(thread.lastMessageAt)}`
    ].join(' / ');
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

  function setFeedbackContext(thread) {
    if (!elements.detailContent) {
      return;
    }

    if (thread.relatedRecordType) {
      elements.detailContent.dataset.feedbackRelatedRecordType = thread.relatedRecordType;
      elements.detailContent.dataset.feedbackRelatedRecordId = thread.relatedRecordId || '';
      elements.detailContent.dataset.feedbackRelatedRecordLabel = thread.relatedRecordLabel || thread.subject || '';
      return;
    }

    delete elements.detailContent.dataset.feedbackRelatedRecordType;
    delete elements.detailContent.dataset.feedbackRelatedRecordId;
    delete elements.detailContent.dataset.feedbackRelatedRecordLabel;
  }

  function labelFor(options, value) {
    return options.find((option) => option.value === value)?.label || value || '';
  }

  function clean(value) {
    return String(value || '').trim();
  }
})();
