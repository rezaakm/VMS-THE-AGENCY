import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialOversightService } from './financial-oversight.service';

@Injectable()
export class FinancialOversightScheduler {
  private readonly logger = new Logger(FinancialOversightScheduler.name);

  constructor(
    private prisma: PrismaService,
    private financialOversightService: FinancialOversightService,
  ) {}

  // Run every day at 7:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async handleOverdueFlags() {
    this.logger.log('Running daily overdue flag escalation check...');

    const now = new Date();

    // Find flags that are past due and not resolved
    const overdueFlags = await this.prisma.financialFlag.findMany({
      where: {
        dueDate: { lt: now },
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      include: {
        assignedTo: true,
      },
    });

    for (const flag of overdueFlags) {
      try {
        await this.prisma.financialFlag.update({
          where: { id: flag.id },
          data: { status: 'ESCALATED' },
        });

        this.logger.warn(`Flag escalated due to overdue: ${flag.title} (ID: ${flag.id})`);

        // TODO: Trigger email notification (will be wired in email service)
      } catch (error) {
        this.logger.error(`Failed to escalate flag ${flag.id}`, error);
      }
    }

    if (overdueFlags.length > 0) {
      this.logger.log(`Escalated ${overdueFlags.length} overdue flags.`);
    }
  }

  // Optional: Run every Monday for checklist reminders
  @Cron(CronExpression.EVERY_WEEK)
  async handleChecklistReminders() {
    this.logger.log('Weekly checklist reminder check (placeholder for future email digest)');
  }
}
