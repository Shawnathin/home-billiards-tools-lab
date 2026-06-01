import { escapeHtml } from '../../src/utils/html.mjs';

export function renderCueRepairsPage({ user }) {
  const displayName = escapeHtml(user?.displayName || 'staff');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cue Repairs | Home Billiards Tools Lab</title>
    <link rel="stylesheet" href="/styles.css" />
    <link rel="stylesheet" href="/apps/cue-repairs.css" />
    <script src="/apps/cue-repairs.js" defer></script>
  </head>
  <body>
    <main class="cue-shell">
      <section class="cue-panel glass-panel" aria-label="Cue Repairs app">
        <header class="cue-topbar">
          <a class="cue-logo" href="/dashboard" aria-label="Back to dashboard">
            <img src="/assets/home-billiards-logo-app.png" alt="Home Billiards" width="520" height="304" />
          </a>
          <div class="cue-nav-actions">
            <a class="secondary-action text-action" href="/dashboard">Dashboard</a>
            <form method="post" action="/logout">
              <button class="secondary-action" type="submit">Log out</button>
            </form>
          </div>
        </header>

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
            <span>Waiting approval</span>
            <strong id="waitingApprovalCount">0</strong>
          </article>
          <article class="cue-stat-card">
            <span>Ready pickup</span>
            <strong id="readyForPickupCount">0</strong>
          </article>
          <article class="cue-stat-card">
            <span>Contacted</span>
            <strong id="contactedNotPickedUpCount">0</strong>
          </article>
          <article class="cue-stat-card">
            <span>Completed</span>
            <strong id="completedCount">0</strong>
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

              <div class="cue-field-grid two-columns">
                <label>
                  Cue brand
                  <input name="cueBrand" type="text" />
                </label>
                <label>
                  Cue model
                  <input name="cueModel" type="text" />
                </label>
              </div>

              <label>
                Cue description
                <textarea name="cueDescription" rows="3"></textarea>
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
                Intake notes
                <textarea name="intakeNotes" rows="3"></textarea>
              </label>

              <label>
                Internal staff notes
                <textarea name="internalNotes" rows="3"></textarea>
              </label>

              <label class="cue-checkbox-row">
                <input name="estimateApproved" type="checkbox" />
                <span>Estimate approved</span>
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
                Status
                <select id="statusFilter">
                  <option value="open">Open</option>
                  <option value="all">All</option>
                  <option value="received">Received</option>
                  <option value="assessing">Assessing</option>
                  <option value="waiting_approval">Waiting approval</option>
                  <option value="approved">Approved</option>
                  <option value="in_progress">In progress</option>
                  <option value="waiting_for_parts">Waiting for parts</option>
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
    </main>
  </body>
</html>`;
}
