import { renderAppShell } from '../../src/utils/app-shell.mjs';
import { escapeHtml } from '../../src/utils/html.mjs';

export function renderJobsWorkOrdersPage({ user }) {
  const displayName = escapeHtml(user?.displayName || 'staff');

  return renderAppShell({
    title: 'Jobs / Work Orders',
    user,
    activePath: '/apps/jobs-work-orders',
    styles: ['/apps/jobs-work-orders.css'],
    scripts: ['/apps/jobs-work-orders.js'],
    mainLabel: 'Jobs and Work Orders app',
    content: `
    <div class="jobs-shell">
      <section class="jobs-panel glass-panel" aria-label="Jobs and Work Orders app">
        <div class="jobs-title-row">
          <div>
            <p class="eyebrow">Internal tools</p>
            <h1>Jobs / Work Orders</h1>
            <p class="welcome-line">Welcome, ${displayName}. Track installs, moves, deliveries, service jobs, and internal work orders.</p>
          </div>
          <p class="jobs-mode-pill">v1</p>
        </div>

        <div class="jobs-summary-grid" aria-label="Work order summary">
          <article class="jobs-stat-card">
            <span>Open</span>
            <strong id="openWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>Scheduled</span>
            <strong id="scheduledWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>In progress</span>
            <strong id="inProgressWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>Waiting</span>
            <strong id="waitingWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>Urgent active</span>
            <strong id="urgentActiveWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>Completed</span>
            <strong id="completedWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>Cancelled</span>
            <strong id="cancelledWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>Archived</span>
            <strong id="archivedWorkOrderCount">0</strong>
          </article>
        </div>

        <div class="jobs-workspace" data-jobs-work-orders-app>
          <section class="jobs-intake-pane" aria-labelledby="workOrderIntakeHeading">
            <div class="jobs-pane-heading">
              <div>
                <h2 id="workOrderIntakeHeading">Work order intake</h2>
                <p id="workOrderFormMessage" class="jobs-message" role="status" aria-live="polite"></p>
              </div>
              <button id="resetWorkOrderForm" class="secondary-action compact-action" type="button">New</button>
            </div>

            <form id="workOrderForm" class="jobs-form">
              <section class="jobs-form-section" aria-label="Contact and customer">
                <h3>Contact / Customer</h3>
                <div class="jobs-contact-link">
                  <div class="jobs-contact-link-heading">
                    <strong>Search contacts</strong>
                    <button id="clearWorkOrderContactLink" class="secondary-action compact-action" type="button" disabled>Clear</button>
                  </div>
                  <input name="customerContactId" type="hidden" />
                  <label>
                    Search
                    <input id="workOrderContactSearch" type="search" placeholder="Name, phone, email, company, contact number" autocomplete="off" />
                  </label>
                  <div id="workOrderContactSelected" class="jobs-selected-contact is-hidden" aria-live="polite"></div>
                  <div id="workOrderContactResults" class="jobs-contact-results" aria-live="polite"></div>
                </div>

                <label>
                  Customer name
                  <input name="customerName" type="text" autocomplete="name" required />
                </label>

                <label>
                  Customer company
                  <input name="customerCompany" type="text" autocomplete="organization" />
                </label>

                <div class="jobs-field-grid two-columns">
                  <label>
                    Phone
                    <input name="customerPhone" type="tel" autocomplete="tel" />
                  </label>
                  <label>
                    Email
                    <input name="customerEmail" type="email" autocomplete="email" />
                  </label>
                </div>
              </section>

              <section class="jobs-form-section" aria-label="Job details">
                <h3>Job Details</h3>
                <div class="jobs-field-grid two-columns">
                  <label>
                    Job type
                    <select id="jobTypeSelect" name="jobTypeId" required>
                      <option value="">Loading job types...</option>
                    </select>
                  </label>
                  <label>
                    Priority
                    <select id="prioritySelect" name="priority" required></select>
                  </label>
                </div>

                <label id="customJobTypeField" class="is-hidden">
                  Custom job type
                  <input name="jobTypeOther" type="text" />
                </label>

                <label>
                  Title / short summary
                  <input name="title" type="text" required />
                </label>

                <div class="jobs-field-grid two-columns">
                  <label>
                    Source / reference
                    <input name="sourceReference" type="text" />
                  </label>
                  <label>
                    Product / table involved
                    <input name="productOrTableInvolved" type="text" />
                  </label>
                </div>

                <div class="jobs-field-grid three-columns">
                  <label>
                    Status
                    <select id="statusSelect" name="status" required></select>
                  </label>
                  <label>
                    Scheduled date
                    <input name="scheduledDate" type="date" />
                  </label>
                  <label>
                    Assigned to
                    <input name="assignedToText" type="text" />
                  </label>
                </div>
              </section>

              <section class="jobs-form-section" aria-label="Service location">
                <h3>Service Location</h3>
                <label>
                  Address line 1
                  <input name="serviceAddressLine1" type="text" autocomplete="address-line1" />
                </label>

                <label>
                  Address line 2
                  <input name="serviceAddressLine2" type="text" autocomplete="address-line2" />
                </label>

                <div class="jobs-field-grid three-columns">
                  <label>
                    City
                    <input name="serviceCity" type="text" autocomplete="address-level2" />
                  </label>
                  <label>
                    Province
                    <input name="serviceProvince" type="text" autocomplete="address-level1" />
                  </label>
                  <label>
                    Postal code
                    <input name="servicePostalCode" type="text" autocomplete="postal-code" />
                  </label>
                </div>

                <label>
                  Service location name
                  <input name="serviceLocationName" type="text" />
                </label>

                <label>
                  Access notes
                  <textarea name="accessNotes" rows="3"></textarea>
                </label>
              </section>

              <section class="jobs-form-section" aria-label="Notes">
                <h3>Notes</h3>
                <label>
                  Service details / requested work
                  <textarea name="serviceDetails" rows="4" required></textarea>
                </label>

                <label>
                  Job notes
                  <textarea name="jobNotes" rows="3"></textarea>
                </label>

                <label>
                  Internal notes
                  <textarea name="internalNotes" rows="3"></textarea>
                </label>

                <label>
                  Completion notes
                  <textarea name="completionNotes" rows="3"></textarea>
                </label>

                <label>
                  Cancellation reason
                  <textarea name="cancellationReason" rows="3"></textarea>
                </label>
              </section>

              <button id="saveWorkOrderButton" class="primary-action" type="submit">Create work order</button>
            </form>
          </section>

          <section class="jobs-list-pane" aria-labelledby="workOrderListHeading">
            <div class="jobs-pane-heading jobs-list-heading">
              <div>
                <h2 id="workOrderListHeading">Work order dashboard</h2>
                <p id="workOrderListStatus" class="jobs-message" role="status" aria-live="polite">Loading work orders...</p>
              </div>
              <button id="refreshWorkOrders" class="secondary-action compact-action" type="button">Refresh</button>
            </div>

            <div class="jobs-filter-grid">
              <label class="wide-filter">
                Search
                <input id="workOrderSearch" type="search" placeholder="Number, customer, job, location, notes" />
              </label>
              <label>
                Status
                <select id="statusFilter">
                  <option value="">Any status</option>
                </select>
              </label>
              <label>
                Priority
                <select id="priorityFilter">
                  <option value="">Any priority</option>
                </select>
              </label>
              <label>
                Job type
                <select id="jobTypeFilter">
                  <option value="">All types</option>
                </select>
              </label>
              <label>
                Scheduled
                <input id="scheduledDateFilter" type="date" />
              </label>
              <label class="jobs-checkbox-row compact-checkbox">
                <input id="includeArchivedFilter" type="checkbox" />
                Include archived
              </label>
            </div>

            <div id="workOrderList" class="jobs-work-order-list" aria-live="polite"></div>
          </section>
        </div>
      </section>
    </div>`
  });
}
