import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Category definitions with keywords for auto-matching
const CATEGORIES = [
  { name: 'Vinyl/Sticker Work', keywords: ['vinyl', 'sticker', 'pasting', 'wrap', 'frosted'] },
  { name: 'Printing', keywords: ['printing', 'print', 'printed', 'banner', 'rollup', 'roll-up', 'card', 'brochure', 'flyer'] },
  { name: 'Rental - Furniture/Tent', keywords: ['tent', 'sofa', 'table', 'chair', 'furniture', 'rental of', 'carpet', 'podium'] },
  { name: 'Branding/Design', keywords: ['branding', 'design', 'concept', 'creative', 'visualization', 'adaptation'] },
  { name: 'LED/Lighting', keywords: ['led', 'lighting', 'neon', 'light', 'illuminat'] },
  { name: 'Transportation/Logistics', keywords: ['transportation', 'transport', 'logistics', 'delivery', 'dismantle', 'dismantl', 'shipping'] },
  { name: 'MDF/Fabrication', keywords: ['mdf', 'fabrication', 'cnc', 'structure', 'monument', 'backdrop', 'photo wall', 'photowall'] },
  { name: 'Photography/Videography', keywords: ['photography', 'videography', 'photo', 'video', 'camera', 'drone', 'filming'] },
  { name: 'Hostess/Staff', keywords: ['hostess', 'promoter', 'staff', 'usher', 'model', 'manpower', 'labour', 'labor'] },
  { name: 'Catering/Food', keywords: ['catering', 'food', 'coffee', 'lunch', 'dinner', 'cooking', 'luqaimat', 'refreshment'] },
  { name: 'Event Management', keywords: ['event management', 'management fees', 'coordination', 'event concept'] },
  { name: 'AV Equipment Rental', keywords: ['sound', 'speaker', 'microphone', 'projector', 'screen rental', 'av ', 'audio'] },
  { name: 'Installation/Labor', keywords: ['installation', 'install', 'labor cost', 'labour cost', 'fixing'] },
  { name: 'Signage', keywords: ['signage', 'totem', 'letters', 'sign board', 'wayfinding', 'directional'] },
  { name: 'Giveaways/Merchandise', keywords: ['giveaway', 'goodie', 'gift', 'notebook', 'flask', 'bag', 'merchandise', 'souvenir', 'pen '] },
  { name: 'Social Media', keywords: ['social media', 'content creation', 'reel', 'instagram', 'tiktok'] },
  { name: 'Acrylic Work', keywords: ['acrylic', 'forex', 'perspex', 'plexiglass'] },
  { name: 'Car Branding', keywords: ['car branding', 'vehicle', 'car sticker', 'car wrap', 'fleet'] },
];

// Vendor name normalization map
const VENDOR_ALIASES: Record<string, string[]> = {
  'High Mark': ['High Mark', 'High mark', 'HighMark', 'Highmark', 'high mark', 'Behrang /High Mark', 'Sajjad / High Mark', 'High mark /Arzu', 'Nijil / HighMark', 'Manual / High Mark'],
  'Rehan': ['Rehan', 'rehan'],
  'The Agency': ['The Agency', 'The agency', 'Agency', 'The Agency / Foroflash', 'The Agency /High Mark', 'The Agency/Graphic', 'Manual /The Agency'],
  'Intelligent': ['Intelligent'],
  'Ibrahim': ['Ibrahim', 'Ibrahim - 1', 'Ibrahim - 2'],
  'Smart Print': ['Smart Print', 'Smart Prints', 'Smart print'],
  'Arzu': ['Arzu', 'Arzoo', 'Arzoo  - 100', 'Arzu (1800)'],
  'Tanveer': ['Tanveer'],
  'Graphic Digital': ['Graphic Digital'],
  'Anup': ['Anup', 'Anoop', 'Anoop - 500'],
  'Global Prism': ['Global Prism', 'Global Prism /Foto Souq'],
  'Falcon': ['Falcon'],
  'Jasani': ['Jasani', 'Jasani /Suresh/Haithem'],
  'Paper Trading': ['Paper Trading', 'Paper Trading & Nezam'],
  'Nijil': ['Nijil', 'NIJIL', 'NIJIL - Dubai', 'Nijil - Dubai for Fabric'],
  'Suresh': ['Suresh', 'Suresn', 'Al areesh Suresh', 'Suresh / Bestline /GB'],
  'Bestline': ['Best Line', 'Bestline'],
  'Haithem': ['Haithem', 'Al Tanfith - Haithem/Waleed'],
  'Al Tanfith': ['Al tanfith', 'Al Tanfith - Haithem/Waleed'],
  'Behrang': ['Behrang', 'Beharng / cash', 'Behrang /High Mark'],
  'Rashid': ['Rashid', 'Rashid / Digitech'],
  'Bassam': ['Bassam'],
  'Nawras Print': ['Nawras Print'],
  'Fatemeh': ['Fatemeh', 'Fateme'],
  'Blackdot': ['Blackdot'],
  'W Hotel': ['W Hotel'],
  'Foto Souq': ['Foto Souq', 'Fotoflash'],
};

