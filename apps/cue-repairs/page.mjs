import { renderAppShell } from '../../src/utils/app-shell.mjs';
import { escapeHtml } from '../../src/utils/html.mjs';

export function renderCueRepairsPage({ user }) {
  const displayName = escapeHtml(user?.displayName || 'staff');

  return renderAppShell({
    title: 'Cue Repairs',
    user,
    activePath: '/apps/cue-repairs',
    styles: ['/apps/cue-repairs.css'],
    scripts: ['/apps/cue-repairs.js'],
    mainLabel: 'Cue Repairs app',
    content: `
    <div class="cue-shell">
      <section class="cue-panel glass-panel" aria-label="Cue Repairs app">
        <div class="cue-title-row">
          <div>
            <p class="eyebrow">Internal tools</p>
            <h1>Cue Repairs</h1>
            <p class="welcome-line">Welcome, ${displayName}. Track repair intake, estimates, customer contact, and pickup.</p>
          </div>
          <p class="cue-mode-pill">v1</p>
        </div>

        <div class="cue-summary-grid" aria-label="Cue repair summary">
          <article class="cue-stat-card">
            <span>Open</span>
            <strong id="openRepairCount">0</strong>
          </article>
          <article class="cue-stat-card">
            <span>Needs attention</span>
            <strong id="needsAttentionCount">0</strong>
          </article>
          <article class="cue-stat-card">
            <span>Ready for pickup</span>
            <strong id="readyForPickupCount">0</strong>
          </article>
          <article class="cue-stat-card">
            <span>Contacted, not picked up</span>
            <strong id="contactedNotPickedUpCount">0</strong>
          </article>
          <article class="cue-stat-card">
            <span>Picked up</span>
            <strong id="pickedUpCount">0</strong>
          </article>
          <article class="cue-stat-card">
            <span>Cancelled</span>
            <strong id="cancelledCount">0</strong>
          </article>
        </div>

        <div class="cue-workspace" data-cue-repairs-app>
          <section class="cue-intake-pane" aria-labelledby="cueIntakeHeading">
            <div class="cue-pane-heading">
              <div>
                <h2 id="cueIntakeHeading">Repair intake</h2>
                <p id="cueFormMessage" class="cue-message" role="status" aria-live="polite"></p>
              </div>
            </div>

            <form id="repairForm" class="cue-form">
              <section class="cue-contact-link" aria-label="Search contacts">
                <div class="cue-contact-link-heading">
                  <strong>Search contacts</strong>
                  <button id="clearRepairContactLink" class="secondary-action compact-action" type="button" disabled>Clear</button>
                </div>
                <input name="customerContactId" type="hidden" />
                <label>
                  Search
                  <input id="repairContactSearch" type="search" placeholder="Name, phone, email, company, contact number" autocomplete="off" />
                </label>
                <div id="repairContactSelected" class="cue-selected-contact is-hidden" aria-live="polite"></div>
                <div id="repairContactResults" class="cue-contact-results" aria-live="polite"></div>
                <div id="repairContactMatchNotice" class="cue-contact-match-notice is-hidden" aria-live="polite"></div>
                <label class="cue-checkbox-row cue-contact-capture-option">
                  <input id="repairSaveCustomerContact" name="saveCustomerContact" type="checkbox" value="true" checked />
                  Save as new contact if no existing contact is linked
                </label>
              </section>

              <div class="cue-field-grid two-columns">
                <label>
                  Customer name
                  <input name="customerName" type="text" autocomplete="name" required />
                </label>
                <label>
                  Phone
                  <input name="customerPhone" type="tel" autocomplete="tel" />
                </label>
              </div>

              <label>
                Email
                <input name="customerEmail" type="email" autocomplete="email" />
              </label>

              <label>
                Cue description
                <textarea name="cueDescription" rows="3" required></textarea>
              </label>

              <div class="cue-field-grid two-columns">
                <label>
                  Repair type
                  <select id="repairTypeSelect" name="repairTypeId" required>
                    <option value="">Loading repair types...</option>
                  </select>
                </label>
                <label>
                  Estimate
                  <input name="estimateDollars" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" />
                </label>
              </div>

              <label id="otherRepairTypeField" class="is-hidden">
                Other repair type
                <input name="repairTypeOther" type="text" />
              </label>

              <label>
                Notes
                <textarea name="intakeNotes" rows="3"></textarea>
              </label>

              <button class="primary-action" type="submit">Create repair</button>
            </form>
          </section>

          <section class="cue-list-pane" aria-labelledby="cueListHeading">
            <div class="cue-pane-heading cue-list-heading">
              <div>
                <h2 id="cueListHeading">Repair dashboard</h2>
                <p id="cueListStatus" class="cue-message" role="status" aria-live="polite">Loading repairs...</p>
              </div>
              <button id="refreshRepairs" class="secondary-action compact-action" type="button">Refresh</button>
            </div>

            <div class="cue-filter-grid">
              <label>
                Search
                <input id="repairSearch" type="search" placeholder="Name, phone, repair number" />
              </label>
              <label>
                View
                <select id="statusFilter">
                  <option value="open">Open</option>
                  <option value="all">All</option>
                  <option value="received">Received</option>
                  <option value="in_progress">In progress</option>
                  <option value="needs_attention">Needs attention</option>
                  <option value="ready_for_pickup">Ready for pickup</option>
                  <option value="picked_up">Picked up</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label>
                Type
                <select id="repairTypeFilter">
                  <option value="">All types</option>
                </select>
              </label>
            </div>

            <div id="repairList" class="cue-repair-list" aria-live="polite"></div>
          </section>
        </div>
      </section>
    </div>`
  });
}
