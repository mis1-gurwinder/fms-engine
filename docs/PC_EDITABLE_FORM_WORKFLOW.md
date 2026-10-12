# PC Editable Stage Forms — v11

## What changed
- The stage page no longer depends on a pasted Google Form URL.
- Each Tata process step loads a compact, stage-specific form definition.
- System identity fields remain locked.
- The PC can edit, delete, reorder, or add operational questions before approval.
- File/photo questions have an actual upload control in the responsible-person form preview.
- Uploaded evidence is shown back to the PC for inspection before the PC marks the task DONE.
- Each stage has responsible-person contact fields: name, email, phone/WhatsApp and delivery channel selection.
- Form versions remain immutable after approval; a correction creates a new draft/version.

## Why the forms are shorter
The source Tata process document contains process-level fields. The previous prototype placed the full process field catalogue into the first stage, producing forms with 20+ questions. v11 maps only the fields relevant to the individual stage and keeps the operational execution controls compact.

## Responsible-person delivery
The engine stores the approved recipient and selected delivery channels. The included server records the dispatch target. Actual external email/SMS/WhatsApp delivery requires connecting an authorized provider; credentials are not embedded in the frontend.

## Evidence flow
Responsible person → upload actual photo/file → submit → PC review → DONE / CORRECTION / HOLD / EXCEPTION.

Submission itself never completes the stage.
