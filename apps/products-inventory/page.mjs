import { renderAppShell } from '../../src/utils/app-shell.mjs';
import { escapeHtml } from '../../src/utils/html.mjs';

export function renderProductsInventoryPage({ user }) {
  const displayName = escapeHtml(user?.displayName || 'staff');

  return renderAppShell({
    title: 'Products / Inventory',
    user,
    activePath: '/apps/products-inventory',
    styles: ['/apps/products-inventory.css'],
    scripts: ['/apps/products-inventory.js'],
    mainLabel: 'Products and Inventory app',
    content: `
    <div class="inventory-shell">
      <section class="inventory-panel glass-panel" aria-label="Products and Inventory app">
        <div class="inventory-title-row">
          <div>
            <p class="eyebrow">Internal tools</p>
            <h1>Products / Inventory</h1>
            <p class="welcome-line">Welcome, ${displayName}. Manage product records and location-level stock awareness.</p>
          </div>
          <p class="inventory-mode-pill">v1</p>
        </div>

        <div class="inventory-note-stack" aria-label="Inventory build notes">
          <p class="inventory-note">Pre-alpha early build of Inventory.</p>
          <p class="inventory-note">Yes Keith, this will include margin, exchange rate, pricing logic, and better product database tools. This is the beginning of building the database.</p>
        </div>

        <div class="inventory-summary-grid" aria-label="Products inventory summary">
          <article class="inventory-stat-card">
            <span>Products shown</span>
            <strong id="productCount">0</strong>
          </article>
          <article class="inventory-stat-card">
            <span>Inventory tracked</span>
            <strong id="trackedCount">0</strong>
          </article>
          <article class="inventory-stat-card">
            <span>Low stock</span>
            <strong id="lowStockCount">0</strong>
          </article>
          <article class="inventory-stat-card">
            <span>Review needed</span>
            <strong id="reviewCount">0</strong>
          </article>
          <article class="inventory-stat-card">
            <span>Archived shown</span>
            <strong id="archivedCount">0</strong>
          </article>
        </div>

        <div class="inventory-workspace" data-products-inventory-app>
          <section class="inventory-editor-pane" aria-labelledby="productEditorHeading">
            <div class="inventory-pane-heading">
              <div>
                <h2 id="productEditorHeading">Product record</h2>
                <p id="productFormMessage" class="inventory-message" role="status" aria-live="polite"></p>
              </div>
              <button id="resetProductForm" class="secondary-action compact-action" type="button">New</button>
            </div>

            <form id="productForm" class="inventory-form">
              <label>
                Product name
                <input name="name" type="text" required />
              </label>

              <div class="inventory-field-grid two-columns">
                <label>
                  Category
                  <select id="productCategorySelect" name="categoryId" required>
                    <option value="">Loading categories...</option>
                  </select>
                </label>
                <label>
                  Status
                  <select id="productStatusSelect" name="status" required></select>
                </label>
              </div>

              <div class="inventory-field-grid two-columns">
                <label>
                  Product type
                  <select id="productTypeSelect" name="productType" required></select>
                </label>
                <label>
                  SKU / code
                  <input name="internalSku" type="text" />
                </label>
              </div>

              <div class="inventory-field-grid two-columns">
                <label>
                  Brand
                  <input name="brand" type="text" />
                </label>
                <label>
                  Model
                  <input name="model" type="text" />
                </label>
              </div>

              <label>
                Manufacturer
                <input name="manufacturer" type="text" />
              </label>

              <div class="inventory-field-grid three-columns">
                <label>
                  Cost
                  <input name="costDollars" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" />
                </label>
                <label>
                  Retail
                  <input name="retailPriceDollars" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" />
                </label>
                <label>
                  MSRP
                  <input name="msrpDollars" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" />
                </label>
              </div>

              <div class="inventory-field-grid two-columns">
                <label>
                  Stock unit
                  <select id="stockUnitSelect" name="stockUnit"></select>
                </label>
                <div class="inventory-check-stack">
                  <label class="inventory-checkbox-row">
                    <input name="inventoryTrackingEnabled" type="checkbox" value="true" />
                    Track inventory
                  </label>
                  <label class="inventory-checkbox-row">
                    <input name="isTaxable" type="checkbox" value="true" checked />
                    Taxable
                  </label>
                </div>
              </div>

              <label>
                Short description
                <textarea name="shortDescription" rows="3"></textarea>
              </label>

              <label>
                Internal notes
                <textarea name="staffNotes" rows="4"></textarea>
              </label>

              <button id="saveProductButton" class="primary-action" type="submit">Create product</button>
            </form>
          </section>

          <section class="inventory-list-pane" aria-labelledby="productListHeading">
            <div class="inventory-pane-heading inventory-list-heading">
              <div>
                <h2 id="productListHeading">Product catalog</h2>
                <p id="productListStatus" class="inventory-message" role="status" aria-live="polite">Loading products...</p>
              </div>
              <button id="refreshProducts" class="secondary-action compact-action" type="button">Refresh</button>
            </div>

            <div class="inventory-filter-grid">
              <label class="wide-filter">
                Search
                <input id="productSearch" type="search" placeholder="Name, SKU, brand, manufacturer, model" />
              </label>
              <label>
                Category
                <select id="categoryFilter">
                  <option value="">All categories</option>
                </select>
              </label>
              <label>
                Status
                <select id="statusFilter">
                  <option value="">Open statuses</option>
                </select>
              </label>
              <label>
                Type
                <select id="typeFilter">
                  <option value="">All types</option>
                </select>
              </label>
              <label>
                Location
                <select id="locationFilter">
                  <option value="">All locations</option>
                </select>
              </label>
              <label>
                Tracked
                <select id="trackedFilter">
                  <option value="">Any</option>
                  <option value="true">Tracked</option>
                  <option value="false">Not tracked</option>
                </select>
              </label>
              <label>
                Low stock
                <select id="lowStockFilter">
                  <option value="">Any</option>
                  <option value="true">Low stock only</option>
                  <option value="false">Not low stock</option>
                </select>
              </label>
              <label>
                Taxable
                <select id="taxableFilter">
                  <option value="">Any</option>
                  <option value="true">Taxable</option>
                  <option value="false">Not taxable</option>
                </select>
              </label>
              <label class="inventory-checkbox-row compact-checkbox">
                <input id="includeArchivedFilter" type="checkbox" />
                Include archived
              </label>
            </div>

            <div id="productList" class="product-list" aria-live="polite"></div>
          </section>
        </div>
      </section>
    </div>`
  });
}
