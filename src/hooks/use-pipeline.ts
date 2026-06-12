import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  pipelineService,
  type BuildCostSheetParams,
  type ApprovalParams,
  type SendQuotationParams,
} from "@/services/pipeline-service";
import { TIME_CONSTANTS } from "@/lib/constants/pipeline";

// Query keys for consistent cache management
export const PIPELINE_QUERY_KEYS = {
  enquiries: ['pipeline-enquiries'] as const,
  costSheets: ['pipeline-cost-sheets'] as const,
} as const;

/**
 * Hook for fetching new enquiries in the pipeline
 */
export function usePipelineEnquiries() {
  return useQuery({
    queryKey: PIPELINE_QUERY_KEYS.enquiries,
    queryFn: () => pipelineService.getNewEnquiries(),
    staleTime: TIME_CONSTANTS.STALE_TIME_MS,
    meta: {
      errorMessage: "Failed to fetch pipeline enquiries",
    },
  });
}

/**
 * Hook for fetching draft cost sheets with computed confidence scores
 */
export function useDraftCostSheets() {
  return useQuery({
    queryKey: PIPELINE_QUERY_KEYS.costSheets,
    queryFn: () => pipelineService.getDraftCostSheets(),
    staleTime: TIME_CONSTANTS.STALE_TIME_MS,
    meta: {
      errorMessage: "Failed to fetch cost sheets",
    },
  });
}

/**
 * Hook for building cost sheets from enquiries
 */
export function useBuildCostSheet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (params: BuildCostSheetParams) =>
      pipelineService.buildCostSheetFromEnquiry(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEYS.enquiries });
      queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEYS.costSheets });
      toast({
        title: "Draft cost sheet created",
        description: "Review and approve the pricing.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error building cost sheet",
        description: error.message,
        variant: "destructive",
      });
    },
    meta: {
      errorMessage: "Failed to build cost sheet",
    },
  });
}

/**
 * Hook for approving or rejecting cost sheets
 */
export function useApproveCostSheet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (params: ApprovalParams) =>
      pipelineService.approveCostSheet(params),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEYS.costSheets });
      queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEYS.enquiries });
      queryClient.invalidateQueries({ queryKey: ["quotations"] });

      const { action } = variables;
      if (action === 'approved' && data.quotation) {
        toast({
          title: "Approved — Quotation created",
          description: `Quotation #${data.quotation.id} is ready.`,
        });
      } else if (action === 'rejected') {
        toast({
          title: "Cost sheet rejected",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error processing approval",
        description: error.message,
        variant: "destructive",
      });
    },
    meta: {
      errorMessage: "Failed to process cost sheet approval",
    },
  });
}

/**
 * Hook for sending quotations via Gmail
 */
export function useSendQuotation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (params: SendQuotationParams) =>
      pipelineService.sendQuotation(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEYS.costSheets });
      queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEYS.enquiries });
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast({
        title: "Gmail draft opened",
        description: "Review the email and click Send in Gmail.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error preparing send",
        description: error.message,
        variant: "destructive",
      });
    },
    meta: {
      errorMessage: "Failed to send quotation",
    },
  });
}

/**
 * Hook that provides derived pipeline state and statistics
 */
export function usePipelineStats() {
  const enquiriesQuery = usePipelineEnquiries();
  const costSheetsQuery = useDraftCostSheets();

  const stats = {
    newEnquiries: enquiriesQuery.data?.filter((e) => e.status === 'new') ?? [],
    draftSheets: costSheetsQuery.data?.filter((s) => s.status === 'draft') ?? [],
    approvedSheets: costSheetsQuery.data?.filter((s) => s.status === 'approved') ?? [],
    isLoading: enquiriesQuery.isLoading || costSheetsQuery.isLoading,
    error: enquiriesQuery.error || costSheetsQuery.error,
  };

  return {
    ...stats,
    counts: {
      newEnquiries: stats.newEnquiries.length,
      draftSheets: stats.draftSheets.length,
      approvedSheets: stats.approvedSheets.length,
    },
  };
}