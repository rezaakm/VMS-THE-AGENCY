import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FinancialOversightService } from './financial-oversight.service';

@Injectable()
export class FinancialOversightScheduler {
  private readonly logger = new Logger(FinancialOversightScheduler.name);

  constructor(private readonly service: FinancialOversightService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleOverdueFlags() {
    const count = await this.service.escalateOverdueFlags();
    if (count > 0) {
      this.logger.log(`Marked ${count} financial flag(s) as OVERDUE`);
    }
  }
}
