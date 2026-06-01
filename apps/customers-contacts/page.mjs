import { renderAppShell } from '../../src/utils/app-shell.mjs';
import { escapeHtml } from '../../src/utils/html.mjs';

export function renderCustomersContactsPage({ user }) {
  const displayName = escapeHtml(user?.displayName || 'staff');

  return renderAppShell({
    title: 'Customers / Contacts',
    user,
    activePath: '/apps/customers-contacts',
    styles: ['/apps/customers-contacts.css'],
    scripts: ['/apps/customers-contacts.js'],
    mainLabel: 'Customers and Contacts app',
    content: `
    <div class="contacts-shell">
      <section class="contacts-panel glass-panel" aria-label="Customers and Contacts app">
        <div class="contacts-title-row">
          <div>
            <p class="eyebrow">Internal tools</p>
            <h1>Customers / Contacts</h1>
            <p class="welcome-line">Welcome, ${displayName}. Keep customer and business contact details findable.</p>
          </div>
          <p class="contacts-mode-pill">v1</p>
        </div>

        <div class="contacts-summary-grid" aria-label="Customers and contacts summary">
          <article class="contacts-stat-card">
            <span>Active</span>
            <strong id="activeContactCount">0</strong>
          </article>
          <article class="contacts-stat-card">
            <span>Review needed</span>
            <strong id="reviewNeededContactCount">0</strong>
          </article>
          <article class="contacts-stat-card">
            <span>Archived</span>
            <strong id="archivedContactCount">0</strong>
          </article>
          <article class="contacts-stat-card">
            <span>Missing email</span>
            <strong id="missingEmailContactCount">0</strong>
          </article>
          <article class="contacts-stat-card">
            <span>Missing phone</span>
            <strong id="missingPhoneContactCount">0</strong>
          </article>
        </div>

        <div class="contacts-workspace" data-customers-contacts-app>
          <section class="contacts-intake-pane" aria-labelledby="contactIntakeHeading">
            <div class="contacts-pane-heading">
              <div>
                <h2 id="contactIntakeHeading">Contact intake</h2>
                <p id="contactFormMessage" class="contacts-message" role="status" aria-live="polite"></p>
              </div>
              <button id="resetContactForm" class="secondary-action compact-action" type="button">New</button>
            </div>

            <form id="contactForm" class="contacts-form">
              <label>
                Display name
                <input name="displayName" type="text" autocomplete="name" required />
              </label>

              <div class="contacts-field-grid two-columns">
                <label>
                  Contact type
                  <select id="contactTypeSelect" name="contactTypeId" required>
                    <option value="">Loading contact types...</option>
                  </select>
                </label>
                <label>
                  Company name
                  <input name="companyName" type="text" autocomplete="organization" />
                </label>
              </div>

              <label id="customContactTypeField" class="is-hidden">
                Other contact type
                <input name="contactTypeOther" type="text" />
              </label>

              <div class="contacts-field-grid two-columns">
                <label>
                  Phone
                  <input name="phone" type="tel" autocomplete="tel" />
                </label>
                <label>
                  Email
                  <input name="email" type="email" autocomplete="email" />
                </label>
              </div>

              <div class="contacts-field-grid two-columns">
                <label>
                  Preferred contact method
                  <select id="preferredContactMethodSelect" name="preferredContactMethod" required></select>
                </label>
                <label>
                  Status
                  <select id="statusSelect" name="status" required></select>
                </label>
              </div>

              <label>
                Address line 1
                <input name="addressLine1" type="text" autocomplete="address-line1" />
              </label>

              <label>
                Address line 2
                <input name="addressLine2" type="text" autocomplete="address-line2" />
              </label>

              <div class="contacts-field-grid three-columns">
                <label>
                  City
                  <input name="city" type="text" autocomplete="address-level2" />
                </label>
                <label>
                  Province
                  <input name="province" type="text" autocomplete="address-level1" />
                </label>
                <label>
                  Postal code
                  <input name="postalCode" type="text" autocomplete="postal-code" />
                </label>
              </div>

              <label>
                Country
                <input name="country" type="text" autocomplete="country-name" value="Canada" />
              </label>

              <label>
                Notes
                <textarea name="notes" rows="4"></textarea>
              </label>

              <label>
                Tags
                <input name="tags" type="text" placeholder="designer, install, wholesale" />
              </label>

              <button id="saveContactButton" class="primary-action" type="submit">Create contact</button>
            </form>
          </section>

          <section class="contacts-list-pane" aria-labelledby="contactListHeading">
            <div class="contacts-pane-heading contacts-list-heading">
              <div>
                <h2 id="contactListHeading">Contact dashboard</h2>
                <p id="contactListStatus" class="contacts-message" role="status" aria-live="polite">Loading contacts...</p>
              </div>
              <button id="refreshContacts" class="secondary-action compact-action" type="button">Refresh</button>
            </div>

            <div class="contacts-filter-grid">
              <label class="wide-filter">
                Search
                <input id="contactSearch" type="search" placeholder="Name, company, phone, email, city, notes, tags" />
              </label>
              <label>
                Status
                <select id="statusFilter"></select>
              </label>
              <label>
                Type
                <select id="contactTypeFilter">
                  <option value="">All types</option>
                </select>
              </label>
              <label>
                Preferred
                <select id="preferredContactMethodFilter">
                  <option value="">Any method</option>
                </select>
              </label>
              <label>
                City
                <input id="cityFilter" type="search" placeholder="Any city" />
              </label>
              <label class="contacts-checkbox-row compact-checkbox">
                <input id="reviewNeededFilter" type="checkbox" />
                Review needed
              </label>
              <label class="contacts-checkbox-row compact-checkbox">
                <input id="includeArchivedFilter" type="checkbox" />
                Include archived
              </label>
            </div>

            <div id="contactList" class="contacts-contact-list" aria-live="polite"></div>
          </section>
        </div>
      </section>
    </div>`
  });
}
