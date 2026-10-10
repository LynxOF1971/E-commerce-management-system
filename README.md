# KDFY-ems

KeyDify Dhaka's responsive order, production, delivery and financial workspace.

## Hosting

The standalone website is built for **GitHub Pages**, with **Google Apps Script + Google Sheets** for data and **private Google Drive files** for photos. See `google-backend/README.md` for deployment and private configuration. No Cloudflare account is required for this deployment.

## Features

- Individual logins and multiple roles per teammate.
- Private role queues, mandatory production proof, delivery outcomes, and manager-reviewed corrections.
- Moderator-only return/replacement orders, immediate routing, highest priority and linked histories.
- Expenses, salaries, imports, and daily/weekly/monthly/yearly reports.

## Development and checks

Use Node.js 24 and `npm ci`. Run `npm run build:google` to regenerate the Apps Script backend after changing handlers. Set `VITE_GOOGLE_SCRIPT_URL` to the deployed `/exec` endpoint and run `npm run build:pages` for the GitHub website.

Run `npx tsc --noEmit`, `node tests/finance.test.mjs`, `node tests/import.test.mjs`, and `node tests/google-backend.test.mjs`.

The original Sites development files remain for compatibility and are not used by the Pages workflow. Existing production data is not copied by publishing source code. Keep the old workspace until a separate data migration is completed.

Never commit private spreadsheet identifiers, setup keys, passwords, sessions, environment files, local databases or production exports.
