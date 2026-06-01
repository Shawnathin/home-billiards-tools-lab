import { escapeHtml } from '../../src/utils/html.mjs';

export function renderServicesAndQuotesPage({ user }) {
  const displayName = escapeHtml(user?.displayName || 'staff');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Services &amp; Quotes | Home Billiards Tools Lab</title>
    <link rel="stylesheet" href="/styles.css" />
    <link rel="stylesheet" href="/apps/services-and-quotes.css" />
    <script src="/apps/services-and-quotes.js" defer></script>
  </head>
  <body>
    <main class="quote-shell">
      <section class="quote-panel glass-panel" aria-label="Services and Quotes app">
        <header class="quote-topbar">
          <a class="quote-logo" href="/dashboard" aria-label="Back to dashboard">
            <img src="/assets/home-billiards-logo-app.png" alt="Home Billiards" width="520" height="304" />
          </a>
          <div class="quote-nav-actions">
            <a class="secondary-action text-action" href="/dashboard">Dashboard</a>
            <form method="post" action="/logout">
              <button class="secondary-action" type="submit">Log out</button>
            </form>
          </div>
        </header>

        <div class="quote-title-row">
          <div>
            <p class="eyebrow">Internal tools</p>
            <h1>Services &amp; Quotes</h1>
            <p class="welcome-line">Welcome, ${displayName}. Build a quick service quote preview from active services.</p>
          </div>
          <p class="quote-mode-pill">v1 preview</p>
        </div>

        <div class="quote-workspace" data-services-quotes-app>
          <section class="catalog-pane" aria-labelledby="catalogHeading">
            <div class="pane-heading">
              <div>
                <h2 id="catalogHeading">Service catalog</h2>
                <p id="catalogStatus" class="pane-note" aria-live="polite">Loading active services...</p>
              </div>
            </div>
            <div id="serviceCatalog" class="service-catalog" aria-live="polite"></div>
          </section>

          <aside class="preview-pane" aria-labelledby="previewHeading">
            <div class="pane-heading">
              <div>
                <h2 id="previewHeading">Quote preview</h2>
                <p class="pane-note">No customer records are saved in v1.</p>
              </div>
            </div>

            <div id="quoteLines" class="quote-lines" aria-live="polite"></div>

            <div class="quote-total-row">
              <span>Subtotal</span>
              <strong id="quoteSubtotal">$0.00</strong>
            </div>

            <p id="quoteMessage" class="app-message" role="status" aria-live="polite"></p>
          </aside>
        </div>
      </section>
    </main>
  </body>
</html>`;
}
