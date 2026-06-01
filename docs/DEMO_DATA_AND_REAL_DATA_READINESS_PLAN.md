# Demo Data and Real Data Readiness Plan

Source of truth: `docs/TOOL_LAB_V1_STABILIZATION_AUDIT.md`

Purpose: keep demo/test records clearly separated from real Home Billiards operations before staff begin entering real service, cue repair, product, or inventory data.

## Non-Negotiable Database Warning

Do not run any Tool Lab SQL against the live Cue Tracker database.

This project is separate from the live Cue Tracker. All schema files, seed data, cleanup work, and future migrations must target only the Home Billiards Tools Lab Supabase project.

## 1. Apps That Currently Have Demo Data

### Services & Quotes

- Tables: `service_categories`, `services`
- Demo data:
  - 4 demo service categories labeled `Demo -`
  - 8 demo services labeled `Demo -`
  - 1 inactive demo service row used to confirm inactive services stay hidden
- No customer records or saved quote records are inserted by the schema.

### Cue Repairs

- Tables: `cue_repair_types`, `cue_repair_jobs`
- Demo data:
  - 11 demo repair types labeled `Demo -`
- No demo repair jobs or customer records are inserted by the schema.

### Products / Inventory

- Tables: `product_categories`, `inventory_locations`, `products`, `product_inventory`, `inventory_adjustments`
- Demo data:
  - 6 product categories with realistic operational names
  - 5 inventory locations with realistic operational names
  - 18 demo products labeled `Demo -`
  - 18 demo inventory rows
  - Demo initial-count adjustment rows
- Product names, SKUs, and notes are labeled demo, but category and location names are plausible enough to be confused with real setup values.

## 2. Why Demo Data Exists

- It gives each v1 app enough records to render and test immediately.
- It supports manual smoke testing without entering real customer, catalog, or inventory data.
- It validates important behavior such as active/inactive filtering, quote math, repair type selection, product filters, low-stock indicators, and adjustment history.
- It helps confirm the app is connected to the lab Supabase project after deploy.

Demo data is useful for testing. It is not approved operational data.

## 3. Demo Data That Must Be Cleaned or Replaced Before Staff Use

### Clean or Replace Before Real Services Use

- Remove or replace all `Demo -` service categories.
- Remove or replace all `Demo -` services.
- Replace demo prices with approved Home Billiards service pricing.
- Confirm inactive services are intentionally inactive and not leftover test rows.
- Confirm all active services have staff-approved names, descriptions, units, and prices.

### Clean or Replace Before Real Cue Repair Use

- Remove or replace all `Demo -` cue repair types.
- Replace demo default prices with approved repair pricing.
- Confirm the final repair type list matches staff intake workflow.
- Confirm no demo/customer test repairs remain if any were created during smoke testing.
- Confirm repair number sequencing is acceptable before first real intake.

### Clean or Replace Before Real Products / Inventory Use

- Remove or replace all `Demo -` products.
- Remove or replace all demo inventory rows and demo initial-count adjustments.
- Replace category names with approved product taxonomy.
- Replace location names/codes with approved operational locations.
- Confirm demo fractional quantities are not treated as real stock.
- Confirm all products, SKUs, prices, tax flags, stock units, and tracking flags are approved.
- Confirm initial inventory counts are entered from a physical count or approved source.

## 4. How to Avoid Confusing Demo Data With Real Operational Data

- Keep demo rows labeled with `Demo -` until they are deliberately removed.
- Do not rename demo rows into real rows without reviewing all related fields.
- Treat plausible Products / Inventory categories and locations as demo until explicitly approved.
- Do not promise product availability based on demo inventory counts.
- Keep local/staging demo data separate from production-ready real data.
- Before staff onboarding, run a cleanup/replacement pass and record who approved the real lists.
- When testing after real data entry begins, create clearly labeled test records and remove or archive them according to the agreed cleanup process.

## 5. Separating Future Schema Creation From Seed/Demo Inserts

Future SQL should be split into separate files or clearly separated execution steps:

