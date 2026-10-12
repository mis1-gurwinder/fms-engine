# Google Form Stage Lifecycle

Operational users receive only the Google Form configured for their current stage.

1. PC creates an FMS instance.
2. Stage 1 becomes ACTIVE and its form is issued to the configured responsible person.
3. The responsible person submits the form.
4. Submission changes the stage to `FORM_SUBMITTED`; it does not complete the stage.
5. PC reviews the submission and marks `DONE`, `NOT DONE`, or `HOLD`.
6. On `DONE`, the engine records actual completion time and calculates delay against the planned time.
7. The dependency engine evaluates the next stage.
8. If all conditions pass, the next stage becomes ACTIVE and its configured form is issued.
9. The cycle continues until the final stage is completed.
10. The FMS instance is then marked COMPLETE and MIS/KPI data is updated.

PostgreSQL remains the source of truth. Google Forms are an operational input channel, not the system of record.
