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
      <section class="internal-messages-panel" aria-label="Internal Messages app">
        <aside class="internal-messages-list-pane" aria-labelledby="internalMessagesListHeading">
          <div class="internal-messages-list-header">
            <div>
              <p class="eyebrow">Staff operations</p>
              <h1 id="internalMessagesListHeading">Internal Messages</h1>
              <p class="welcome-line">Welcome, ${displayName}. Scan staff threads and record follow-up.</p>
            </div>
            <button id="internalMessagesNewThreadButton" class="primary-action compact-action" type="button">New thread</button>
          </div>

          <div class="internal-messages-summary-strip" aria-label="Internal message summary">
            <article>
              <span>Open</span>
              <strong id="internalMessagesOpenCount">0</strong>
            </article>
            <article>
              <span>Attention</span>
              <strong id="internalMessagesNeedsAttentionCount">0</strong>
            </article>
            <article>
              <span>Urgent</span>
              <strong id="internalMessagesUrgentCount">0</strong>
            </article>
            <article>
              <span>Closed</span>
              <strong id="internalMessagesClosedCount">0</strong>
            </article>
          </div>

          <div class="internal-messages-controls">
            <label class="internal-messages-search-field">
              <span>Search</span>
              <input id="internalMessagesSearch" type="search" placeholder="Subject, message, record, staff" />
            </label>

            <div class="internal-messages-filter-row">
              <label>
                <span>Status</span>
                <select id="internalMessagesStatusFilter">
                  <option value="open">Open</option>
                  <option value="">All statuses</option>
                </select>
              </label>
              <label class="internal-messages-checkbox-label">
                <input id="internalMessagesUnreadFilter" type="checkbox" />
                <span>Unread</span>
              </label>
              <button id="internalMessagesRefresh" class="secondary-action compact-action" type="button">Refresh</button>
            </div>

            <details class="internal-messages-more-filters">
              <summary>More filters</summary>
              <div class="internal-messages-more-filter-grid">
                <label>
                  <span>Priority</span>
                  <select id="internalMessagesPriorityFilter">
                    <option value="">Any priority</option>
                  </select>
                </label>
                <label>
                  <span>Record type</span>
                  <select id="internalMessagesRecordTypeFilter">
                    <option value="">Any record type</option>
                  </select>
                </label>
              </div>
            </details>
          </div>

          <p id="internalMessagesListStatus" class="internal-messages-message" role="status" aria-live="polite">Loading threads...</p>
          <div id="internalMessagesThreadList" class="internal-messages-thread-list" aria-live="polite"></div>
        </aside>

        <section class="internal-messages-detail-pane" aria-label="Selected internal message thread">
          <div id="internalMessagesDetailEmpty" class="internal-messages-empty-detail">
            <p class="eyebrow">Conversation</p>
            <h2 id="internalMessagesDetailHeading">Select a thread</h2>
            <p>Choose a conversation from the list to read, reply, or update its status.</p>
            <button id="internalMessagesEmptyNewThreadButton" class="secondary-action compact-action" type="button">New thread</button>
          </div>

          <div id="internalMessagesNewPane" class="internal-messages-new-pane" hidden>
            <div class="internal-messages-conversation-header">
              <div>
                <p class="eyebrow">New thread</p>
                <h2 id="internalMessagesNewHeading">Start a conversation</h2>
                <p id="internalMessagesNewStatus" class="internal-messages-message" role="status" aria-live="polite"></p>
              </div>
              <button id="internalMessagesCancelNewThread" class="secondary-action compact-action" type="button">Cancel</button>
            </div>

            <form id="internalMessagesNewForm" class="internal-messages-new-form">
              <div class="internal-messages-form-grid">
                <label class="internal-messages-wide-field">
                  <span>Subject</span>
                  <input id="internalMessagesSubject" name="subject" type="text" maxlength="180" required />
                </label>
                <label>
                  <span>Priority</span>
                  <select id="internalMessagesPriority" name="priority">
                    <option value="normal">Normal</option>
                    <option value="needs_attention">Needs attention</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <label class="internal-messages-full-field">
                  <span>First message</span>
                  <textarea id="internalMessagesBody" name="body" rows="5" maxlength="4000" required></textarea>
                </label>
              </div>

              <details class="internal-messages-record-details">
                <summary>Optional record link</summary>
                <div class="internal-messages-record-grid">
                  <label>
                    <span>Record type</span>
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
                    <span>Record ID</span>
                    <input id="internalMessagesRelatedRecordId" name="relatedRecordId" type="text" maxlength="260" />
                  </label>
                  <label>
                    <span>Record label</span>
                    <input id="internalMessagesRelatedRecordLabel" name="relatedRecordLabel" type="text" maxlength="260" />
                  </label>
                </div>
              </details>

              <div class="internal-messages-form-actions">
                <button id="internalMessagesCreateButton" class="primary-action compact-action" type="submit">Create thread</button>
              </div>
            </form>
          </div>

          <div id="internalMessagesDetailContent" class="internal-messages-detail-content" hidden>
            <div class="internal-messages-conversation-header">
              <div>
                <p id="internalMessagesDetailEyebrow" class="eyebrow">Thread</p>
                <h2 id="internalMessagesDetailSubject">Thread</h2>
                <p id="internalMessagesDetailMeta" class="internal-messages-detail-meta"></p>
              </div>
              <div class="internal-messages-detail-controls">
                <label>
                  <span>Status</span>
                  <select id="internalMessagesDetailStatus"></select>
                </label>
                <label>
                  <span>Priority</span>
                  <select id="internalMessagesDetailPriority"></select>
                </label>
              </div>
            </div>

            <div id="internalMessagesPosts" class="internal-messages-post-list" aria-live="polite"></div>

            <form id="internalMessagesReplyForm" class="internal-messages-reply-form">
              <label>
                <span>Reply</span>
                <textarea id="internalMessagesReplyBody" rows="3" maxlength="4000" required></textarea>
              </label>
              <div class="internal-messages-form-actions">
                <p id="internalMessagesDetailStatusMessage" class="internal-messages-message" role="status" aria-live="polite"></p>
                <button id="internalMessagesReplyButton" class="primary-action compact-action" type="submit">Post reply</button>
              </div>
            </form>
          </div>
        </section>
      </section>
    </div>`
  });
}
