// client/src/components/member/OverviewCard.jsx
//
// CHANGE: breakdown data now received as props from MemberDashboard
// instead of fetched internally. MemberDashboard owns the fetch so the
// sidebar and OverviewCard share one API call with no duplication.
//
// Props received:
//   breakdown          — the breakdown response object (or null)
//   loadingBreakdown   — boolean, true while fetch is in flight
//   onRefreshBreakdown — callback, OverviewCard calls this after payment
//                        success to tell the parent to re-fetch
//   onGoToPayment      — navigate to payment tab
//   memberProfile      — member data from AppContext
//
// All display logic, skeleton, paid/due states, HistoryStrip — unchanged.
// buildDescription(), Intl month names, t() calls — all identical.

import React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, AlertCircle, ArrowRight,
  Calendar, Receipt, TrendingUp,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const Pulse = ({ className }) => (
  <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />
);

const OverviewSkeleton = () => (
  <div className="space-y-4">
    <div className="rounded-2xl border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3 flex-1">
          <Pulse className="h-4 w-28" />
          <Pulse className="h-8 w-36" />
          <Pulse className="h-3 w-52" />
        </div>
        <Pulse className="h-10 w-28 rounded-xl" />
      </div>
      <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4">
        <Pulse className="h-10" />
        <Pulse className="h-10" />
        <Pulse className="h-10" />
      </div>
    </div>
    <div className="flex gap-2">
      {Array.from({ length: 12 }).map((_, i) => (
        <Pulse key={i} className="flex-1 h-10 rounded-lg" />
      ))}
    </div>
  </div>
);

