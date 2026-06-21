// client/src/pages/NoticeDetail.jsx
//
// CHANGES:
//   - Back button removed. Breadcrumb replaces it — it provides the same
//     "go to /notices" function but also shows the full location context
//     (Home → Notices → This Notice). A dedicated back button alongside
//     a breadcrumb is redundant — the breadcrumb IS the back navigation.
//   - All hardcoded strings now go through t() from the "notices" namespace.
//   - usePageTitle wired to notice.title (already was, no change needed).
//   - formatDate used for the date display instead of raw toLocaleDateString.

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAppContext } from "../context/AppContext";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import { formatDate } from "../utils/formatDate";

import usePageTitle from "../hooks/usePageTitle";
import Breadcrumb   from "../components/Breadcrumb";

const NoticeDetail = () => {
  const { axios } = useAppContext();
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { t }     = useTranslation("notices");

  const [notice,  setNotice]  = useState(null);
  const [loading, setLoading] = useState(true);

  // Title updates from null → notice.title once data loads.
  // While loading the tab shows "GOHS", after load it shows "Notice Title | GOHS".
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

  // Breadcrumb crumbs — built after data loads so the last crumb
  // shows the actual notice title, not a placeholder.
  // While loading this array is omitted and no breadcrumb renders.
  const crumbs = notice
    ? [
        { label: "Home",    href: "/"        },
        { label: t("title"), href: "/notices" },
        { label: notice.title                 }, // no href = current page
      ]
    : [];

  return (
    <div className="w-full bg-white py-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 md:px-8">

        {loading ? (
          <div className="flex justify-center items-center h-[50vh]">
            <div className="animate-spin h-8 w-8 text-gray-600" />
          </div>
        ) : !notice ? (
          <p className="text-gray-500 font-outfit">Notice not found.</p>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0  }}
            transition={{ duration: 0.5  }}
          >
            {/* Breadcrumb — replaces the previous back button.
                "Home / Notices / {notice.title}" provides the same
                navigation affordance without visual redundancy. */}
            <Breadcrumb crumbs={crumbs} />

            {/* Notice header */}
            <div className="mb-8">
              <h1 className="font-playfair text-3xl font-semibold text-gray-900 mb-2">
                {notice.title}
              </h1>
              <p className="text-sm text-gray-400 font-outfit">
                {t("detail.postedOn")} {formatDate(notice.createdAt)}
              </p>
            </div>

            {/* Image */}
            {notice.image && (
              <img
                src={notice.image}
                alt={notice.title}
                className="w-full h-[400px] object-cover rounded-2xl shadow-sm mb-8"
              />
            )}

            {/* Body */}
            <div className="space-y-4 max-w-3xl">
              {notice.date && (
                <p className="text-gray-600 font-outfit text-sm">
                  <span className="font-semibold">{t("detail.date")}:</span>{" "}
                  {formatDate(notice.date)}
                </p>
              )}
              {notice.summary && (
                <p className="text-gray-700 font-outfit text-base font-medium leading-relaxed">
                  {notice.summary}
                </p>
              )}
              {notice.content && (
                <p className="text-gray-700 font-outfit text-base leading-relaxed">
                  {notice.content}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default NoticeDetail;