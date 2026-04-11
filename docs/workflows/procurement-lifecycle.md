# Procurement Lifecycle Workflow Contract

## Purpose
Manage the full procurement cycle from vendor selection through RFQ, PO creation, delivery, invoicing, and payment tracking.

## Triggers
- Business need identified (new equipment, service, supply)
- RFQ created for competitive bidding
- Direct PO for known vendors

## Primary Trigger Mechanism
Dashboard UI

## Inputs
- Item/service requirements
- Budget allocation
- Preferred vendors (if any)
- Delivery timeline

## Required Context
- Vendor performance history
- Historical pricing from cost sheets
- Budget availability
- Approval authority level

## Workflow Steps

### Path A: Competitive Procurement (RFQ)
1. Create RFQ with specifications
2. Invite qualified vendors to bid
3. Vendors submit bids through portal (token-authenticated)
4. Compare bids on price, quality, delivery, vendor score
5. Award to selected vendor
6. Generate PO from winning bid
7. Track delivery
8. Process invoice
9. Update vendor performance

### Path B: Direct Purchase (PO)
1. Select vendor
2. Create PO with line items
3. Submit for approval (if above threshold)
4. Issue PO to vendor
5. Track delivery
6. Process invoice
7. Update vendor performance

## Outputs
- RFQ record with bid comparison
- Purchase Order with full lifecycle status
- Invoice records linked to PO
- Vendor performance update
- Audit log entries at each stage

## Safety Level
- Level 0: View POs and vendors
- Level 1: Create POs, submit RFQs (Buyer+)
- Level 2: Approve POs above threshold (Manager+)

## Failure Modes & Handling
- No bids received → extend deadline or direct procurement
- PO amount exceeds budget → block and notify Manager
- Vendor delivers late → record in evaluation, affect performance score
- Invoice mismatch → flag for review before payment

## Success Metrics
- Average procurement cycle time (RFQ to PO)
- Vendor bid response rate
- PO completion rate
- Invoice-to-PO match rate

## Logging Requirements
Log:
- RFQ creation, bid submissions, award decision
- PO creation, approval, status changes
- Invoice submission and matching
- Vendor evaluation entries

## Downstream Integrations
- Zoho Books (planned: auto-create vendor bills)
- Email notification to vendor on PO issuance
- Cost sheet auto-population from completed POs
