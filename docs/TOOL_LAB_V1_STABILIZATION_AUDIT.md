# Home Billiards Tools Lab v1 Stabilization Audit

Branch audited: `stabilize/tool-lab-v1`

Audit scope: documentation/backlog only; no app behavior, routes, schemas, auth, dependencies, or Cue Tracker integrations changed.

## 1. Current App Inventory

| App | Route | API namespace | Database tables used | Current status | Known demo data | Main purpose |
| --- | --- | --- | --- | --- | --- | --- |
| Services & Quotes | `/apps/services-and-quotes` | `/api/apps/services-and-quotes` | `service_categories`, `services` | v1, enabled, protected by `requireAuth` | 4 demo service categories and 8 demo services labeled `Demo -`; includes one inactive service row to confirm inactive services stay hidden | Build quick service quote previews from active service catalog rows. v1 does not save customers or quotes. |
| Cue Repairs | `/apps/cue-repairs` | `/api/apps/cue-repairs` | `cue_repair_types`, `cue_repair_jobs`, `cue_repair_number_seq` | v1, enabled, protected by `requireAuth` | 11 demo repair types labeled `Demo -`; no demo repair jobs or customer records inserted by schema | Track cue repair intake, estimates, statuses, customer contact, completion, pickup, and cancellation. |
| Products / Inventory | `/apps/products-inventory` | `/api/apps/products-inventory` | `product_categories`, `inventory_locations`, `products`, `product_inventory`, `inventory_adjustments` | v1, enabled, protected by `requireAuth` | 6 product categories, 5 locations, 18 demo products, 18 demo inventory rows, and demo initial-count adjustments; product names/SKUs and notes are labeled demo | Track internal product records, pricing, stock quantities by location, low-stock awareness, confidence markers, and immutable inventory adjustments. |

## 2. Platform Architecture Summary

- Express server: `server.mjs` creates one Express app, registers auth, dashboard, app page routes, app API routers, static assets, 404 handling, and generic error handling.
- Server-side sessions: `express-session` with `connect-pg-simple` stores sessions in the Postgres `session` table. Cookie name is `hbtl.sid`; secure cookies are enabled in production.
- `requireAuth`: `src/middleware.mjs` checks `req.session.user` and redirects unauthenticated requests to `/`.
- Supabase Postgres: `src/db.mjs` uses `pg.Pool` with `DATABASE_URL`; SSL is on by default unless `DB_SSL=false`.
- Public assets: `public/` contains the login page, global JS/CSS, app-specific CSS/JS under `public/apps/`, and the Home Billiards logo under `public/assets/`.
- App registry: `src/app-registry.mjs` is the dashboard source of truth for enabled tools and future placeholders. Cue Tracker is explicitly listed as not connected.
- App-specific folders: each current app lives under `apps/<app-id>/` with `page.mjs`, `routes.mjs`, and `database/schema.sql`.
- App-specific SQL files: app schemas are separate from the shell schema in `database/schema.sql`; Cue Repairs also has `apps/cue-repairs/database/simplify-statuses.sql` as a one-off status migration.

## 3. Current Routes Map

### Page Routes

- `GET /` - login page when logged out; redirects logged-in users to `/dashboard`.
- `GET /apps/services-and-quotes` - Services & Quotes page, protected.
- `GET /apps/cue-repairs` - Cue Repairs page, protected.
- `GET /apps/products-inventory` - Products / Inventory page, protected.

### API Routes

- `GET /api/apps/services-and-quotes/categories`
- `GET /api/apps/services-and-quotes/services`
- `POST /api/apps/services-and-quotes/quote-preview`
- `GET /api/apps/cue-repairs/types`
- `GET /api/apps/cue-repairs/repairs`
- `POST /api/apps/cue-repairs/repairs`
- `PATCH /api/apps/cue-repairs/repairs/:id`
- `GET /api/apps/cue-repairs/summary`
- `GET /api/apps/products-inventory/bootstrap`
- `GET /api/apps/products-inventory/categories`
- `GET /api/apps/products-inventory/locations`
- `GET /api/apps/products-inventory/products`
- `GET /api/apps/products-inventory/products/:id`
- `POST /api/apps/products-inventory/products`
- `PATCH /api/apps/products-inventory/products/:id`
- `POST /api/apps/products-inventory/products/:id/archive`
- `POST /api/apps/products-inventory/products/:id/reactivate`
- `GET /api/apps/products-inventory/inventory`
- `GET /api/apps/products-inventory/inventory/adjustments`
- `POST /api/apps/products-inventory/inventory/adjustments`

### Auth Routes

- `POST /login` - validates username and PIN against `users`, writes to `login_events`, regenerates the session, and redirects to `/dashboard`.
- `POST /logout` - destroys the session and clears `hbtl.sid`.

### Dashboard Route

- `GET /dashboard` - protected app launcher populated from `appRegistry`.

## 4. Database Table Map

### Shell/Auth Tables

- `users` - seeded staff/admin login identities and password hashes.
- `login_events` - login audit trail with attempted username, success flag, IP address, user agent, and timestamp.
- `session` - server-side session storage used by `connect-pg-simple`.

