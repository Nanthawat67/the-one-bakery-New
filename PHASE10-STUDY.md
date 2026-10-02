# THE ONE Bakery — PHASE 10 STUDY BUILD

## Purpose
This folder is the integrated full-system build for study/reference. It intentionally jumps ahead of the incremental Phase 0 → Phase 9 work so the project can still be studied if the chat conversation ends before all incremental phases are completed.

**Important:** this is an integrated build, not a replacement for the Phase 0/Phase 1 baselines.

## Conceptual phase coverage
- Phase 0 — Customer ordering, cart, checkout, order handling, kitchen, packing, dashboard, product management
- Phase 1 — Order workflow / state transition
- Phase 2 — Authentication, roles, permissions, status history / audit trail
- Phase 3 — Production planning, capacity, batches, progress
- Phase 4 — Packing workflow
- Phase 5 — Sales analytics / dashboard data
- Phase 6 — Finance (sales, income, expenses)
- Phase 7 — Association Rule / Market Basket Analysis and recommendation baseline
- Phase 8 — Forecasting baseline and evaluation metrics
- Phase 9 — Feedback, public tracking, persistent notifications and supporting functions
- Phase 10 — Integrated system containing the above modules

The modules are integrated into one codebase rather than physically separated into folders named `phase2`, `phase3`, etc.

## Main pages
- `/` — customer ordering
- `/track.html` — public order tracking
- `/login.html` — staff login
- `/admin.html` — admin/order management
- `/kitchen.html` — production view
- `/packing.html` — packing view
- `/analytics.html` — analytics / association / forecasting
- `/finance.html` — finance

## Main API groups
- `/api/auth`
- `/api/products`
- `/api/orders`
- `/api/production`
- `/api/notifications`
- `/api/analytics`
- `/api/finance`
- `/api/feedback`
- `/api/inventory`

## Database areas
- products
- orders
- order_items
- users
- order_status_history
- production_capacity
- production_batches
- production_items
- inventory
- recipes
- notifications
- feedback
- finance_transactions

## What is useful to study now
1. Trace one order from customer checkout → admin review → production → packing → pickup.
2. Follow a status change from frontend button → API route → database update → status history / notification.
3. Study the production calculation using `batch_size` and `minutes_per_batch`.
4. Study analytics endpoints for sales, association metrics, and forecast baseline.
5. Study how JWT and role checks are applied to protected API routes.
6. Study the database relationships before making incremental changes.

## Verification performed in this environment
- JavaScript syntax check: passed for server, config, middleware, routes, database JS, tests and frontend JS files.
- Existing unit tests in `tests/basic.test.js`: 3/3 passed.

## Not verified here
- Full PostgreSQL integration with the user's own database credentials/data.
- End-to-end browser UI behavior.
- Production deployment on Render.
- Real business-data quality for forecasting and association rules.
- Security hardening for production credentials/secrets.

## Default demo accounts in the original V7 README
- admin / admin123
- kitchen / kitchen123
- packing / packing123

Change these credentials before real use.
