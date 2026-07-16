// client/src/pages/Notices.jsx
//
// REDESIGNED — hero banner + floating search/filter bar.
//
//   - Hero section: your existing site hero image as background, dark
//     gradient overlay for text legibility (same approach as Hero.jsx's
//     brightness(55%) treatment, done here via a gradient instead so
//     the image stays sharp while text stays readable).
//   - Breadcrumb: a light/white-text variant built INLINE for this page
//     only. The shared Breadcrumb.jsx component is styled for white
//     backgrounds (blue links) and is used correctly elsewhere
//     (NoticeDetail.jsx) — changing it globally would break that page,
//     so this page gets its own light variant instead.
//   - Heading: bold Outfit "Community Notices" with emerald highlight,
//     matching NoticesPreview.jsx's heading style — instead of the old
//     font-playfair serif heading. No pill/badge here — kept minimal
//     per feedback, all content horizontally centered in the hero.
//   - Hero height reduced (260px/300px vs original 360px/420px) so the
//     image/content area doesn't dominate the page.
//   - Active breadcrumb crumb (current page) shown in emerald, distinct
//     from the white/70 "Home" link, so it clearly reads as "you are
//     here" rather than another clickable link.
//   - Search + date range: fully functional client-side filtering by
//     title/summary text and notice date range, in a floating white
//     card that overlaps the bottom edge of the hero (common modern
//     pattern — content concept only, not a copy of any reference
//     design's visual style).
//
// List rendering below (date chip / divider / title / arrow) is
// UNCHANGED from your previous version — only now driven by
// filteredNotices instead of notices directly.

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight, ChevronRight, Search, Calendar,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import usePageTitle from "../hooks/usePageTitle";
import { useTranslation } from "react-i18next";

const rowVariant = {
  hidden: { opacity: 0, x: -12 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" },
  }),
};

