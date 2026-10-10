# KDFY-ems

KeyDify Dhaka's responsive employee, order, production, delivery and financial workspace.

## Features

- Individual accounts with multiple roles: manager, moderator, designer, production, distributor and CRM.
- Order handoffs, required production proof photos, delivery outcomes and audited correction requests.
- Moderator-created return/replacement orders, direct team routing and highest-priority queues.
- Expenses, salary records, imports and day/week/month/year reporting.

## Current deployment

The live application runs on Sites with Cloudflare Workers, D1 for structured data and R2 for uploaded photos. It is not a static GitHub Pages application. GitHub can store this source, but independent hosting requires a server deployment, database and object storage configuration. Publishing source does not copy live orders, passwords, sessions or photos to GitHub.

The current database is already connected. Google Sheets is not used as the primary database.

## Local development

Node.js 22.13 or newer is required. Install dependencies, then run `npm run dev`. The project's scripts configure local D1 and R2 storage. Apply the schema migrations in `drizzle/` to the local database before using authenticated features. Local data is separate from production data.

Checks: `npx tsc --noEmit`, `node tests/finance.test.mjs`, `node tests/import.test.mjs`.
Build: `npm run build`.

## Moving to independent hosting

Provision a private database and photo bucket, configure Worker bindings, replace the Sites-specific authentication/deployment integration, and securely migrate existing data before switching traffic. Keep all credentials in hosting secrets. Do not deploy the local preview authentication configuration publicly. A fresh independent deployment needs a secure manager-account bootstrap because the current initial setup checks the private Sites identity header.

Never commit `.env` files, `.wrangler`, local test data, generated build output, credentials or production exports. Database schema migrations are safe to track; database contents are not part of this source repository.
