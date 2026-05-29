import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FinancialOversightService } from './financial-oversight.service';
import { FinancialOversightEmailService } from './financial-oversight.email.service';

@Injectable()
export class FinancialOversightScheduler {
  private readonly logger = new Logger(FinancialOversightScheduler.name);
  private static readonly APPROACHING_DAYS = 3;

  constructor(
    private readonly service: FinancialOversightService,
    private readonly email: FinancialOversightEmailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleOverdueFlags() {
    const toEscalate = await this.service.findFlagsPastDeadline();
    const count = await this.service.escalateOverdueFlags();
    if (count > 0) {
      this.logger.log(`Marked ${count} financial flag(s) as OVERDUE`);
      await this.email.sendOverdueAlert(toEscalate);
    }

    const checklistOverdue = await this.service.escalateOverdueChecklistItems();
    if (checklistOverdue > 0) {
      this.logger.log(
        `Marked ${checklistOverdue} checklist item(s) as OVERDUE for current period`,
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleApproachingDeadlines() {
    const approaching = await this.service.getFlagsApproachingDeadline(
      FinancialOversightScheduler.APPROACHING_DAYS,
    );
    if (approaching.length > 0) {
      await this.email.sendApproachingDeadlineAlert(
        approaching,
        FinancialOversightScheduler.APPROACHING_DAYS,
      );
      this.logger.log(
        `Sent approaching-deadline alert for ${approaching.length} flag(s)`,
      );
    }
  }
}