// Formats a native <input type="date"> value ("YYYY-MM-DD") into clean
// display text ("11 Jul 2026") — used to replace the browser's raw
// mm/dd/yyyy rendering with something that actually looks intentional.
const formatDisplayDate = (isoDateStr) => {
  if (!isoDateStr) return "";
  const d = new Date(`${isoDateStr}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
};

const Notices = () => {
  const { axios, navigate } = useAppContext();
  const { t } = useTranslation("notices");
  usePageTitle(t("title"));

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Search / date-range filter state ────────────────────────────────────
  const [search,   setSearch]   = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");

  // Refs to the actual native date inputs — used to open the picker
  // programmatically via showPicker(), rather than relying on a click
  // "passing through" an invisible overlay input (unreliable across
  // browsers). This is the officially supported way to trigger a
  // native date picker from a custom-styled trigger element.
  const fromDateRef = useRef(null);
  const toDateRef   = useRef(null);

  const openDatePicker = (ref) => {
    if (ref.current?.showPicker) {
      try {
        ref.current.showPicker();
        return;
      } catch {
        // showPicker can throw if called outside a user gesture in
        // some browsers — fall through to focus() below.
      }
    }
    // Fallback for browsers without showPicker support (older Firefox/
    // Safari): focus the field so at least keyboard date entry works.
    ref.current?.focus();
  };

  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get("/api/notices");
      if (data.success) {
        setNotices(data.notices);
      }
    } catch {
      setNotices([]);
    } finally {
      setLoading(false);
    }
  }, [axios]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  // ── Apply filters ────────────────────────────────────────────────────────
  const filteredNotices = useMemo(() => {
    const query = search.trim().toLowerCase();
    const from  = fromDate ? new Date(fromDate)                 : null;
    const to    = toDate   ? new Date(`${toDate}T23:59:59.999`) : null;

    return notices.filter((notice) => {
      const matchesSearch = !query
        || notice.title?.toLowerCase().includes(query)
        || notice.summary?.toLowerCase().includes(query);

      const noticeDate  = new Date(notice.date || notice.createdAt);
      const matchesFrom = !from || noticeDate >= from;
      const matchesTo   = !to   || noticeDate <= to;

      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [notices, search, fromDate, toDate]);

  const hasActiveFilters = search || fromDate || toDate;

  const clearFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="w-full bg-white min-h-screen">

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div className="relative w-full h-[260px] md:h-[300px] overflow-hidden">
        <div
          className="absolute inset-0 bg-[url('/src/assets/heroImage6.png')]
                     bg-cover bg-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b
                        from-black/75 via-black/55 to-black/75" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8
                        h-full flex flex-col items-center justify-center
                        text-center">

          {/* Light breadcrumb — inline variant, this page only.
              Active crumb (current page) shown in emerald so it reads
              clearly as "you are here", matching the emerald highlight
              used in the heading below.                                 */}
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex items-center justify-center gap-1.5 text-base">
              <li>
                <Link
                  to="/"
                  className="text-white/70 hover:text-white
                             font-outfit font-medium transition-colors"
                >
                  Home
                </Link>
              </li>
              <li className="flex items-center gap-1.5">
                <ChevronRight className="h-4 w-4 text-white/40" strokeWidth={2} />
                <span className="text-emerald-400 font-outfit font-semibold">
                  {t("title")}
                </span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-4xl md:text-5xl font-bold text-white mb-3"
          >
            Community <span className="text-emerald-400">Notices</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-white/70 text-sm md:text-base max-w-lg mx-auto"
          >
            A quick look at what's happening around your community.
          </motion.p>
        </div>
      </div>

      {/* ── Floating search / filter bar — overlaps hero bottom edge ────── */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 -mt-8 relative z-20">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100
                        p-3 flex flex-col md:flex-row md:items-center gap-3">

          {/* Search */}
          <div className="flex-1 relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2
                        h-4 w-4 text-gray-400"
              strokeWidth={2}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notices by title or keywords..."
              className="w-full pl-10 pr-4 py-2.5 text-sm
                        border border-gray-200 rounded-xl bg-gray-50
                        outline-none focus:ring-2 focus:ring-emerald-500/20
                        focus:border-emerald-500 focus:bg-white
                        transition-colors"
            />
          </div>

          {/* Date range — a single bordered control housing both dates.
              Each box has an onClick that calls the native input's
              showPicker() via ref, rather than stretching an invisible
              input over the box to "catch" the click — that overlay
              approach is unreliable across browsers (that's what was
              failing). The real <input type="date"> still holds the
              actual value and fires onChange normally when a date is
              picked; it's just visually hidden (opacity-0, and
              pointer-events-none so it never intercepts clicks itself)
              rather than being the click target.                      */}
          <div className="flex items-center border border-gray-200
                          rounded-xl bg-gray-50 divide-x divide-gray-200
                          overflow-hidden">
            {/* Start date */}
            <div
              onClick={() => openDatePicker(fromDateRef)}
              className="relative flex items-center gap-2 px-3.5 py-2.5
                        w-[150px] cursor-pointer select-none"
            >
              <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" strokeWidth={2} />
              <span className={`text-sm truncate ${fromDate ? "text-gray-700" : "text-gray-400"}`}>
                {fromDate ? formatDisplayDate(fromDate) : "Start date"}
              </span>
              <input
                ref={fromDateRef}
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label="Start date"
                tabIndex={-1}
                className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
              />
            </div>

            {/* End date */}
            <div
              onClick={() => openDatePicker(toDateRef)}
              className="relative flex items-center gap-2 px-3.5 py-2.5
                        w-[150px] cursor-pointer select-none"
            >
              <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" strokeWidth={2} />
              <span className={`text-sm truncate ${toDate ? "text-gray-700" : "text-gray-400"}`}>
                {toDate ? formatDisplayDate(toDate) : "End date"}
              </span>
              <input
                ref={toDateRef}
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                aria-label="End date"
                tabIndex={-1}
                className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm font-medium text-gray-500 hover:text-emerald-600
                        px-3 py-2.5 rounded-xl hover:bg-gray-50
                        transition-colors whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Notice list ───────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-10 pb-20">

        {loading ? (
          <div className="flex justify-center items-center h-[40vh]">
            <div className="animate-spin h-8 w-8 border-2 border-gray-200
                            border-t-emerald-500 rounded-full" />
          </div>
        ) : (
          <>
            {hasActiveFilters && (
              <p className="text-sm text-gray-400 font-outfit mb-4">
                {filteredNotices.length} result{filteredNotices.length !== 1 ? "s" : ""}
              </p>
            )}

            <div className="border-t border-b border-gray-100 divide-y divide-gray-100">
              {filteredNotices.map((notice, i) => {
                const d     = new Date(notice.date || notice.createdAt);
                const day   = d.getDate();
                const month = d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();

                return (
                  <motion.button
                    key={notice._id}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={rowVariant}
                    onClick={() => navigate(`/notices/${notice._id}`)}
                    className="w-full flex items-center gap-5 py-6 px-3 -mx-3
                               text-left rounded-lg group
                               hover:bg-gray-50 transition-colors duration-200"
                  >
                    {/* Date chip */}
                    <div className="flex-shrink-0 w-14 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide
                                    text-emerald-600">
                        {month}
                      </p>
                      <p className="text-3xl font-semibold text-gray-800 leading-tight">
                        {day}
                      </p>
                    </div>

                    {/* Divider */}
                    <div className="flex-shrink-0 w-px h-12 bg-gray-200" />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-900 font-bold text-lg
                                    truncate group-hover:text-emerald-600
                                    transition-colors duration-200">
                        {notice.title}
                      </h3>
                      <p className="text-gray-500 text-base truncate mt-1">
                        {notice.summary}
                      </p>
                    </div>

                    <ArrowRight
                      size={20}
                      strokeWidth={2}
                      className="flex-shrink-0 text-gray-300
                                 group-hover:text-emerald-500
                                 group-hover:translate-x-1
                                 transition-all duration-200"
                    />
                  </motion.button>
                );
              })}

              {filteredNotices.length === 0 && (
                <p className="text-gray-400 font-outfit py-14 text-center">
                  {hasActiveFilters
                    ? "No notices match your search."
                    : "No notices available."}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Notices;