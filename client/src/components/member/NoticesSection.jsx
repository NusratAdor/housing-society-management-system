// client/src/components/member/NoticesSection.jsx
//
// CHANGE (visual only — zero functional changes), 3rd pass:
//   - Text sizing increased across the board — title, summary, date
//     chip, and header text were all reading too small at the
//     previous sizes.
//   - Hover/accent color switched from --dashboard-accent to the same
//     emerald shades used on the Notices list page and NoticeDetail
//     hero (emerald-600 for title hover, emerald-500 for the arrow
//     icon and "View All" button, emerald-600 for the date-chip month
//     label). This is a direct request to match those pages' accent
//     color rather than the dashboard's separate green token, so this
//     supersedes the earlier --dashboard-accent choice in this file.
//   - Refresh-success flash unchanged (was already emerald-500, so it
//     now also matches everything else here).
//
// UNCHANGED: fetchNotices, handleRefresh, error/empty states logic,
// translation keys and t() usage, NoticeCard linking, skeleton
// structure, date-chip-instead-of-repeated-icon pattern from the
// previous pass.

import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Bell, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../context/AppContext";
import { formatDate } from "../../utils/formatDate";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const NoticeSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <div key={i} className="flex gap-4 p-4 rounded-xl border border-gray-100">
        <div className="w-16 h-16 rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2.5 py-1">
          <div className="h-4   bg-gray-100 animate-pulse rounded-lg w-3/4" />
          <div className="h-3.5 bg-gray-100 animate-pulse rounded-lg w-1/3" />
          <div className="h-3.5 bg-gray-100 animate-pulse rounded-lg w-full" />
        </div>
      </div>
    ))}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export default function NoticesSection() {
  const { axios } = useAppContext();

  // "notices" namespace — all t() calls resolve against notices.json
  const { t } = useTranslation("notices");

  const [notices,   setNotices]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  const fetchNotices = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const { data } = await axios.get("/api/notices");
      if (data.success) setNotices(data.notices.slice(0, 6));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [axios]);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const handleRefresh = async () => {
    await fetchNotices(true);
    setRefreshed(true);
    setTimeout(() => setRefreshed(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ duration: 0.3  }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Bell className="h-5 w-5 text-gray-400" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {t("title")}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            title={t("refresh")}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50
              text-gray-400 hover:text-gray-600 transition-colors
              disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${
              refreshed ? "text-emerald-500" : ""
            }`} />
          </button>

          {/* Exact match to ViewAllButton in NoticesPreview.jsx — same
              border/gradient-hover treatment, kept as a Link (not
              button) since this one navigates directly to /notices.    */}
          <Link
            to="/notices"
            className="flex items-center gap-2 font-outfit font-medium text-sm
                       border border-emerald-500 text-emerald-600
                       rounded-md px-4 py-2
                       bg-transparent
                       hover:bg-gradient-to-r hover:from-emerald-500 hover:to-teal-600
                       hover:text-white hover:border-transparent hover:shadow-md
                       transition-all duration-300 ease-out
                       group"
          >
            {t("viewAll")}
            <ArrowRight
              className="w-3.5 h-3.5 transition-transform duration-300
                         group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <NoticeSkeleton />
      ) : error ? (
        <ErrorState onRetry={() => fetchNotices()} t={t} />
      ) : notices.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div className="space-y-2">
          {notices.map((notice, index) => (
            <NoticeCard key={notice._id} notice={notice} index={index} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── NoticeCard ───────────────────────────────────────────────────────────────
// Notice content (title, summary) is admin-authored database content.
// It is intentionally NOT run through t() — database strings will be
// handled separately by the backend Bn-field + localize.js strategy.
// Only the structural UI chrome around the card goes through t().

function NoticeCard({ notice, index }) {
  const d     = new Date(notice.date || notice.createdAt);
  const day   = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
    >
      <Link
        to={`/notices/${notice._id}`}
        className="group flex items-center gap-4 p-4 rounded-xl border
          border-gray-100 hover:border-gray-200 hover:bg-gray-50
          transition-all duration-200"
      >
        {/* Image if present — otherwise a date chip. */}
        {notice.image ? (
          <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden
            border border-gray-100">
            <img
              src={notice.image}
              alt={notice.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="flex-shrink-0 w-16 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide
              text-emerald-600">
              {month}
            </p>
            <p className="text-2xl font-bold text-gray-800 leading-tight mt-0.5">
              {day}
            </p>
          </div>
        )}

        <div className="flex-shrink-0 w-px h-11 bg-gray-100" />

        {/* Text — database-authored content, not translated via t() */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 truncate
            group-hover:text-emerald-600 transition-colors">
            {notice.title}
          </h3>
          {notice.summary && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-1 leading-relaxed">
              {notice.summary}
            </p>
          )}
        </div>

        <ArrowRight className="h-4 w-4 text-gray-300
          group-hover:text-emerald-500 flex-shrink-0
          transition-all duration-200 group-hover:translate-x-1" />
      </Link>
    </motion.div>
  );
}

// ─── States ───────────────────────────────────────────────────────────────────
// t received as prop — these never render independently so they
// don't need their own useTranslation() call.

function EmptyState({ t }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100
        flex items-center justify-center mb-4">
        <Bell className="h-5 w-5 text-gray-300" />
      </div>
      <p className="text-base font-medium text-gray-500">
        {t("empty.title")}
      </p>
      <p className="text-sm text-gray-400 mt-1">
        {t("empty.subtitle")}
      </p>
    </div>
  );
}

function ErrorState({ onRetry, t }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <p className="text-base text-gray-500 mb-3">
        {t("error.message")}
      </p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 text-sm font-semibold
          text-emerald-600 hover:underline transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        {t("error.retry")}
      </button>
    </div>
  );
}