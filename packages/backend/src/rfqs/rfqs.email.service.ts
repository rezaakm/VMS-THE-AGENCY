import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class RfqEmailService {
  private readonly logger = new Logger(RfqEmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    const host = this.configService.get('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(this.configService.get('SMTP_PORT') || '587'),
        secure: this.configService.get('SMTP_PORT') === '465',
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
      });
    }
  }

  async sendRfqInvite(params: {
    vendorName: string;
    vendorEmail: string;
    rfqNumber: string;
    rfqTitle: string;
    deadline: Date;
    items: Array<{ itemNumber: number; description: string; quantity: number; unit: string }>;
    bidUrl: string;
  }): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
      return false;
    }

    const itemRows = params.items
      .map((i) => `<tr><td style="padding:8px;border:1px solid #ddd">${i.itemNumber}</td><td style="padding:8px;border:1px solid #ddd">${i.description}</td><td style="padding:8px;border:1px solid #ddd">${i.quantity} ${i.unit}</td></tr>`)
      .join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a1a2e">Request for Quotation</h2>
        <p>Dear ${params.vendorName},</p>
        <p>You are invited to submit a quotation for the following:</p>

        <table style="width:100%;margin:16px 0;background:#f8f9fa;padding:12px;border-radius:8px">
          <tr><td><strong>RFQ Number:</strong></td><td>${params.rfqNumber}</td></tr>
          <tr><td><strong>Title:</strong></td><td>${params.rfqTitle}</td></tr>
          <tr><td><strong>Deadline:</strong></td><td style="color:#e63946;font-weight:bold">${new Date(params.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
        </table>

        <h3>Items Required:</h3>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead><tr style="background:#1a1a2e;color:white">
            <th style="padding:8px;text-align:left">#</th>
            <th style="padding:8px;text-align:left">Description</th>
            <th style="padding:8px;text-align:left">Qty</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
        </table>

        <p>Please submit your pricing by clicking the button below:</p>
        <a href="${params.bidUrl}" style="display:inline-block;background:#1a1a2e;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0">Submit Your Quotation</a>

        <p style="color:#666;font-size:12px;margin-top:24px">
          This is an automated message from The Agency Oman's Vendor Management System.<br>
          If you have questions, please reply to this email.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.configService.get('SMTP_FROM') || this.configService.get('SMTP_USER'),
        to: params.vendorEmail,
        subject: `RFQ ${params.rfqNumber}: ${params.rfqTitle}`,
        html,
      });
      this.logger.log(`RFQ email sent to ${params.vendorEmail}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${params.vendorEmail}: ${err.message}`);
      return false;
    }
  }
}
