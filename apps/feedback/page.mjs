import { renderAppShell } from '../../src/utils/app-shell.mjs';
import { escapeHtml } from '../../src/utils/html.mjs';

export function renderFeedbackPage({ user }) {
  const displayName = escapeHtml(user?.displayName || 'staff');

  return renderAppShell({
    title: 'Feedback Inbox',
    user,
    activePath: '/apps/feedback',
    styles: ['/apps/feedback.css'],
    scripts: ['/apps/feedback.js'],
    mainLabel: 'Feedback Inbox app',
    content: `
    <div class="feedback-shell">
      <section class="feedback-panel glass-panel" aria-label="Feedback Inbox app">
        <div class="feedback-title-row">
          <div>
            <p class="eyebrow">Internal review</p>
            <h1>Feedback Inbox</h1>
            <p class="welcome-line">Welcome, ${displayName}. Review staff notes about bugs, confusion, missing fields, workflow issues, and feature ideas.</p>
          </div>
          <p class="feedback-mode-pill">v1</p>
        </div>

        <div class="feedback-summary-grid" aria-label="Feedback summary">
          <article class="feedback-stat-card">
            <span>New</span>
            <strong id="feedbackNewCount">0</strong>
          </article>
          <article class="feedback-stat-card">
            <span>Reviewing</span>
            <strong id="feedbackReviewingCount">0</strong>
          </article>
          <article class="feedback-stat-card">
            <span>Accepted</span>
            <strong id="feedbackAcceptedCount">0</strong>
          </article>
          <article class="feedback-stat-card">
            <span>High/Blocking</span>
            <strong id="feedbackHighBlockingCount">0</strong>
          </article>
          <article class="feedback-stat-card">
            <span>Resolved</span>
            <strong id="feedbackResolvedCount">0</strong>
          </article>
        </div>

        <section class="feedback-list-pane" aria-labelledby="feedbackListHeading">
          <div class="feedback-pane-heading feedback-list-heading">
            <div>
              <h2 id="feedbackListHeading">Staff feedback</h2>
              <p id="feedbackListStatus" class="feedback-message" role="status" aria-live="polite">Loading feedback...</p>
            </div>
            <button id="refreshFeedback" class="secondary-action compact-action" type="button">Refresh</button>
          </div>

          <div class="feedback-filter-grid">
            <label class="wide-filter">
              Search
              <input id="feedbackSearch" type="search" placeholder="Message, note, person, app, path" />
            </label>
            <label>
              Status
              <select id="feedbackStatusFilter">
                <option value="active">Active</option>
                <option value="">All statuses</option>
              </select>
            </label>
            <label>
              Category
              <select id="feedbackCategoryFilter">
                <option value="">All categories</option>
              </select>
            </label>
            <label>
              Severity
              <select id="feedbackSeverityFilter">
                <option value="">Any severity</option>
              </select>
            </label>
            <label>
              App
              <select id="feedbackAppFilter">
                <option value="">All apps</option>
              </select>
            </label>
          </div>

          <div id="feedbackList" class="feedback-card-list" aria-live="polite"></div>
        </section>
      </section>
    </div>`
  });
}
