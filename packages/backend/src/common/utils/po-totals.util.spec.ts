import { calculatePOTotals } from './po-totals.util';

describe('calculatePOTotals', () => {
  it('sums line items with discount and tax', () => {
    const result = calculatePOTotals(
      [
        { quantity: 2, unitPrice: 100, discount: 10, taxRate: 5 },
        { quantity: 1, unitPrice: 50, discount: 0, taxRate: 0 },
      ],
      25,
    );

    expect(result.subtotal).toBe(230);
    expect(result.taxAmount).toBe(9);
    expect(result.totalAmount).toBe(264);
  });

  it('handles empty items with shipping only', () => {
    const result = calculatePOTotals([], 100);
    expect(result.subtotal).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.totalAmount).toBe(100);
  });
});
