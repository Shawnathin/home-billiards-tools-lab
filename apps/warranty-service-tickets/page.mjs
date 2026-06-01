import { escapeHtml } from '../../src/utils/html.mjs';

export function renderWarrantyServiceTicketsPage({ user }) {
  const displayName = escapeHtml(user?.displayName || 'staff');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Warranty / Service Tickets | Home Billiards Tools Lab</title>
    <link rel="stylesheet" href="/styles.css" />
    <link rel="stylesheet" href="/apps/warranty-service-tickets.css" />
    <script src="/apps/warranty-service-tickets.js" defer></script>
  </head>
  <body>
    <main class="warranty-shell">
      <section class="warranty-panel glass-panel" aria-label="Warranty and Service Tickets app">
        <header class="warranty-topbar">
          <a class="warranty-logo" href="/dashboard" aria-label="Back to dashboard">
            <img src="/assets/home-billiards-logo-app.png" alt="Home Billiards" width="520" height="304" />
          </a>
          <div class="warranty-nav-actions">
            <a class="secondary-action text-action" href="/dashboard">Dashboard</a>
            <form method="post" action="/logout">
              <button class="secondary-action" type="submit">Log out</button>
            </form>
          </div>
        </header>

        <div class="warranty-title-row">
          <div>
            <p class="eyebrow">Internal tools</p>
            <h1>Warranty / Service Tickets</h1>
            <p class="welcome-line">Welcome, ${displayName}. Track customer issues from intake to resolution.</p>
          </div>
          <p class="warranty-mode-pill">v1</p>
        </div>

        <div class="warranty-summary-grid" aria-label="Warranty and service ticket summary">
          <article class="warranty-stat-card">
            <span>Open</span>
            <strong id="openTicketCount">0</strong>
          </article>
          <article class="warranty-stat-card">
            <span>Needs attention</span>
            <strong id="needsAttentionCount">0</strong>
          </article>
          <article class="warranty-stat-card">
            <span>Waiting on customer</span>
            <strong id="waitingOnCustomerCount">0</strong>
          </article>
          <article class="warranty-stat-card">
            <span>Follow-up due</span>
            <strong id="followUpDueCount">0</strong>
          </article>
          <article class="warranty-stat-card">
            <span>Resolved</span>
            <strong id="resolvedTicketCount">0</strong>
          </article>
          <article class="warranty-stat-card">
            <span>Cancelled</span>
            <strong id="cancelledTicketCount">0</strong>
          </article>
        </div>

        <div class="warranty-workspace" data-warranty-service-tickets-app>
          <section class="warranty-intake-pane" aria-labelledby="ticketIntakeHeading">
            <div class="warranty-pane-heading">
              <div>
                <h2 id="ticketIntakeHeading">Ticket intake</h2>
                <p id="ticketFormMessage" class="warranty-message" role="status" aria-live="polite"></p>
              </div>
              <button id="resetTicketForm" class="secondary-action compact-action" type="button">New</button>
            </div>

            <form id="ticketForm" class="warranty-form">
              <section class="warranty-contact-link" aria-label="Search contacts">
                <div class="warranty-contact-link-heading">
                  <strong>Search contacts</strong>
                  <button id="clearTicketContactLink" class="secondary-action compact-action" type="button" disabled>Clear</button>
                </div>
                <input name="customerContactId" type="hidden" />
                <label>
                  Search
                  <input id="ticketContactSearch" type="search" placeholder="Name, phone, email, company, contact number" autocomplete="off" />
                </label>
                <div id="ticketContactSelected" class="warranty-selected-contact is-hidden" aria-live="polite"></div>
                <div id="ticketContactResults" class="warranty-contact-results" aria-live="polite"></div>
                <label class="warranty-checkbox-row warranty-contact-capture-option">
                  <input id="ticketSaveCustomerContact" name="saveCustomerContact" type="checkbox" value="true" checked />
                  Save as new contact if no existing contact is linked
                </label>
              </section>

              <label>
                Customer name
                <input name="customerName" type="text" autocomplete="name" required />
              </label>

              <div class="warranty-field-grid two-columns">
                <label>
                  Phone
                  <input name="customerPhone" type="tel" autocomplete="tel" />
                </label>
                <label>
                  Email
                  <input name="customerEmail" type="email" autocomplete="email" />
                </label>
              </div>

              <div class="warranty-field-grid two-columns">
                <label>
                  Issue type
                  <select id="issueTypeSelect" name="issueTypeId" required>
                    <option value="">Loading issue types...</option>
                  </select>
                </label>
                <label>
                  Priority
                  <select id="prioritySelect" name="priority" required></select>
                </label>
              </div>

              <label id="customIssueTypeField" class="is-hidden">
                Custom issue type
                <input name="issueTypeOther" type="text" />
              </label>

              <div class="warranty-field-grid two-columns">
                <label>
                  Product involved
                  <input name="productInvolved" type="text" />
                </label>
                <label>
                  Order / job / reference
                  <input name="orderOrJobReference" type="text" />
                </label>
              </div>

              <div class="warranty-field-grid two-columns">
                <label>
                  Status
                  <select id="statusSelect" name="status" required></select>
                </label>
                <label>
                  Follow-up date
                  <input name="followUpAt" type="datetime-local" />
                </label>
              </div>

              <label class="warranty-checkbox-row">
                <input name="isWarranty" type="checkbox" value="true" />
                Warranty
              </label>

              <label>
                Issue description
                <textarea name="issueDescription" rows="4" required></textarea>
              </label>

              <label>
                Internal notes
                <textarea name="internalNotes" rows="3"></textarea>
              </label>

              <button id="saveTicketButton" class="primary-action" type="submit">Create ticket</button>
            </form>
          </section>

          <section class="warranty-list-pane" aria-labelledby="ticketListHeading">
            <div class="warranty-pane-heading warranty-list-heading">
              <div>
                <h2 id="ticketListHeading">Ticket dashboard</h2>
                <p id="ticketListStatus" class="warranty-message" role="status" aria-live="polite">Loading tickets...</p>
              </div>
              <button id="refreshTickets" class="secondary-action compact-action" type="button">Refresh</button>
            </div>

            <div class="warranty-filter-grid">
              <label class="wide-filter">
                Search
                <input id="ticketSearch" type="search" placeholder="Ticket, customer, product, reference" />
              </label>
              <label>
                View
                <select id="statusFilter">
                  <option value="open">Open</option>
                  <option value="all">All</option>
                </select>
              </label>
              <label>
                Priority
                <select id="priorityFilter">
                  <option value="">Any priority</option>
                </select>
              </label>
              <label>
                Type
                <select id="issueTypeFilter">
                  <option value="">All types</option>
                </select>
              </label>
              <label>
                Warranty
                <select id="warrantyFilter">
                  <option value="">Any</option>
                  <option value="true">Warranty</option>
                  <option value="false">Not warranty</option>
                </select>
              </label>
              <label class="warranty-checkbox-row compact-checkbox">
                <input id="followUpDueFilter" type="checkbox" />
                Follow-up due
              </label>
              <label class="warranty-checkbox-row compact-checkbox">
                <input id="includeClosedFilter" type="checkbox" />
                Include closed
              </label>
            </div>

            <div id="ticketList" class="warranty-ticket-list" aria-live="polite"></div>
          </section>
        </div>
      </section>
    </main>
  </body>
</html>`;
}
