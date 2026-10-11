// What a queued payment is for, read straight from the Payment document the
// server already returns. Labels only, no financial maths.
export const describePaymentContents = (payment) => {
  const monthly = payment.pendingMonthlyIds?.length ?? 0;
  const extra = payment.pendingExtraIds?.length ?? 0;
  const advance = payment.advanceAmount ?? 0;

  const parts = [];
  if (monthly) parts.push(`${monthly} monthly due${monthly > 1 ? "s" : ""}`);
  if (extra) parts.push(`${extra} extra charge${extra > 1 ? "s" : ""}`);
  if (advance) parts.push(`৳${advance.toLocaleString()} to credit balance`);

  return parts.join(" · ") || "—";
};