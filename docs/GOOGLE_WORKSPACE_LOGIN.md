# Google Workspace-only portal login

## Goal

Only authenticated Google Workspace users whose account belongs to `@dinerofoodworks.com` can enter the internal FMS portal.

## Browser

The login screen loads Google Identity Services and uses:

```text
data-hd / hd = dinerofoodworks.com
```

This helps Google present the intended Workspace account. It is not treated as the security boundary.

## Server

The Node.js API verifies the Google ID token with `google-auth-library` and requires:

- `email_verified = true`
- `hd = dinerofoodworks.com`
- email ending in `@dinerofoodworks.com`

The server then issues an HTTP-only signed session cookie. Internal API routes require that session.

## Google Cloud configuration

1. Create/select the Google Cloud project owned by the organization.
2. Configure the OAuth consent/branding information as appropriate for the organization's Workspace.
3. Create an OAuth client for a **Web application**.
4. Add the React application's exact origin to **Authorized JavaScript origins**.
   - Local: `http://localhost:5173`
   - Production: the organization's HTTPS portal origin.
5. Put the resulting client ID in both:
   - `client/.env` as `VITE_GOOGLE_CLIENT_ID`
   - `server/.env` as `GOOGLE_CLIENT_ID`
6. Set a long random `SESSION_SECRET` on the server.
7. In production set `COOKIE_SECURE=true` and serve the application over HTTPS.

Google documents that JavaScript applications need authorized JavaScript origins and that modern Google Identity Services/OAuth implementations should use secure authorization flows. The backend verification is required because a browser-side domain hint is not sufficient authorization.
