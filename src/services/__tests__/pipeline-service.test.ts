import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineService } from '../pipeline-service';
import { supabase } from '@/lib/supabase';
import { ENQUIRY_STATUSES, COST_SHEET_STATUSES } from '@/lib/constants/pipeline';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// Mock confidence calculation
vi.mock('@/lib/confidence', () => ({
  computeLineConfidence: vi.fn(() => ({ score: 85, bucket: 'high', label: 'Strong match' })),
  computeSheetConfidence: vi.fn(() => 82),
  CONFIDENCE_COLORS: {},
  CONFIDENCE_DOT_COLORS: {},
}));

describe('PipelineService', () => {
  let service: PipelineService;
  let mockSupabaseFrom: any;

  beforeEach(() => {
    service = new PipelineService();
    mockSupabaseFrom = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    };
    vi.mocked(supabase.from).mockReturnValue(mockSupabaseFrom);
  });

  describe('getNewEnquiries', () => {
    it('should fetch enquiries with pipeline statuses', async () => {
      const mockEnquiries = [
        { id: '1', status: 'new', client: 'Test Client' },
        { id: '2', status: 'in_progress', client: 'Another Client' },
      ];

      mockSupabaseFrom.select.mockResolvedValue({
        data: mockEnquiries,
        error: null,
      });

      const result = await service.getNewEnquiries();

      expect(supabase.from).toHaveBeenCalledWith('enquiries');
      expect(mockSupabaseFrom.select).toHaveBeenCalledWith('*');
      expect(mockSupabaseFrom.in).toHaveBeenCalledWith('status', [
        ENQUIRY_STATUSES.NEW,
        ENQUIRY_STATUSES.IN_PROGRESS,
        ENQUIRY_STATUSES.DRAFTING,
        ENQUIRY_STATUSES.APPROVED,
        ENQUIRY_STATUSES.QUOTED,
      ]);
      expect(result).toEqual(mockEnquiries);
    });

    it('should throw error when Supabase returns error', async () => {
      mockSupabaseFrom.select.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(service.getNewEnquiries()).rejects.toThrow(
        'Failed to fetch enquiries: Database error'
      );
    });

    it('should return empty array when no data', async () => {
      mockSupabaseFrom.select.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.getNewEnquiries();
      expect(result).toEqual([]);
    });
  });

  describe('parseEnquiryDescription', () => {
    it('should parse description into line items', () => {
      const description = 'Item 1\nItem 2;\n• Item 3\n- Item 4';
      const result = (service as any).parseEnquiryDescription(description);

      expect(result).toEqual(['Item 1', 'Item 2', 'Item 3', 'Item 4']);
    });

    it('should filter out short items', () => {
      const description = 'A\nValid item description\nB';
      const result = (service as any).parseEnquiryDescription(description);

      expect(result).toEqual(['Valid item description']);
    });

    it('should return default item for empty description', () => {
      const result = (service as any).parseEnquiryDescription('');
      expect(result).toEqual(['Service item']);
    });
  });

  describe('buildCostSheetFromEnquiry', () => {
    it('should create cost sheet and items from enquiry', async () => {
      const mockEnquiry = {
        id: '1',
        title: 'Test Project',
        client: 'Test Client',
        description: 'Item 1\nItem 2',
        enquiryNumber: 'ENQ-001',
      };

      const mockSheet = { id: 'sheet-1', jobNumber: 'ENQ-001' };
      const mockItems = [
        { id: 'item-1', description: 'Item 1' },
        { id: 'item-2', description: 'Item 2' },
      ];

      // Mock create cost sheet
      mockSupabaseFrom.select.mockResolvedValueOnce({
        data: mockSheet,
        error: null,
      });

      // Mock match pricing RPC calls
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [{
          item_label: 'Matched Item',
          typical_cost: 100,
          typical_sell: 130,
          match_type: 'exact',
          score: 0.95
        }],
      });

      // Mock create items
      mockSupabaseFrom.select
        .mockResolvedValueOnce({ data: mockItems[0], error: null })
        .mockResolvedValueOnce({ data: mockItems[1], error: null });

      // Mock update enquiry status
      mockSupabaseFrom.update.mockResolvedValue({ error: null });

      const result = await service.buildCostSheetFromEnquiry({ enquiry: mockEnquiry });

      expect(result.sheet).toEqual(mockSheet);
      expect(result.items).toHaveLength(2);

      // Verify cost sheet creation
      expect(mockSupabaseFrom.insert).toHaveBeenCalledWith({
        jobNumber: 'ENQ-001',
        client: 'Test Client',
        event: 'Test Project',
        date: expect.any(String),
        status: COST_SHEET_STATUSES.DRAFT,
        enquiry_id: '1',
      });

      // Verify enquiry status update
      expect(mockSupabaseFrom.update).toHaveBeenCalledWith({
        status: ENQUIRY_STATUSES.DRAFTING,
      });
    });
  });

  describe('getConfidenceBucket', () => {
    it('should return correct bucket for high confidence', () => {
      expect(service.getConfidenceBucket(90)).toBe('high');
      expect(service.getConfidenceBucket(80)).toBe('high');
    });

    it('should return correct bucket for medium confidence', () => {
      expect(service.getConfidenceBucket(70)).toBe('medium');
      expect(service.getConfidenceBucket(50)).toBe('medium');
    });

    it('should return correct bucket for low confidence', () => {
      expect(service.getConfidenceBucket(30)).toBe('low');
      expect(service.getConfidenceBucket(1)).toBe('low');
    });

    it('should return none for zero confidence', () => {
      expect(service.getConfidenceBucket(0)).toBe('none');
    });
  });

  describe('formatOMR', () => {
    it('should format numbers correctly', () => {
      expect((service as any).formatOMR(123.456)).toBe('123.456 OMR');
      expect((service as any).formatOMR(0)).toBe('0.000 OMR');
      expect((service as any).formatOMR(1000)).toBe('1,000.000 OMR');
    });

    it('should handle null and undefined', () => {
      expect((service as any).formatOMR(null)).toBe('0.000 OMR');
      expect((service as any).formatOMR(undefined)).toBe('0.000 OMR');
    });
  });

  describe('roundTo3', () => {
    it('should round to 3 decimal places', () => {
      expect((service as any).roundTo3(123.4567)).toBe(123.457);
      expect((service as any).roundTo3(123.4564)).toBe(123.456);
      expect((service as any).roundTo3(123)).toBe(123);
    });
  });

  describe('buildGmailComposeUrl', () => {
    it('should create proper Gmail compose URL', () => {
      const url = (service as any).buildGmailComposeUrl(
        'test@example.com',
        'Test Subject',
        'Test Body'
      );

      expect(url).toContain('https://mail.google.com/mail/');
      expect(url).toContain('to=test%40example.com');
      expect(url).toContain('su=Test+Subject');
      expect(url).toContain('body=Test+Body');
    });
  });
});

