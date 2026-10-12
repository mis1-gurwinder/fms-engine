# PostgreSQL Setup — FMS Engine v15

PostgreSQL is the source of truth for FMS authorization, FMS definitions, workflow configuration and future operational execution data.

## 1. Install PostgreSQL

Install PostgreSQL on the development/server machine and remember the password for the PostgreSQL `postgres` administrator.

pgAdmin 4 can be used as the graphical administration tool.

## 2. Create the database

In pgAdmin:

1. Connect to the local PostgreSQL server.
2. Right-click **Databases** → **Create** → **Database**.
3. Database name: `fms_engine`.
4. Save.

## 3. Open Query Tool

Select `fms_engine` → **Tools → Query Tool**.

Run these files in this order:

1. `database/schema.sql`
2. `database/migrations_v14.sql`
3. `database/migrations_v15_access_control.sql`
4. `database/seed.sql`

The v15 migration creates the roles, permissions and initial authorized Google Workspace users.

## 4. Verify the users

Run:

```sql
SELECT employee_code, name, email, role_code, active
FROM users
ORDER BY role_code, name;
```

You should see the five supplied Workspace accounts:

- `rahul.arora@dinerofoodworks.com` → MD
- `mis1@dinerofoodworks.com` → MDO
- `mis@dinerofoodworks.com` → MDO
- `ea@dinerofoodworks.com` → EA
- `pc1@dinerofoodworks.com` → PC

## 5. Configure the Node server

Create `server/.env` from `server/.env.example` and set:

```env
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/fms_engine
```

Keep the PostgreSQL password only in the server `.env` file.

Also keep the Google OAuth and session values configured:

```env
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
ALLOWED_GOOGLE_DOMAIN=dinerofoodworks.com
SESSION_SECRET=LONG_RANDOM_SECRET
```

## 6. Start the server

From the project root:

```bat
npm run start:server
```

Expected server message:

```text
FMS API listening on http://localhost:4000
```

## 7. Check database connectivity

Open:

```text
http://localhost:4000/api/health
```

Expected JSON includes:

```json
{"ok":true,"database":"postgresql"}
```

## 8. Google login authorization flow

After PostgreSQL is connected:

**Google sign-in → verified Workspace email → users table lookup → active user → role → permissions → FMS workspace.**

A valid `@dinerofoodworks.com` account that is not present/active in `users` is rejected.

## 9. Important security rule

Do not put PostgreSQL credentials, SMTP passwords, session secrets or service credentials in React, `.tsx`, `.env` files committed to Git, screenshots or distributable ZIPs.
