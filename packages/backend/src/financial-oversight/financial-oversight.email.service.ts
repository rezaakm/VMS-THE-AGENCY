import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinancialFlag } from '@prisma/client';
import * as nodemailer from 'nodemailer';

@Injectable()
export class FinancialOversightEmailService {
  private readonly logger = new Logger(FinancialOversightEmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    const host = this.configService.get('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(this.configService.get('SMTP_PORT') || '587', 10),
        secure: this.configService.get('SMTP_PORT') === '465',
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
      });
    }
  }

  private getRecipients(): string[] {
    const raw =
      this.configService.get('FINANCIAL_ALERT_EMAILS') ||
      this.configService.get('SMTP_USER') ||
      '';
    return raw
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
  }

  private async sendDigest(
    subject: string,
    intro: string,
    rows: string,
  ): Promise<boolean> {
    const recipients = this.getRecipients();
    if (!this.transporter || recipients.length === 0) {
      this.logger.warn(
        'Financial alert email skipped: configure SMTP_HOST and FINANCIAL_ALERT_EMAILS (or SMTP_USER)',
      );
      return false;
    }

    const frontendUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto">
        <h2 style="color:#1a1a2e">VMS Financial Oversight</h2>
        <p>${intro}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <thead>
            <tr style="background:#1a1a2e;color:#fff">
              <th style="padding:8px;text-align:left">#</th>
              <th style="padding:8px;text-align:left">Title</th>
              <th style="padding:8px;text-align:left">Severity</th>
              <th style="padding:8px;text-align:left">Assigned</th>
              <th style="padding:8px;text-align:left">Deadline</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <a href="${frontendUrl}/dashboard/financial-oversight/flags"
           style="display:inline-block;background:#1a1a2e;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px">
          Open Financial Flags
        </a>
        <p style="color:#666;font-size:12px;margin-top:24px">
          Automated alert from The Agency VMS. Do not reply unless configured as a monitored inbox.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from:
          this.configService.get('SMTP_FROM') ||
          this.configService.get('SMTP_USER'),
        to: recipients.join(', '),
        subject,
        html,
      });
      this.logger.log(`Financial alert sent to ${recipients.join(', ')}`);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Financial alert email failed: ${message}`);
      return false;
    }
  }

  private flagRows(flags: FinancialFlag[]): string {
    return flags
      .map((f) => {
        const deadline = f.deadline
          ? new Date(f.deadline).toLocaleDateString('en-GB')
          : '—';
        return `<tr>
          <td style="padding:8px;border:1px solid #ddd">${f.flagNumber}</td>
          <td style="padding:8px;border:1px solid #ddd">${f.title}</td>
          <td style="padding:8px;border:1px solid #ddd">${f.severity}</td>
          <td style="padding:8px;border:1px solid #ddd">${f.assignedTo || '—'}</td>
          <td style="padding:8px;border:1px solid #ddd">${deadline}</td>
        </tr>`;
      })
      .join('');
  }

  async sendOverdueAlert(flags: FinancialFlag[]): Promise<boolean> {
    if (flags.length === 0) return false;
    return this.sendDigest(
      `[VMS] ${flags.length} financial flag(s) now OVERDUE`,
      'The following audit flags are past their deadline and have been marked <strong>OVERDUE</strong>:',
      this.flagRows(flags),
    );
  }

  async sendApproachingDeadlineAlert(
    flags: FinancialFlag[],
    withinDays: number,
  ): Promise<boolean> {
    if (flags.length === 0) return false;
    return this.sendDigest(
      `[VMS] ${flags.length} financial flag(s) due within ${withinDays} days`,
      `These open flags are due within the next <strong>${withinDays} days</strong>:`,
      this.flagRows(flags),
    );
  }
}
