// client/src/pages/admin/Dashboard.jsx
//
// CHANGE: Recent Activity section added at the bottom.
// Reads from adminOnly notifications already stored by the backend
// whenever members submit questions, request admin access, or pay.
// No new API endpoint needed — GET /api/notifications already exists.
// fetchDashboard already polls every 60s so activity updates automatically.
// All other sections unchanged.

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  TrendingUp,
  AlertCircle,
  DollarSign,
  Clock,
  Activity,
  MessageSquare,
  ShieldCheck,
  CreditCard,
  Bell,
  HelpCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import Title from "../../components/Title";
import { useAppContext } from "../../context/AppContext";
import { formatDate } from "../../utils/formatDate";
import usePageTitle from "../../hooks/usePageTitle";

const MONTH_NAMES = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Maps notification type → icon + color for the activity feed
const ACTIVITY_META = {
  Question: {
    icon: HelpCircle,
    color: "text-amber-500",
    bg: "bg-amber-50",
    label: "New question",
  },
  Payment: {
    icon: CreditCard,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    label: "Payment received",
  },
  AdminApproved: {
    icon: ShieldCheck,
    color: "text-purple-500",
    bg: "bg-purple-50",
    label: "Admin access request",
  },
  AdminRejected: {
    icon: ShieldCheck,
    color: "text-red-400",
    bg: "bg-red-50",
    label: "Admin request",
  },
  Member: {
    icon: Users,
    color: "text-blue-400",
    bg: "bg-blue-50",
    label: "New member",
  },
  MemberUpdate: {
    icon: Users,
    color: "text-gray-400",
    bg: "bg-gray-100",
    label: "Profile updated",
  },
  Notice: {
    icon: Bell,
    color: "text-blue-400",
    bg: "bg-blue-50",
    label: "Notice published",
  },
  // FAQ intentionally omitted — admin-self-generated, no signal value
};

// Types to suppress from the activity feed display
const HIDDEN_ACTIVITY_TYPES = new Set(["FAQ"]);

