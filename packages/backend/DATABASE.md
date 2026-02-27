# Database Schema Documentation

## Overview

The Vendor Management System uses PostgreSQL as the database and Prisma as the ORM. The schema includes comprehensive models for managing vendors, purchase orders, contracts, evaluations, and more.

## Schema Structure

### Core Models

#### 1. User
Manages system users with role-based access control.

**Fields:**
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `password` (String, Hashed)
- `firstName` (String)
- `lastName` (String)
- `role` (Enum: ADMIN, MANAGER, BUYER, VIEWER)
- `isActive` (Boolean)
- `createdAt`, `updatedAt` (DateTime)

**Relations:**
- Has many PurchaseOrders
- Has many Evaluations
- Has many AuditLogs

#### 2. Vendor
Core vendor information and business details.

**Fields:**
- `id` (UUID, Primary Key)
- `code` (String, Unique) - Auto-generated vendor code (VEN000001, etc.)
- `name` (String)
- `email` (String)
- `phone` (String)
- `website` (String, Optional)
- `taxId` (String, Optional)
- `status` (Enum: ACTIVE, INACTIVE, PENDING, BLACKLISTED)

**Address Fields:**
- `address`, `city`, `state`, `country`, `postalCode`

**Business Info:**
- `industry` (String)
- `category` (String)
- `description` (String, Optional)
- `registrationDate` (DateTime, Optional)

**Payment Terms:**
- `paymentTerms` (String, e.g., "Net 30")
- `creditLimit` (Float, Optional)
- `currency` (String, Default: "USD")

**Performance Metrics:**
- `performanceScore` (Float, Default: 0)
- `totalOrders` (Int, Default: 0)
- `totalSpent` (Float, Default: 0)

**Relations:**
- Has many VendorContacts
- Has many Documents
- Has many PurchaseOrders
- Has many Contracts
- Has many Evaluations
- Has many Invoices

#### 3. VendorContact
Contact persons for each vendor.

**Fields:**
- `id` (UUID, Primary Key)
- `vendorId` (UUID, Foreign Key)
- `firstName`, `lastName`, `email`, `phone`
- `position` (String, Optional)
- `isPrimary` (Boolean, Default: false)

#### 4. Document
Vendor-related documents (certificates, licenses, contracts).

**Fields:**
- `id` (UUID, Primary Key)
- `vendorId` (UUID, Foreign Key)
- `name` (String)
- `type` (String) - e.g., "Certificate", "License", "Contract"
- `fileUrl` (String)
- `fileSize` (Int, Optional)
- `mimeType` (String, Optional)
- `expiryDate` (DateTime, Optional)

#### 5. PurchaseOrder
Purchase orders placed with vendors.

**Fields:**
- `id` (UUID, Primary Key)
- `orderNumber` (String, Unique) - Auto-generated (PO2024000001, etc.)
- `vendorId` (UUID, Foreign Key)
- `userId` (UUID, Foreign Key)
- `status` (Enum: DRAFT, SUBMITTED, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED)

**Dates:**
- `orderDate` (DateTime, Default: now)
- `requiredDate` (DateTime, Optional)
- `deliveryDate` (DateTime, Optional)

**Financial:**
- `subtotal` (Float, Default: 0)
- `taxAmount` (Float, Default: 0)
- `shippingCost` (Float, Default: 0)
- `totalAmount` (Float, Default: 0)

**Relations:**
- Belongs to Vendor
- Belongs to User
- Has many POItems
- Has many Invoices

#### 6. POItem
Line items within a purchase order.

**Fields:**
- `id` (UUID, Primary Key)
- `poId` (UUID, Foreign Key)
- `itemNumber` (String)
- `description` (String)
- `quantity` (Float)
- `unitPrice` (Float)
- `discount` (Float, Default: 0)
- `taxRate` (Float, Default: 0)
- `totalPrice` (Float)

#### 7. Contract
Contracts and agreements with vendors.

**Fields:**
- `id` (UUID, Primary Key)
- `contractNumber` (String, Unique) - Auto-generated (CNT2024000001, etc.)
- `vendorId` (UUID, Foreign Key)
- `title` (String)
- `status` (Enum: DRAFT, ACTIVE, EXPIRED, TERMINATED)

**Dates:**
- `startDate` (DateTime)
- `endDate` (DateTime)
- `signedDate` (DateTime, Optional)

**Financial:**
- `contractValue` (Float, Optional)
- `currency` (String, Default: "USD")

**Details:**
- `terms` (String, Optional) - Contract terms and conditions
- `description` (String, Optional)
- `autoRenew` (Boolean, Default: false)
- `renewalPeriod` (Int, Optional) - in months

#### 8. Evaluation
Vendor performance evaluations.

**Fields:**
- `id` (UUID, Primary Key)
- `vendorId` (UUID, Foreign Key)
- `evaluatorId` (UUID, Foreign Key)
- `qualityScore` (Float, 1-5 scale)
- `deliveryScore` (Float, 1-5 scale)
- `pricingScore` (Float, 1-5 scale)
- `serviceScore` (Float, 1-5 scale)
- `overallScore` (Float) - Calculated average
- `comments` (String, Optional)
- `evaluationDate` (DateTime, Default: now)
- `period` (String, Optional) - e.g., "Q1 2024"

#### 9. Invoice
Invoices from vendors.

