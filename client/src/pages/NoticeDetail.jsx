// client/src/pages/NoticeDetail.jsx
//
// REDESIGNED (3rd pass) — hero restored, but minimal: breadcrumb +
// title only, no subheading/subtitle text in the hero this time (that
// was the "subheading" being removed — the previous hero version also
// had a "Posted on" line under the title; that's gone now, both dates
// live together in the content card below instead).
//
//   - Hero: same background image + gradient overlay as the Notices
//     list page. Contains ONLY the light breadcrumb + bold white title
//     — nothing else. Title is NOT repeated in the card below (it
//     already lives in the hero — showing it twice would be
//     redundant).
//   - Breadcrumb: only the ACTIVE (current page / notice title) crumb
//     gets a distinct color (emerald-400). "Home" and "Notices" stay
//     white/70 — this was already the convention on the Notices list
//     page hero breadcrumb, applied here too.
//   - Card below: UNCHANGED content — both "Posted on" and "Date"
//     shown together in one meta row, then body, then attachment.
//     Only the top accent bar color changed, from emerald-500 to the
//     specific requested #CAD2C5.
//   - Everything else (data fetching, loading/error states, toast
//     handling, attachment logic, image rendering) — UNCHANGED.

import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAppContext } from "../context/AppContext";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import { formatDate } from "../utils/formatDate";
import {
  CalendarDays, ChevronRight, Paperclip, FileText, Download,
} from "lucide-react";

import usePageTitle from "../hooks/usePageTitle";

const NoticeDetail = () => {
  const { axios } = useAppContext();
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { t }     = useTranslation("notices");

  const [notice,  setNotice]  = useState(null);
  const [loading, setLoading] = useState(true);

  usePageTitle(notice?.title ?? null);

  useEffect(() => {
    const fetchNotice = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/notices/${id}`);
        if (data.success) {
          setNotice(data.notice);
        } else {
          toast.error(data.message || "Failed to load notice");
          navigate("/notices");
        }
      } catch {
        toast.error("Error loading notice. Please try again.");
        navigate("/notices");
      } finally {
        setLoading(false);
      }
    };
    fetchNotice();
  }, [id, navigate, axios]);

  // Display name: use the clean original filename captured at upload
  // time. Falls back to "Attachment" only for legacy notices created
  // before this field existed.
  const attachmentName = notice?.attachmentOriginalName || "Attachment";

  // ── Loading / not-found — no hero here, since there's no notice
  //    data yet to put a title in.                                    */
  if (loading) {
    return (
      <div className="w-full bg-white min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-gray-200
                        border-t-emerald-500 rounded-full" />
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="w-full bg-white min-h-screen flex items-center justify-center">
        <p className="text-gray-500 font-outfit">Notice not found.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white min-h-screen">

      {/* ── Hero — breadcrumb + title only, no subheading ────────────────── */}
      <div className="relative w-full overflow-hidden">
        <div
          className="absolute inset-0 bg-[url('/src/assets/heroImage6.png')]
                     bg-cover bg-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b
                        from-black/75 via-black/55 to-black/75" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8
                        py-16 md:py-20 flex flex-col items-center text-center">

          {/* Light breadcrumb — only the active (current) crumb is
              colored differently (emerald-400); Home and Notices stay
              white/70, matching the Notices list page convention.      */}
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-base flex-wrap">
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
                <ChevronRight className="h-3.5 w-3.5 text-white/40" strokeWidth={2} />
                <Link
                  to="/notices"
                  className="text-white/70 hover:text-white
                             font-outfit font-medium transition-colors"
                >
                  {t("title")}
                </Link>
              </li>
              <li className="flex items-center gap-1.5 min-w-0">
                <ChevronRight className="h-3.5 w-3.5 text-white/40 flex-shrink-0" strokeWidth={2} />
                <span
                  className="text-emerald-400 font-outfit font-medium
                             truncate max-w-[220px]"
                  aria-current="page"
                >
                  {notice.title}
                </span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            Community <span className="text-emerald-400">Notices</span>
          </motion.h1>
        </div>
      </div>

      {/* ── Content card — normal spacing below hero, no overlap ─────────── */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 mt-10 md:mt-12 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative bg-white border border-gray-100
                    rounded-2xl shadow-lg overflow-hidden"
        >
          {/* Top accent bar */}
          <div className="h-1" style={{ backgroundColor: "#84A98C" }} />

          <div className="p-6 md:p-10">

            {/* Title — restored here since the hero now shows a
                generic "Community Notices" heading rather than this
                specific notice's title, so the card is the only place
                the actual title appears.                               */}
            <h2 className="font-bold text-2xl md:text-3xl
                           text-gray-900 mb-4 leading-tight">
              {notice.title}
            </h2>

            {/* Meta row — both dates together */}
            <div className="mb-6 pb-6 border-b border-gray-100
                            flex flex-wrap items-center gap-x-5 gap-y-1.5
                            text-sm text-gray-500">
              <span className="flex items-center gap-1.5
                               text-emerald-600 font-medium">
                <CalendarDays size={15} strokeWidth={1.8} />
                {t("detail.postedOn")} {formatDate(notice.createdAt)}
              </span>

              {notice.date && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={15} strokeWidth={1.8} />
                  {t("detail.date")}: {formatDate(notice.date)}
                </span>
              )}
            </div>

            {/* Image — real, notice-specific content */}
            {notice.image && (
              <img
                src={notice.image}
                alt={notice.title}
                className="w-full h-[320px] object-cover rounded-xl mb-6"
              />
            )}

            {/* Body */}
            <div className="space-y-4">
              {notice.summary && (
                <p className="text-gray-700 font-outfit text-base
                              font-medium leading-relaxed">
                  {notice.summary}
                </p>
              )}
              {notice.content && (
                <p className="text-gray-700 font-outfit text-base
                              leading-relaxed">
                  {notice.content}
                </p>
              )}
            </div>

            {/* Attachment — renders if the notice has one. */}
            {notice.attachment && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="flex items-center gap-1.5 text-xs font-semibold
                              text-gray-400 uppercase tracking-wide mb-3">
                  <Paperclip size={13} strokeWidth={2} />
                  Attachment
                </p>

                <a
                  href={notice.attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4
                             bg-gray-50 hover:bg-emerald-50
                             border border-gray-200 hover:border-emerald-300
                             rounded-xl transition-all duration-200 group"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg
                                  bg-emerald-100 flex items-center justify-center
                                  group-hover:bg-emerald-500 transition-colors
                                  duration-200">
                    <FileText
                      size={18}
                      strokeWidth={2}
                      className="text-emerald-600 group-hover:text-white
                                transition-colors duration-200"
                    />
                  </div>

                  <span className="flex-1 min-w-0 text-sm font-medium
                                   text-gray-700 truncate group-hover:text-emerald-700
                                   transition-colors duration-200">
                    {attachmentName}
                  </span>

                  <Download
                    size={16}
                    className="flex-shrink-0 text-gray-400
                              group-hover:text-emerald-600
                              transition-colors duration-200"
                  />
                </a>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default NoticeDetail;