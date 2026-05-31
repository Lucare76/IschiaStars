import { calculatePaymentBreakdown } from "@/lib/hotel-policies";

export function calculateDeposit(totalPrice: number, depositPercent: number): { depositAmount: number; balanceAmount: number } {
  const breakdown = calculatePaymentBreakdown(totalPrice, depositPercent);
  return {
    depositAmount: breakdown.depositAmount,
    balanceAmount: breakdown.balanceAmount
  };
}
