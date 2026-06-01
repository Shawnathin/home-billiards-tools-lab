import { renderAppShell } from '../../src/utils/app-shell.mjs';
import { escapeHtml } from '../../src/utils/html.mjs';

export function renderInternalMessagesPage({ user }) {
  const displayName = escapeHtml(user?.displayName || 'staff');

  return renderAppShell({
    title: 'Internal Messages',
    user,
    activePath: '/apps/internal-messages',
    styles: ['/apps/internal-messages.css'],
    scripts: ['/apps/internal-messages.js'],
    mainLabel: 'Internal Messages app',
    content: `
    <div class="internal-messages-shell">
      <section class="internal-messages-panel glass-panel" aria-label="Internal Messages app">
        <div class="internal-messages-title-row">
          <div>
            <p class="eyebrow">Staff operations</p>
            <h1>Internal Messages</h1>
            <p class="welcome-line">Welcome, ${displayName}. Track staff-only threads for general notes and record-linked follow-up.</p>
          </div>
          <p class="internal-messages-mode-pill">v1</p>
        </div>

        <div class="internal-messages-summary-grid" aria-label="Internal message summary">
          <article class="internal-messages-stat-card">
            <span>Open</span>
            <strong id="internalMessagesOpenCount">0</strong>
          </article>
          <article class="internal-messages-stat-card">
            <span>Needs attention</span>
            <strong id="internalMessagesNeedsAttentionCount">0</strong>
          </article>
          <article class="internal-messages-stat-card">
            <span>Urgent</span>
            <strong id="internalMessagesUrgentCount">0</strong>
          </article>
          <article class="internal-messages-stat-card">
            <span>Resolved / archived</span>
            <strong id="internalMessagesClosedCount">0</strong>
          </article>
        </div>

        <section class="internal-messages-new-pane" aria-labelledby="internalMessagesNewHeading">
          <div class="internal-messages-pane-heading">
            <div>
              <h2 id="internalMessagesNewHeading">New thread</h2>
              <p id="internalMessagesNewStatus" class="internal-messages-message" role="status" aria-live="polite"></p>
            </div>
          </div>

          <form id="internalMessagesNewForm" class="internal-messages-new-form">
            <label class="internal-messages-wide-field">
              Subject
              <input id="internalMessagesSubject" name="subject" type="text" maxlength="180" required />
            </label>
            <label>
              Priority
              <select id="internalMessagesPriority" name="priority">
                <option value="normal">Normal</option>
                <option value="needs_attention">Needs attention</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label class="internal-messages-wide-field">
              First message
              <textarea id="internalMessagesBody" name="body" rows="4" maxlength="4000" required></textarea>
            </label>
            <label>
              Record type
              <select id="internalMessagesRelatedRecordType" name="relatedRecordType">
                <option value="">No record link</option>
                <option value="general">General</option>
                <option value="work_order">Work order</option>
                <option value="customer_contact">Customer contact</option>
                <option value="warranty_service_ticket">Warranty / service ticket</option>
                <option value="cue_repair">Cue repair</option>
                <option value="product_inventory">Product / inventory</option>
              </select>
            </label>
            <label>
              Record ID
              <input id="internalMessagesRelatedRecordId" name="relatedRecordId" type="text" maxlength="260" />
            </label>
            <label>
              Record label
              <input id="internalMessagesRelatedRecordLabel" name="relatedRecordLabel" type="text" maxlength="260" />
            </label>
            <div class="internal-messages-form-actions">
              <button id="internalMessagesCreateButton" class="primary-action compact-action" type="submit">Create thread</button>
            </div>
          </form>
        </section>

        <section class="internal-messages-workspace" aria-label="Internal message threads">
          <section class="internal-messages-list-pane" aria-labelledby="internalMessagesListHeading">
            <div class="internal-messages-pane-heading">
              <div>
                <h2 id="internalMessagesListHeading">Threads</h2>
                <p id="internalMessagesListStatus" class="internal-messages-message" role="status" aria-live="polite">Loading threads...</p>
              </div>
              <button id="internalMessagesRefresh" class="secondary-action compact-action" type="button">Refresh</button>
            </div>

            <div class="internal-messages-filter-grid">
              <label class="internal-messages-wide-filter">
                Search
                <input id="internalMessagesSearch" type="search" placeholder="Subject, message, record, staff member" />
              </label>
              <label>
                Status
                <select id="internalMessagesStatusFilter">
                  <option value="open">Open</option>
                  <option value="">All statuses</option>
                </select>
              </label>
              <label>
                Priority
                <select id="internalMessagesPriorityFilter">
                  <option value="">Any priority</option>
                </select>
              </label>
              <label>
                Record type
                <select id="internalMessagesRecordTypeFilter">
                  <option value="">Any record type</option>
                </select>
              </label>
              <label class="internal-messages-checkbox-label">
                <input id="internalMessagesUnreadFilter" type="checkbox" />
                <span>Unread only</span>
              </label>
            </div>

            <div id="internalMessagesThreadList" class="internal-messages-thread-list" aria-live="polite"></div>
          </section>

          <section class="internal-messages-detail-pane" aria-labelledby="internalMessagesDetailHeading">
            <div id="internalMessagesDetailEmpty" class="internal-messages-empty-detail">
              <h2 id="internalMessagesDetailHeading">Select a thread</h2>
              <p>Open a thread from the list to review posts, reply, or update its status.</p>
            </div>

            <div id="internalMessagesDetailContent" class="internal-messages-detail-content" hidden>
              <div class="internal-messages-detail-header">
                <div>
                  <p id="internalMessagesDetailEyebrow" class="eyebrow">Thread</p>
                  <h2 id="internalMessagesDetailSubject">Thread</h2>
                  <p id="internalMessagesDetailMeta" class="internal-messages-detail-meta"></p>
                </div>
                <div class="internal-messages-detail-controls">
                  <label>
                    Status
                    <select id="internalMessagesDetailStatus"></select>
                  </label>
                  <label>
                    Priority
                    <select id="internalMessagesDetailPriority"></select>
                  </label>
                </div>
              </div>

              <div id="internalMessagesPosts" class="internal-messages-post-list" aria-live="polite"></div>

              <form id="internalMessagesReplyForm" class="internal-messages-reply-form">
                <label>
                  Reply
                  <textarea id="internalMessagesReplyBody" rows="4" maxlength="4000" required></textarea>
                </label>
                <div class="internal-messages-form-actions">
                  <p id="internalMessagesDetailStatusMessage" class="internal-messages-message" role="status" aria-live="polite"></p>
                  <button id="internalMessagesReplyButton" class="primary-action compact-action" type="submit">Post reply</button>
                </div>
              </form>
            </div>
          </section>
        </section>
      </section>
    </div>`
  });
}
