# Google Forms Workflow — v16

## FMS stage fields

The FMS stage form configuration has only two editable values:

1. **Existing Google Form URL** — the responder link for a form that already exists in Google Workspace.
2. **Responsible Workspace email** — restricted in the UI and API to an address ending in `@dinerofoodworks.com`.

No phone number, phone/WhatsApp delivery, or duplicate question editor is provided.

## Dispatch

1. Enter the URL and email.
2. Approve the link.
3. Click **Send now**.
4. The Node.js server sends the original Google Form URL via Nodemailer/SMTP.

The server validates that the URL uses `docs.google.com/forms/` or `forms.gle/` and that the recipient belongs to the company domain.

## PC review

Google Forms owns response storage. PC opens the form, selects **Responses → View in Sheets**, and reviews the linked response spreadsheet. Share the response spreadsheet with the relevant PC Workspace account as required by company policy.

This version does not subscribe to Google Forms response events. It does not automatically import the response row or automatically unlock the next stage. Do not interpret an email send or Google Form submission as PC approval.

## Tata 18-stage map

01 RM Inward → 02 Incoming QC → 03 Fumigation → 04 PM Inward → 05 Post-Fum QC → 06 Manual Sorting → 07 Pulses Packing → 08 Makhana Packing → 09 FG Release → 10 Dispatch Planning → 11 FG Dispatch → 12 Daily Inventory → 13 Quarterly Audit → 14 Loss / Breach → 15 SAP Daily Entries → 16 Monthly Invoice → 17 Labour + Consumables Cost → 18 Daily Production MIS.

Fumigation remains a controlled process stage. The FMS stores only the approved form link and workflow metadata; operational treatment instructions must be supplied by authorized plant procedures and qualified personnel.


## PC stage decision gate

After checking the linked Google Sheet, PC opens the stage in the FMS Engine and records DONE, CORRECTION, HOLD, or EXCEPTION. The server persists the decision in `workflow_steps.execution_status`; DONE records `actual_completed_at`, calculates delay minutes when a planned timestamp exists, writes an audit event, and unlocks the next sequential stage. Locked stages cannot be marked DONE. The engine still does not detect Google Form submissions automatically.
