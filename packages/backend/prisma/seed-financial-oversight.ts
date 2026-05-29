import { PrismaClient, FlagSeverity, FlagCategory, FlagStatus, ResponseGrade, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds the 12 real financial flags from the April 2026 audit.
 * This is the heart of Phase 2 per the project constitution.
 */
export async function seedFinancialOversight(adminUserId: string, managerUserId?: string) {
  console.log('🌱 Seeding Financial Oversight data (real audit flags)...');

  const now = new Date();
  const dueSoon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const overdue = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

  // The 12 real issues from the April 2026 financial audit
  const realFlags = [
    {
      title: 'Budget conflict between two major proposals',
      description: 'Two competing proposals for the same project were approved with conflicting budget allocations, leading to double-counting of OMR 87,000.',
      severity: 'CRITICAL' as FlagSeverity,
      category: 'BUDGET' as FlagCategory,
      dueDate: overdue,
      status: 'OPEN' as FlagStatus,
    },
    {
      title: 'Revenue forecasting has no documented methodology',
      description: 'Revenue projections for 2026 are being used for board reporting and bank facilities with no clear assumptions, model, or sensitivity analysis.',
      severity: 'HIGH' as FlagSeverity,
      category: 'REVENUE' as FlagCategory,
      dueDate: dueSoon,
    },
    {
      title: 'Direct cost ratio at 63% (target <55%)',
      description: 'Direct costs as percentage of revenue have climbed to 63%. Target per board-approved plan is below 55%. Root cause analysis missing.',
      severity: 'CRITICAL' as FlagSeverity,
      category: 'COSTS' as FlagCategory,
      dueDate: overdue,
    },
    {
      title: 'Unjustified OpEx increases in Q1 2026',
      description: 'Operating expenses increased 22% YoY with no corresponding revenue growth or documented approval for the incremental spend.',
      severity: 'HIGH' as FlagSeverity,
      category: 'COSTS' as FlagCategory,
    },
    {
      title: 'AR collections stuck at OMR 57,100 over 90 days',
      description: 'Significant receivables over 90 days old with no formal collection process or escalation. Several large clients have not been contacted in 60+ days.',
      severity: 'CRITICAL' as FlagSeverity,
      category: 'AR_COLLECTIONS' as FlagCategory,
      dueDate: overdue,
    },
    {
      title: 'No formal financial statements prepared since Dec 2025',
      description: 'Management and board are operating without monthly or quarterly financial statements. Last complete set is from December 2025.',
      severity: 'HIGH' as FlagSeverity,
      category: 'FINANCIAL_STATEMENTS' as FlagCategory,
    },
    {
      title: 'Bank reconciliation not performed since January 2026',
      description: 'Bank accounts have not been reconciled for four months. This is a fundamental control failure.',
      severity: 'CRITICAL' as FlagSeverity,
      category: 'BANK_RECON' as FlagCategory,
      dueDate: overdue,
    },
    {
      title: 'Staff settlements and salary inconsistencies',
      description: 'Multiple instances of staff advances and settlements not properly recorded or approved. Some salaries appear to have been paid outside normal payroll cycles.',
      severity: 'HIGH' as FlagSeverity,
      category: 'STAFF_SETTLEMENTS' as FlagCategory,
    },
    {
      title: 'Owner current account - 13 months accumulated',
      description: 'Owner drawings and personal expenses have been charged to the business for 13 consecutive months with no settlement or formal accounting treatment.',
      severity: 'CRITICAL' as FlagSeverity,
      category: 'OWNER_ACCOUNT' as FlagCategory,
      dueDate: overdue,
    },
    {
      title: 'Six critical financial processes undocumented',
      description: 'Key processes (monthly close, cash flow forecasting, client profitability analysis, job costing, PO approval matrix, owner account reconciliation) have no written SOPs or clear ownership.',
      severity: 'HIGH' as FlagSeverity,
      category: 'PROCESSES' as FlagCategory,
    },
    {
      title: 'Budget arithmetic and version control errors',
      description: 'Multiple versions of the 2026 budget are circulating with different numbers. No single source of truth or change control process.',
      severity: 'MEDIUM' as FlagSeverity,
      category: 'BUDGET' as FlagCategory,
    },
    {
      title: 'Other Expenses used as dumping ground',
      description: 'The "Other Expenses" category in the P&L has grown 47% and is being used to absorb variances without proper classification or investigation.',
      severity: 'MEDIUM' as FlagSeverity,
      category: 'COSTS' as FlagCategory,
    },
  ];

  const createdFlags = [];

  for (const flagData of realFlags) {
    const flag = await prisma.financialFlag.create({
      data: {
        title: flagData.title,
        description: flagData.description,
        severity: flagData.severity,
        category: flagData.category,
        status: flagData.status || 'OPEN',
        dueDate: flagData.dueDate || null,
        createdById: adminUserId,
        assignedToId: managerUserId || adminUserId,
      },
    });
    createdFlags.push(flag);
    console.log(`  ✅ Created flag: ${flag.title.substring(0, 60)}...`);
  }

  // Create sample responses for a few flags
  if (createdFlags.length >= 3) {
    await prisma.flagResponse.create({
      data: {
        flagId: createdFlags[0].id,
        acknowledge: 'Acknowledged the budget double-counting issue.',
        rootCause: 'Two different departments submitted proposals without cross-checking budgets.',
        currentStatus: 'Finance team is reconciling the two proposals.',
        actionPlan: 'Cancel one proposal and re-forecast Q2-Q4. Implement budget review gate.',
        evidence: 'Email trail between ops and finance dated March 12-18.',
        completionDate: 'Target: 15 June 2026',
        submittedById: adminUserId,
      },
    });
    console.log('  ✅ Added sample response to first flag');
  }

  // Create checklist items based on the audit gaps
  const checklistItems = [
    { name: 'Bank reconciliation completed', frequency: 'monthly', dueDay: 5, ownerRole: 'ADMIN' as UserRole },
    { name: 'Owner current account settled', frequency: 'monthly', dueDay: 5, ownerRole: 'ADMIN' as UserRole },
    { name: 'Monthly P&L prepared and reviewed', frequency: 'monthly', dueDay: 10, ownerRole: 'MANAGER' as UserRole },
    { name: 'AR aging report + collection calls', frequency: 'weekly', dueDay: 1, ownerRole: 'BUYER' as UserRole },
    { name: 'Budget vs actual variance analysis', frequency: 'monthly', dueDay: 12, ownerRole: 'MANAGER' as UserRole },
    { name: 'Financial processes checklist review', frequency: 'quarterly', dueDay: 1, ownerRole: 'ADMIN' as UserRole },
  ];

  for (const item of checklistItems) {
    await prisma.financialChecklistItem.create({ data: item });
  }
  console.log(`  ✅ Created ${checklistItems.length} checklist items`);

  // Create the 6 missing financial processes
  const processes = [
    { name: 'Monthly Financial Close', description: 'Full close process including bank rec, accruals, and board reporting pack', status: 'ACTIVE' },
    { name: 'Cash Flow Forecasting', description: '13-week rolling cash forecast updated every Monday', status: 'IN_DEVELOPMENT' },
    { name: 'Client & Job Profitability Analysis', description: 'Monthly review of margin by client and project type', status: 'NOT_STARTED' },
    { name: 'PO Approval Matrix & Thresholds', description: 'Formal approval limits by role and amount', status: 'ACTIVE' },
    { name: 'Owner Account Reconciliation', description: 'Monthly clearance of drawings and personal expenses', status: 'ACTIVE' },
    { name: 'Budget Change Control', description: 'Process for approving and documenting budget revisions', status: 'NOT_STARTED' },
  ];

  for (const proc of processes) {
    await prisma.financialProcess.create({
      data: {
        ...proc,
        ownerId: adminUserId,
      },
    });
  }
  console.log(`  ✅ Created ${processes.length} financial processes`);

  console.log('✅ Financial Oversight seed data created successfully (12 real audit flags + supporting data)');
  return createdFlags;
}

// Allow running this file directly
if (require.main === module) {
  seedFinancialOversight('replace-with-admin-id')
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
