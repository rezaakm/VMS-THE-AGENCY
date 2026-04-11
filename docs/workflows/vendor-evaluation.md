# Vendor Evaluation Workflow Contract

## Purpose
Assess and score vendor performance to inform future procurement decisions and maintain accountability.

## Triggers
- PO completed or contract milestone reached
- Quarterly vendor review cycle
- Manual evaluation request

## Primary Trigger Mechanism
Dashboard UI (post-PO completion prompt or scheduled review)

## Inputs
- Vendor ID
- Evaluation criteria scores (quality, delivery, pricing, communication, compliance)
- Evaluator notes

## Required Context
- Vendor profile and history
- Recent POs and delivery performance
- Previous evaluation scores
- Any outstanding issues or flags

## Outputs
- Evaluation record with weighted scores
- Updated vendor performance score (rolling average)
- Vendor status recommendation (maintain, watch, blacklist)
- Audit log entry

## Scoring Model
| Criterion | Weight | Scale |
|-----------|--------|-------|
| Quality | 25% | 1-5 |
| Delivery Timeliness | 25% | 1-5 |
| Pricing Competitiveness | 20% | 1-5 |
| Communication | 15% | 1-5 |
| Compliance | 15% | 1-5 |

Overall score = weighted average, mapped to 0-100.

## Safety Level
Level 1 — evaluations require Buyer role or above.
Vendor blacklisting requires Manager approval.

## Success Metrics
- Percentage of vendors evaluated in current quarter
- Score distribution trends
- Correlation between vendor score and procurement outcomes

## Logging Requirements
Log: evaluation creation, score changes, status recommendations.
