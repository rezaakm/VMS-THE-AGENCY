export interface POItemInput {
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

export function calculatePOTotals(
  items: POItemInput[],
  shippingCost = 0,
): { subtotal: number; taxAmount: number; totalAmount: number } {
  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      item.quantity *
        item.unitPrice *
        (1 - (item.discount || 0) / 100),
    0,
  );

  const taxAmount = items.reduce(
    (sum, item) =>
      sum +
      (item.quantity *
        item.unitPrice *
        (1 - (item.discount || 0) / 100) *
        (item.taxRate || 0)) /
        100,
    0,
  );

  return {
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount + shippingCost,
  };
}
