import { renderAppShell } from '../../src/utils/app-shell.mjs';
import { escapeHtml } from '../../src/utils/html.mjs';

export function renderServicesAndQuotesPage({ user }) {
  const displayName = escapeHtml(user?.displayName || 'staff');

  return renderAppShell({
    title: 'Services & Quotes',
    user,
    activePath: '/apps/services-and-quotes',
    styles: ['/apps/services-and-quotes.css'],
    scripts: ['/apps/services-and-quotes.js'],
    mainLabel: 'Services and Quotes app',
    content: `
    <div class="quote-shell">
      <section class="quote-panel glass-panel" aria-label="Services and Quotes app">
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
    </div>`
  });
}