### Services & Quotes Tables

- `service_categories` - active/inactive service groupings, sort order, descriptions.
- `services` - service catalog rows with category, name, description, base price in cents, unit label, active flag, and sort order.

### Cue Repairs Tables

- `cue_repair_types` - active/inactive repair types with default prices and sort order.
- `cue_repair_jobs` - repair intake/customer/cue/status/estimate/final price/timestamp tracking.
- `cue_repair_number_seq` - sequence used by `cue_repair_next_number()` to generate repair numbers such as `CR-YYYY-0001`.

### Products / Inventory Tables

- `product_categories` - category names, slugs, descriptions, active flag, and sort order.
- `inventory_locations` - stock locations with location codes, descriptions, active flag, and sort order.
- `products` - product identity, category, SKU/code, brand/manufacturer/model, type/status, descriptions, notes, stock unit, pricing, taxable flag, inventory tracking flag, and archive timestamp.
- `product_inventory` - per-product, per-location quantity, low-stock threshold, confidence marker, count timestamp, and notes.
- `inventory_adjustments` - immutable stock movement ledger with before/delta/after quantities, reason, notes, group id, staff name, and timestamp.

## 5. Known Rough Edges

- Demo data cleanup: all three app schemas include optional demo/test seed sections. These are useful for v1 validation but should be separated from production-ready schema/migration steps before real data entry.
- UI simplification: the apps are functional but dense. Cue Repairs and Products / Inventory especially would benefit from workflow-focused trimming after staff feedback.
- Inconsistent naming: user-facing names mix `Products / Inventory`, `Product Data Admin`, `Services & Quotes`, `quote preview`, `repair dashboard`, and `inventory awareness`. A short naming pass would reduce staff confusion.
- Missing admin editing: there is no app UI for editing service categories/services, cue repair types, product categories, or inventory locations. Those are currently managed through SQL/seed data.
- Seed data concerns: Services and Cue Repairs clearly prefix demo rows with `Demo -`; Products / Inventory product rows do too, but category and location names are plausible operational names. That can blur demo versus real setup.
- Testing gaps: no automated tests or test folders were found. Current confidence appears to depend on manual login, app workflow checks, and database inspection.
- App-specific polish: Services & Quotes has no saved quotes/customer export; Cue Repairs has no closeout review screen or delete/archive workflow; Products / Inventory has no import/export path and uses fractional demo quantities even for countable product examples.
- Database migration concerns: schema and demo seed data are bundled together, and migration history is not formalized. Cue Repairs has one separate status migration file, which should be accounted for in deployment order.
- Live data entry concerns: once real customer or inventory data is entered, demo cleanup, backup expectations, audit requirements, retention rules, and staff edit permissions become operational concerns.
- Auth/roles are basic: `users.role` exists, but app access is currently all logged-in users through `requireAuth`; there is no role-based app authorization.
- Render/Supabase operational checks are manual: environment variables and pooled connection usage are documented, but there is no deployment checklist or health-check route.

## 6. Stabilization Checklist

### Login

- [ ] Confirm `/` loads the login screen when logged out.
- [ ] Confirm invalid login redirects with the expected login error.
- [ ] Confirm valid users seeded by `database/seed-users.mjs` can log in.
- [ ] Confirm successful and failed attempts write to `login_events`.
- [ ] Confirm logout destroys the session and clears access to protected pages.

### Dashboard

- [ ] Confirm `/dashboard` is protected by `requireAuth`.
- [ ] Confirm the dashboard shows exactly three enabled v1 apps.
- [ ] Confirm future/disabled app registry entries do not open live tools.
- [ ] Confirm Cue Tracker remains shown as not connected and disabled.

### Services & Quotes

- [ ] Confirm categories and services load from active rows only.
- [ ] Confirm inactive demo services do not appear.
- [ ] Confirm quote preview handles empty, single-item, multi-item, and duplicate service selections.
- [ ] Confirm currency displays in CAD and totals use cents correctly.
- [ ] Confirm no customer records or saved quote rows are created.

### Cue Repairs

- [ ] Confirm repair types load from active rows only.
- [ ] Confirm creating a repair requires customer name, one contact method, cue detail, and repair type.
- [ ] Confirm status filters, search, and summary counts agree with database rows.
- [ ] Confirm status changes set completion, contacted, pickup, and cancellation timestamps as expected.
- [ ] Confirm custom/other repair type flow works after refresh.

### Products / Inventory

- [ ] Confirm bootstrap loads categories, locations, product statuses, product types, stock units, confidence values, and adjustment types.
- [ ] Confirm product create/edit validates category, type, status, stock unit, money fields, and unique SKU/code.
- [ ] Confirm archive/reactivate behavior preserves expected product visibility.
- [ ] Confirm inventory filters and low-stock counts match `product_inventory`.
- [ ] Confirm adjustment creation updates inventory and writes immutable `inventory_adjustments` rows.

### Supabase Tables

- [ ] Confirm shell schema is present in the lab Supabase project only.
- [ ] Confirm each app schema has been applied once and in the intended order.
- [ ] Confirm demo data is intentional in the current environment.
- [ ] Confirm no SQL is run against the live Cue Tracker database.
- [ ] Confirm backups/exports exist before real operational data is entered.

