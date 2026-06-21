// client/src/components/member/NoticesSection.jsx
//
// CHANGE from previous version:
//   - useTranslation("notices") added.
//   - All hardcoded UI chrome strings replaced with t() calls.
//   - Notice title, summary, content are NOT translated via t() —
//     they are admin-authored strings stored in MongoDB. They will
//     be handled by the backend Bn-field strategy (Phase 4 of the
//     backend migration) and not by i18next.
//   - t passed to EmptyState and ErrorState as a prop — neither
//     renders independently so they do not need their own hook call.
//   - Zero functional changes: fetch, refresh, error/empty states,
//     NoticeCard linking — all identical to previous version.

import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../context/AppContext";
import { formatDate } from "../../utils/formatDate";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const NoticeSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <div key={i} className="flex gap-3 p-4 rounded-xl border border-gray-100">
        <div className="w-16 h-16 rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-3.5 bg-gray-100 animate-pulse rounded-lg w-3/4" />
          <div className="h-3 bg-gray-100   animate-pulse rounded-lg w-1/3" />
          <div className="h-3 bg-gray-100   animate-pulse rounded-lg w-full" />
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
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-xl">
            <Bell className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {t("title")}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            title={t("refresh")}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50
              text-gray-400 hover:text-gray-600 transition-colors
              disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${
              refreshed ? "text-emerald-500" : ""
            }`} />
          </button>

          <Link
            to="/notices"
            className="flex items-center gap-1.5 text-xs font-semibold
              text-[var(--color-primary)] hover:underline"
          >
            {t("viewAll")}
            <ExternalLink className="h-3 w-3" />
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
    >
      <Link
        to={`/notices/${notice._id}`}
        className="group flex gap-4 p-4 rounded-xl border border-gray-100
          hover:border-[var(--color-primary)]/30 hover:bg-blue-50/30
          transition-all duration-200"
      >
        {/* Image or placeholder */}
        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden
          bg-gray-100 border border-gray-100">
          {notice.image ? (
            <img
              src={notice.image}
              alt={notice.title}
              className="w-full h-full object-cover group-hover:scale-105
                transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Bell className="h-6 w-6 text-gray-300" />
            </div>
          )}
        </div>

        {/* Text — database-authored content, not translated via t() */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate
            group-hover:text-[var(--color-primary)] transition-colors">
            {notice.title}
          </h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {formatDate(notice.date)}
          </p>
          {notice.summary && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
              {notice.summary}
            </p>
          )}
        </div>

        <ExternalLink className="h-3.5 w-3.5 text-gray-300
          group-hover:text-[var(--color-primary)] flex-shrink-0 mt-1
          transition-colors" />
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
      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center
        justify-center mb-4">
        <Bell className="h-6 w-6 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-500">
        {t("empty.title")}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        {t("empty.subtitle")}
      </p>
    </div>
  );
}

function ErrorState({ onRetry, t }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <p className="text-sm text-gray-500 mb-3">
        {t("error.message")}
      </p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 text-xs font-semibold
          text-[var(--color-primary)] hover:underline"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {t("error.retry")}
      </button>
    </div>
  );
}