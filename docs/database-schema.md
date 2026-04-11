# Database Schema — The Agency VMS

This file documents the working schema for VMS-THE-AGENCY.
The authoritative schema is in `packages/backend/prisma/schema.prisma`.

## Design Rules

- All IDs are UUIDs.
- All tables have created_at and updated_at timestamps.
- Financial values are stored as Float (OMR by default).
- Enums are used for status fields to enforce valid states.
- Cascading deletes are set where child records should not outlive parents.
- Indexes on frequently queried fields (status, severity, foreign keys).

---

## Core Tables

### users
Authenticated operators with role-based access.
Fields: id, email, password, firstName, lastName, role (ADMIN/MANAGER/BUYER/VIEWER), isActive, timestamps.

### vendors
Company profiles with business information and performance tracking.
Fields: id, name, code (unique), email, phone, website, taxId, status, address fields, industry, category, paymentTerms, creditLimit, currency, performanceScore, totalOrders, totalSpent, timestamps.
Relations: contacts, documents, purchaseOrders, contracts, evaluations, invoices, rfqBids.

### vendor_contacts
Contact persons for each vendor.
Fields: id, vendorId, firstName, lastName, email, phone, position, isPrimary.

### documents
Files uploaded for vendors (certificates, licenses, contracts).
Fields: id, vendorId, name, type, fileUrl, fileSize, mimeType, expiryDate.

### purchase_orders
Procurement orders with financial tracking.
Fields: id, orderNumber (unique), vendorId, userId, status (DRAFT/SUBMITTED/APPROVED/IN_PROGRESS/COMPLETED/CANCELLED), dates, financial totals, description, notes.
Relations: vendor, user, items, invoices.

### po_items
Line items within purchase orders.
Fields: id, purchaseOrderId, description, quantity, unitPrice, totalPrice, unit, category, notes.

### invoices
Vendor invoices linked to purchase orders.
Fields: id, vendorId, purchaseOrderId, invoiceNumber, amount, status (PENDING/PAID/OVERDUE/CANCELLED), dates.

### contracts
Vendor contracts with lifecycle management.
Fields: id, vendorId, contractNumber, title, status (DRAFT/ACTIVE/EXPIRED/TERMINATED), financial terms, dates.

### evaluations
Vendor performance assessments.
Fields: id, vendorId, userId, scores (quality, delivery, pricing, communication, compliance), overallScore, comments, period.

### audit_logs
Immutable trail of system actions.
Fields: id, userId, action, entity, entityId, details (JSON), ipAddress, timestamp.

---

## RFQ Tables

### rfqs
Request for quotation records.
Fields: id, rfqNumber, title, description, userId, status, dates, requirements.

### rfq_items
Line items within RFQs.
Fields: id, rfqId, description, quantity, unit, specifications.

### rfq_vendor_bids
Vendor bid submissions for RFQs.
Fields: id, rfqId, vendorId, bidToken, status, totalAmount, notes, dates.

### rfq_bid_items
Line item pricing within vendor bids.
Fields: id, bidId, rfqItemId, unitPrice, totalPrice, notes, leadTime.

---

## Financial Oversight Tables (Phase 2)

### financial_flags
Audit issues and investigation items.
Fields: id, flagNumber, title, description, severity (CRITICAL/HIGH/MEDIUM/LOW), status (OPEN/IN_PROGRESS/RESOLVED/CLOSED/OVERDUE), category, assignedTo, deadline, timestamps.
Relations: responses.

### flag_responses
A-F template submissions for flags.
Fields: id, flagId, acknowledgement (YES/NO/PARTIALLY), rootCause, currentStatus, correctiveAction, evidence (JSON), completionDate, grade (ADEQUATE/PARTIAL/INADEQUATE), reviewerNotes, submittedAt, reviewedAt.

### financial_checklist_items
Recurring compliance check templates.
Fields: id, name, description, frequency (DAILY/WEEKLY/MONTHLY/QUARTERLY/ANNUAL), owner, dueDay, category, isActive.
Relations: completions.

### checklist_completions
Period-based completion tracking.
Fields: id, checklistItemId, period, status (PENDING/COMPLETED/OVERDUE/SKIPPED), completedBy, completedAt, notes, evidence.
Unique constraint: (checklistItemId, period).

### financial_processes
SOP registry with ownership and status tracking.
Fields: id, name, description, owner, frequency, status (NOT_STARTED/IN_DEVELOPMENT/ACTIVE/NEEDS_UPDATE), templateUrl, lastExecuted, nextDue, trainingRequired, timestamps.

---

## Cost Intelligence Tables (CIS — separate database)

### cost_sheets, cost_items, cost_categories
Managed in the CIS subdirectory with its own Prisma schema and PostgreSQL database.