**Fields:**
- `id` (UUID, Primary Key)
- `invoiceNumber` (String, Unique)
- `vendorId` (UUID, Foreign Key)
- `poId` (UUID, Foreign Key, Optional)

**Dates:**
- `invoiceDate` (DateTime, Default: now)
- `dueDate` (DateTime)
- `paidDate` (DateTime, Optional)

**Financial:**
- `amount` (Float)
- `taxAmount` (Float, Default: 0)
- `totalAmount` (Float)
- `paidAmount` (Float, Default: 0)
- `status` (Enum: PENDING, PAID, OVERDUE, CANCELLED)

#### 10. AuditLog
System audit trail for tracking changes.

**Fields:**
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key)
- `action` (String) - e.g., "CREATE", "UPDATE", "DELETE"
- `entity` (String) - e.g., "VENDOR", "PO", "CONTRACT"
- `entityId` (String)
- `changes` (JSON, Optional) - Before/after values
- `ipAddress` (String, Optional)
- `userAgent` (String, Optional)
- `createdAt` (DateTime, Default: now)

## Enums

### UserRole
- `ADMIN` - Full system access
- `MANAGER` - Management capabilities
- `BUYER` - Can create and manage purchase orders
- `VIEWER` - Read-only access

### VendorStatus
- `ACTIVE` - Vendor is active and can receive orders
- `INACTIVE` - Temporarily inactive
- `PENDING` - Awaiting approval
- `BLACKLISTED` - Vendor is blocked

### POStatus
- `DRAFT` - Initial creation
- `SUBMITTED` - Submitted for approval
- `APPROVED` - Approved and ready
- `IN_PROGRESS` - Order being processed
- `COMPLETED` - Order fulfilled
- `CANCELLED` - Order cancelled

### ContractStatus
- `DRAFT` - Contract draft
- `ACTIVE` - Active contract
- `EXPIRED` - Contract expired
- `TERMINATED` - Contract terminated

### PaymentStatus
- `PENDING` - Payment pending
- `PAID` - Payment completed
- `OVERDUE` - Payment overdue
- `CANCELLED` - Payment cancelled

## Database Setup

### 1. Install Dependencies

```bash
cd packages/backend
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/vms_db"
JWT_SECRET="your-secret-key"
JWT_EXPIRATION="7d"
PORT=3001
```

### 3. Run Migrations

```bash
# Generate Prisma Client
npm run prisma:generate

# Create and apply migrations
npm run prisma:migrate

# Or in development (creates migration and applies it)
npx prisma migrate dev --name init
```

### 4. Seed Database

```bash
npm run prisma:seed
```

This will create:
- Admin user (admin@vms.com / admin123)
- Buyer user (buyer@vms.com / buyer123)
- Sample vendors with contacts
- Sample purchase orders
- Sample contracts
- Sample evaluations
- Sample invoices

### 5. Open Prisma Studio (Optional)

```bash
npm run prisma:studio
```

This opens a GUI to view and edit database records at `http://localhost:5555`

## Migrations

### Creating a New Migration

```bash
# After modifying schema.prisma
npx prisma migrate dev --name your_migration_name
```

### Applying Migrations in Production

```bash
npx prisma migrate deploy
```

### Resetting Database (Development Only)

```bash
npx prisma migrate reset
```

This will:
1. Drop the database
2. Create a new database
3. Apply all migrations
4. Run seed script

## Relationships Summary

```
User
  ├── PurchaseOrder (1:N)
  ├── Evaluation (1:N)
  └── AuditLog (1:N)

Vendor
  ├── VendorContact (1:N)
  ├── Document (1:N)
  ├── PurchaseOrder (1:N)
  ├── Contract (1:N)
  ├── Evaluation (1:N)
  └── Invoice (1:N)

PurchaseOrder
  ├── POItem (1:N)
  └── Invoice (1:N)
```

## Best Practices

1. **Always use transactions** for operations involving multiple tables
2. **Use Prisma Client** for all database operations (never raw SQL unless necessary)
3. **Validate data** before inserting using DTOs with class-validator
4. **Use enums** for status fields to maintain data integrity
5. **Implement soft deletes** if needed for critical records
6. **Index frequently queried fields** (already done via Prisma schema)
7. **Use cascading deletes** carefully (only for dependent records)

## Common Queries

### Get Vendor with Relations
```typescript
const vendor = await prisma.vendor.findUnique({
  where: { id: vendorId },
  include: {
    contacts: true,
    documents: true,
    purchaseOrders: {
      take: 10,
      orderBy: { createdAt: 'desc' },
    },
    contracts: {
      where: { status: 'ACTIVE' },
    },
    evaluations: {
      orderBy: { evaluationDate: 'desc' },
      take: 5,
    },
  },
});
```

### Get Purchase Order with Items
```typescript
const po = await prisma.purchaseOrder.findUnique({
  where: { id: poId },
  include: {
    vendor: true,
    user: true,
    items: true,
  },
});
```

### Get Vendor Performance Metrics
```typescript
const vendor = await prisma.vendor.findUnique({
  where: { id: vendorId },
  include: {
    evaluations: {
      orderBy: { evaluationDate: 'desc' },
    },
    _count: {
      select: {
        purchaseOrders: true,
        contracts: true,
      },
    },
  },
});
```

