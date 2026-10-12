# Tata/Palda reference note

The attached/reference material available in the conversation was used as the business reference for the first configuration.

The reference set exposes 18 process/FMS configurations and stage-level operational requirements. The implementation intentionally keeps the engine generic and places process-specific names, roles, checklists and workflow definitions in configuration/data.

The T-01 flow shown in the demo is a dependency-control demonstration. Before production, validate every exact stage, field, SLA, approval and exception condition against the business owner's signed process document.

## v7 interpretation from the Tata stage sheet

The Tata/Palda sheet structure is treated as a stage-level operational contract:

- WHAT — activity to perform
- WHO — responsible person/role
- HOW — operating method/evidence
- WHEN — trigger or planned timing
- Form/checklist — stage-specific data and evidence

The FMS instance is the project. Each stage is a dependency-gated task. The responsible person receives the stage-specific Google Form. The PC reviews the response and controls the stage status. On PC DONE, the engine records actual completion/delay and activates the next configured stage.

The existing sheet remains a business reference; undocumented parameters should remain configurable or marked `Needs clarification` rather than invented.
