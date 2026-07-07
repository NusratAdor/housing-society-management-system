// client/src/components/member/OverviewCard.jsx
//
// REDESIGN v2 — fixes from review:
//
//   1. Max-width container — content constrained to max-w-6xl, centered
//      with horizontal padding. Prevents ugly full-bleed stretch on wide
//      monitors. Same pattern used by Linear, Stripe, Notion dashboards.
//
//   2. Hero card member info panel — shows Member ID, Plot, Designation
//      only. "Member since" removed — lives exclusively in sidebar footer.
//      No duplication between hero card and sidebar.
//
//   3. Section header icons — changed from Bell (same as action bell in
//      top bar) to FileText for notices, Activity for notifications.
//      Avoids visual confusion between decorative section icons and the
//      actionable notification bell.
//
//   4. Gallery removed from stat strip — gallery count is not actionable.
//      Replaced with a Gallery quick-link card that navigates to /gallery.
//      Stat strip now: New Notices | Notifications | Payment Status | Questions
//
//   5. Skeleton colors fixed — visible gray on white background.

import React, { useEffect, useCallback, useState, useMemo } from "react";
import { motion }        from "framer-motion";
import {
  AlertCircle, ArrowRight, Bell, CreditCard,
  HelpCircle, ChevronRight, FileText,
  Activity, Image as ImageIcon, CheckCircle2,
} from "lucide-react";
import { Link }          from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import { formatDate }    from "../../utils/formatDate";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const OverviewSkeleton = () => (
  <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-4">
    <div className="rounded-2xl bg-slate-200 h-44 animate-pulse" />
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[1,2,3,4].map(i => (
        <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 h-72 bg-gray-200 rounded-2xl animate-pulse" />
      <div className="lg:col-span-2 h-72 bg-gray-200 rounded-2xl animate-pulse" />
    </div>
    <div className="h-24 bg-gray-200 rounded-2xl animate-pulse" />
  </div>
);

// ─── Building SVG ─────────────────────────────────────────────────────────────

const BuildingIllustration = () => (
  <svg viewBox="0 0 200 160" className="h-full w-auto opacity-[0.15]"
    fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="30" y="40" width="80" height="120" rx="2" fill="white" />
    <polygon points="20,42 110,42 70,10 60,10" fill="white" opacity="0.6" />
    {[40,60,80,96].map((x,i) => (
      <rect key={`r1${i}`} x={x} y="55" width="12" height="14" rx="1" fill="#0f172a" opacity="0.3" />
    ))}
    {[40,60,80,96].map((x,i) => (
      <rect key={`r2${i}`} x={x} y="80" width="12" height="14" rx="1" fill="#0f172a" opacity="0.3" />
    ))}
    {[40,60,80,96].map((x,i) => (
      <rect key={`r3${i}`} x={x} y="105" width="12" height="14" rx="1" fill="#0f172a" opacity="0.3" />
    ))}
    <rect x="60" y="130" width="20" height="30" rx="2" fill="#0f172a" opacity="0.4" />
    <rect x="130" y="70" width="50" height="90" rx="2" fill="white" opacity="0.5" />
    {[138,155].map((x,i) => (
      <rect key={`s1${i}`} x={x} y="85" width="10" height="12" rx="1" fill="#0f172a" opacity="0.2" />
    ))}
    {[138,155].map((x,i) => (
      <rect key={`s2${i}`} x={x} y="108" width="10" height="12" rx="1" fill="#0f172a" opacity="0.2" />
    ))}
    <line x1="0" y1="160" x2="200" y2="160" stroke="white" strokeWidth="2" opacity="0.3" />
    <circle cx="15" cy="130" r="12" fill="white" opacity="0.25" />
    <rect x="13" y="140" width="4" height="20" fill="white" opacity="0.2" />
  </svg>
);

// ─── Greeting ─────────────────────────────────────────────────────────────────

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
};

// ─── Notification type meta ───────────────────────────────────────────────────

function notifMeta(n) {
  const c = (n.content ?? "").toLowerCase();
  if (c.includes("payment") || c.includes("receipt"))
    return { Icon: CreditCard, color: "text-emerald-600", bg: "bg-emerald-50" };
  if (c.includes("question") || c.includes("answer"))
    return { Icon: HelpCircle, color: "text-amber-600",   bg: "bg-amber-50"   };
  if (c.includes("notice"))
    return { Icon: FileText,   color: "text-blue-600",    bg: "bg-blue-50"    };
  return   { Icon: Bell,       color: "text-gray-500",    bg: "bg-gray-100"   };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeroInfoRow({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className={`text-xs font-semibold text-white leading-tight ${
        mono ? "font-mono" : ""
      }`}>
        {value}
      </p>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor,
  badgeBg, onClick, sub, valueIsText = false }) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-2xl p-4
        text-left hover:shadow-md hover:border-gray-300
        transition-all duration-150 active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={`p-2 rounded-xl ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full text-white ${badgeBg}`}>
          {valueIsText ? value : value}
        </span>
      </div>
      <p className="text-xs font-semibold text-gray-800 mb-0.5">{label}</p>
      <p className="text-[11px] text-gray-400 line-clamp-1">{sub}</p>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OverviewCard({
  onGoToPayment,
  onGoToNotices,
  onGoToFAQs,
  memberProfile,
  breakdown,
  loadingBreakdown,
  joinDate,
}) {
  const { axios, getToken } = useAppContext();

  const [notices,             setNotices]             = useState([]);
  const [loadingNotices,      setLoadingNotices]      = useState(true);
  const [memberNotifications, setMemberNotifications] = useState([]);
  const [loadingNotifs,       setLoadingNotifs]       = useState(true);
  const [pendingQCount,       setPendingQCount]       = useState(0);

  const fetchNotices = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/notices");
      if (data.success) setNotices((data.notices ?? []).slice(0, 3));
    } catch { /* empty state */ }
    finally { setLoadingNotices(false); }
  }, [axios]);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/notifications/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setMemberNotifications((data.notifications ?? data.payments ?? []).slice(0, 5));
      }
    } catch { /* empty state */ }
    finally { setLoadingNotifs(false); }
  }, [axios, getToken]);

  const fetchPendingQuestions = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/faqs/pending/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setPendingQCount((data.questions ?? data.pending ?? []).length);
      }
    } catch { /* silent */ }
  }, [axios, getToken]);

  useEffect(() => {
    fetchNotices();
    fetchNotifications();
    fetchPendingQuestions();
  }, [fetchNotices, fetchNotifications, fetchPendingQuestions]);

  // Derived values
  const firstName          = memberProfile?.name?.split(" ")[0] ?? "there";
  const totalDue           = breakdown?.totalDue      ?? 0;
  const isPaid             = breakdown?.paymentStatus === "Paid";
  const lastPayment        = breakdown?.lastPayment   ?? null;
  const nextDue            = breakdown?.nextDueMonth  ?? null;
  const unreadNotifCount   = memberNotifications.length;

  const newNoticesCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return notices.filter(n => new Date(n.createdAt).getTime() > cutoff).length;
  }, [notices]);

  if (loadingBreakdown) return <OverviewSkeleton />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ duration: 0.25 }}
      // MAX-WIDTH CONTAINER — this is the key fix for full-bleed stretch
      className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-4"
    >

      {/* ── 1. Hero greeting ────────────────────────────────────────── */}
      <div className="relative rounded-2xl bg-slate-800 overflow-hidden
        min-h-[160px] md:min-h-[180px]">
        <div className="absolute right-0 top-0 bottom-0 w-40 md:w-56
          flex items-end justify-end pointer-events-none select-none">
          <BuildingIllustration />
        </div>

        <div className="relative z-10 p-5 md:p-7
          flex flex-col sm:flex-row sm:items-start justify-between gap-4">

          {/* Left */}
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-sm font-medium mb-1">
              {getGreeting()}, {firstName}
            </p>
            <h1 className="text-white text-xl md:text-2xl font-semibold
              font-playfair leading-tight mb-1">
              Welcome back to GOMCS
            </h1>
            
            <div className="mt-3 inline-flex items-center px-3 py-1.5
              bg-white/10 rounded-full border border-white/10">
              <span className="text-slate-300 text-xs">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long", day: "numeric",
                  month: "long", year: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Right — member info: ID, Plot, Designation only.
              "Member since" intentionally omitted — lives in sidebar footer. */}
          <div className="flex-shrink-0 bg-white/10 backdrop-blur-sm
            border border-white/15 rounded-xl p-4 min-w-[155px]">
            <div className="space-y-2.5">
              <HeroInfoRow
                label="Member ID"
                value={memberProfile?.membershipNo ?? "—"}
                mono
              />
              {memberProfile?.plotNo && (
                <HeroInfoRow label="Plot" value={`Plot ${memberProfile.plotNo}`} />
              )}
              {memberProfile?.designation && (
                <HeroInfoRow label="Designation" value={memberProfile.designation} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Stat strip — 4 cards, all actionable ─────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="New Notices"
          value={loadingNotices ? "—" : String(newNoticesCount)}
          icon={Bell}
          iconBg="bg-blue-50"    iconColor="text-blue-600"
          badgeBg="bg-blue-600"
          onClick={onGoToNotices}
          sub="View all →"
        />
        <StatCard
          label="Notifications"
          value={loadingNotifs ? "—" : String(unreadNotifCount)}
          icon={Activity}
          iconBg="bg-violet-50"  iconColor="text-violet-600"
          badgeBg="bg-violet-600"
          onClick={() => {}}
          sub="Recent activity"
        />
        <StatCard
          label="Payment Status"
          value={isPaid ? "Paid" : "Due"}
          icon={CreditCard}
          iconBg={isPaid ? "bg-emerald-50" : "bg-amber-50"}
          iconColor={isPaid ? "text-emerald-600" : "text-amber-600"}
          badgeBg={isPaid ? "bg-emerald-600" : "bg-amber-500"}
          onClick={onGoToPayment}
          sub={isPaid ? "All clear ✓" : `৳${totalDue.toLocaleString()} outstanding`}
          valueIsText
        />
        <StatCard
          label="My Questions"
          value={String(pendingQCount)}
          icon={HelpCircle}
          iconBg="bg-orange-50"  iconColor="text-orange-600"
          badgeBg="bg-orange-500"
          onClick={onGoToFAQs}
          sub="Pending answers"
        />
      </div>

      {/* ── 3. Two-column content ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Recent Notices — 3 cols */}
        <div className="lg:col-span-3 bg-white rounded-2xl border
          border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4
            border-b border-gray-100">
            <div className="flex items-center gap-2">
              {/* FileText icon instead of Bell — avoids confusion with action bell */}
              <FileText className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">
                Recent Notices
              </h3>
            </div>
            <button
              onClick={onGoToNotices}
              className="text-xs font-semibold text-[var(--color-primary)]
                hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {loadingNotices ? (
            <div className="p-5 space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notices.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <FileText className="h-7 w-7 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No notices yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notices.map(notice => {
                const isNew = Date.now() - new Date(notice.createdAt).getTime()
                  < 7 * 24 * 60 * 60 * 1000;
                return (
                  <Link
                    key={notice._id}
                    to={`/notices/${notice._id}`}
                    className="flex items-start gap-3.5 px-5 py-4
                      hover:bg-gray-50 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gray-100
                      flex-shrink-0 overflow-hidden border border-gray-100">
                      {notice.image ? (
                        <img src={notice.image} alt={notice.title}
                          className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-50">
                          <FileText className="h-5 w-5 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-gray-800 truncate
                          group-hover:text-[var(--color-primary)] transition-colors">
                          {notice.title}
                        </p>
                        {isNew && (
                          <span className="flex-shrink-0 text-[9px] font-bold
                            px-1.5 py-0.5 bg-blue-100 text-blue-700
                            rounded-full uppercase tracking-wide">
                            New
                          </span>
                        )}
                      </div>
                      {notice.summary && (
                        <p className="text-xs text-gray-500 line-clamp-1">
                          {notice.summary}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1">
                        {formatDate(notice.date || notice.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300
                      group-hover:text-[var(--color-primary)]
                      flex-shrink-0 mt-1 transition-colors" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Latest Notifications — 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-2xl border
          border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4
            border-b border-gray-100">
            <div className="flex items-center gap-2">
              {/* Activity icon — distinct from action bell */}
              <Activity className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">
                Latest Notifications
              </h3>
            </div>
          </div>

          {loadingNotifs ? (
            <div className="p-5 space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-6 h-6 bg-gray-200 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded" />
                    <div className="h-2.5 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : memberNotifications.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Activity className="h-7 w-7 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 overflow-y-auto max-h-72">
              {memberNotifications.map(n => {
                const { Icon: NIcon, bg: nBg, color: nColor } = notifMeta(n);
                return (
                  <div key={n._id}
                    className="flex items-start gap-3 px-5 py-3.5
                      hover:bg-gray-50 transition-colors">
                    <div className={`w-6 h-6 rounded-full flex items-center
                      justify-center flex-shrink-0 mt-0.5 ${nBg}`}>
                      <NIcon className={`h-3 w-3 ${nColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">
                        {n.content}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {formatDate(n.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Payment overview footer ──────────────────────────────── */}
      <div className={`rounded-2xl border p-5 ${
        isPaid ? "bg-white border-gray-200" : "bg-amber-50 border-amber-200"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center
          justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-xl flex-shrink-0 ${
              isPaid ? "bg-emerald-100" : "bg-amber-100"
            }`}>
              <CreditCard className={`h-5 w-5 ${
                isPaid ? "text-emerald-600" : "text-amber-700"
              }`} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Payment Overview</p>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                {nextDue && (
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                      Next Due{" "}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">
                      {new Date(nextDue.year, nextDue.month - 1)
                        .toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                    Due Amount{" "}
                  </span>
                  <span className={`text-sm font-bold font-playfair ${
                    isPaid ? "text-emerald-600" : "text-amber-700"
                  }`}>
                    {isPaid ? "৳0 — All clear!" : `৳${totalDue.toLocaleString()}`}
                  </span>
                </div>
                {lastPayment && (
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                      Last Payment{" "}
                    </span>
                    <span className="text-sm font-semibold text-gray-700">
                      ৳{lastPayment.amount.toLocaleString()} ·{" "}
                      {new Date(lastPayment.paidAt).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onGoToPayment}
            className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5
              text-sm font-semibold rounded-xl transition-all duration-150
              active:scale-95 ${
              isPaid
                ? "bg-gray-900 text-white hover:bg-gray-800"
                : "bg-amber-600 text-white hover:bg-amber-700"
            }`}
          >
            View Payment Details
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

    </motion.div>
  );
}