// Client name normalization
const CLIENT_ALIASES: Record<string, string[]> = {
  'Al Fardan Motors': ['Al Fardan Motors', 'Al Fardan motors', 'Alfardan', 'Alfardan Motors', 'Al Fardan Motors- Ferrari', 'Al Fardan Motors-Ferrari'],
  'Fairtrade Auto Services': ['Fairtrade Auto Service', 'Fairtrade Auto Services', 'Fair Trade Auto Services', 'Fair Trade Auto Service', 'Fairtrade Auto', 'Fairtrade Auto Services LLC'],
  'Omantel': ['Omantel'],
  'Al Jenaibi International': ['Al Jenaibi International', 'Al Jenaibi International Automobiles', 'Al Jenaibi International Automobiles LLC'],
  'EGM': ['EGM', 'Emirates Gift Market', 'Emirates Gift Market - EGM'],
  'Al Hashar Group': ['Al Hashar Auto', 'Al Hashar Group'],
  'BRF': ['BRF', 'MBRF'],
  'ICRC': ['ICRC'],
  'Al Ahly Sabbour': ['Al Ahly Sabbour', 'Al Ahly Sabbour X Oman'],
  'BMW': ['BMW', 'BMW Club Oman'],
  'NBO': ['NBO'],
  'OCEC': ['OCEC'],
  'Saud Bahwan Group': ['Saud Bhawan Group', 'Saud Bahwan Group'],
};

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private categoryMap = new Map<string, string>(); // name -> id
  private vendorMap = new Map<string, string>(); // normalized name -> id
  private clientMap = new Map<string, string>(); // normalized name -> id

  constructor(private prisma: PrismaService) {}

  /**
   * Initialize categories, vendor map, client map
   */
  async initialize() {
    // Seed categories
    for (const cat of CATEGORIES) {
      const existing = await this.prisma.category.upsert({
        where: { name: cat.name },
        update: { keywords: cat.keywords },
        create: { name: cat.name, keywords: cat.keywords },
      });
      this.categoryMap.set(cat.name, existing.id);
    }
    this.logger.log(`Initialized ${this.categoryMap.size} categories`);
  }

  /**
   * Normalize a vendor name using the alias map
   */
  normalizeVendorName(raw: string): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length < 2) return null;

    // Skip numeric values that leaked into vendor column
    if (/^-?[\d.]+$/.test(trimmed)) return null;
    if (trimmed === '#DIV/0!' || trimmed === 'Vendor' || trimmed === 'Vendor ') return null;
    if (trimmed.toLowerCase() === 'cancel' || trimmed.toLowerCase() === 'not paid') return null;

    // Check alias map
    for (const [normalized, aliases] of Object.entries(VENDOR_ALIASES)) {
      if (aliases.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
        return normalized;
      }
    }

    // Return as-is if no alias found (will be created as new vendor)
    return trimmed;
  }

  /**
   * Normalize a client name
   */
  normalizeClientName(raw: string): string {
    if (!raw) return 'Unknown Client';
    const trimmed = raw.trim();

    for (const [normalized, aliases] of Object.entries(CLIENT_ALIASES)) {
      if (aliases.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
        return normalized;
      }
    }
    return trimmed;
  }

  /**
   * Auto-categorize an item based on its description
   */
  categorizeItem(description: string): string | null {
    const lower = description.toLowerCase();
    for (const cat of CATEGORIES) {
      if (cat.keywords.some(kw => lower.includes(kw))) {
        return cat.name;
      }
    }
    return null;
  }

  /**
   * Get or create a vendor by normalized name
   */
  async getOrCreateVendor(normalizedName: string, rawName: string): Promise<string> {
    if (this.vendorMap.has(normalizedName)) {
      return this.vendorMap.get(normalizedName)!;
    }

    const existing = await this.prisma.vendor.findUnique({ where: { name: normalizedName } });
    if (existing) {
      // Add alias if new
      if (!existing.aliases.includes(rawName)) {
        await this.prisma.vendor.update({
          where: { id: existing.id },
          data: { aliases: { push: rawName } },
        });
      }
      this.vendorMap.set(normalizedName, existing.id);
      return existing.id;
    }

    const created = await this.prisma.vendor.create({
      data: {
        name: normalizedName,
        aliases: rawName !== normalizedName ? [rawName] : [],
      },
    });
    this.vendorMap.set(normalizedName, created.id);
    return created.id;
  }

  /**
   * Get or create a client
   */
  async getOrCreateClient(normalizedName: string, rawName: string): Promise<string> {
    if (this.clientMap.has(normalizedName)) {
      return this.clientMap.get(normalizedName)!;
    }

    const existing = await this.prisma.client.findUnique({ where: { name: normalizedName } });
    if (existing) {
      if (!existing.aliases.includes(rawName)) {
        await this.prisma.client.update({
          where: { id: existing.id },
          data: { aliases: { push: rawName } },
        });
      }
      this.clientMap.set(normalizedName, existing.id);
      return existing.id;
    }

    const created = await this.prisma.client.create({
      data: {
        name: normalizedName,
        aliases: rawName !== normalizedName ? [rawName] : [],
      },
    });
    this.clientMap.set(normalizedName, created.id);
    return created.id;
  }

  /**
   * Parse a single Excel cost sheet
   */
  parseExcelFile(filePath: string): {
    company: string;
    date: string | null;
    subject: string;
    items: Array<{
      itemNumber: number;
      description: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
      unitSelling: number;
      totalSelling: number;
      vendorRaw: string | null;
    }>;
  } | null {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Extract header info
      const company = sheet['B3']?.v?.toString().trim() || 'Unknown';
      const date = sheet['B4']?.v?.toString().trim() || null;
      const subject = sheet['B5']?.v?.toString().trim() || 'Unknown Subject';

      // Extract line items starting from row 10
      const items: any[] = [];
      let row = 10;
      let emptyRows = 0;

      while (emptyRows < 3 && row < 100) {
        const descCell = sheet[`B${row}`];
        const desc = descCell?.v?.toString().trim();

        if (!desc || desc.length < 4) {
          emptyRows++;
          row++;
          continue;
        }

        // Skip total/subtotal rows
        const descLower = desc.toLowerCase();
        if (['sub total', 'subtotal', 'total', 'vat 5%', 'vat', 'delivery timeline'].some(s => descLower.includes(s))) {
          row++;
          continue;
        }

        // Skip notes rows
        if (descLower.startsWith('note:') || descLower.startsWith('delivery')) {
          row++;
          continue;
        }

        emptyRows = 0;

        const qty = this.getNumericValue(sheet[`C${row}`]);
        const unitCost = this.getNumericValue(sheet[`D${row}`]);
        const totalCost = this.getNumericValue(sheet[`E${row}`]);
        const unitSelling = this.getNumericValue(sheet[`F${row}`]);
        const totalSelling = this.getNumericValue(sheet[`G${row}`]);
        const vendorCell = sheet[`I${row}`];
        let vendorRaw: string | null = null;

        if (vendorCell?.v && typeof vendorCell.v === 'string') {
          vendorRaw = vendorCell.v.trim();
        }

        items.push({
          itemNumber: items.length + 1,
          description: desc,
          quantity: qty || 1,
          unitCost: unitCost || 0,
          totalCost: totalCost || 0,
          unitSelling: unitSelling || 0,
          totalSelling: totalSelling || 0,
          vendorRaw,
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
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  /**
   * Import a single cost sheet file into the database
   */
  async importFile(filePath: string, year: number): Promise<{ success: boolean; jobNumber?: string; error?: string }> {
    const fileName = path.basename(filePath);

    // Extract job number from filename
    const jobMatch = fileName.match(/^(\d+)/);
    const jobNumber = jobMatch ? jobMatch[1] : `UNK-${Date.now()}`;

    // Check if already imported
    const existing = await this.prisma.project.findUnique({ where: { jobNumber } });
    if (existing) {
      return { success: false, jobNumber, error: 'Already imported' };
    }

    // Parse file
    const parsed = this.parseExcelFile(filePath);
    if (!parsed || parsed.items.length === 0) {
      return { success: false, jobNumber, error: 'Failed to parse or no items found' };
    }

    // Normalize client
    const normalizedClient = this.normalizeClientName(parsed.company);
    const clientId = await this.getOrCreateClient(normalizedClient, parsed.company);

    // Parse date
    let parsedDate: Date | null = null;
    if (parsed.date) {
      try {
        // Handle DD.MM.YYYY format
        const parts = parsed.date.split('.');
        if (parts.length === 3) {
          parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      } catch {}
    }

    // Calculate totals
    const totalCost = parsed.items.reduce((sum, i) => sum + (i.totalCost || 0), 0);
    const totalSell = parsed.items.reduce((sum, i) => sum + (i.totalSelling || 0), 0);
    const marginPct = totalSell > 0 ? ((totalSell - totalCost) / totalSell) * 100 : 0;

    // Create project with line items
    const project = await this.prisma.project.create({
      data: {
        jobNumber,
        clientId,
        subject: parsed.subject,
        date: parsedDate,
        year,
        totalCost,
        totalSell,
        marginPct,
        sourceFile: fileName,
      },
    });

    // Create line items
    for (const item of parsed.items) {
      // Categorize
      const categoryName = this.categorizeItem(item.description);
      const categoryId = categoryName ? this.categoryMap.get(categoryName) : null;

      // Normalize vendor
      let vendorId: string | null = null;
      if (item.vendorRaw) {
        const normalizedVendor = this.normalizeVendorName(item.vendorRaw);
        if (normalizedVendor) {
          vendorId = await this.getOrCreateVendor(normalizedVendor, item.vendorRaw);
        }
      }

      const marginAmount = item.totalSelling - item.totalCost;
      const marginPctItem = item.totalSelling > 0 ? (marginAmount / item.totalSelling) * 100 : 0;

      await this.prisma.lineItem.create({
        data: {
          projectId: project.id,
          itemNumber: item.itemNumber,
          description: item.description,
          categoryId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          unitSelling: item.unitSelling,
          totalSelling: item.totalSelling,
          marginAmount,
          marginPct: marginPctItem,
          vendorId,
          vendorRaw: item.vendorRaw,
        },
      });
    }

    return { success: true, jobNumber };
  }

  /**
   * Bulk import all cost sheets from a directory
   */
  async importDirectory(dirPath: string, year: number): Promise<{
    total: number;
    imported: number;
    skipped: number;
    errors: number;
    details: any[];
  }> {
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx'));
    const results = { total: files.length, imported: 0, skipped: 0, errors: 0, details: [] as any[] };

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const result = await this.importFile(filePath, year);

      if (result.success) {
        results.imported++;
      } else if (result.error === 'Already imported') {
        results.skipped++;
      } else {
        results.errors++;
      }

      results.details.push({ file, ...result });
    }

    return results;
  }

  /**
   * Import from uploaded file buffer
   */
  async importFromBuffer(buffer: Buffer, fileName: string, year: number): Promise<any> {
    const tempPath = path.join('/tmp', `upload-${Date.now()}-${fileName}`);
    fs.writeFileSync(tempPath, buffer);
    try {
      const result = await this.importFile(tempPath, year);
      return result;
    } finally {
      fs.unlinkSync(tempPath);
    }
  }
}
