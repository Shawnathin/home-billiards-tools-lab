import { getEnabledApps } from '../app-registry.mjs';
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
    <div class="ops-shell">
      <aside class="ops-sidebar" aria-label="Primary navigation">
        <a class="ops-brand" href="/dashboard" aria-label="Home Billiards Tools Lab dashboard">
          <img src="/assets/home-billiards-logo-app.png" alt="Home Billiards" width="520" height="304" />
          <span>Tools Lab</span>
          <small>Internal Tools</small>
        </a>

        <nav class="ops-nav" aria-label="Internal tools">
          ${renderNavLink(dashboardNavItem, activePath)}
          <p class="ops-nav-label">Active Tools</p>
          ${getEnabledApps().map((app) => renderNavLink(app, activePath)).join('')}
        </nav>

        <div class="ops-sidebar-footer">
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

function formatRole(role) {
  if (!role) {
    return 'Logged in';
  }

  return String(role)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
