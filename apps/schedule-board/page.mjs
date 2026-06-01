import { renderAppShell } from '../../src/utils/app-shell.mjs';
import { escapeHtml } from '../../src/utils/html.mjs';

export function renderScheduleBoardPage({ user }) {
  const displayName = escapeHtml(user?.displayName || 'staff');

  return renderAppShell({
    title: 'Schedule Board',
    user,
    activePath: '/apps/schedule-board',
    styles: ['/apps/schedule-board.css'],
    scripts: ['/apps/schedule-board.js'],
    mainLabel: 'Schedule Board app',
    content: `
    <div class="schedule-shell">
      <section class="schedule-panel glass-panel" aria-label="Schedule Board app">
        <div class="schedule-title-row">
          <div>
            <p class="eyebrow">Dispatch visibility</p>
            <h1>Schedule Board</h1>
            <p class="welcome-line">Welcome, ${displayName}. Review visit timing, assignments, locations, and follow-up status.</p>
          </div>
          <p class="schedule-mode-pill">v1</p>
        </div>

        <div class="schedule-summary-grid" aria-label="Schedule summary">
          <article class="schedule-stat-card">
            <span>Today</span>
            <strong id="scheduleTodayCount">0</strong>
          </article>
          <article class="schedule-stat-card">
            <span>Upcoming</span>
            <strong id="scheduleUpcomingCount">0</strong>
          </article>
          <article class="schedule-stat-card">
            <span>Unscheduled</span>
            <strong id="scheduleUnscheduledCount">0</strong>
          </article>
          <article class="schedule-stat-card">
            <span>Completed / follow-up</span>
            <strong id="scheduleCompletedCount">0</strong>
          </article>
          <article class="schedule-stat-card">
            <span>Total shown</span>
            <strong id="scheduleTotalCount">0</strong>
          </article>
        </div>

        <section class="schedule-board-pane" aria-labelledby="scheduleBoardHeading">
          <div class="schedule-pane-heading">
            <div>
              <h2 id="scheduleBoardHeading">Visits</h2>
              <p id="scheduleBoardStatus" class="schedule-message" role="status" aria-live="polite">Loading visits...</p>
            </div>
            <button id="refreshScheduleBoard" class="secondary-action compact-action" type="button">Refresh</button>
          </div>

          <div class="schedule-filter-grid">
            <label class="schedule-wide-filter">
              Search
              <input id="scheduleSearch" type="search" placeholder="Work order, customer, phone, location, instructions" />
            </label>
            <label>
              View
              <select id="scheduleViewFilter">
                <option value="">All board sections</option>
                <option value="today">Today</option>
                <option value="upcoming">Upcoming</option>
                <option value="unscheduled">Unscheduled</option>
                <option value="completed">Completed / follow-up</option>
              </select>
            </label>
            <label>
              Assignment
              <select id="scheduleAssignmentFilter">
                <option value="">All assignments</option>
              </select>
            </label>
            <label>
              Visit status
              <select id="scheduleVisitStatusFilter">
                <option value="">Active visits</option>
              </select>
            </label>
            <label>
              Schedule state
              <select id="scheduleStateFilter">
                <option value="">Any state</option>
              </select>
            </label>
            <label>
              Date from
              <input id="scheduleDateFromFilter" type="date" />
            </label>
            <label>
              Date to
              <input id="scheduleDateToFilter" type="date" />
            </label>
          </div>

          <div class="schedule-board-grid" aria-live="polite">
            <section class="schedule-column" data-schedule-section="today" aria-labelledby="todayVisitsHeading">
              <div class="schedule-column-heading">
                <h3 id="todayVisitsHeading">Today</h3>
                <span id="todayVisitsSectionCount">0</span>
              </div>
              <div id="todayVisitsList" class="schedule-card-list"></div>
            </section>

            <section class="schedule-column" data-schedule-section="upcoming" aria-labelledby="upcomingVisitsHeading">
              <div class="schedule-column-heading">
                <h3 id="upcomingVisitsHeading">Upcoming</h3>
                <span id="upcomingVisitsSectionCount">0</span>
              </div>
              <div id="upcomingVisitsList" class="schedule-card-list"></div>
            </section>

            <section class="schedule-column" data-schedule-section="unscheduled" aria-labelledby="unscheduledVisitsHeading">
              <div class="schedule-column-heading">
                <h3 id="unscheduledVisitsHeading">Unscheduled</h3>
                <span id="unscheduledVisitsSectionCount">0</span>
              </div>
              <div id="unscheduledVisitsList" class="schedule-card-list"></div>
            </section>

            <section class="schedule-column" data-schedule-section="completed" aria-labelledby="completedVisitsHeading">
              <div class="schedule-column-heading">
                <h3 id="completedVisitsHeading">Completed / follow-up</h3>
                <span id="completedVisitsSectionCount">0</span>
              </div>
              <div id="completedVisitsList" class="schedule-card-list"></div>
            </section>
          </div>
        </section>
      </section>
    </div>`
  });
}
