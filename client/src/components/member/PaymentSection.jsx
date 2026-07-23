// client/src/components/member/PaymentSection.jsx
//
// CHANGE from previous version:
//   - Removed the earlier isPaid-gated separate "Pay in Advance" card.
//     Advance payment is now folded into the normal Pay Now flow: an
//     always-available "Add extra for future dues (optional)" field lets
//     a member top up any payment with a credit amount, whether or not
//     they currently have other dues selected or outstanding at all.
//   - The Pay Now section is no longer hidden when the member is fully
//     paid up — it stays available purely for advance payment in that case.
//   - Added a standalone "Credit Balance" banner, shown whenever the
//     member has unapplied credit, regardless of their current due status.
//   - Everything else — Opening Balance card, i18next usage, ExportControl,
//     FIFO month selection, regular extra charge checkboxes, receipt
//     download — is unchanged.

import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import {
  CreditCard, CheckCircle2, AlertCircle, ChevronDown,
  ChevronUp, Receipt, Loader2, Wallet, Clock, Info,
  Download, FileText, Sheet, CalendarRange,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../context/AppContext";

const monthName = (month, format = "long") =>
  new Date(2000, month - 1).toLocaleDateString(undefined, { month: format });

const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-gray-100 rounded ${className}`} />
);

const SummaryCardSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 p-5">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-8 w-16" />
    </div>
  </div>
);

const STATUS_STYLES = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending:   "bg-amber-50  text-amber-700   border-amber-200",
  failed:    "bg-red-50    text-red-700     border-red-200",
  rejected:  "bg-red-50    text-red-700     border-red-200",
};

const StatusBadge = ({ status }) => (
  <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold
    rounded-full border ${STATUS_STYLES[status] || "bg-gray-100 text-gray-500"}`}>
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
);

