# Phase 10 Fix Notes

## 1. Pickup time removed
- Customer checkout no longer asks for a pickup date/time.
- `orders.pickup_at` is removed for new databases; existing databases drop the column during init.
- Admin/Tracking no longer display pickup time.
- Production ordering uses `created_at` instead of `pickup_at`.

## 2. Analytics crash protection
- `/api/analytics/*` routes now catch rejected async DB queries.
- A PostgreSQL/query error returns HTTP 500 JSON instead of becoming an unhandled Promise rejection that can terminate Node in Express 4.
- The terminal prints `ANALYTICS API ERROR:` with the real database error for debugging.

Important: if the existing database schema is inconsistent with the V7 schema, the real DB error should now be visible in the terminal without killing the server.
