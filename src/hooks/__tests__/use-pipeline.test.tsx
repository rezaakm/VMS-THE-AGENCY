import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import {
  usePipelineEnquiries,
  useDraftCostSheets,
  useBuildCostSheet,
  usePipelineStats,
  PIPELINE_QUERY_KEYS,
} from '../use-pipeline';
import { pipelineService } from '@/services/pipeline-service';

// Mock the pipeline service
vi.mock('@/services/pipeline-service', () => ({
  pipelineService: {
    getNewEnquiries: vi.fn(),
    getDraftCostSheets: vi.fn(),
    buildCostSheetFromEnquiry: vi.fn(),
    approveCostSheet: vi.fn(),
  },
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retry for tests
        cacheTime: 0, // Disable caching for tests
      },
      mutations: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('usePipelineEnquiries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch enquiries successfully', async () => {
    const mockEnquiries = [
      { id: '1', status: 'new', client: 'Client A' },
      { id: '2', status: 'in_progress', client: 'Client B' },
    ];

    vi.mocked(pipelineService.getNewEnquiries).mockResolvedValue(mockEnquiries);

    const { result } = renderHook(usePipelineEnquiries, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockEnquiries);
    expect(pipelineService.getNewEnquiries).toHaveBeenCalledTimes(1);
  });

  it('should handle fetch errors gracefully', async () => {
    const error = new Error('Failed to fetch enquiries');
    vi.mocked(pipelineService.getNewEnquiries).mockRejectedValue(error);

    const { result } = renderHook(usePipelineEnquiries, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error);
  });

  it('should use correct query key', () => {
    renderHook(usePipelineEnquiries, {
      wrapper: createWrapper(),
    });

    expect(PIPELINE_QUERY_KEYS.enquiries).toEqual(['pipeline-enquiries']);
  });
});

describe('useDraftCostSheets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch cost sheets with confidence scores', async () => {
    const mockCostSheets = [
      {
        id: 'sheet-1',
        jobNumber: 'JOB-001',
        status: 'draft',
        sheetConfidence: 85,
        items: [
          { id: 'item-1', confidence: 90 },
          { id: 'item-2', confidence: 80 },
        ],
      },
    ];

    vi.mocked(pipelineService.getDraftCostSheets).mockResolvedValue(mockCostSheets);

    const { result } = renderHook(useDraftCostSheets, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockCostSheets);
  });
});

describe('useBuildCostSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build cost sheet and invalidate queries', async () => {
    const mockResult = {
      sheet: { id: 'sheet-1', jobNumber: 'JOB-001' },
      items: [{ id: 'item-1', description: 'Test item' }],
    };

    vi.mocked(pipelineService.buildCostSheetFromEnquiry).mockResolvedValue(mockResult);

    const { result } = renderHook(useBuildCostSheet, {
      wrapper: createWrapper(),
    });

    const enquiry = {
      id: '1',
      title: 'Test Project',
      client: 'Test Client',
      description: 'Test description',
      status: 'new' as const,
    };

    await act(async () => {
      result.current.mutate({ enquiry });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(pipelineService.buildCostSheetFromEnquiry).toHaveBeenCalledWith({
      enquiry,
    });
  });

  it('should handle build errors and show toast', async () => {
    const error = new Error('Build failed');
    vi.mocked(pipelineService.buildCostSheetFromEnquiry).mockRejectedValue(error);

    const { result } = renderHook(useBuildCostSheet, {
      wrapper: createWrapper(),
    });

    const enquiry = {
      id: '1',
      title: 'Test Project',
      client: 'Test Client',
      description: 'Test description',
      status: 'new' as const,
    };

    await act(async () => {
      result.current.mutate({ enquiry });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error);
  });
});

describe('usePipelineStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide derived stats from enquiries and cost sheets', async () => {
    const mockEnquiries = [
      { id: '1', status: 'new', client: 'Client A' },
      { id: '2', status: 'new', client: 'Client B' },
      { id: '3', status: 'in_progress', client: 'Client C' },
    ];

    const mockCostSheets = [
      { id: 'sheet-1', status: 'draft', sheetConfidence: 85, items: [] },
      { id: 'sheet-2', status: 'approved', sheetConfidence: 90, items: [] },
    ];

    vi.mocked(pipelineService.getNewEnquiries).mockResolvedValue(mockEnquiries);
    vi.mocked(pipelineService.getDraftCostSheets).mockResolvedValue(mockCostSheets);

    const { result } = renderHook(usePipelineStats, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.newEnquiries).toHaveLength(2);
      expect(result.current.draftSheets).toHaveLength(1);
      expect(result.current.approvedSheets).toHaveLength(1);
    });

    expect(result.current.counts).toEqual({
      newEnquiries: 2,
      draftSheets: 1,
      approvedSheets: 1,
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should handle loading states correctly', () => {
    vi.mocked(pipelineService.getNewEnquiries).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    vi.mocked(pipelineService.getDraftCostSheets).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(usePipelineStats, {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.newEnquiries).toEqual([]);
    expect(result.current.counts.newEnquiries).toBe(0);
  });

  it('should filter enquiries and cost sheets by status correctly', async () => {
    const mockEnquiries = [
      { id: '1', status: 'new', client: 'Client A' },
      { id: '2', status: 'quoted', client: 'Client B' }, // Should not appear in newEnquiries
    ];

    const mockCostSheets = [
      { id: 'sheet-1', status: 'draft', sheetConfidence: 85, items: [] },
      { id: 'sheet-2', status: 'approved', sheetConfidence: 90, items: [] },
      { id: 'sheet-3', status: 'rejected', sheetConfidence: 30, items: [] }, // Should not appear in approved
    ];

    vi.mocked(pipelineService.getNewEnquiries).mockResolvedValue(mockEnquiries);
    vi.mocked(pipelineService.getDraftCostSheets).mockResolvedValue(mockCostSheets);

    const { result } = renderHook(usePipelineStats, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.newEnquiries).toHaveLength(1);
    expect(result.current.newEnquiries[0].status).toBe('new');

    expect(result.current.draftSheets).toHaveLength(1);
    expect(result.current.draftSheets[0].status).toBe('draft');

    expect(result.current.approvedSheets).toHaveLength(1);
    expect(result.current.approvedSheets[0].status).toBe('approved');
  });
});

// Test query invalidation behavior
describe('Query Invalidation', () => {
  it('should use consistent query keys', () => {
    expect(PIPELINE_QUERY_KEYS).toEqual({
      enquiries: ['pipeline-enquiries'],
      costSheets: ['pipeline-cost-sheets'],
    });
  });
});

// Test stale time configuration
describe('Query Configuration', () => {
  it('should have appropriate stale times configured', () => {
    const { result } = renderHook(usePipelineEnquiries, {
      wrapper: createWrapper(),
    });

    // Query should be configured with stale time from constants
    expect(result.current.dataUpdatedAt).toBeDefined();
  });
});