const ActivityIcon = ({ type }) => {
  const meta = ACTIVITY_META[type] ?? ACTIVITY_META.Member;
  const Icon = meta.icon;
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center
      justify-center flex-shrink-0 ${meta.bg}`}
    >
      <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
    </div>
  );
};

const Dashboard = () => {
  const { axios, getToken } = useAppContext();
  usePageTitle("Admin Dashboard");

  const [dashData, setDashData] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFirstLoad = useRef(true);

  // Fetch main dashboard metrics
  const fetchDashboard = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const token = await getToken();
        const { data } = await axios.get("/api/admin/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data.success) setDashData(data);
      } catch (error) {
        console.error("Admin dashboard fetch error:", error.message);
        if (!silent) toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
        isFirstLoad.current = false;
      }
    },
    [axios, getToken],
  );

  // Fetch admin activity feed separately — lightweight, frequent
  const fetchActivity = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setActivity(data.notifications ?? []);
    } catch {
      // Silent
    }
  }, [axios, getToken]);

  const handleClearNotifications = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.delete("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setActivity([]);
        toast.success("Activity cleared");
      }
    } catch {
      toast.error("Failed to clear activity");
    }
  };

  useEffect(() => {
    fetchDashboard(false);
    fetchActivity();
    const interval = setInterval(() => {
      fetchDashboard(true);
      fetchActivity();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchDashboard, fetchActivity]);

  if (loading || !dashData) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div
          className="animate-spin h-8 w-8 border-2 border-gray-400
          border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const { metrics, trend, outstanding, chargeAnalytics, recentPayments } =
    dashData;

  const statCards = [
    {
      name: "Total Members",
      value: metrics.totalMembers,
      sub: `${metrics.membersPaid} fully paid`,
      icon: <Users className="h-5 w-5" />,
      path: "/admin/manage-members",
      color: "bg-blue-50 border-blue-200",
      text: "text-blue-700",
    },
    {
      name: "This Month",
      value: `৳${metrics.thisMonthCollection.toLocaleString()}`,
      sub: `৳${metrics.todayCollection.toLocaleString()} today`,
      icon: <DollarSign className="h-5 w-5" />,
      path: "/admin/payments",
      color: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-700",
    },
    {
      name: "Outstanding",
      value: `৳${metrics.totalOutstanding.toLocaleString()}`,
      sub: `${metrics.membersWithDues} members with dues`,
      icon: <AlertCircle className="h-5 w-5" />,
      path: "/admin/payments",
      color: "bg-red-50 border-red-200",
      text: "text-red-700",
    },
    {
      name: "Pending",
      value: metrics.pendingPaymentsCount,
      sub: "payments awaiting approval",
      icon: <Clock className="h-5 w-5" />,
      path: "/admin/payments",
      color:
        metrics.pendingPaymentsCount > 0
          ? "bg-amber-50 border-amber-300"
          : "bg-gray-50 border-gray-200",
      text:
        metrics.pendingPaymentsCount > 0 ? "text-amber-700" : "text-gray-600",
    },
  ];

  return (
    <div className="w-full bg-white min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="mb-8">
          <Title
            title="Admin Dashboard"
            subTitle="Housing society financial overview and management."
          />
        </div>

        {/* ── Stat cards — unchanged ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {statCards.map((card, i) => (
            <motion.div
              key={card.name}
              initial={isFirstLoad.current ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Link
                to={card.path}
                className={`flex items-start gap-4 p-5 border rounded-xl
                  hover:shadow-md transition-all duration-200 ${card.color}`}
              >
                <div
                  className={`p-2 rounded-lg bg-white shadow-sm ${card.text}`}
                >
                  {card.icon}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {card.name}
                  </p>
                  <p className={`text-xl font-bold mt-0.5 ${card.text}`}>
                    {card.value}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* ── Trend + Quick Actions — unchanged ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <motion.div
  initial={isFirstLoad.current ? { opacity: 0, y: 12 } : false}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.15 }}
  className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-6 shadow-sm flex flex-col"
>
  {/* Header */}
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">
        <TrendingUp className="h-4 w-4 text-slate-700" />
      </div>
      <div>
        <h3 className="font-playfair text-base font-semibold text-gray-900 tracking-tight">
          Collection Trend
        </h3>
        <p className="text-xs text-gray-400">12-month transaction volume</p>
      </div>
    </div>

    <div className="flex items-center gap-5 text-xs font-medium text-gray-500">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
        <span>
          This Month:{" "}
          <strong className="text-slate-900 font-semibold">
            ৳{metrics.thisMonthCollection.toLocaleString()}
          </strong>
        </span>
      </div>
      <div className="h-3 w-[1px] bg-gray-200" />
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        <span>
          All Time:{" "}
          <strong className="text-slate-900 font-semibold">
            ৳{metrics.totalCollection.toLocaleString()}
          </strong>
        </span>
      </div>
    </div>
  </div>

  {/* Chart */}
  {trend.length > 0 ? (() => {
    const maxCollected = Math.max(...trend.map(t => t.collected), 1);
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();

    // Three Y-axis grid lines at 25%, 50%, 75% of max
    const gridLines = [0.75, 0.5, 0.25];

    return (
      <div className="flex flex-col flex-1">
        <div className="relative flex gap-2 items-end h-44">

          {/* Y-axis grid lines — purely visual, no layout impact */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-0">
            {gridLines.map((fraction) => (
              <div
                key={fraction}
                className="w-full border-t border-dashed border-gray-100"
                style={{ marginTop: `${(1 - fraction) * 100}%` }}
              />
            ))}
          </div>

          {trend.map((point, idx) => {
            const heightPct   = Math.round((point.collected / maxCollected) * 100);
            const hasData     = point.collected > 0;
            const isThisMonth = point.month === currentMonth && point.year === currentYear;

            return (
              <div
                key={`${point.year}-${point.month}`}
                className="flex-1 flex flex-col items-center justify-end h-full group relative"
              >
                {/* Tooltip — fixed width, won't clip */}
                {hasData && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                    bg-gray-900 text-white text-[10px] font-medium px-2.5 py-1.5
                    rounded-lg shadow-lg opacity-0 group-hover:opacity-100
                    transition-opacity duration-150 whitespace-nowrap pointer-events-none z-30">
                    <span className="block text-gray-400 text-[9px] mb-0.5">
                      {MONTH_NAMES[point.month]} {point.year}
                    </span>
                    ৳{point.collected.toLocaleString()}
                  </div>
                )}

                {/* Bar */}
                <div className="w-full flex flex-col justify-end"
                  style={{ height: "100%" }}>
                  <motion.div
                    initial={{ scaleY: 0, originY: 1 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      delay: 0.15 + idx * 0.04,
                      duration: 0.45,
                      ease: [0.33, 1, 0.68, 1],
                    }}
                    style={{
                      height: hasData ? `${Math.max(heightPct, 4)}%` : "2px",
                      transformOrigin: "bottom",
                    }}
                    className={`w-full rounded-t-[3px] transition-colors duration-150
                      ${isThisMonth
                        ? "bg-slate-800 group-hover:bg-slate-700"
                        : hasData
                        ? "bg-slate-300 group-hover:bg-slate-400"
                        : "bg-gray-100"
                      }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Month labels — outside chart area, clean baseline */}
        <div className="flex gap-2 mt-2.5">
          {trend.map((point) => {
            const isThisMonth = point.month === currentMonth && point.year === currentYear;
            return (
              <div
                key={`label-${point.year}-${point.month}`}
                className="flex-1 text-center"
              >
                <span className={`text-[10px] font-medium transition-colors
                  ${isThisMonth
                    ? "text-slate-800 font-semibold"
                    : "text-gray-400"
                  }`}>
                  {MONTH_NAMES[point.month]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  })() : (
    <div className="flex-1 flex items-center justify-center text-gray-400
      text-xs font-medium bg-gray-50 rounded-xl border border-dashed border-gray-200 h-44">
      No payment history found
    </div>
  )}
</motion.div>

          <motion.div
            initial={isFirstLoad.current ? { opacity: 0, y: 16 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
          >
            <h3 className="font-playfair text-base font-semibold text-gray-800 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-1">
              {[
                { label: "Add New Notice", path: "/admin/manage-notices" },
                { label: "Answer FAQ", path: "/admin/manage-faqs" },
                { label: "Add Gallery Item", path: "/admin/manage-gallery" },
                { label: "Review Payments", path: "/admin/payments" },
                { label: "Manage Members", path: "/admin/manage-members" },
              ].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-2 p-2.5 rounded-lg text-sm
                    text-[var(--color-primary)] font-outfit hover:bg-blue-50
                    transition-colors"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full
                    bg-[var(--color-primary)] flex-shrink-0"
                  />
                  {item.label}
                </Link>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Outstanding + Recent Payments — unchanged ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <motion.div
            initial={isFirstLoad.current ? { opacity: 0, y: 16 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-playfair text-base font-semibold text-gray-800">
                Highest Outstanding
              </h3>
              <Link
                to="/admin/payments"
                className="text-xs text-[var(--color-primary)] hover:underline"
              >
                View all
              </Link>
            </div>
            {outstanding.members.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                All members are paid up 🎉
              </p>
            ) : (
              <div className="space-y-3">
                {outstanding.members.slice(0, 5).map((item) => (
                  <div
                    key={item.memberId}
                    className="flex items-center justify-between py-2
                      border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {item.member?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.member?.membershipNo || "—"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-red-600">
                      ৳{item.totalDue.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={isFirstLoad.current ? { opacity: 0, y: 16 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
          >
            <h3 className="font-playfair text-base font-semibold text-gray-800 mb-4">
              Recent Payments
            </h3>
            {recentPayments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                No payments yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentPayments.slice(0, 5).map((payment) => (
                  <div
                    key={payment._id}
                    className="flex items-center justify-between py-2
                      border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {payment.member?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {payment.receiptNumber} ·{" "}
                        {payment.paidAt
                          ? new Date(payment.paidAt).toLocaleDateString("en-GB")
                          : "—"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">
                      ৳{payment.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Extra charge analytics — unchanged ─────────────────────── */}
        {chargeAnalytics.length > 0 && (
          <motion.div
            initial={isFirstLoad.current ? { opacity: 0, y: 16 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mb-6 bg-white border border-gray-200 rounded-xl
              p-6 shadow-sm"
          >
            <h3 className="font-playfair text-base font-semibold text-gray-800 mb-4">
              Extra Charge Analytics
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[480px]">
                <thead className="text-xs uppercase text-gray-400 bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Charge Type</th>
                    <th className="px-4 py-2 font-semibold text-right">
                      Total Charged
                    </th>
                    <th className="px-4 py-2 font-semibold text-right">
                      Collected
                    </th>
                    <th className="px-4 py-2 font-semibold text-right">
                      Outstanding
                    </th>
                    <th className="px-4 py-2 font-semibold text-center">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {chargeAnalytics.map((item) => (
                    <tr key={item.label} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {item.label}
                        <span className="ml-2 text-xs text-gray-400">
                          ({item.countTotal} members)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        ৳{item.totalCharged.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                        ৳{item.totalPaid.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-red-500">
                        ৳{item.totalUnpaid.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs
                          font-semibold rounded-full ${
                            item.collectionRate >= 80
                              ? "bg-emerald-100 text-emerald-700"
                              : item.collectionRate >= 50
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-600"
                          }`}
                        >
                          {item.collectionRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ── Recent Activity — NEW ──────────────────────────────────── */}
        <motion.div
          initial={isFirstLoad.current ? { opacity: 0, y: 16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[var(--color-primary)]" />
              <h3 className="font-playfair text-base font-semibold text-gray-800">
                Recent Activity
              </h3>
              {/* Badge shows only the visible (non-suppressed) count */}
              {(() => {
                const visibleCount = activity.filter(
                  (item) => !HIDDEN_ACTIVITY_TYPES.has(item.type),
                ).length;
                return visibleCount > 0 ? (
                  <span
                    className="px-2 py-0.5 bg-blue-50 text-blue-600
            text-[10px] font-semibold rounded-full"
                  >
                    {visibleCount}
                  </span>
                ) : null;
              })()}
            </div>
            {activity.length > 0 && (
              <button
                onClick={handleClearNotifications}
                className="text-xs text-gray-400 hover:text-gray-600
          font-outfit transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {(() => {
            // Filter out admin-self-generated types before rendering
            const visibleActivity = activity.filter(
              (item) => !HIDDEN_ACTIVITY_TYPES.has(item.type),
            );

            if (visibleActivity.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-10">
                  <Activity className="h-8 w-8 text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">No recent activity</p>
                  <p className="text-xs text-gray-300 mt-1">
                    Member actions will appear here
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-0">
                {visibleActivity.map((item, index) => {
                  const meta = ACTIVITY_META[item.type];
                  // If type is unknown (future types), skip gracefully
                  if (!meta) return null;
                  const Icon = meta.icon;

                  return (
                    <motion.div
                      key={item._id}
                      initial={
                        isFirstLoad.current ? { opacity: 0, x: -8 } : false
                      }
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.04 }}
                      className="flex items-start gap-3 py-3 border-b
                border-gray-50 last:border-0"
                    >
                      {/* Type icon */}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center
                justify-center flex-shrink-0 mt-0.5 ${meta.bg}`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {item.content}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-[10px] font-semibold ${meta.color}`}
                          >
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-gray-300">·</span>
                          <span className="text-[11px] text-gray-400">
                            {formatDate(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            );
          })()}
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
