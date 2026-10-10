# KDFY-ems Google backend

The website is built from `standalone/` and hosted by GitHub Pages. Apps Script saves business records to dedicated `KDFY_` tabs in the owner's existing Google Sheet and private photos in Google Drive. It does not publish the Sheet or photo folder.

The existing TypeScript order, finance, and access handlers are transformed into synchronous Apps Script code by `npm run build:google`. Tests exercise the compiled handlers. The adapter only supports fixed SQL emitted by these handlers; clients cannot submit SQL.

Deployment:
1. Create an Apps Script project, paste `Code.gs`, and enable the advanced Google Sheets API service.
2. In private Script Properties set `SPREADSHEET_ID`. Never commit spreadsheet identifiers, setup keys, passwords, or tokens.
3. Run `initializeWorkspace` as the owner. Existing tabs are preserved. It creates application tabs and a private photo folder, and displays a setup key in the owner's execution log.
4. Deploy a web app, execute as owner, access Anyone. Business operations still require app authentication and server-side role checks; `doGet` returns health only.
5. Store its `/exec` URL in the repository's `GOOGLE_SCRIPT_URL` Actions variable, enable Pages with GitHub Actions, and run the workflow.
6. Use the private setup key once to create the manager account. Bootstrap closes when the manager exists.

Accounts and sessions are kept in private Script Properties. Passwords use salted PBKDF2-SHA256 with 100,000 iterations. Sessions last 24 hours and are held in browser session storage. Apps Script quotas and Drive storage limits apply; this is intended for a small team. Direct spreadsheet editors can edit business records; ordinary staff should receive only app accounts.

Data in the old ChatGPT workspace is not automatically imported. Preserve it until an authenticated migration is verified.
