import { getAppByPath, getEnabledApps } from '../app-registry.mjs';
import { escapeHtml } from './html.mjs';

const dashboardNavItem = {
  name: 'Dashboard',
  path: '/dashboard'
};

export function renderAppShell({
  title,
  user,
  activePath,
  styles = [],
  scripts = [],
  content,
  mainLabel = 'Home Billiards Tools Lab'
}) {
  const displayName = user?.displayName || user?.username || 'Staff';
  const userRole = formatRole(user?.role);
  const pageTitle =
    title === 'Home Billiards Tools Lab'
      ? 'Home Billiards Tools Lab'
      : `${title} | Home Billiards Tools Lab`;
  const navApps = getEnabledApps({ user });
  const feedbackContext = getFeedbackSourceContext(activePath);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(pageTitle)}</title>
    <link rel="stylesheet" href="/styles.css" />
    ${styles.map(renderStylesheet).join('\n    ')}
    ${scripts.map(renderScriptPreload).join('\n    ')}
  </head>
  <body>
    <div
      class="ops-shell"
      data-feedback-source-app-slug="${escapeHtml(feedbackContext.sourceAppSlug)}"
      data-feedback-source-app-label="${escapeHtml(feedbackContext.sourceAppLabel)}"
    >
      <aside class="ops-sidebar" aria-label="Primary navigation">
        <a class="ops-brand" href="/dashboard" aria-label="Home Billiards Tools Lab dashboard">
          <img src="/assets/home-billiards-logo-app.png" alt="Home Billiards" width="520" height="304" />
          <span>Tools Lab</span>
          <small>Internal Tools</small>
        </a>

        <nav class="ops-nav" aria-label="Internal tools">
          ${renderNavLink(dashboardNavItem, activePath)}
          <p class="ops-nav-label">Active Tools</p>
          ${navApps.map((app) => renderNavLink(app, activePath)).join('')}
        </nav>

        <div class="ops-sidebar-footer">
          <button
            id="openFeedbackButton"
            class="ops-feedback-button"
            type="button"
            title="Report something broken, confusing, missing, or worth improving."
          >Feedback</button>
          <div class="ops-user">
            <span>${escapeHtml(displayName)}</span>
            <small>${escapeHtml(userRole)}</small>
          </div>
          <form method="post" action="/logout">
            <button class="ops-logout" type="submit">Log out</button>
          </form>
        </div>
      </aside>

      <main class="ops-main" aria-label="${escapeHtml(mainLabel)}">
${content}
      </main>
    </div>
    ${renderFeedbackModal()}
    <script src="/app.js" defer></script>
    ${scripts.map(renderScript).join('\n    ')}
  </body>
</html>`;
}

function renderStylesheet(path) {
  return `<link rel="stylesheet" href="${escapeHtml(path)}" />`;
}

function renderScriptPreload(path) {
  return `<link rel="preload" href="${escapeHtml(path)}" as="script" />`;
}

function renderScript(path) {
  return `<script src="${escapeHtml(path)}" defer></script>`;
}

function renderNavLink(item, activePath) {
  const isActive = item.path === activePath;
  const activeClass = isActive ? ' is-active' : '';
  const currentAttr = isActive ? ' aria-current="page"' : '';

  return `<a class="ops-nav-link${activeClass}" href="${escapeHtml(item.path)}"${currentAttr}>${escapeHtml(item.name)}</a>`;
}

function renderFeedbackModal() {
  return `<div id="feedbackModal" class="feedback-modal-backdrop" hidden>
      <div class="feedback-modal-panel" role="dialog" aria-modal="true" aria-labelledby="feedbackModalTitle">
        <form id="feedbackForm" class="feedback-form">
          <div class="feedback-modal-heading">
            <div>
              <h2 id="feedbackModalTitle">Send Feedback</h2>
              <p>Report something broken, confusing, missing, or worth improving. This is for Tools Lab feedback only, not customer/job notes.</p>
            </div>
            <button id="closeFeedbackButton" class="feedback-icon-button" type="button" aria-label="Close feedback">&times;</button>
          </div>

          <label>
            What happened or what should be improved?
            <textarea id="feedbackMessage" name="message" rows="5" maxlength="4000" required></textarea>
          </label>

          <div class="feedback-modal-grid">
            <label>
              Category
              <select id="feedbackCategory" name="category">
                <option value="bug">Bug</option>
                <option value="confusing">Confusing</option>
                <option value="missing_field">Missing field</option>
                <option value="workflow_issue">Workflow issue</option>
                <option value="feature_idea">Feature idea</option>
                <option value="data_issue">Data issue</option>
                <option value="other" selected>Other</option>
              </select>
            </label>

            <label>
              Severity
              <select id="feedbackSeverity" name="severity">
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
                <option value="blocking">Blocking</option>
              </select>
            </label>
          </div>

          <p id="feedbackFormMessage" class="feedback-form-message" role="status" aria-live="polite"></p>

          <div class="feedback-modal-actions">
            <button id="cancelFeedbackButton" class="secondary-action" type="button">Cancel</button>
            <button id="submitFeedbackButton" class="primary-action" type="submit">Send feedback</button>
          </div>
        </form>
      </div>
    </div>`;
}

function getFeedbackSourceContext(activePath) {
  if (activePath === '/dashboard') {
    return {
      sourceAppSlug: 'dashboard',
      sourceAppLabel: 'Dashboard'
    };
  }

  const app = getAppByPath(activePath);

  return {
    sourceAppSlug: app?.id || '',
    sourceAppLabel: app?.name || ''
  };
}

function formatRole(role) {
  if (!role) {
    return 'Logged in';
  }

  return String(role)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
