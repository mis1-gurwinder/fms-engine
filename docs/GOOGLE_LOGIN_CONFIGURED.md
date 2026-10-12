# Google Workspace Login — Local Configuration

The local development configuration is already populated with the supplied Google OAuth Web Client ID.

- Frontend origin: `http://localhost:5174`
- API: `http://localhost:4000`
- Allowed Workspace domain: `dinerofoodworks.com`

The server verifies the Google ID token, checks `email_verified`, checks the Workspace `hd` claim, and requires the email to end with `@dinerofoodworks.com`.

## Important

- The OAuth Client ID is safe for browser configuration.
- The session secret is server-only and must never be copied into React/Vite files.
- SMTP credentials are placeholders and must be filled on the server if email dispatch is enabled.
- The Google Cloud OAuth client must have `http://localhost:5174` under Authorized JavaScript origins.
- Do not commit `client/.env` or `server/.env`; they are ignored by `.gitignore`.
