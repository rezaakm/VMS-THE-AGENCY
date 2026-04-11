# Financial Flag Investigation Workflow Contract

## Purpose
Track financial audit issues from identification through investigation, response, grading, and resolution.

## Triggers
- Manual flag creation by Admin/Manager after identifying a financial issue
- Automated detection of overdue checklist items
- Import from external audit findings

## Primary Trigger Mechanism
Dashboard UI or API

## Inputs
- Flag title, description, severity, category
- Assigned person (e.g., Dinesh — Accountant)
- Deadline for response

## Required Context
- Current financial data relevant to the flag
- Historical context (previous responses, related flags)
- Supporting documents from the original finding

## Outputs
- Flag record with full lifecycle status
- Response submission (A-F template)
- Grade assessment (Adequate / Partial / Inadequate)
- Resolution or follow-up action
- Audit trail of all actions

## Response Template (A-F Format)

Every flag response must include:
- **A — Acknowledgement**: Do you accept this finding? (Yes / No / Partially)
- **B — Root Cause**: Why did this happen? (specific, not "was busy" or "will fix")
- **C — Current Status**: What is the state right now, today? (with data/numbers)
- **D — Corrective Action**: What specific steps will you take? (list each step)
- **E — Evidence / Attachments**: What documents support your response?
- **F — Completion Date**: By what date will this be fully resolved? (specific date, not "ASAP")

## Grading Criteria

| Grade | Criteria |
|-------|----------|
| **ADEQUATE** | All A-F sections completed, evidence provided, corrective action is concrete and credible, deadline is specific |
| **PARTIAL** | Most sections completed, some evidence, but gaps in corrective action or vague commitments ("will do", "need to discuss") |
| **INADEQUATE** | Missing sections, no evidence, no concrete plan, deadline says "NIL" or "pending" |

## Status Transitions
```
OPEN → IN_PROGRESS (when response submitted)
IN_PROGRESS → RESOLVED (when graded ADEQUATE)
IN_PROGRESS → OPEN (when graded INADEQUATE, new deadline set)
ANY → OVERDUE (when deadline passes without resolution)
RESOLVED → CLOSED (after verification period)
```

## Safety Level
Level 1 — flag creation and grading require Manager or Admin role.
Level 0 — flag viewing and response submission available to all authenticated users.

## Failure Modes & Handling
- Response submitted without evidence → warn but allow (tracked as gap)
- Deadline missed → auto-escalate to OVERDUE status
- Grade disputed → reviewer notes field used for clarification

## Success Metrics
- Average flag resolution time (target: <14 days for MEDIUM, <7 days for HIGH/CRITICAL)
- Response completion rate (target: 100% within deadline)
- Adequate grade rate (target: >70% on first submission)

## Logging Requirements
Log:
- flag creation (who, when, severity)
- response submission (who, when, content summary)
- grade assignment (who, when, grade, notes)
- status transitions (from, to, timestamp)
- deadline changes (old, new, reason)

## Downstream Integrations
- Email notification to assignee when flag created
- Email reminder 3 days before deadline
- Dashboard widget showing open flags by severity
- Calendar event creation for deadlines (Google Calendar)
