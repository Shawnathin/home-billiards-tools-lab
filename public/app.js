(() => {
  const loginMessage = document.querySelector('#loginMessage');
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  const loginMessages = {
    missing: 'Choose a user and enter a login code.',
    login: 'That login did not work. Check the user and code, then try again.'
  };

  if (loginMessage && error && loginMessages[error]) {
    loginMessage.textContent = loginMessages[error];
  }

  const elements = {
    modal: document.getElementById('feedbackModal'),
    form: document.getElementById('feedbackForm'),
    openButton: document.getElementById('openFeedbackButton'),
    closeButton: document.getElementById('closeFeedbackButton'),
    cancelButton: document.getElementById('cancelFeedbackButton'),
    submitButton: document.getElementById('submitFeedbackButton'),
    message: document.getElementById('feedbackMessage'),
    category: document.getElementById('feedbackCategory'),
    severity: document.getElementById('feedbackSeverity'),
    formMessage: document.getElementById('feedbackFormMessage')
  };

  if (!elements.modal || !elements.form || !elements.openButton) {
    return;
  }

  bindFeedbackEvents();

  function bindFeedbackEvents() {
    elements.openButton.addEventListener('click', openFeedbackModal);
    elements.closeButton.addEventListener('click', closeFeedbackModal);
    elements.cancelButton.addEventListener('click', closeFeedbackModal);
    elements.form.addEventListener('submit', handleFeedbackSubmit);
    elements.message.addEventListener('invalid', handleFeedbackInvalid);
    elements.modal.addEventListener('click', (event) => {
      if (event.target === elements.modal) {
        closeFeedbackModal();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.modal.hidden) {
        closeFeedbackModal();
      }
    });
  }

  function openFeedbackModal() {
    elements.modal.hidden = false;
    document.body.classList.add('has-feedback-modal');
    setFeedbackMessage('');
    window.setTimeout(() => elements.message.focus(), 0);
  }

  function closeFeedbackModal() {
    elements.modal.hidden = true;
    document.body.classList.remove('has-feedback-modal');
    resetFeedbackForm();
    elements.openButton.focus();
  }

  async function handleFeedbackSubmit(event) {
    event.preventDefault();

    const message = clean(elements.message.value);

    if (!message) {
      setFeedbackMessage('Tell us what happened before sending feedback.', true);
      elements.message.focus();
      return;
    }

    try {
      setFeedbackMessage('');
      await withBusyButton(elements.submitButton, () => submitFeedback({
        message,
        category: elements.category.value,
        severity: elements.severity.value,
        ...collectFeedbackContext()
      }));
      setFeedbackMessage('Thanks \u2014 feedback sent.');
      window.setTimeout(closeFeedbackModal, 900);
    } catch (submitError) {
      setFeedbackMessage(submitError.message || 'Feedback could not be sent.', true);
    }
  }

  function handleFeedbackInvalid(event) {
    event.preventDefault();
    setFeedbackMessage('Tell us what happened before sending feedback.', true);
    elements.message.focus();
  }

  async function submitFeedback(payload) {
    const response = await fetch('/api/apps/feedback/submissions', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const contentType = response.headers.get('content-type') || '';

    if (response.redirected || contentType.includes('text/html')) {
      window.location.href = '/';
      throw new Error('Please log in again.');
    }

    let payloadJson = null;

    if (contentType.includes('application/json')) {
      payloadJson = await response.json();
    }

    if (!response.ok) {
      throw new Error(payloadJson?.error || 'Feedback could not be sent.');
    }

    return payloadJson || {};
  }

  function collectFeedbackContext() {
    const shell = document.querySelector('.ops-shell');
    const related = document.querySelector('[data-feedback-related-record-type], [data-related-record-type]');

    return {
      sourceAppSlug: shell?.dataset.feedbackSourceAppSlug || inferSourceAppSlug(),
      sourceAppLabel: shell?.dataset.feedbackSourceAppLabel || inferSourceAppLabel(),
      sourcePath: `${window.location.pathname}${window.location.search}`,
      sourceUrl: window.location.href,
      sourcePageTitle: document.title,
      relatedRecordType: readDatasetValue(related, 'feedbackRelatedRecordType') || readDatasetValue(related, 'relatedRecordType'),
      relatedRecordId: readDatasetValue(related, 'feedbackRelatedRecordId') || readDatasetValue(related, 'relatedRecordId'),
      relatedRecordLabel: readDatasetValue(related, 'feedbackRelatedRecordLabel') || readDatasetValue(related, 'relatedRecordLabel')
    };
  }

  function inferSourceAppSlug() {
    const match = window.location.pathname.match(/^\/apps\/([^/]+)/);
    return match ? match[1] : 'dashboard';
  }

  function inferSourceAppLabel() {
    const activeNav = document.querySelector('.ops-nav-link.is-active');
    return activeNav?.textContent?.trim() || document.title.replace(' | Home Billiards Tools Lab', '');
  }

  async function withBusyButton(button, callback) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Sending...';

    try {
      return await callback();
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function resetFeedbackForm() {
    elements.form.reset();
    setFeedbackMessage('');
  }

  function setFeedbackMessage(message, isError = false) {
    elements.formMessage.textContent = message;
    elements.formMessage.classList.toggle('is-error', isError);
  }

  function readDatasetValue(element, key) {
    return element?.dataset?.[key] || '';
  }

  function clean(value) {
    return String(value || '').trim();
  }
})();