const ExportControl = ({ t }) => {
  const { getToken } = useAppContext();
  const [open,        setOpen]        = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const [startDate,   setStartDate]   = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [endDate,     setEndDate]     = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [downloading, setDownloading] = useState(null);

  const btnRef   = useRef(null);
  const panelRef = useRef(null);
  const BACKEND  = import.meta.env.VITE_BACKEND_URL || "";

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownPos({
        top:   rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current   && !btnRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [open]);

  const handleDownload = async (type) => {
    setDownloading(type);
    try {
      const token    = await getToken();
      const url      = `${BACKEND}/api/reports/me/${type}?startDate=${startDate}&endDate=${endDate}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast.error(err.message || `Failed to generate ${type.toUpperCase()}`);
        return;
      }
      const blob     = await response.blob();
      const blobUrl  = URL.createObjectURL(blob);
      const anchor   = document.createElement("a");
      const filename =
        response.headers.get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ||
        `payment-history-${startDate}-${endDate}.${type}`;
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);
      setOpen(false);
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold
          text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50
          hover:border-gray-300 transition-colors whitespace-nowrap"
      >
        <Download className="h-3.5 w-3.5" />
        {t("export.trigger")}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.13 }}
            style={{
              position: "fixed",
              top:   dropdownPos.top,
              right: dropdownPos.right,
              zIndex: 9999,
            }}
            className="w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-4"
          >
            <p className="text-[10px] font-semibold text-gray-400 uppercase
              tracking-wide mb-3 flex items-center gap-1.5">
              <CalendarRange className="h-3 w-3" />
              {t("export.period")}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">
                  {t("export.from")}
                </label>
                <input
                  type="date" value={startDate} max={endDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full p-1.5 border border-gray-200 rounded-lg
                    text-xs focus:outline-none focus:ring-2
                    focus:ring-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">
                  {t("export.to")}
                </label>
                <input
                  type="date" value={endDate} min={startDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full p-1.5 border border-gray-200 rounded-lg
                    text-xs focus:outline-none focus:ring-2
                    focus:ring-[var(--color-primary)]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {["pdf", "csv"].map(type => (
                <button
                  key={type}
                  onClick={() => handleDownload(type)}
                  disabled={!!downloading}
                  className="flex-1 flex items-center justify-center gap-1.5
                    py-2 text-xs font-semibold text-gray-700 border border-gray-200
                    rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {downloading === type
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : type === "pdf"
                    ? <FileText className="h-3.5 w-3.5" />
                    : <Sheet   className="h-3.5 w-3.5" />
                  }
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function PaymentSection({ onPaymentSuccess }) {
  const { axios, getToken } = useAppContext();

  const { t } = useTranslation("payment");

  const [breakdown,            setBreakdown]            = useState(null);
  const [history,              setHistory]              = useState([]);
  const [selectedMonthlyIds,   setSelectedMonthlyIds]   = useState([]);
  const [selectedExtraIds,     setSelectedExtraIds]     = useState([]);
  const [openingBalanceAmount, setOpeningBalanceAmount] = useState(0);
  const [openingBalanceInput,  setOpeningBalanceInput]  = useState("0");
  // Optional "top up with extra credit" amount — can be combined with a
  // charge selection, or sent alone with nothing else selected.
  const [extraAdvanceInput,    setExtraAdvanceInput]    = useState("0");
  const [extraAdvanceAmount,   setExtraAdvanceAmount]   = useState(0);
  const [loadingData,          setLoadingData]          = useState(true);
  const [loadingHistory,       setLoadingHistory]       = useState(false);
  const [paying,               setPaying]               = useState(false);
  const [historyOpen,          setHistoryOpen]          = useState(false);
  const [expandedPayment,      setExpandedPayment]      = useState(null);

  const fetchBreakdown = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/payments/me/breakdown", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setBreakdown(data);
        setSelectedMonthlyIds([]);
        setSelectedExtraIds([]);
        const openingAmt = data.openingBalanceCharge?.amount ?? 0;
        setOpeningBalanceAmount(openingAmt);
        setOpeningBalanceInput(String(openingAmt));
        setExtraAdvanceInput("0");
        setExtraAdvanceAmount(0);
      }
    } catch {
      toast.error("Failed to load payment data");
    } finally {
      setLoadingData(false);
    }
  }, [axios, getToken]);

  const fetchHistory = useCallback(async () => {
    if (loadingHistory) return;
    setLoadingHistory(true);
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/payments/me/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setHistory(data.history);
    } catch {
      toast.error("Failed to load transaction history");
    } finally {
      setLoadingHistory(false);
    }
  }, [axios, getToken, loadingHistory]);

  useEffect(() => { fetchBreakdown(); }, [fetchBreakdown]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("payment_status");
    if (!status) return;
    window.history.replaceState({}, "", window.location.pathname);
     if (status === "VALID") {
      toast.success("Payment received! Awaiting confirmation from admin.");
      fetchBreakdown();
      onPaymentSuccess?.();
    } else if (status === "FAILED") {
      toast.error("Payment failed. Please try again.");
    } else if (status === "CANCEL") {
      toast("Payment cancelled.", { icon: "ℹ️" });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMonthClick = useCallback((chargeId, index) => {
    const isSelected = selectedMonthlyIds.includes(chargeId);
    if (isSelected) {
      setSelectedMonthlyIds(
        (breakdown?.unpaidMonthlyCharges || [])
          .slice(0, index).map(c => String(c._id))
      );
    } else {
      setSelectedMonthlyIds(
        (breakdown?.unpaidMonthlyCharges || [])
          .slice(0, index + 1).map(c => String(c._id))
      );
    }
  }, [selectedMonthlyIds, breakdown]);

  const handleExtraToggle = useCallback((chargeId) => {
    setSelectedExtraIds(prev =>
      prev.includes(chargeId)
        ? prev.filter(id => id !== chargeId)
        : [...prev, chargeId]
    );
  }, []);

  const handleReceiptDownload = async (paymentId) => {
    try {
      const token    = await getToken();
      const BACKEND  = import.meta.env.VITE_BACKEND_URL || "";
      const response = await fetch(
        `${BACKEND}/api/reports/me/receipt/${paymentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) { toast.error("Failed to download receipt"); return; }
      const blob     = await response.blob();
      const blobUrl  = URL.createObjectURL(blob);
      const anchor   = document.createElement("a");
      const filename =
        response.headers.get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ||
        `receipt-${paymentId}.pdf`;
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Receipt download failed");
    }
  };

  const selectedMonthlyTotal = useMemo(() => {
    if (!breakdown) return 0;
    return breakdown.unpaidMonthlyCharges
      .filter(c => selectedMonthlyIds.includes(String(c._id)))
      .reduce((sum, c) => sum + c.amount, 0);
  }, [breakdown, selectedMonthlyIds]);

  const selectedExtraTotal = useMemo(() => {
    if (!breakdown) return 0;
    const regularExtraTotal = breakdown.unpaidExtraCharges
      .filter(c => selectedExtraIds.includes(String(c._id)))
      .reduce((sum, c) => sum + c.amount, 0);

    const openingBalanceId = breakdown.openingBalanceCharge
      ? String(breakdown.openingBalanceCharge._id)
      : null;
    const openingBalanceSelected = openingBalanceId && selectedExtraIds.includes(openingBalanceId);

    return regularExtraTotal + (openingBalanceSelected ? openingBalanceAmount : 0);
  }, [breakdown, selectedExtraIds, openingBalanceAmount]);

  // Portion that actually clears existing dues — used to compute how
  // much of totalDue remains, independent of any advance top-up.
  const chargesSelectedTotal = selectedMonthlyTotal + selectedExtraTotal;

  // Grand total actually charged to the gateway this transaction.
  const selectedTotal = chargesSelectedTotal + extraAdvanceAmount;

  const hasSelection =
    selectedMonthlyIds.length > 0 ||
    selectedExtraIds.length   > 0 ||
    extraAdvanceAmount        > 0;

  const handlePay = async () => {
    if (!hasSelection) {
      toast.error("Select at least one charge, or add an amount to pay in advance");
      return;
    }
    setPaying(true);
    try {
      const token = await getToken();

      const openingBalanceId = breakdown?.openingBalanceCharge
        ? String(breakdown.openingBalanceCharge._id)
        : null;
      const partialAmounts = {};
      if (openingBalanceId && selectedExtraIds.includes(openingBalanceId)) {
        partialAmounts[openingBalanceId] = openingBalanceAmount;
      }

      const { data } = await axios.post(
        "/api/payments/create",
        {
          selectedMonthlyIds,
          selectedExtraIds,
          partialAmounts,
          advanceAmount: extraAdvanceAmount,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.message || "Failed to start payment");
        setPaying(false);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Payment failed. Try again.");
      setPaying(false);
    }
  };

  const unpaidMonthly    = breakdown?.unpaidMonthlyCharges ?? [];
  const unpaidExtra      = breakdown?.unpaidExtraCharges   ?? [];
  const last12           = breakdown?.last12Months         ?? [];
  const currentFee       = breakdown?.currentFee           ?? 0;
  const totalDue         = breakdown?.totalDue             ?? 0;
  const totalMonthlyDue  = breakdown?.totalMonthlyDue      ?? 0;
  const totalExtraDue    = breakdown?.totalExtraDue        ?? 0;
  const isPaid           = breakdown?.paymentStatus        === "Paid";
  const lastPayment      = breakdown?.lastPayment          ?? null;
  const nextDueMonth     = breakdown?.nextDueMonth         ?? null;
  const pendingPayment   = breakdown?.pendingPayment       ?? null;
  const creditBalance    = breakdown?.creditBalance        ?? 0;
  const unpaidMonthCount = unpaidMonthly.length;
  const remainingAfterSelection = totalDue - chargesSelectedTotal;

  const dueDescription = (() => {
    const mc = unpaidMonthCount;
    const ec = unpaidExtra.length;
    if (mc > 0 && ec > 0) {
      return t("summary.descBoth", { count: mc, monthCount: mc, chargeCount: ec });
    }
    if (mc > 0) return t("summary.descMonthly", { count: mc });
    return t("summary.descExtra", { count: ec });
  })();

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 font-outfit">

      {/* ── Summary card ──────────────────────────────────────────────── */}
      {loadingData ? <SummaryCardSkeleton /> : isPaid ? (
        <div className="rounded-2xl border bg-emerald-50 border-emerald-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-emerald-800">
                {t("summary.allClear")}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {t("summary.allClearSub")}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] text-emerald-500 uppercase tracking-wide">
                {t("summary.monthlyFee")}
              </p>
              <p className="text-xl font-bold text-emerald-700 font-playfair">
                ৳{currentFee.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="bg-amber-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-100 flex-shrink-0 mt-0.5">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-800">
                    {t("summary.outstanding")}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 font-playfair leading-tight mt-0.5">
                    ৳{totalDue.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs leading-relaxed">
                    {dueDescription}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                  {t("summary.monthlyFee")}
                </p>
                <p className="text-xl font-bold text-gray-700 font-playfair">
                  ৳{currentFee.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
            <div className="p-3.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                {t("summary.monthlyDues")}
              </p>
              <p className="text-sm font-bold text-gray-800 mt-0.5">
                ৳{totalMonthlyDue.toLocaleString()}
              </p>
            </div>
            <div className="p-3.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                {t("summary.extraCharges")}
              </p>
              <p className="text-sm font-bold text-gray-800 mt-0.5">
                ৳{totalExtraDue.toLocaleString()}
              </p>
            </div>
          </div>

          {(nextDueMonth || lastPayment) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-4 py-3
              border-t border-gray-100 bg-gray-50/60">
              {nextDueMonth && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                    {t("summary.nextDue")}
                  </p>
                  <p className="text-xs font-semibold text-gray-700 mt-0.5">
                    {new Date(nextDueMonth.year, nextDueMonth.month - 1)
                      .toLocaleDateString(undefined, { month: "short" })}{" "}
                    {nextDueMonth.year}
                  </p>
                </div>
              )}
              {lastPayment && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                    {t("summary.lastPayment")}
                  </p>
                  <p className="text-xs font-semibold text-gray-700 mt-0.5">
                    ৳{lastPayment.amount.toLocaleString()} ·{" "}
                    {new Date(lastPayment.paidAt).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short",
                    })}
                  </p>
                </div>
              )}
              {lastPayment?.receiptNumber && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                    {t("summary.receipt")}
                  </p>
                  <p className="text-[11px] font-mono font-semibold text-gray-600 mt-0.5">
                    {lastPayment.receiptNumber}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Credit balance banner — shown whenever the member has
          unapplied advance-payment credit, regardless of current due
          status. Independent of everything else. ──────────────────── */}
      {!loadingData && creditBalance > 0 && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border
          border-emerald-200 rounded-xl">
          <Wallet className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-800">
              Credit Balance: ৳{creditBalance.toLocaleString()}
            </p>
            <p className="text-emerald-600 text-xs mt-0.5">
              This will be automatically applied to your upcoming monthly dues.
            </p>
          </div>
        </div>
      )}

      {/* ── Pending payment warning ────────────────────────────────────── */}
      {!loadingData && pendingPayment && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border
          border-amber-200 rounded-xl">
          <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800">
              {t("pending.title")}
            </p>
            <p className="text-amber-600 text-xs mt-0.5">
              {t("pending.body", {
                amount: pendingPayment.amount.toLocaleString(),
              })}
            </p>
          </div>
        </div>
      )}

      {!loadingData && breakdown?.awaitingConfirmationPayment && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border
          border-blue-200 rounded-xl">
          <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-blue-800">
              Payment received — awaiting confirmation
            </p>
            <p className="text-blue-600 text-xs mt-0.5">
              We've received your payment of ৳{breakdown.awaitingConfirmationPayment.amount.toLocaleString()}.
              It will be reflected in your dues once confirmed by the admin.
            </p>
          </div>
        </div>
      )}

      {/* ── 12-month history strip ─────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase
          tracking-widest mb-2">
          {t("history12")}
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none" }}>
          {loadingData
            ? Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="flex-shrink-0 w-12 h-10 rounded-lg" />
              ))
            : last12.length > 0
            ? last12.map(({ month, year, status }) => (
                <div
                  key={`${month}-${year}`}
                  title={`${new Date(year, month - 1)
                    .toLocaleDateString(undefined, { month: "long" })} ${year} — ${status}`}
                  className={`flex-shrink-0 flex flex-col items-center px-2.5 py-1.5
                    rounded-lg text-xs font-semibold border cursor-default
                    select-none min-w-[44px]
                    ${status === "Paid"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-gray-50 border-gray-200 text-gray-500"
                    }`}
                >
                  <span>
                    {new Date(year, month - 1)
                      .toLocaleDateString(undefined, { month: "short" })}
                  </span>
                  <span className="text-[8px] opacity-60 font-normal">
                    {String(year).slice(2)}
                  </span>
                </div>
              ))
            : <p className="text-xs text-gray-400">—</p>
          }
        </div>
      </div>

      {/* ── Opening Balance card ─────────────────────────────────────── */}
      {!loadingData && breakdown?.openingBalanceCharge && (
        <div className="border border-indigo-200 rounded-2xl overflow-hidden bg-indigo-50/40">
          <div className="px-5 py-4 flex items-center gap-3">
            <div className="p-1.5 bg-indigo-100 rounded-lg">
              <Wallet className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-900">Opening Balance</p>
              <p className="text-xs text-indigo-600">
                Carried over from before joining the digital system — stays here until fully cleared
              </p>
            </div>
            <span className="ml-auto text-sm font-bold text-indigo-700">
              ৳{breakdown.openingBalanceCharge.amount.toLocaleString()}
            </span>
          </div>

          <div className="px-5 pb-5 flex items-center gap-3 flex-wrap">
            <label className="text-xs text-gray-500">Amount to pay now</label>
            <span className="text-sm text-gray-500">৳</span>
            <input
              type="number"
              min={1}
              max={breakdown.openingBalanceCharge.amount}
              value={openingBalanceInput}
              onChange={e => setOpeningBalanceInput(e.target.value)}
              onBlur={() => {
                const parsed = Number(openingBalanceInput);
                const clamped = Math.min(
                  Math.max(1, Number.isFinite(parsed) ? parsed : 1),
                  breakdown.openingBalanceCharge.amount
                );
                setOpeningBalanceInput(String(clamped));
                setOpeningBalanceAmount(clamped);
              }}
              className="w-32 p-2 border border-gray-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={() => handleExtraToggle(String(breakdown.openingBalanceCharge._id))}
              className={`ml-auto px-3 py-1.5 text-xs font-semibold rounded-lg border
                transition-colors ${
                  selectedExtraIds.includes(String(breakdown.openingBalanceCharge._id))
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                }`}
            >
              {selectedExtraIds.includes(String(breakdown.openingBalanceCharge._id))
                ? "Selected"
                : "Select to pay"}
            </button>
          </div>
        </div>
      )}

      {/* ── Monthly dues selector ──────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="p-1.5 bg-blue-50 rounded-lg">
            <Wallet className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {t("monthly.title")}
            </p>
            <p className="text-xs text-gray-400">
              {t("monthly.subtitle")}
            </p>
          </div>
        </div>

        <div className="p-5">
          {loadingData && (
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-9 w-28 rounded-xl" />
              ))}
            </div>
          )}

          {!loadingData && unpaidMonthly.length === 0 && (
            <div className="flex items-center gap-3 py-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <p className="text-sm text-emerald-700 font-medium">
                {t("monthly.allPaid")}
              </p>
            </div>
          )}

          {!loadingData && unpaidMonthly.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-3">
                {t("monthly.selectHint")}
              </p>
              <div className="flex flex-wrap gap-2 mb-5">
                {unpaidMonthly.map((charge, idx) => {
                  const cid         = String(charge._id);
                  const isSelected  = selectedMonthlyIds.includes(cid);
                  const isReachable = idx === 0 || selectedMonthlyIds.includes(
                    String(unpaidMonthly[idx - 1]._id)
                  );
                  return (
                    <button
                      key={cid}
                      onClick={() => handleMonthClick(cid, idx)}
                      title={`${monthName(charge.month)} ${charge.year} — ৳${charge.amount.toLocaleString()}`}
                      className={`relative flex flex-col items-center px-4 py-2
                        rounded-xl text-xs font-semibold border
                        transition-all duration-150
                        ${isSelected
                          ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-sm scale-105"
                          : isReachable
                          ? "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                          : "bg-gray-50 border-gray-100 text-gray-300 cursor-default"
                        }`}
                    >
                      <span>
                        {new Date(charge.year, charge.month - 1)
                          .toLocaleDateString(undefined, { month: "short" })}{" "}
                        {charge.year}
                      </span>
                      <span className={`text-[10px] mt-0.5 font-normal ${
                        isSelected ? "text-white/80" : "text-gray-400"
                      }`}>
                        ৳{charge.amount.toLocaleString()}
                      </span>
                      {isSelected && (
                        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5
                          bg-emerald-400 rounded-full flex items-center justify-center">
                          <span className="text-[7px] text-white font-bold">✓</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedMonthlyIds.length > 0 && (
                <p className="text-xs text-gray-500 mb-4">
                  {t("monthly.selectedSummary", {
                    count:  selectedMonthlyIds.length,
                    amount: selectedMonthlyTotal.toLocaleString(),
                  })}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Extra / additional charges ────────────────────────────────── */}
      {!loadingData && unpaidExtra.length > 0 && (
        <div className="border border-amber-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 bg-amber-50 flex items-center gap-3">
            <div className="p-1.5 bg-amber-100 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {t("extra.title")}
              </p>
              <p className="text-xs text-amber-600">
                {t("extra.pending", {
                  count: unpaidExtra.length,
                  total: unpaidExtra
                    .reduce((s, c) => s + c.amount, 0)
                    .toLocaleString(),
                })}
              </p>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {unpaidExtra.map(charge => {
              const cid        = String(charge._id);
              const isSelected = selectedExtraIds.includes(cid);
              return (
                <label
                  key={cid}
                  className="flex items-start gap-4 px-5 py-4 bg-white
                    hover:bg-amber-50/40 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleExtraToggle(cid)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300
                      accent-amber-500 cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {charge.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {charge.purpose}
                    </p>
                    {charge.dueDate && (
                      <p className="text-[11px] text-red-400 flex items-center
                        gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {t("extra.dueBy", {
                          date: new Date(charge.dueDate).toLocaleDateString(
                            "en-GB",
                            { day: "numeric", month: "short", year: "numeric" }
                          ),
                        })}
                      </p>
                    )}
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 mt-0.5 ${
                    isSelected ? "text-amber-600" : "text-gray-800"
                  }`}>
                    ৳{charge.amount.toLocaleString()}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pay now — always available, whether or not there are current
          dues, so a member can add an advance-payment top-up at any
          time. ───────────────────────────────────────────────────────── */}
      {!loadingData && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border p-5 transition-all duration-200
            ${hasSelection
              ? "border-[var(--color-primary)] bg-blue-50"
              : "border-gray-200 bg-gray-50"
            }`}
        >
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <label className="text-xs text-gray-500">
              Add extra for future dues (optional)
            </label>
            <span className="text-sm text-gray-500">৳</span>
            <input
              type="number"
              min={0}
              value={extraAdvanceInput}
              onChange={e => setExtraAdvanceInput(e.target.value)}
              onBlur={() => {
                const parsed = Number(extraAdvanceInput);
                const clamped = Math.max(0, Number.isFinite(parsed) ? parsed : 0);
                setExtraAdvanceInput(String(clamped));
                setExtraAdvanceAmount(clamped);
              }}
              className="w-28 p-1.5 border border-gray-200 rounded-lg text-xs
                focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                {hasSelection
                  ? t("pay.totalSelected")
                  : t("pay.selectAbove")
                }
              </p>
              <p className={`text-3xl font-bold font-playfair leading-none mt-1
                ${hasSelection ? "text-gray-900" : "text-gray-300"}`}>
                {hasSelection ? `৳${selectedTotal.toLocaleString()}` : "—"}
              </p>

              {hasSelection && (
                <div className="mt-1.5 space-y-0.5">
                  {selectedMonthlyIds.length > 0 && (
                    <p className="text-xs text-gray-500">
                      {t("pay.monthLine", {
                        count:  selectedMonthlyIds.length,
                        amount: selectedMonthlyTotal.toLocaleString(),
                      })}
                    </p>
                  )}
                  {selectedExtraIds.length > 0 && (
                    <p className="text-xs text-gray-500">
                      {t("pay.extraLine", {
                        count:  selectedExtraIds.length,
                        amount: selectedExtraTotal.toLocaleString(),
                      })}
                    </p>
                  )}
                  {extraAdvanceAmount > 0 && (
                    <p className="text-xs text-emerald-600">
                      + ৳{extraAdvanceAmount.toLocaleString()} banked as credit for future dues
                    </p>
                  )}
                  {remainingAfterSelection > 0 && (
                    <p className="text-xs text-orange-500 font-medium">
                      {t("pay.remaining", {
                        amount: remainingAfterSelection.toLocaleString(),
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handlePay}
              disabled={!hasSelection || paying}
              className="flex items-center gap-2 px-6 py-3
                bg-[var(--color-primary)] text-white text-sm font-semibold
                rounded-xl shadow-sm hover:bg-blue-700 active:scale-95
                transition-all disabled:opacity-40 disabled:cursor-not-allowed
                disabled:active:scale-100 flex-shrink-0"
            >
              {paying
                ? <><Loader2 className="animate-spin h-4 w-4" /> {t("pay.processing")}</>
                : <><CreditCard className="h-4 w-4" /> {t("pay.payNow")}</>
              }
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Transaction history + export ──────────────────────────────── */}
      <div className="border border-gray-200 rounded-2xl">
        <div className="flex items-center justify-between px-5 py-4 bg-white
          border-b border-gray-100 gap-3 rounded-t-2xl">
          <button
            className="flex items-center gap-2.5 flex-1 text-left min-w-0"
            onClick={() => {
              const opening = !historyOpen;
              setHistoryOpen(opening);
              if (opening && history.length === 0) fetchHistory();
            }}
          >
            <div className="p-1.5 bg-gray-100 rounded-lg flex-shrink-0">
              <Receipt className="h-4 w-4 text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">
                {t("history.title")}
              </p>
              <p className="text-xs text-gray-400">
                {historyOpen && loadingHistory
                  ? t("history.loading")
                  : history.length > 0
                  ? t("history.records", { count: history.length })
                  : t("history.clickToLoad")
                }
              </p>
            </div>
            {historyOpen
              ? <ChevronUp   className="h-4 w-4 text-gray-400 flex-shrink-0 ml-auto" />
              : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0 ml-auto" />
            }
          </button>

          <ExportControl t={t} />
        </div>

        <AnimatePresence initial={false}>
          {historyOpen && (
            <motion.div
              key="history"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-gray-100 rounded-b-2xl"
            >
              {loadingHistory ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  {t("history.clickToLoad")}
                </p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {history.map(payment => (
                    <div key={payment._id}>
                      <button
                        className="w-full flex items-center justify-between
                          px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                        onClick={() => setExpandedPayment(
                          expandedPayment === payment._id ? null : payment._id
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-800">
                                ৳{payment.amount.toLocaleString()}
                              </span>
                              <StatusBadge status={payment.status} />
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {payment.paidAt
                                ? new Date(payment.paidAt).toLocaleDateString(
                                    "en-GB",
                                    { day: "numeric", month: "short", year: "numeric" }
                                  )
                                : new Date(payment.createdAt).toLocaleDateString("en-GB")
                              }
                              {payment.receiptNumber && (
                                <span className="ml-2 font-mono">
                                  {payment.receiptNumber}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        {expandedPayment === payment._id
                          ? <ChevronUp   className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          : <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        }
                      </button>

                      <AnimatePresence initial={false}>
                        {expandedPayment === payment._id && (
                          <motion.div
                            key="breakdown"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden bg-gray-50 border-t border-gray-100"
                          >
                            {payment.breakdown && payment.breakdown.length > 0 ? (
                              <div className="px-5 py-3 space-y-2">
                                <p className="text-[10px] font-semibold text-gray-400
                                  uppercase tracking-wide mb-2">
                                  {t("history.covered")}
                                </p>
                                {payment.breakdown.map((alloc, i) => (
                                  <div key={i}
                                    className="flex items-center justify-between
                                      text-xs text-gray-600">
                                    <span>
                                      {alloc.type === "monthly"
                                        ? `${monthName(alloc.month)} ${alloc.year} — ${t("history.monthlyDues")}`
                                        : alloc.label
                                      }
                                      {alloc.type === "extra" && alloc.purpose && (
                                        <span className="text-gray-400 ml-1">
                                          ({alloc.purpose})
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-semibold text-gray-800 ml-4 flex-shrink-0">
                                      ৳{alloc.amount.toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="px-5 py-3 text-xs text-gray-400">
                                {t("history.noBreakdown")}
                              </p>
                            )}

                            {payment.status === "completed" && payment.receiptNumber && (
                              <div className="px-5 py-3 border-t border-gray-100">
                                <button
                                  onClick={() => handleReceiptDownload(payment._id)}
                                  className="flex items-center gap-1.5 text-xs
                                    font-semibold text-[var(--color-primary)]
                                    hover:underline"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  {t("history.downloadReceipt", {
                                    id: payment.receiptNumber,
                                  })}
                                </button>
                              </div>
                            )}

                            {payment.rejectedReason && (
                              <p className="px-5 pb-3 text-xs text-red-400">
                                {t("history.rejectionReason")}{" "}
                                {payment.rejectedReason}
                              </p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}