// Integration tests for error scenarios
describe('PipelineService Error Handling', () => {
  let service: PipelineService;

  beforeEach(() => {
    service = new PipelineService();
  });

  it('should handle Supabase connection errors gracefully', async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error('Connection failed');
    });

    await expect(service.getNewEnquiries()).rejects.toThrow('Connection failed');
  });

  it('should handle missing enquiry data in buildCostSheet', async () => {
    const invalidEnquiry = { id: '', title: '', client: '', description: '' };

    await expect(
      service.buildCostSheetFromEnquiry({ enquiry: invalidEnquiry })
    ).rejects.toThrow();
  });
});

// Performance tests
describe('PipelineService Performance', () => {
  let service: PipelineService;

  beforeEach(() => {
    service = new PipelineService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should cache repeated confidence calculations', () => {
    const bucket1 = service.getConfidenceBucket(85);
    const bucket2 = service.getConfidenceBucket(85);

    expect(bucket1).toBe(bucket2);
    expect(bucket1).toBe('high');
  });

  it('should handle large datasets efficiently', async () => {
    const largeEnquiryList = Array.from({ length: 1000 }, (_, i) => ({
      id: `${i}`,
      status: 'new',
      client: `Client ${i}`,
    }));

    const mockSupabaseFrom = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: largeEnquiryList,
        error: null,
      }),
    };
    vi.mocked(supabase.from).mockReturnValue(mockSupabaseFrom);

    const startTime = Date.now();
    const result = await service.getNewEnquiries();
    const endTime = Date.now();

    expect(result).toHaveLength(1000);
    expect(endTime - startTime).toBeLessThan(100); // Should be fast
  });
});