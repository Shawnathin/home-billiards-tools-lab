# Tool Lab v1 Smoke Test Checklist

Source of truth: `docs/TOOL_LAB_V1_STABILIZATION_AUDIT.md`

Purpose: run this checklist manually before merging future PRs, after Render deploys, and before staff use real operational data. This checklist must not change app behavior, database schemas, authentication, or Cue Tracker connections.

## Test Setup

- [ ] Confirm you are testing the Home Billiards Tools Lab environment, not the live Cue Tracker.
- [ ] Confirm the app is using the lab Supabase project only.
- [ ] Confirm you have a valid seeded Tool Lab user and login code.
- [ ] Confirm demo data is expected in the test environment before using demo rows in test steps.
- [ ] Keep a note of browser, device, and environment tested.

## 1. Login

1. Open `/` while logged out.
2. Confirm the Home Billiards Tools Lab login screen appears.
3. Submit the form with no user or no login code.
4. Confirm the app redirects back to `/` and shows the missing-login message.
5. Submit an invalid user/login code combination.
6. Confirm the app redirects back to `/` and shows the failed-login message.
7. Submit a valid seeded Tool Lab user and login code.
8. Confirm the app redirects to `/dashboard`.
9. In Supabase, confirm a successful login attempt was written to `login_events`.
10. In Supabase, confirm failed login attempts were also written to `login_events`.

Expected result: valid users reach the dashboard, invalid attempts stay on login, and login events are recorded.

## 2. Logout

1. From `/dashboard`, click `Log out`.
2. Confirm the app redirects to `/`.
3. Try opening `/dashboard` directly in the same browser.
4. Confirm the app redirects back to `/`.
5. Try opening each protected app route directly:
   - `/apps/services-and-quotes`
   - `/apps/cue-repairs`
   - `/apps/products-inventory`
6. Confirm each protected app route redirects back to `/`.

Expected result: logout destroys access to all protected pages.

## 3. Dashboard

1. Log in with a valid Tool Lab user.
2. Confirm `/dashboard` loads without error.
3. Confirm the dashboard says 3 tools are ready.
4. Confirm these enabled app cards are visible and clickable:
   - Services & Quotes
   - Cue Repairs
   - Products / Inventory
5. Confirm disabled/future registry entries are visible only as inactive cards or non-live entries:
   - Cue Tracker
   - Project Command Center
   - Product Data Admin
6. Confirm Cue Tracker is not clickable as a live app and is described as not connected.
7. Click each enabled app card and confirm it opens the expected app page.
8. Use each app's Dashboard link to return to `/dashboard`.

Expected result: only the three v1 tools are active, and Cue Tracker remains disconnected.

## 4. Services & Quotes

1. Open `/apps/services-and-quotes`.
2. Confirm the page loads with the Services & Quotes title.
3. Confirm the active service catalog loads.
4. Confirm demo categories and services appear only when demo data is expected.
5. Confirm inactive demo services do not appear in the selectable catalog.
6. Add one service to the quote preview.
7. Confirm the quote line appears with quantity, unit price, line subtotal, and subtotal.
8. Increase and decrease quantity.
9. Confirm subtotal updates correctly in CAD.
10. Add multiple services.
11. Confirm the subtotal equals the sum of all line subtotals.
12. Remove all services.
13. Confirm the quote preview returns to an empty or `$0.00` state.
14. Refresh the page.
15. Confirm no customer record or saved quote record was created.

Expected result: Services & Quotes calculates previews from active services only and does not save customer or quote data.

## 5. Cue Repairs

1. Open `/apps/cue-repairs`.
2. Confirm the Cue Repairs page loads with summary cards, intake form, filters, and repair list.
3. Confirm active repair types load in the repair type dropdown.
4. Confirm demo repair types appear only when demo data is expected.
5. Try submitting an empty repair form.
6. Confirm validation prevents creation or shows a useful required-field message.
7. Create a test repair with:
   - Customer name
   - Phone or email
   - Cue description
   - Repair type
   - Estimate
   - Notes
8. Confirm the repair appears in the repair list.
9. Confirm the repair has a generated repair number.
10. Confirm the Open summary count updates.
11. Search for the test repair by customer name or repair number.
12. Confirm the search result includes the test repair.
13. Change the status to `needs_attention`.
14. Confirm the Needs attention summary count updates.
15. Change the status to `ready_for_pickup`.
16. Confirm `completed_at` is set in Supabase for that repair.
17. Mark the customer contacted if the UI exposes that action.
18. Confirm `customer_contacted_at` is set in Supabase.
19. Change the status to `picked_up`.
20. Confirm `picked_up_at` is set and the repair no longer counts as open.
21. Create or edit a repair using the custom/other repair type path if demo data includes that option.
22. Refresh the page and confirm the repair list and summary still agree.

