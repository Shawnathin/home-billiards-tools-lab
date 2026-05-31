# Deployment Notes

## Rules

- This project is separate from the live Cue Tracker.
- Do not use the Cue Tracker database.
- Do not commit `.env` files.
- Use Render environment variables for `DATABASE_URL` and `SESSION_SECRET`.
- Use the Supabase pooled connection string.

## Render basics

- Build command: `npm install`
- Start command: `npm start`
- Environment variable `NODE_ENV`: `production`
