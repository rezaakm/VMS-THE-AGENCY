# Monthly Financial Checklist Workflow Contract

## Purpose
Ensure recurring financial tasks are completed on time every period. This replaces informal reminders and ad-hoc follow-ups with a structured, trackable system.

## Triggers
- Start of each month (automatic period generation)
- Manual check-in via dashboard
- Scheduled reminder (planned)

## Primary Trigger Mechanism
Time-based (monthly cycle) + Dashboard UI

## Inputs
- Checklist item definitions (name, owner, due day, frequency)
- Current period (e.g., "2026-04")

## Required Context
- Active checklist items
- Completion status for current period
- Owner assignments

## Standard Checklist Items

| Item | Owner | Due Day | Frequency | Category |
|------|-------|---------|-----------|----------|
| Bank Reconciliation | Accountant | 5th | Monthly | RECONCILIATION |
| Owner Current Account Cut-off | Accountant | 5th | Monthly | COMPLIANCE |
| Monthly P&L Statement | Accountant | 10th | Monthly | COMPLIANCE |
| AR Aging Report | Accountant | Every Monday | Weekly | AR |
| Staff Payroll Reconciliation | Accountant | 28th | Monthly | STAFF |
| Vendor Payment Verification | Accountant | 15th | Monthly | EXPENSES |
| Cash Position Update | Accountant | 1st | Monthly | RECONCILIATION |
| VAT Return Preparation | Accountant | 20th | Monthly | COMPLIANCE |
| Budget vs Actual Review | MD + Accountant | 12th | Monthly | BUDGET |
| Client Invoicing Review | Accountant | 5th | Monthly | REVENUE |

## Outputs
- Checklist completion record for each item in each period
- Completion rate percentage for current period
- Overdue items list
- Historical completion trends

## Status Transitions
```
PENDING → COMPLETED (when marked done with evidence)
PENDING → OVERDUE (when due date passes)
PENDING → SKIPPED (with justification)
OVERDUE → COMPLETED (late completion tracked)
```

## Safety Level
Level 0 — viewing and completing checklist items available to assigned owner.
Level 1 — creating or modifying checklist templates requires Manager or Admin.

## Failure Modes & Handling
- Item not completed by due date → auto-mark as OVERDUE
- Owner not available → escalate to Manager
- Evidence not attached → allow completion but flag for review

## Success Metrics
- Monthly completion rate (target: >95%)
- Average days overdue for late items (target: <3 days)
- Consecutive months with 100% completion (track streak)

## Logging Requirements
Log:
- completion action (who, when, item, period)
- overdue detection (item, period, days overdue)
- skip justification (who, why)

## Downstream Integrations
- Dashboard progress bar showing current month completion
- Email reminder to owners on due date if not yet completed
- Monthly summary report for MD review
