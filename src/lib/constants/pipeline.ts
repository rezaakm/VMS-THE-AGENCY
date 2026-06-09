// Pipeline status constants and types

export const ENQUIRY_STATUSES = {
  NEW: "new",
  IN_PROGRESS: "in_progress",
  DRAFTING: "drafting",
  APPROVED: "approved",
  QUOTED: "quoted",
  SENT: "sent",
  WON: "won",
  LOST: "lost",
} as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[keyof typeof ENQUIRY_STATUSES];

export const COST_SHEET_STATUSES = {
  DRAFT: "draft",
  APPROVED: "approved",
  REJECTED: "rejected",
  QUOTED: "quoted",
} as const;

export type CostSheetStatus = (typeof COST_SHEET_STATUSES)[keyof typeof COST_SHEET_STATUSES];

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 80,
  MEDIUM: 50,
} as const;

export const TIME_CONSTANTS = {
  STALE_TIME_MS: 30_000,
} as const;
