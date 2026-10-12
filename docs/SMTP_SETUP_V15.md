# SMTP Setup — FMS Engine v15

The FMS Engine sends workflow email from the Node.js server through Nodemailer. SMTP credentials stay in `server/.env` and are never placed in React/client code.

## Recommended Google Workspace approach

For a production server, prefer a Google Workspace SMTP relay configuration administered by the organization's Workspace administrator. Google documents SMTP relay as a Workspace-admin configuration. The relay hostname used by the Workspace relay service is `smtp-relay.gmail.com`.

For a small development setup, an authorized Google account can use an App Password if the organization's Workspace policy allows App Passwords. Google states that App Passwords require 2-Step Verification and are a less-preferred compatibility mechanism.

## Option A — development mailbox + App Password

1. Choose one dedicated sending mailbox, for example `mis@dinerofoodworks.com`.
2. Sign into that Google Workspace account.
3. Enable 2-Step Verification if it is not already enabled.
4. Open Google Account security and create an App Password if the Workspace administrator allows it.
5. Copy the generated 16-character App Password once. Do not paste it into chat, GitHub, React code, screenshots or the ZIP.
6. Put the values in `server/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mis@dinerofoodworks.com
SMTP_PASS=YOUR_APP_PASSWORD
SMTP_FROM=FMS Control <mis@dinerofoodworks.com>
```

7. Restart the Node.js server.
8. Sign into FMS with an authorized account.
9. Use the SMTP test action in the Control Tower. The test endpoint is protected by `SYSTEM_CONFIG`.
10. Confirm the message arrives.

If App Passwords are unavailable for the Workspace organization, do not try to bypass the policy. Use Option B or the organization's approved mail service.

## Option B — Google Workspace SMTP relay

Ask the Google Workspace administrator to configure the organization's SMTP relay service. The exact relay authentication policy depends on the administrator's Workspace configuration.

For a relay configuration that uses SMTP authentication, the server values are typically:

```env
SMTP_HOST=smtp-relay.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=AUTHORIZED_WORKSPACE_ACCOUNT
SMTP_PASS=AUTHORIZED_CREDENTIAL_OR_APP_PASSWORD
SMTP_FROM=FMS Control <authorized-sender@dinerofoodworks.com>
```

If the administrator configures IP-based relay authorization instead, the relay may not use username/password authentication. In that case, the Nodemailer transport must be changed to match the organization's relay policy rather than blindly filling `SMTP_USER`/`SMTP_PASS`.

## Troubleshooting

- `535` / authentication errors → check the SMTP authentication method and credentials.
- `550 5.7.0 relay denied` → check Workspace SMTP relay authorization, sender domain and configured sending IP/policy.
- TLS/STARTTLS errors → verify port 587 and `SMTP_SECURE=false` for STARTTLS.
- Messages not delivered → check spam, Workspace routing, SPF/DKIM/DMARC and sender policy.

Never store the mailbox password in source control.
