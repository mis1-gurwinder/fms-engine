# FMS Engine v25 — Stage 01 auto-email on create, submission status on stage

A responsive FMS workspace using the requested brand palette and Poppins typography. The Control Tower and FMS detail page show the Tata 18-stage process map after the first FMS is created.

## Core features retained from v22

- Stage form builder now stores **only an existing Google Form URL and the responsible person's `@dinerofoodworks.com` Workspace email**.
- Removed in-app Google Form question builder, custom doer response form, phone number field, and phone/WhatsApp delivery UI.
- **Send now** emails the actual Google Form URL through the Node.js SMTP/Nodemailer service.
- Doers submit in Google Forms. PC opens that form's **Responses → View in Sheets** to review the linked Google Sheet.
- A form submission is not treated as stage completion; PC remains the workflow gate.
- FMS Builder provides three modes: Plant PDF, Plant Stage ZIP (recommended for a plant with many separate stage files), and Manual FMS. PDF/ZIP stage extraction is best-effort and requires human review. The Tata 18-stage list is available as reference material, not forced onto every FMS.
- Stage 01 displays READY immediately after workflow creation; every later stage displays LOCKED pending PC approval of the preceding stage, for any workflow length.
- Workflow diagrams adapt to the number of stages configured for each FMS.
- UI palette: coral `#FE5E41`, charcoal `#231F20`, light peach `#FFF0EE`, accent peach `#FFC3BB`.
- The supplied Dinero symbol is included as a monochrome white mark on the charcoal sidebar, with a coral favicon; the app uses the official symbol file supplied by the user rather than a guessed web asset URL.
- Existing role-based access and seeded Workspace users are retained from v15.


- **Simple task timestamp baseline — no invented deadline.** The FMS creation timestamp is recorded. Stage 01's task-created/started timestamp is the FMS creation timestamp. A later stage receives its task-created/started timestamp when PC marks the preceding stage DONE and unlocks it.
- **Actual completion timestamp** is recorded automatically when PC marks the stage DONE after reviewing the Google Sheet response.
- **Time taken** is `actual completion timestamp - task-created/activated timestamp`. The UI does not assume a 4-hour target or create future due dates automatically.
- **Deadline variance is optional.** A stage is only classified as over SLA when the company has explicitly configured a real `sla_minutes` target. Elapsed time by itself is not incorrectly labeled as late.
- **Control Tower KPIs** query live PostgreSQL records for total FMS, running FMS, completed FMS, configured-SLA overruns, exceptions, and stage-level DONE / READY-IN-PROGRESS / LOCKED counts. Empty database state is explicitly shown rather than inventing metrics. Dashboard metrics refresh every 30 seconds.
- Each stage displays task-created/activated time, actual completion time, and time taken. PC decisions are the gate for stage completion and unlocking the next stage.

## Requirements

- Node.js LTS and npm
- PostgreSQL and pgAdmin 4
- Google Workspace OAuth client configured for `http://localhost:5174`
- SMTP credentials in `server/.env`

## Install dependencies

Run in the project root:

```bat
npm run install:all
```

## Environment files

Copy `client/.env.example` to `client/.env` and set `VITE_GOOGLE_CLIENT_ID` and `VITE_API_URL=http://localhost:4000`.

Copy `server/.env.example` to `server/.env`. Configure `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `ALLOWED_GOOGLE_DOMAIN=dinerofoodworks.com`, a generated `SESSION_SECRET`, and SMTP values. Never commit or share `.env` files.

## Database setup

Create a PostgreSQL database named `fms_engine`. In pgAdmin's Query Tool, run these files in order:

1. `database/schema.sql`
2. `database/migrations_v7.sql`
3. `database/migrations_v10.sql`
4. `database/migrations_v14.sql`
5. `database/migrations_v15_access_control.sql`
6. `database/migrations_v16_google_form_workflow.sql`
7. `database/migrations_v17_workflow_modes.sql`
8. `database/migrations_v18_zip_stage_packs.sql`
9. `database/migrations_v19_stage_timing_kpis.sql`
10. `database/migrations_v20_planned_tat_dashboard.sql`
11. `database/migrations_v21_task-created-time-baseline.sql`
12. `database/migrations_v23_form_submission_flow.sql`
13. `database/seed.sql`

Then set `DATABASE_URL` in `server/.env`, for example:

```env
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/fms_engine
```

## Start the services

Terminal 1 — backend:

```bat
npm run start:server
```

Terminal 2 — frontend:

```bat
npm run start:client
```

Open `http://localhost:5174`. Backend health check: `http://localhost:4000/api/health`.

## Google Forms operating steps

1. Create and maintain each form in Google Forms. Questions remain in Google Forms; the FMS app does not duplicate them.
2. In the form, open **Responses** and connect/create the response spreadsheet with the Sheets icon.
3. Share that spreadsheet with the PC Workspace account with the appropriate access.
4. In the FMS stage, paste the existing responder URL (usually `https://docs.google.com/forms/.../viewform`) and the doer's `@dinerofoodworks.com` email.
5. Approve the link, then select **Send now**. SMTP must be configured and the logged-in role must have `WORKFLOW_CONTROL` permission.
6. The doer submits the Google Form. PC opens the form's Responses tab and selects **View in Sheets** to review the response sheet.
7. Submission is not approval. PC must separately record the workflow decision in the operational process.

