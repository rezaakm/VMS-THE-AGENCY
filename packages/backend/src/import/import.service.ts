import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const CATEGORIES = [
  { name: 'Vinyl/Sticker Work', keywords: ['vinyl', 'sticker', 'pasting', 'wrap', 'frosted'] },
  { name: 'Printing', keywords: ['printing', 'print', 'printed', 'banner', 'rollup', 'roll-up', 'card', 'brochure', 'flyer'] },
  { name: 'Rental - Furniture/Tent', keywords: ['tent', 'sofa', 'table', 'chair', 'furniture', 'rental of', 'carpet', 'podium'] },
  { name: 'Branding/Design', keywords: ['branding', 'brand', 'design', 'logo', 'graphic'] },
  { name: 'Fabrication/Carpentry', keywords: ['fabricat', 'carpent', 'mdf', 'wood', 'cnc', 'booth', 'kiosk', 'counter', 'reception'] },
  { name: 'Signage', keywords: ['sign', 'signage', 'acrylic letter', 'neon', 'lightbox', 'totem', 'pylon'] },
  { name: 'AV/Lighting/Sound', keywords: ['light', 'lighting', 'led', 'screen', 'audio', 'sound', 'speaker', 'projector', 'av ', 'stage'] },
  { name: 'Photography/Videography', keywords: ['photo', 'video', 'camera', 'drone', 'shooting'] },
  { name: 'Gifts/Merchandise', keywords: ['gift', 'merch', 'giveaway', 'souvenir', 'trophy', 'medal', 'pen', 'bag', 'mug'] },
  { name: 'Catering/F&B', keywords: ['cater', 'food', 'coffee', 'tea', 'water', 'juice', 'lunch', 'dinner', 'refreshment'] },
  { name: 'Logistics/Transport', keywords: ['transport', 'logistics', 'delivery', 'truck', 'crane', 'forklift', 'loading'] },
  { name: 'Installation/Labour', keywords: ['install', 'labour', 'labor', 'manpower', 'worker', 'helper', 'technician', 'rigger'] },
  { name: 'Electrical/Power', keywords: ['electric', 'power', 'generator', 'cable', 'plug', 'socket', 'wiring'] },
  { name: 'Flowers/Landscaping', keywords: ['flower', 'floral', 'plant', 'landscape', 'grass', 'garden'] },
  { name: 'Uniforms/Clothing', keywords: ['uniform', 'shirt', 't-shirt', 'tshirt', 'polo', 'cap', 'hat', 'vest', 'jacket'] },
  { name: 'Digital/Social Media', keywords: ['social media', 'digital', 'website', 'app', 'seo', 'online', 'instagram', 'facebook'] },
  { name: 'Miscellaneous', keywords: [] },
];

const VENDOR_ALIASES: Record<string, string[]> = {
  'High Mark': ['HighMark', 'High mark', 'Highmark', 'HIGH MARK'],
  'Al Jazeera': ['Al jazeera', 'Aljazeera', 'AL JAZEERA'],
  'Gulf Printing': ['Gulf printing', 'GULF PRINTING', 'Gulf Print'],
  'Oman Signage': ['Oman signage', 'OMAN SIGNAGE'],
};

