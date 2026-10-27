/**
 * Amounts a customer pays or gets back, on the payment and refund screens.
 * Same in every language: en-US grouping, two decimals, then MXN. Example: $450.00 MXN.
 * This screen never shows a commission or a professional's share.
 */
export function formatCustomerMXN(amount: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(amount);
  return `$${formatted} MXN`;
}