1. Base schema: extensions, tables, constraints, indexes, triggers, functions, and sequences only.
2. Required reference seed: approved operational defaults that must exist in every real environment.
3. Demo/test seed: optional rows for local or staging validation only.
4. Cleanup scripts: explicit removal or replacement scripts for demo/test rows.
5. Migration notes: run order, target environment, rollback/backup expectations, and whether the SQL is safe for production.

Rules for future schema/seed work:

- Do not bundle optional demo inserts into production schema execution by default.
- Label demo/test inserts clearly in file names and row values.
- Add comments stating the intended target environment.
- Confirm the Supabase project before running SQL.
- Never run Tool Lab SQL against the live Cue Tracker database.

## 6. Checklist Before Entering Real Service Catalog Data

- [ ] Confirm the target database is the Tool Lab Supabase project.
- [ ] Confirm all `Demo -` service categories and services have been removed or intentionally left in a non-production environment.
- [ ] Confirm staff-approved service categories.
- [ ] Confirm staff-approved service names.
- [ ] Confirm service descriptions are clear enough for staff use.
- [ ] Confirm all prices are approved and stored in CAD cents.
- [ ] Confirm unit labels are correct.
- [ ] Confirm active/inactive status for every service.
- [ ] Confirm sort order is useful in the quote builder.
- [ ] Run the Services & Quotes smoke test after data entry.

## 7. Checklist Before Entering Real Cue Repair Data

- [ ] Confirm the target database is the Tool Lab Supabase project.
- [ ] Confirm all `Demo -` cue repair types have been removed or intentionally left in a non-production environment.
- [ ] Confirm staff-approved repair types.
- [ ] Confirm default repair prices are approved and stored in CAD cents.
- [ ] Confirm custom/other repair type behavior is still wanted.
- [ ] Confirm required intake fields match staff workflow.
- [ ] Confirm status values match the simplified v1 workflow:
  - `received`
  - `in_progress`
  - `needs_attention`
  - `ready_for_pickup`
  - `picked_up`
  - `cancelled`
- [ ] Confirm repair number sequencing is acceptable.
- [ ] Confirm who is allowed to create and update repair records.
- [ ] Run the Cue Repairs smoke test after data entry.

## 8. Checklist Before Entering Real Product / Inventory Data

- [ ] Confirm the target database is the Tool Lab Supabase project.
- [ ] Confirm all `Demo -` products have been removed or intentionally left in a non-production environment.
- [ ] Confirm demo inventory rows and demo initial-count adjustments have been removed or isolated.
- [ ] Confirm product categories are approved.
- [ ] Confirm inventory locations and location codes are approved.
- [ ] Confirm product naming conventions.
- [ ] Confirm SKU/code conventions and uniqueness expectations.
- [ ] Confirm brand, manufacturer, and model conventions.
- [ ] Confirm cost, retail, MSRP, and tax flag expectations.
- [ ] Confirm stock units for each product type.
- [ ] Confirm which products have inventory tracking enabled.
- [ ] Confirm initial inventory counts come from a physical count or approved source.
- [ ] Confirm low-stock thresholds and confidence values are understood by staff.
- [ ] Confirm who is allowed to create products, edit products, archive products, reactivate products, and create inventory adjustments.
- [ ] Run the Products / Inventory smoke test after data entry.

## 9. Readiness Gate Before Staff Use

Do not start regular staff use until all items below are true:

- [ ] Render is deployed from `main` and passes the smoke test checklist.
- [ ] Supabase tables are present in the Tool Lab project only.
- [ ] Demo data has been removed, replaced, or explicitly isolated.
- [ ] Real service catalog data is approved.
- [ ] Real cue repair type data is approved.
- [ ] Real product category/location/product/inventory data is approved.
- [ ] Staff understand that Products / Inventory is internal awareness only and physical stock should be confirmed before promising availability.
- [ ] Backup/export expectations are clear before customer or inventory data is entered.
- [ ] Future SQL changes are split into schema, required seed, optional demo seed, and cleanup/migration notes.
- [ ] Everyone involved understands that the live Cue Tracker database is off limits for this project.