const CLIENT_ALIASES: Record<string, string[]> = {
  'Al Fardan': ['Al fardan', 'Alfardan', 'AL FARDAN', 'Al Fardan Group'],
  'Omantel': ['omantel', 'OMANTEL', 'Oman Tel'],
  'Bank Muscat': ['Bank muscat', 'BANK MUSCAT', 'BankMuscat'],
  'Ooredoo': ['ooredoo', 'OOREDOO', 'Ooredoo Oman'],
};

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private categoryMap = new Map<string, string>();
  private clientMap = new Map<string, string>();
  private vendorMap = new Map<string, string>();
  private initialized = false;

  constructor(private prisma: PrismaService) {}

  async initialize() {
    if (this.initialized) return;

    for (const cat of CATEGORIES) {
      const existing = await this.prisma.category.findUnique({ where: { name: cat.name } });
      if (existing) {
        this.categoryMap.set(cat.name, existing.id);
      } else {
        const created = await this.prisma.category.create({
          data: { name: cat.name, keywords: cat.keywords, description: `Auto-created category for ${cat.name}` },
        });
        this.categoryMap.set(cat.name, created.id);
      }
    }
    this.initialized = true;
  }

  categorizeItem(description: string): string | null {
    const descLower = description.toLowerCase();
    for (const cat of CATEGORIES) {
      if (cat.keywords.length === 0) continue;
      if (cat.keywords.some(kw => descLower.includes(kw))) {
        return this.categoryMap.get(cat.name) || null;
      }
    }
    return this.categoryMap.get('Miscellaneous') || null;
  }

  normalizeVendorName(raw: string): string {
    const trimmed = raw.trim();
    for (const [canonical, aliases] of Object.entries(VENDOR_ALIASES)) {
      if (aliases.some(a => a.toLowerCase() === trimmed.toLowerCase()) || canonical.toLowerCase() === trimmed.toLowerCase()) {
        return canonical;
      }
    }
    return trimmed.replace(/\s+/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  normalizeClientName(raw: string): string {
    const trimmed = raw.trim();
    for (const [canonical, aliases] of Object.entries(CLIENT_ALIASES)) {
      if (aliases.some(a => a.toLowerCase() === trimmed.toLowerCase()) || canonical.toLowerCase() === trimmed.toLowerCase()) {
        return canonical;
      }
    }
    return trimmed.replace(/\s+/g, ' ');
  }

  async getOrCreateVendor(normalizedName: string, rawName: string): Promise<string> {
    if (this.vendorMap.has(normalizedName)) return this.vendorMap.get(normalizedName)!;

    const existing = await this.prisma.vendor.findUnique({ where: { name: normalizedName } });
    if (existing) {
      if (!existing.aliases.includes(rawName)) {
        await this.prisma.vendor.update({ where: { id: existing.id }, data: { aliases: { push: rawName } } });
      }
      this.vendorMap.set(normalizedName, existing.id);
      return existing.id;
    }

    const created = await this.prisma.vendor.create({
      data: { name: normalizedName, aliases: rawName !== normalizedName ? [rawName] : [] },
    });
    this.vendorMap.set(normalizedName, created.id);
    return created.id;
  }

  async getOrCreateClient(normalizedName: string, rawName: string): Promise<string> {
    if (this.clientMap.has(normalizedName)) return this.clientMap.get(normalizedName)!;

    const existing = await this.prisma.client.findUnique({ where: { name: normalizedName } });
    if (existing) {
      if (!existing.aliases.includes(rawName)) {
        await this.prisma.client.update({ where: { id: existing.id }, data: { aliases: { push: rawName } } });
      }
      this.clientMap.set(normalizedName, existing.id);
      return existing.id;
    }

    const created = await this.prisma.client.create({
      data: { name: normalizedName, aliases: rawName !== normalizedName ? [rawName] : [] },
    });
    this.clientMap.set(normalizedName, created.id);
    return created.id;
  }

  parseExcelFile(filePath: string) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const company = sheet['B3']?.v?.toString().trim() || 'Unknown';
      const date = sheet['B4']?.v?.toString().trim() || null;
      const subject = sheet['B5']?.v?.toString().trim() || 'Unknown Subject';

      const items: any[] = [];
      let row = 10;
      let emptyRows = 0;

      while (emptyRows < 3 && row < 100) {
        const descCell = sheet[`B${row}`];
        const desc = descCell?.v?.toString().trim();

        if (!desc || desc.length < 4) { emptyRows++; row++; continue; }

        const descLower = desc.toLowerCase();
        if (['sub total', 'subtotal', 'total', 'vat 5%', 'vat', 'delivery timeline'].some(s => descLower.includes(s))) { row++; continue; }
        if (descLower.startsWith('note:') || descLower.startsWith('delivery')) { row++; continue; }

        emptyRows = 0;
        const qty = this.getNumericValue(sheet[`C${row}`]);
        const unitCost = this.getNumericValue(sheet[`D${row}`]);
        const totalCost = this.getNumericValue(sheet[`E${row}`]);
        const unitSelling = this.getNumericValue(sheet[`F${row}`]);
        const totalSelling = this.getNumericValue(sheet[`G${row}`]);
        const vendorCell = sheet[`I${row}`];
        let vendorRaw: string | null = null;
        if (vendorCell?.v && typeof vendorCell.v === 'string') vendorRaw = vendorCell.v.trim();

        items.push({
          itemNumber: items.length + 1, description: desc, quantity: qty || 1,
          unitCost: unitCost || 0, totalCost: totalCost || 0,
          unitSelling: unitSelling || 0, totalSelling: totalSelling || 0, vendorRaw,
        });
        row++;
      }

      return { company, date, subject, items };
    } catch (error) {
      this.logger.error(`Failed to parse ${filePath}: ${error.message}`);
      return null;
    }
  }

  private getNumericValue(cell: any): number | null {
    if (!cell) return null;
    const val = cell.v;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') { const p = parseFloat(val); return isNaN(p) ? null : p; }
    return null;
  }

  async importFile(filePath: string, year: number): Promise<{ success: boolean; jobNumber?: string; error?: string }> {
    const fileName = path.basename(filePath);
    const jobMatch = fileName.match(/^(\d+)/);
    const jobNumber = jobMatch ? jobMatch[1] : `UNK-${Date.now()}`;

    const existing = await this.prisma.project.findUnique({ where: { jobNumber } });
    if (existing) return { success: false, jobNumber, error: 'Already imported' };

    const parsed = this.parseExcelFile(filePath);
    if (!parsed || parsed.items.length === 0) return { success: false, jobNumber, error: 'Failed to parse or no items found' };

    const normalizedClient = this.normalizeClientName(parsed.company);
    const clientId = await this.getOrCreateClient(normalizedClient, parsed.company);

    let parsedDate: Date | null = null;
    if (parsed.date) {
      try {
        const parts = parsed.date.split('.');
        if (parts.length === 3) {
          const candidate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          // Validate: must be a real date and year must be reasonable (1900-2100)
          if (!isNaN(candidate.getTime()) && candidate.getFullYear() >= 1900 && candidate.getFullYear() <= 2100) {
            parsedDate = candidate;
          } else {
            this.logger.warn(`Invalid date "${parsed.date}" in ${filePath}, skipping date`);
          }
        }
      } catch {
        this.logger.warn(`Failed to parse date "${parsed.date}" in ${filePath}`);
      }
    }

    const totalCost = parsed.items.reduce((sum, i) => sum + (i.totalCost || 0), 0);
    const totalSell = parsed.items.reduce((sum, i) => sum + (i.totalSelling || 0), 0);
    const marginPct = totalSell > 0 ? ((totalSell - totalCost) / totalSell) * 100 : 0;

    const project = await this.prisma.project.create({
      data: {
        jobNumber, clientId, subject: parsed.subject, date: parsedDate, year,
        totalCost, totalSell, marginPct, fileName,
      },
    });

    for (const item of parsed.items) {
      const categoryId = this.categorizeItem(item.description);
      let vendorId: string | null = null;
      if (item.vendorRaw) {
        const normalizedVendor = this.normalizeVendorName(item.vendorRaw);
        if (normalizedVendor) vendorId = await this.getOrCreateVendor(normalizedVendor, item.vendorRaw);
      }

      const marginAmount = item.totalSelling - item.totalCost;
      const marginPctItem = item.totalSelling > 0 ? (marginAmount / item.totalSelling) * 100 : 0;

      await this.prisma.lineItem.create({
        data: {
          projectId: project.id, itemNumber: item.itemNumber, description: item.description,
          categoryId, quantity: item.quantity, unitCost: item.unitCost, totalCost: item.totalCost,
          unitSelling: item.unitSelling, totalSelling: item.totalSelling,
          marginAmount, marginPct: marginPctItem, vendorId, vendorRaw: item.vendorRaw,
        },
      });
    }

    return { success: true, jobNumber };
  }

  async importDirectory(dirPath: string, year: number) {
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx'));
    const results = { total: files.length, imported: 0, skipped: 0, errors: 0, details: [] as any[] };

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const result = await this.importFile(filePath, year);
      if (result.success) results.imported++;
      else if (result.error === 'Already imported') results.skipped++;
      else results.errors++;
      results.details.push({ file, ...result });
    }
    return results;
  }

  async importFromBuffer(buffer: Buffer, fileName: string, year: number): Promise<any> {
    const tempPath = path.join('/tmp', `upload-${Date.now()}-${fileName}`);
    fs.writeFileSync(tempPath, buffer);
    try {
      return await this.importFile(tempPath, year);
    } finally {
      fs.unlinkSync(tempPath);
    }
  }
}
