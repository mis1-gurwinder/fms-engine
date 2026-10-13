# Google Form Operating Model — v9

## Who sees what

- Operator / responsible person: only the currently assigned Google Form.
- PC: full FMS FMS Plant Tower, submissions, dependency state, review and completion decisions.
- EC / MDO / MD: management/review dashboards according to RBAC.

## Lifecycle

Project created → Step active → Form issued → Responsible person submits → PC reviews → DONE / NOT DONE / HOLD / EXCEPTION → actual completion timestamp → delay calculation → next step activated → next form issued.

A form submission never directly activates the next step.
