import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FinancialOversightEmailService {
  private readonly logger = new Logger(FinancialOversightEmailService.name);
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    this.enabled = !!this.configService.get('SMTP_HOST');
  }

  async sendOverdueFlagAlert(flag: any, assignee: any) {
    if (!this.enabled) {
      this.logger.warn('Email notifications disabled (no SMTP config)');
      return;
    }

    // TODO: Implement real email sending (nodemailer or similar)
    this.logger.log(
      `[EMAIL PLACEHOLDER] Would send overdue alert for flag "${flag.title}" to ${assignee?.email || 'assigned user'}`
    );
  }

  async sendFlagGradedNotification(flag: any, response: any, gradedBy: any) {
    if (!this.enabled) return;

    this.logger.log(
      `[EMAIL PLACEHOLDER] Flag graded: ${flag.title} - Grade: ${response.grade} by ${gradedBy?.email}`
    );
  }

  async sendWeeklyChecklistDigest() {
    if (!this.enabled) return;
    this.logger.log('[EMAIL PLACEHOLDER] Sending weekly checklist digest');
  }
}