export default function OverviewCard({
  onGoToPayment,
  memberProfile,
  breakdown,
  loadingBreakdown,
  onRefreshBreakdown,
}) {
  const { t } = useTranslation("overview");

  // Show skeleton while parent is fetching
  if (loadingBreakdown) return <OverviewSkeleton />;

  // Destructure with safe defaults
  const totalDue      = breakdown?.totalDue        ?? 0;
  const totalMonthly  = breakdown?.totalMonthlyDue ?? 0;
  const totalExtra    = breakdown?.totalExtraDue   ?? 0;
  const isPaid        = breakdown?.paymentStatus   === "Paid";
  const currentFee    = breakdown?.currentFee      ?? 0;
  const nextDueMonth  = breakdown?.nextDueMonth    ?? null;
  const lastPayment   = breakdown?.lastPayment     ?? null;
  const last12        = breakdown?.last12Months    ?? [];
  const unpaidMonthly = breakdown?.unpaidMonthlyCharges ?? [];
  const unpaidExtra   = breakdown?.unpaidExtraCharges   ?? [];
  const firstName     = memberProfile?.name?.split(" ")[0] ?? "there";

  const buildDescription = () => {
    const mc = unpaidMonthly.length;
    const ec = unpaidExtra.length;
    if (mc > 0 && ec > 0) {
      return t(mc > 1 || ec > 1 ? "description.both_months" : "description.both", {
        monthCount: mc, chargeCount: ec,
      });
    }
    if (mc > 0) return t("description.monthsOnly", { count: mc });
    return t("description.chargesOnly", { count: ec });
  };

  // ── PAID STATE ────────────────────────────────────────────────────────────
  if (isPaid) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0  }}
        transition={{ duration: 0.3  }}
        className="space-y-4"
      >
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-emerald-100 flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-600
                  uppercase tracking-widest mb-1">
                  {t("status.label")}
                </p>
                <p className="text-2xl font-semibold text-emerald-800
                  font-playfair leading-tight">
                  {t("status.allClear", { name: firstName })}
                </p>
                <p className="text-sm text-emerald-600 mt-1.5">
                  {t("status.nothingOwed")}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-emerald-500 uppercase tracking-wide">
                {t("status.monthlyFee")}
              </p>
              <p className="text-xl font-semibold text-emerald-700
                font-playfair mt-0.5">
                ৳{currentFee.toLocaleString()}
              </p>
            </div>
          </div>

          {lastPayment && (
            <div className="mt-5 pt-4 border-t border-emerald-200
              flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <p className="text-[10px] text-emerald-500 uppercase tracking-wide">
                  {t("status.lastPayment")}
                </p>
                <p className="text-sm font-medium text-emerald-800 mt-0.5">
                  ৳{lastPayment.amount.toLocaleString()} ·{" "}
                  {new Date(lastPayment.paidAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              </div>
              {lastPayment.receiptNumber && (
                <div>
                  <p className="text-[10px] text-emerald-500 uppercase tracking-wide">
                    {t("status.receipt")}
                  </p>
                  <p className="text-sm font-mono font-medium text-emerald-800 mt-0.5">
                    {lastPayment.receiptNumber}
                  </p>
                </div>
              )}
              <button
                onClick={onGoToPayment}
                className="ml-auto text-xs font-semibold text-emerald-600
                  hover:text-emerald-800 flex items-center gap-1 transition-colors"
              >
                {t("status.viewHistory")}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <HistoryStrip last12={last12} t={t} />
      </motion.div>
    );
  }

  // ── DUE STATE ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ duration: 0.3  }}
      className="space-y-4"
    >
      <div className="rounded-2xl border border-amber-200 bg-white overflow-hidden">
        <div className="bg-amber-50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-amber-100 flex-shrink-0 mt-0.5">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-600
                  uppercase tracking-widest mb-1">
                  {t("status.outstanding")}
                </p>
                <p className="text-3xl font-semibold text-gray-900
                  font-playfair leading-tight">
                  ৳{totalDue.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-1.5 max-w-sm">
                  {buildDescription()}
                </p>
              </div>
            </div>

            <button
              onClick={onGoToPayment}
              className="flex items-center gap-2 px-5 py-2.5
                bg-[var(--color-primary)] hover:bg-blue-700 active:scale-95
                text-white text-sm font-semibold rounded-xl shadow-sm
                transition-all duration-150 flex-shrink-0 whitespace-nowrap"
            >
              {t("status.viewHistory")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 pt-4 border-t border-amber-200
            grid grid-cols-2 sm:grid-cols-3 gap-4">
            {nextDueMonth && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                    {t("status.oldestUnpaid")}
                  </p>
                  <p className="text-sm font-medium text-gray-700 mt-0.5">
                    {new Date(nextDueMonth.year, nextDueMonth.month - 1)
                      .toLocaleDateString(undefined, {
                        month: "long", year: "numeric",
                      })}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                  {t("status.monthlyFee")}
                </p>
                <p className="text-sm font-medium text-gray-700 mt-0.5">
                  ৳{currentFee.toLocaleString()}
                </p>
              </div>
            </div>
            {lastPayment && (
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                    {t("status.lastPayment")}
                  </p>
                  <p className="text-sm font-medium text-gray-700 mt-0.5">
                    ৳{lastPayment.amount.toLocaleString()} ·{" "}
                    {new Date(lastPayment.paidAt).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short",
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {(totalMonthly > 0 || totalExtra > 0) && (
          <div className="grid grid-cols-2 divide-x divide-gray-100
            border-t border-gray-100 bg-white">
            <div className="px-6 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                  {t("breakdown.monthlyDues")}
                </p>
                <p className="text-base font-semibold text-gray-800 mt-0.5">
                  ৳{totalMonthly.toLocaleString()}
                </p>
              </div>
              <span className="text-[10px] font-medium px-2 py-1
                bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                {t("breakdown.month", { count: unpaidMonthly.length })}
              </span>
            </div>
            <div className="px-6 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                  {t("breakdown.extraCharges")}
                </p>
                <p className="text-base font-semibold text-gray-800 mt-0.5">
                  ৳{totalExtra.toLocaleString()}
                </p>
              </div>
              {unpaidExtra.length > 0 && (
                <span className="text-[10px] font-medium px-2 py-1
                  bg-orange-50 text-orange-700 rounded-full border border-orange-200">
                  {t("breakdown.charge", { count: unpaidExtra.length })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <HistoryStrip last12={last12} t={t} />
    </motion.div>
  );
}

function HistoryStrip({ last12, t }) {
  if (last12.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase
        tracking-widest mb-2.5">
        {t("historyStrip.label")}
      </p>
      <div className="flex gap-1.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}>
        {last12.map(({ month, year, status }) => {
          const monthLabel = new Date(year, month - 1)
            .toLocaleDateString(undefined, { month: "short" });
          return (
            <div
              key={`${month}-${year}`}
              title={`${new Date(year, month - 1)
                .toLocaleDateString(undefined, { month: "long" })} ${year} — ${status}`}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-2
                rounded-xl text-xs font-semibold border cursor-default
                select-none min-w-[44px]
                ${status === "Paid"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-gray-50 border-gray-200 text-gray-500"
                }`}
            >
              <span>{monthLabel}</span>
              <span className="text-[8px] opacity-60 font-normal mt-0.5">
                {String(year).slice(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}