Expected result: repair intake, filtering, status updates, and timestamp side effects work as expected in the lab database.

## 6. Products / Inventory

1. Open `/apps/products-inventory`.
2. Confirm the Products / Inventory page loads with summary cards, product form, filters, and product list.
3. Confirm bootstrap data loads:
   - Product categories
   - Inventory locations
   - Product statuses
   - Product types
   - Stock units
   - Inventory confidence values
   - Adjustment types
4. Confirm demo product rows appear only when demo data is expected.
5. Try submitting an empty product form.
6. Confirm validation prevents creation or shows a useful required-field message.
7. Create a test product with:
   - Product name
   - Category
   - Status
   - Product type
   - SKU/code
   - Stock unit
   - Cost, retail, and/or MSRP if needed
8. Confirm the product appears in the product list.
9. Search for the product by name or SKU/code.
10. Confirm search returns the product.
11. Edit the product and save.
12. Confirm the updated values appear after refresh.
13. Archive the product.
14. Confirm it disappears from the default open product view.
15. Enable the include-archived filter.
16. Confirm the archived product appears.
17. Reactivate the product.
18. Confirm it returns to the default open product view.
19. If inventory tracking is enabled, create an inventory adjustment.
20. Confirm `product_inventory` updates for the product/location.
21. Confirm an immutable `inventory_adjustments` row is written with before, delta, after, reason, notes, adjusted-by, and timestamp.
22. Test low-stock and location filters against a known row.

Expected result: product records, archive/reactivate, filters, inventory rows, and adjustment history behave consistently in the lab database.

## 7. Render Deployment Sanity

1. Confirm Render deploys from `main`.
2. Confirm the build command is `npm install`.
3. Confirm the start command is `npm start`.
4. Confirm `NODE_ENV=production`.
5. Confirm `DATABASE_URL` is present and points to the lab Supabase pooled connection string.
6. Confirm `SESSION_SECRET` is present.
7. Confirm no `.env` file is committed.
8. Open the deployed Render URL.
9. Confirm the login page loads.
10. Log in and confirm `/dashboard` loads.
11. Open all three v1 app pages.
12. Confirm Render logs show no startup error or repeated server error during smoke testing.

Expected result: deployed app starts cleanly, uses lab environment variables, and serves all protected v1 pages.

## 8. Supabase Table Sanity

1. Confirm the lab Supabase project contains shell/auth tables:
   - `users`
   - `login_events`
   - `session`
2. Confirm Services & Quotes tables exist:
   - `service_categories`
   - `services`
3. Confirm Cue Repairs tables and sequence exist:
   - `cue_repair_types`
   - `cue_repair_jobs`
   - `cue_repair_number_seq`
4. Confirm Products / Inventory tables exist:
   - `product_categories`
   - `inventory_locations`
   - `products`
   - `product_inventory`
   - `inventory_adjustments`
5. Confirm demo rows are present only where expected for the environment.
6. Confirm no SQL has been run against the live Cue Tracker database.
7. Confirm backups or exports exist before real operational data is entered.

Expected result: the lab database has the expected Tool Lab tables only and remains separate from Cue Tracker.

## 9. Regression Checks After Each Future PR

Run this shorter pass after every future PR, even for small changes:

- [ ] Log in successfully.
- [ ] Log out successfully.
- [ ] Confirm `/dashboard` is protected while logged out.
- [ ] Confirm dashboard still shows exactly three enabled v1 apps.
- [ ] Confirm Cue Tracker remains disabled and not connected.
- [ ] Open Services & Quotes and calculate one quote preview.
- [ ] Open Cue Repairs and load repair types, repair list, and summary counts.
- [ ] Open Products / Inventory and load bootstrap data plus product list.
- [ ] Confirm no route names changed unless the PR explicitly documented a bug fix.
- [ ] Confirm no database schema changes were included unless the PR explicitly authorized a migration.
- [ ] Confirm no auth/session code changed unless the PR explicitly targeted authentication.
- [ ] Confirm no new dependencies were added unless the PR explicitly approved them.
- [ ] Confirm Render deploy sanity after merging to `main`.
