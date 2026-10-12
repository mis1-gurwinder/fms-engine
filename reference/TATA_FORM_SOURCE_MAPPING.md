# Tata/Palda → Google Form Mapping (v9)

Source: the supplied Indore - DFPL - Tata process-flow ZIP, 18 HTML process documents.

## Execution model

1. Project/FMS instance is created with a timestamp and planned dates.
2. Only the currently active step has its operational Google Form issued to its configured responsible person.
3. Form submission is evidence/data capture; it is **not** stage completion.
4. The PC reviews the submission and marks the step DONE / NOT DONE / HOLD / EXCEPTION.
5. When the PC marks DONE and all configured completion conditions pass, the dependency engine records actual completion time, calculates delay against plan, activates the next step, and issues its form.
6. The final PC-approved step completes the FMS instance and feeds MIS/KPI/audit.

## 18 Tata processes

The catalog covers T-01 through T-18. Each process document was parsed into its documented WHAT / WHO / WHEN / HOW steps. Each step has a corresponding Google Form template under `reference/google-forms/`.

## Important

The forms are **templates/specifications**, not live forms in the company's Google Workspace. Real Google Form IDs/URLs must be configured after the company authorizes the integration. PostgreSQL remains the system of record.

T-03 contains hazardous-treatment operational information in the source documentation. The generated form specification intentionally records authorization, compliance evidence, monitoring records and clearance status without reproducing operational chemical dosing/handling instructions.
