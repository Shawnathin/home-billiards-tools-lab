import { renderAppShell } from '../../src/utils/app-shell.mjs';
import { escapeHtml } from '../../src/utils/html.mjs';

export function renderJobsWorkOrdersPage({ user }) {
  const displayName = escapeHtml(user?.displayName || 'staff');

  return renderAppShell({
    title: 'Work Orders',
    user,
    activePath: '/apps/jobs-work-orders',
    styles: ['/apps/jobs-work-orders.css'],
    scripts: ['/apps/jobs-work-orders.js'],
    mainLabel: 'Work Orders app',
    content: `
    <div class="jobs-shell">
      <section class="jobs-panel glass-panel" aria-label="Work Orders app">
        <div class="jobs-title-row">
          <div>
            <p class="eyebrow">Operations workflow</p>
            <h1>Work Orders</h1>
            <p class="welcome-line">Welcome, ${displayName}. Create customer-linked work orders, visits, and service locations.</p>
          </div>
          <p class="jobs-mode-pill">v1</p>
        </div>

        <div class="jobs-summary-grid" aria-label="Work order summary">
          <article class="jobs-stat-card">
            <span>Quoted</span>
            <strong id="quotedWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>To be scheduled</span>
            <strong id="toBeScheduledWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>Booked</span>
            <strong id="bookedWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>Booked visits</span>
            <strong id="bookedVisitsCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>Completed</span>
            <strong id="completedWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>Invoiced</span>
            <strong id="invoicedWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>Paid</span>
            <strong id="paidWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>Cancelled</span>
            <strong id="cancelledWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>Unscheduled</span>
            <strong id="unscheduledWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>HBS Internal</span>
            <strong id="hbsInternalWorkOrderCount">0</strong>
          </article>
          <article class="jobs-stat-card">
            <span>HBS External</span>
            <strong id="hbsExternalWorkOrderCount">0</strong>
          </article>
        </div>

        <div class="jobs-workspace" data-jobs-work-orders-app>
          <section class="jobs-intake-pane" aria-labelledby="workOrderIntakeHeading">
            <div class="jobs-pane-heading">
              <div>
                <h2 id="workOrderIntakeHeading">Create work order</h2>
                <p id="workOrderFormMessage" class="jobs-message" role="status" aria-live="polite"></p>
              </div>
              <button id="resetWorkOrderForm" class="secondary-action compact-action" type="button">New</button>
            </div>

            <form id="workOrderForm" class="jobs-form">
              <section class="jobs-form-section" aria-label="Customer">
                <h3>Customer</h3>
                <div class="jobs-contact-link">
                  <div class="jobs-contact-link-heading">
                    <strong>Customer search</strong>
                    <button id="clearWorkOrderContactLink" class="secondary-action compact-action" type="button" disabled>Clear</button>
                  </div>
                  <input name="customerContactId" type="hidden" />
                  <label>
                    Search
                    <input id="workOrderContactSearch" type="search" placeholder="Name, phone, email, company, contact number" autocomplete="off" />
                  </label>
                  <div id="workOrderContactSelected" class="jobs-selected-contact is-hidden" aria-live="polite"></div>
                  <div id="workOrderContactAddressOption" class="jobs-contact-address-option is-hidden" aria-live="polite"></div>
                  <div id="workOrderContactResults" class="jobs-contact-results" aria-live="polite"></div>
                </div>

                <div class="jobs-field-grid three-columns">
                  <label>
                    Contact person
                    <input name="contactPersonName" type="text" autocomplete="name" />
                  </label>
                  <label>
                    Contact phone
                    <input name="contactPersonPhone" type="tel" autocomplete="tel" />
                  </label>
                  <label>
                    Contact email
                    <input name="contactPersonEmail" type="email" autocomplete="email" />
                  </label>
                </div>
              </section>

              <section class="jobs-form-section" aria-label="Locations">
                <h3>Locations</h3>
                <label>
                  Location mode
                  <select id="locationModeSelect" name="locationMode">
                    <option value="service">Service address</option>
                    <option value="pickup_delivery">Pickup + delivery</option>
                  </select>
                </label>

                <div class="jobs-location-group" data-location-panel="service">
                  <div class="jobs-section-subhead">
                    <strong>Service address</strong>
                  </div>
                  <label>
                    Saved property
                    <select id="servicePropertySelect" data-property-select="service">
                      <option value="">Select saved property</option>
                    </select>
                  </label>
                  <div class="jobs-field-grid two-columns">
                    <label>
                      Label
                      <input data-location-field="service.label" type="text" />
                    </label>
                    <label>
                      Address line 1
                      <input data-location-field="service.addressLine1" type="text" autocomplete="address-line1" />
                    </label>
                    <label>
                      Address line 2
                      <input data-location-field="service.addressLine2" type="text" autocomplete="address-line2" />
                    </label>
                    <label>
                      City
                      <input data-location-field="service.city" type="text" autocomplete="address-level2" />
                    </label>
                    <label>
                      Province
                      <input data-location-field="service.province" type="text" autocomplete="address-level1" value="BC" />
                    </label>
                    <label>
                      Postal code
                      <input data-location-field="service.postalCode" type="text" autocomplete="postal-code" />
                    </label>
                  </div>
                  <div class="jobs-field-grid two-columns">
                    <label>
                      Site/access notes
                      <textarea data-location-field="service.siteAccessNotes" rows="2"></textarea>
                    </label>
                    <label>
                      Parking notes
                      <textarea data-location-field="service.parkingNotes" rows="2"></textarea>
                    </label>
                    <label>
                      Stairs/elevator notes
                      <textarea data-location-field="service.stairsElevatorNotes" rows="2"></textarea>
                    </label>
                    <label>
                      Room/location notes
                      <textarea data-location-field="service.roomLocationNotes" rows="2"></textarea>
                    </label>
                  </div>
                  <label class="jobs-checkbox-row compact-checkbox jobs-save-property-row">
                    <input data-save-property-role="service" type="checkbox" />
                    Save this address to customer properties
                  </label>
                </div>

                <div class="jobs-location-group is-hidden" data-location-panel="pickup">
                  <div class="jobs-section-subhead">
                    <strong>Pickup address</strong>
                  </div>
                  <label>
                    Saved property
                    <select id="pickupPropertySelect" data-property-select="pickup">
                      <option value="">Select saved property</option>
                    </select>
                  </label>
                  <div class="jobs-field-grid two-columns">
                    <label>
                      Label
                      <input data-location-field="pickup.label" type="text" />
                    </label>
                    <label>
                      Address line 1
                      <input data-location-field="pickup.addressLine1" type="text" autocomplete="address-line1" />
                    </label>
                    <label>
                      Address line 2
                      <input data-location-field="pickup.addressLine2" type="text" autocomplete="address-line2" />
                    </label>
                    <label>
                      City
                      <input data-location-field="pickup.city" type="text" autocomplete="address-level2" />
                    </label>
                    <label>
                      Province
                      <input data-location-field="pickup.province" type="text" autocomplete="address-level1" value="BC" />
                    </label>
                    <label>
                      Postal code
                      <input data-location-field="pickup.postalCode" type="text" autocomplete="postal-code" />
                    </label>
                  </div>
                  <div class="jobs-field-grid two-columns">
                    <label>
                      Site/access notes
                      <textarea data-location-field="pickup.siteAccessNotes" rows="2"></textarea>
                    </label>
                    <label>
                      Parking notes
                      <textarea data-location-field="pickup.parkingNotes" rows="2"></textarea>
                    </label>
                    <label>
                      Stairs/elevator notes
                      <textarea data-location-field="pickup.stairsElevatorNotes" rows="2"></textarea>
                    </label>
                    <label>
                      Room/location notes
                      <textarea data-location-field="pickup.roomLocationNotes" rows="2"></textarea>
                    </label>
                  </div>
                  <label class="jobs-checkbox-row compact-checkbox jobs-save-property-row">
                    <input data-save-property-role="pickup" type="checkbox" />
                    Save this address to customer properties
                  </label>
                </div>

                <div class="jobs-location-group is-hidden" data-location-panel="delivery">
                  <div class="jobs-section-subhead">
                    <strong>Delivery address</strong>
                  </div>
                  <label>
                    Saved property
                    <select id="deliveryPropertySelect" data-property-select="delivery">
                      <option value="">Select saved property</option>
                    </select>
                  </label>
                  <div class="jobs-field-grid two-columns">
                    <label>
                      Label
                      <input data-location-field="delivery.label" type="text" />
                    </label>
                    <label>
                      Address line 1
                      <input data-location-field="delivery.addressLine1" type="text" autocomplete="address-line1" />
                    </label>
                    <label>
                      Address line 2
                      <input data-location-field="delivery.addressLine2" type="text" autocomplete="address-line2" />
                    </label>
                    <label>
                      City
                      <input data-location-field="delivery.city" type="text" autocomplete="address-level2" />
                    </label>
                    <label>
                      Province
                      <input data-location-field="delivery.province" type="text" autocomplete="address-level1" value="BC" />
                    </label>
                    <label>
                      Postal code
                      <input data-location-field="delivery.postalCode" type="text" autocomplete="postal-code" />
                    </label>
                  </div>
                  <div class="jobs-field-grid two-columns">
                    <label>
                      Site/access notes
                      <textarea data-location-field="delivery.siteAccessNotes" rows="2"></textarea>
                    </label>
                    <label>
                      Parking notes
                      <textarea data-location-field="delivery.parkingNotes" rows="2"></textarea>
                    </label>
                    <label>
                      Stairs/elevator notes
                      <textarea data-location-field="delivery.stairsElevatorNotes" rows="2"></textarea>
                    </label>
                    <label>
                      Room/location notes
                      <textarea data-location-field="delivery.roomLocationNotes" rows="2"></textarea>
                    </label>
                  </div>
                  <label class="jobs-checkbox-row compact-checkbox jobs-save-property-row">
                    <input data-save-property-role="delivery" type="checkbox" />
                    Save this address to customer properties
                  </label>
                </div>

                <details class="jobs-quick-property">
                  <summary>Quick add property</summary>
                  <div class="jobs-quick-property-grid">
                    <label>
                      Use for
                      <select id="quickPropertyRole">
                        <option value="service">Service</option>
                        <option value="pickup">Pickup</option>
                        <option value="delivery">Delivery</option>
                      </select>
                    </label>
                    <label>
                      Label
                      <input id="quickPropertyLabel" type="text" />
                    </label>
                    <label>
                      Address line 1
                      <input id="quickPropertyAddressLine1" type="text" autocomplete="address-line1" />
                    </label>
                    <label>
                      Address line 2
                      <input id="quickPropertyAddressLine2" type="text" autocomplete="address-line2" />
                    </label>
                    <label>
                      City
                      <input id="quickPropertyCity" type="text" autocomplete="address-level2" />
                    </label>
                    <label>
                      Province
                      <input id="quickPropertyProvince" type="text" autocomplete="address-level1" value="BC" />
                    </label>
                    <label>
                      Postal code
                      <input id="quickPropertyPostalCode" type="text" autocomplete="postal-code" />
                    </label>
                    <label>
                      Site/access notes
                      <textarea id="quickPropertySiteAccessNotes" rows="2"></textarea>
                    </label>
                    <label>
                      Parking notes
                      <textarea id="quickPropertyParkingNotes" rows="2"></textarea>
                    </label>
                    <label>
                      Stairs/elevator notes
                      <textarea id="quickPropertyStairsElevatorNotes" rows="2"></textarea>
                    </label>
                    <label>
                      Room/location notes
                      <textarea id="quickPropertyRoomLocationNotes" rows="2"></textarea>
                    </label>
                    <button id="addQuickProperty" class="secondary-action compact-action" type="button">Add property</button>
                  </div>
                </details>
              </section>

              <section class="jobs-form-section" aria-label="Work details">
                <h3>Work Details</h3>
                <div class="jobs-field-grid three-columns">
                  <label>
                    Work type
                    <select id="jobTypeSelect" name="jobTypeId" required>
                      <option value="">Loading work types...</option>
                    </select>
                  </label>
                  <label>
                    Abbreviation
                    <input name="workTypeAbbreviation" type="text" />
                  </label>
                  <label>
                    Status
                    <select id="statusSelect" name="status" required></select>
                  </label>
                </div>

                <label>
                  Title
                  <input name="title" type="text" />
                </label>

                <div class="jobs-field-grid two-columns">
                  <label>
                    Product / table details
                    <input name="productOrTableInvolved" type="text" />
                  </label>
                  <label>
                    Reference number
                    <input name="referenceNumber" type="text" />
                  </label>
                  <label>
                    Old system reference
                    <input name="oldSystemReference" type="text" />
                  </label>
                  <label>
                    Customer reference
                    <input name="customerReferenceNumber" type="text" />
                  </label>
                  <label>
                    Source ticket ID
                    <input name="sourceWarrantyServiceTicketId" type="text" />
                  </label>
                </div>

                <label>
                  Work description
                  <textarea name="serviceDetails" rows="4" required></textarea>
                </label>
              </section>

              <section class="jobs-form-section" aria-label="Schedule and visits">
                <h3>Schedule / Visits</h3>
                <div class="jobs-field-grid three-columns">
                  <label>
                    Visit type
                    <select id="visitTypeSelect" name="visitType"></select>
                  </label>
                  <label>
                    Schedule state
                    <select id="scheduleStateSelect" name="scheduleState"></select>
                  </label>
                  <label>
                    Booked date
                    <input name="scheduledDate" type="date" />
                  </label>
                  <label>
                    Arrival window
                    <select id="arrivalWindowSelect" name="arrivalWindowLabel"></select>
                  </label>
                  <label class="jobs-checkbox-row compact-checkbox">
                    <input id="anytimeVisit" name="anytime" type="checkbox" />
                    Anytime
                  </label>
                  <label>
                    Start time
                    <input name="startTime" type="time" />
                  </label>
                  <label>
                    End time
                    <input name="endTime" type="time" />
                  </label>
                  <label>
                    Assigned to
                    <select id="assignedToSelect" name="assignedTo"></select>
                  </label>
                </div>
                <label>
                  Visit instructions
                  <textarea name="visitInstructions" rows="3"></textarea>
                </label>
                <label>
                  Timing notes
                  <textarea name="timingNotes" rows="2"></textarea>
                </label>
              </section>

              <section class="jobs-form-section" aria-label="Office notes">
                <h3>Office Notes</h3>
                <label>
                  Internal office notes
                  <textarea name="internalNotes" rows="3"></textarea>
                </label>
              </section>

              <section class="jobs-form-section" aria-label="Status lifecycle">
                <h3>Status / Billing Lifecycle</h3>
                <div class="jobs-lifecycle-strip" aria-label="Work order lifecycle">
                  <span>Quoted</span>
                  <span>To be scheduled</span>
                  <span>Booked</span>
                  <span>Completed</span>
                  <span>Invoiced</span>
                  <span>Paid</span>
                  <span>Cancelled</span>
                </div>
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
                <input id="workOrderSearch" type="search" placeholder="Number, customer, city, reference, work" />
              </label>
              <label>
                Status
                <select id="statusFilter">
                  <option value="">Any status</option>
                </select>
              </label>
              <label>
                Work type
                <select id="jobTypeFilter">
                  <option value="">All types</option>
                </select>
              </label>
              <label>
                Assigned
                <select id="assignedToFilter">
                  <option value="">Any team</option>
                </select>
              </label>
              <label>
                Scheduled date
                <input id="scheduledDateFilter" type="date" />
              </label>
              <label>
                City
                <input id="cityFilter" type="text" />
              </label>
              <label class="jobs-checkbox-row compact-checkbox">
                <input id="unscheduledFilter" type="checkbox" />
                Unscheduled
              </label>
              <label class="jobs-checkbox-row compact-checkbox">
                <input id="includeArchivedFilter" type="checkbox" />
                Archived
              </label>
            </div>

            <div id="workOrderList" class="jobs-work-order-list" aria-live="polite"></div>
          </section>
        </div>
      </section>
    </div>`
  });
}