## Important integration boundary

This version sends the external Google Form URL and provides the PC's Google Sheets review path. It does **not** use a Google Forms API/webhook to detect submissions automatically, and it does not claim that Google Sheets responses automatically advance the workflow. That integration requires authorized Google Forms/Sheets API access or an approved webhook/automation and a durable stage-execution record.

## Browser preview

Open `preview/FMS-Engine-v19-browser-preview.html` directly in a browser for a standalone, responsive visual preview. It is a design preview only and does not connect to PostgreSQL or send email.

## Documentation

- `docs/GOOGLE_FORMS_V16.md`
- `docs/POSTGRES_SETUP_V15.md`
- `docs/SMTP_SETUP_V15.md`
- `docs/USER_ACCESS_MODEL_V15.md`
- `docs/ARCHITECTURE.md`


## v17 — two workflow creation modes

The FMS Builder now offers two options:

1. **Plant PDF Template** — upload a text-based process PDF. The browser attempts best-effort text extraction and detects numbered headings such as `Stage 1:`, `01 -`, `Step 2:` or `T-01`. The resulting candidate stage names must be reviewed and corrected before creation. PDF extraction is not OCR and may not work on scanned/image-only PDFs or unusual embedded font encodings; in that case, use the extracted-text area if available or enter stages manually.
2. **Manual FMS** — start with one blank stage and add/remove stages as needed.

Both modes create a sequential workflow: stage 01 starts READY; each later stage starts LOCKED and becomes READY only when PC records DONE on its predecessor. Google Form URL and responsible Workspace email remain stage-level settings.

### v17 database migration

After applying the v16 schema/migrations, run `database/migrations_v17_workflow_modes.sql` in pgAdmin Query Tool. It adds `workflow_mode` and `source_document_name` to the `fms` table.


## v18: Three workflow creation methods

1. **Plant PDF** — upload one readable process PDF and review candidate stage names. Scanned/image-only PDFs may need OCR; extraction is best-effort.
2. **Plant Stage ZIP (recommended for multi-stage plants)** — upload one standard ZIP containing the plant's stage files. Name stage files with sequence and label, such as `Stage 01 - RM Inward.pdf`, `Stage 02 - Incoming QC.html`, or `T-03 Fumigation.pdf`. ZIP contents are scanned in the browser; no files are uploaded to the application server by this importer. Supported ZIP compression methods are stored and deflate. It detects stage sequence from filenames first and can read stage headings from text-based TXT, Markdown, CSV, HTML, XML, JSON and text-based PDFs. Scanned PDFs, DOCX, image-only documents, unsupported compression and complicated process branching require manual review or manual stage entry.
3. **Manual FMS** — add and configure any number of stages yourself.

All imported stage names are proposals. Review order, responsible role, WHAT/HOW/WHEN, and Google Form URL before creating the FMS. Stage 01 is READY; subsequent stages are LOCKED until PC marks the previous stage DONE.

### v18 database migration

For an existing v17 database, run `database/migrations_v18_zip_stage_packs.sql` after the v17 migration. For a fresh database, apply all migrations in ascending version order and then `database/seed.sql`.

### Brand and responsive behavior

The UI uses Dinero's supplied symbol mark, monochrome charcoal/white interface and coral accent (`#FE5E41`). Layout adapts for phone, tablet, laptop and desktop, with reduced-motion support.


## v19 — Stage timing and PC dashboard

- The FMS definition stores a database-generated creation timestamp. Stage 01 starts when the FMS is created; each next stage starts when PC marks its predecessor DONE.
- Planned date/time is prefilled using an editable suggested schedule and is selected/edited through the browser's calendar + clock control. Confirm or adjust each stage's planned due time before creating the FMS.
- Each FMS detail page displays completed, ready/active, locked/pending, delayed and progress KPIs. Each stage row displays planned due, actual start, actual completion, actual TAT and delay.
- Actual TAT is the elapsed time from stage activation to PC-approved DONE. Delay is the positive number of minutes between planned due time and PC completion; early/on-time completion reports zero delay. A pending stage past its due time is counted as delayed in the live KPI.
- Duplicate FMS codes are rejected by PostgreSQL's unique constraint and returned as a clear conflict response. Browser-only duplicate checks are supplementary, not authoritative.

### v19 migration

Run `database/migrations_v19_stage_timing_kpis.sql` after `database/migrations_v18_zip_stage_packs.sql`.

## Browser preview

Open `preview/FMS-Engine-v19-browser-preview.html` directly in a browser for a standalone, responsive visual preview with sample stage timing KPIs. It does not connect to PostgreSQL or send mail.


## Upgrade existing v20 database

If your database already has all migrations through v20, run only `database/migrations_v21_task-created-time-baseline.sql` in pgAdmin Query Tool. Do not rerun the base schema or older migrations on an already initialized database.

## v21 task timestamp and time-taken formulas

