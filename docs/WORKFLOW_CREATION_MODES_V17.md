# Workflow Creation Modes — v18

## Option 1: Plant PDF
Upload one plant process PDF. The browser extracts readable text where supported and suggests numbered stage names. Scanned PDFs may need OCR. Review every stage before creation.

## Option 2: Plant Stage ZIP (recommended for plant workflows with many stages)
Upload one ZIP containing all stage files. Use sequence-based filenames such as `Stage 01 - RM Inward.pdf`, `Stage 02 - Incoming QC.html`, and so on. The browser reads ZIP central-directory entries and supports stored/deflated ZIP entries. It extracts stage names from filenames first, and can inspect TXT, Markdown, CSV, HTML, XML, JSON and text-based PDFs. ZIP contents are parsed locally in the browser; they are not uploaded to the FMS server by this importer.

The ZIP importer is best-effort: it does not guarantee OCR for scanned PDFs, DOCX extraction, extraction from images, all PDF encodings, every ZIP compression method, or automatic inference of branch conditions. Review the proposed sequence and configure missing stage details.

## Option 3: Manual FMS
Start with a blank workflow. Add, rename and remove as many stages as required.

## Shared execution model
- Stage 01 is READY when an FMS instance starts.
- Stage 02 onward remains LOCKED until PC marks the preceding stage DONE.
- CORRECTION, HOLD and EXCEPTION do not advance the sequence.
- Use only the existing Google Form URL and the responsible `@dinerofoodworks.com` Workspace email for form delivery. The FMS Engine does not duplicate Google Form question fields or require phone/WhatsApp numbers.
- PC reviews the Google Form response Sheet and records the authoritative decision in FMS.

## Migration
For an existing v17 database, run `database/migrations_v18_zip_stage_packs.sql`.
