// A payment's allocations can include months paid LATER from its advance
// credit. Only allocations for the charges selected at payment time are
// "direct". Direct allocations + advanceAmount always equal payment.amount.

const ADVANCE_LABEL = "Advance payment (added to credit)";

export const getDirectAllocations = (payment, allocations) => {
  if (!(payment.advanceAmount > 0)) return allocations; // nothing was banked
  const direct = new Set(
    [...(payment.pendingMonthlyIds || []), ...(payment.pendingExtraIds || [])].map(String),
  );
  return allocations.filter((a) => direct.has(String(a.chargeId)));
};

export const buildAdvanceItem = (payment) =>
  payment.advanceAmount > 0
    ? {
        type: "advance",
        description: ADVANCE_LABEL,
        label: ADVANCE_LABEL, // frontend history reads `label` for non-monthly rows
        amount: payment.advanceAmount,
      }
    : null;