- `fms.created_at`: database timestamp recorded when the FMS is created.
- Stage 01 `started_at` and `planned_at`: same as `fms.created_at`.
- Later stage `started_at` and `planned_at`: timestamp when PC marks the previous stage DONE and the next stage becomes READY.
- `actual_completed_at`: timestamp written by the server when PC selects DONE.
- `actual_tat_minutes`: `floor((actual_completed_at - started_at) / 60 seconds)`; shown as **TIME TAKEN**.
- `delay_minutes`: only a deadline variance when an explicit `sla_minutes` target exists; no target means no automatic late/overdue claim.
- Form submission alone never completes a stage. PC review and DONE decision record the completion timestamp and unlock the next stage.

## Browser preview

Open `FMS-Engine-v21-browser-preview.html` directly in a browser. It is illustrative and does not connect to PostgreSQL or send mail.


## v22 — Minimal stage status and PC return-to-doer

Every stage shows only four execution fields: **Planned**, **Actual**, **Status**, and **Time Delay**. Planned is the stage task-creation/activation timestamp. Actual is set automatically when PC records DONE. Time Delay is elapsed time from planned/activation timestamp to PC completion (or a live elapsed timer while active); it is not an SLA breach.

PC has two decisions: **DONE** (records completion and unlocks the next stage) or **Return to doer — resubmit** (requires feedback, marks the stage CORRECTION, and emails the responsible Workspace address with feedback and the Google Form link, when SMTP is configured). A correction does not unlock the next stage and does not set the actual-completion timestamp.

For an existing v21 database, run `database/migrations_v22_pc_return_to_doer.sql` in pgAdmin Query Tool after selecting `fms_engine`.


## v23 UI correction: preserve full FMS, simplify individual stage only

- Restored the complete Control Tower, FMS Catalog, FMS Builder, FMS-level KPIs, workflow diagram, stage map metadata, Google Form configuration, and other project navigation from the full application.
- The overall FMS workflow diagram is compact again: stage number, stage name, status/gate, Google Form linked/pending, and Configure link. It does not show the individual-stage four-metric panel or PC decision buttons.
- The full StageLive detail page alone shows exactly four execution metrics: Planned, Actual, Status, Time Delay.
- PC decision actions (DONE & unlock next, Return to doer with required feedback) are only inside the individual stage detail page. No DONE/return buttons are placed on the overall FMS page.
- Whole-FMS KPIs remain live-data based; no fabricated operational records are seeded.
- This is a UI-only correction on top of v22; no additional database migration is required beyond the v22 migration already applied.


## v23 correction requested

The whole FMS experience is retained: Control Tower, FMS Catalog, FMS Builder (PDF / ZIP stage pack / Manual), FMS-level KPIs, the compact sequential workflow diagram, full stage map metadata, Google Form URL configuration, users/access and all existing navigation.

The four-field summary (Planned, Actual, Status, Time Delay) and PC decision actions are shown on the individual stage detail page only. The whole-FMS flow nodes are compact and do not repeat those four metrics. DONE and Return to doer controls exist only inside the stage detail page.

This v23 release is a frontend/UI correction on top of v22 and does not add a database migration.


## v24 identity and stage context update

- FMS creation uses the same required identity step for Plant PDF, Stage ZIP, and Manual FMS modes.
- The identity form labels the process name explicitly and shows a system-generated creation timestamp. That exact timestamp is saved as `createdAt` when Create FMS is pressed.
- FMS code remains unique and plant/department remain dropdowns.
- The individual stage page retains exactly four execution metrics: Planned, Actual, Status, and Time Delay.
- Below those metrics, the stage page shows the process context fields WHAT, WHO, HOW, and WHEN. These are configured for each stage in FMS Builder and are not additional execution KPI fields.
- No database migration is required for this UI/model-field update. Existing stage records already carry `what`, `who`, `how`, and `when`; old records may show “Not defined yet” until configured.

- Every stage now requires WHAT, WHO, HOW, and WHEN before the FMS can be created. This prevents imported/manual stages from being published with missing operational context.
- Browser preview artifact: `preview/FMS-Engine-v24-browser-preview.html` (illustrative UI only; not connected to API/database).


## v25 changes

- **Process Name** is the FMS name field; **Timestamp** is saved on create and shown on the success page and FMS page.
- **Stage 01 Google Form + doer email**: entered in the Create wizard (or auto-filled from a PDF/ZIP if a Google Form link or `@dinerofoodworks.com` email is in the file). Clicking **Create FMS** emails the doer immediately.
- **Doer submits** the Google Form. The stage shows *Doer submitted · PC review pending* on the FMS workflow and the stage page.
- **Backup Sheet**: the Google Form's linked response Sheet receives every response. To also send the submission to the FMS Engine, install `google-apps-script/FMS-Form-Submit-Webhook.gs` in that Sheet (Extensions > Apps Script, then add an On form submit trigger). Set `FORM_WEBHOOK_SECRET` in `server/.env` and the same value in the script. The server must be reachable from Google (public URL); locally, the Sheet still holds every response.
- Submission never completes a stage. PC still marks DONE.
=======