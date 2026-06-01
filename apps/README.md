# Apps

Native internal tools live here.

## Services & Quotes v1

- Protected page: `/apps/services-and-quotes`
- Protected API namespace: `/api/apps/services-and-quotes/*`
- Database schema: `apps/services-and-quotes/database/schema.sql`

This first app stores service categories and services with prices in cents, then calculates quote previews from active services only. It does not store customer records or saved quotes.

## Cue Repairs v1

- Protected page: `/apps/cue-repairs`
- Protected API namespace: `/api/apps/cue-repairs/*`
- Database schema: `apps/cue-repairs/database/schema.sql`

This app stores cue repair intake records, estimates in cents, workflow status, customer contact timestamps, completion, pickup, and cancellation tracking.