### Render Deploy

- [ ] Confirm Render deploys from `main`.
- [ ] Confirm build command is `npm install`.
- [ ] Confirm start command is `npm start`.
- [ ] Confirm `NODE_ENV=production`.
- [ ] Confirm `DATABASE_URL` and `SESSION_SECRET` are set in Render environment variables.
- [ ] Confirm the Supabase pooled connection string is used.

### GitHub Branches

- [ ] Keep `main` as the stable deployed branch.
- [ ] Keep stabilization work in `stabilize/tool-lab-v1`.
- [ ] Use feature/fix branches for app changes after this audit.
- [ ] Open PRs into `main`; do not merge until manually reviewed.
- [ ] Keep documentation-only PRs separate from behavior changes.

### Demo Data

- [ ] Decide which demo rows stay in local/staging only.
- [ ] Remove or isolate demo seed sections before production data entry.
- [ ] Replace plausible demo category/location names with real approved operational values.
- [ ] Confirm demo inventory counts are not treated as real stock.
- [ ] Document a safe cleanup script/process before staff onboarding.

### Real-Data Readiness

- [ ] Confirm staff-approved service catalog and prices.
- [ ] Confirm real cue repair statuses and intake fields.
- [ ] Confirm product category/location taxonomy.
- [ ] Confirm inventory counting process and confidence definitions.
- [ ] Confirm who may create, edit, archive, or adjust records.

## 7. App Polish Backlog

### Fix Now

- Separate schema creation from demo seed data or clearly document production-safe SQL order.
- Create a demo cleanup plan before any real customer, repair, product, or inventory records are entered.
- Add a short manual smoke-test checklist to the repo for login, dashboard, and all three v1 apps.
- Verify Render/Supabase environment settings against the deployment notes.
- Confirm the live Cue Tracker database credentials are not present in this project or Render environment.

### Fix Soon

- Add admin/data-management screens or scripts for service catalog rows, cue repair types, product categories, and inventory locations.
- Standardize product/app naming in dashboard copy, docs, and future issues.
- Add basic automated tests around API validation, auth protection, and quote/inventory math.
- Add a CSV import/export plan for product data and inventory counts.
- Add staff-facing real-data entry guidance for customer records and inventory adjustments.

### Defer

- Role-based authorization by app or action.
- Saved quote records and quote/customer history.
- Advanced repair workflow reporting, notifications, or pickup reminders.
- Full inventory purchasing/receiving workflows.
- Any connection to the live Cue Tracker, unless explicitly approved as a separate project with a migration plan.

## 8. App 4 Readiness

The platform is structurally ready for App 4: there is an app registry, protected page route pattern, protected API namespace pattern, app-specific folders, public app assets, and app-specific SQL files.

Clean up these items first:

- Decide and document the schema-versus-demo-seed process so App 4 does not add more mixed migration/seed ambiguity.
- Add a lightweight smoke-test routine so App 4 can be validated without regressing the three existing apps.
- Confirm real-data readiness for the current apps before widening the operational surface area.
- Keep Cue Tracker isolated; App 4 should not touch or depend on the live tracker.
- Consider a small shared checklist/template for new app folders, route registration, SQL files, dashboard registry entries, and deployment verification.

## 9. Recommended Next Actions

1. Review this audit with the project manager and mark which demo data is local/staging only.
2. Create a production-safe SQL plan that separates base schemas, migrations, and seed/demo data.
3. Run the stabilization checklist manually on the current Render/Supabase environment.
4. Confirm Render uses only the lab Supabase database and never the live Cue Tracker database.
5. Decide the real service catalog, repair type list, product categories, and inventory locations.
6. Clean or replace demo rows before staff enter real operational data.
7. Add a small smoke-test document or script for protected routes and core API workflows.
8. Create backlog issues from the Fix Now and Fix Soon sections.
9. Define staff permissions for editing catalog/configuration data versus entering daily records.
10. Start App 4 only after demo cleanup, deploy verification, and smoke-test coverage are in place.

## 10. Codex Safety Notes

Future Codex tasks must avoid breaking:

- The live Cue Tracker isolation rule; do not connect to, migrate, seed, or inspect the live Cue Tracker database from this repo.
- Authentication flow in `server.mjs`, `src/middleware.mjs`, `database/schema.sql`, and `database/seed-users.mjs` unless the task explicitly targets auth.
- Existing route paths for `/`, `/login`, `/logout`, `/dashboard`, `/apps/*`, and `/api/apps/*`.
- Existing database table names, column names, constraints, indexes, triggers, and sequences unless a migration task explicitly authorizes schema changes.
- Server-side session storage in the `session` table and `hbtl.sid` cookie behavior.
- Existing app registry entries, especially disabled/future Cue Tracker status.
- App-specific SQL separation under `apps/<app-id>/database/`.
- Inventory adjustment immutability; corrections should be new adjustment rows, not updates/deletes.
- Demo-data labeling until a deliberate cleanup task removes or replaces it.
- The no-new-app boundary during stabilization work.
