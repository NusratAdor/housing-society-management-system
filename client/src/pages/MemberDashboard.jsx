// client/src/pages/MemberDashboard.jsx
//
// CHANGE (only this): the white bordered title bar shown for non-overview
// tabs has been removed entirely. It contained a redundant page-title
// <h1> (already using font-playfair, which clashed with the modern
// dashboard aesthetic) plus a Plot badge that duplicated info already
// shown in the sidebar and ProfileSection.
//
// Each section component (ProfileSection, NoticesSection, FAQSection,
// PaymentSection) already renders its own internal heading — that is
// now the ONLY heading for its tab. No information is lost: plot number
// lives in the sidebar identity block and in ProfileSection's own field.
//
// bg-gray-50 is now the single, consistent page background with no
// extra white strip above the content — each section's white card
// floats directly on it, which is the modern dashboard pattern you
// wanted.
//
// Nothing else changed: mobile pill nav, tab logic, AnimatePresence
// transition, max-w-6xl content container, all section props — all
// identical to your working version.

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOutletContext, Link } from "react-router-dom";
import {
  LayoutDashboard, CreditCard, User,
  Bell, MessageCircle, Image,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppContext }  from "../context/AppContext";

import OverviewCard   from "../components/member/OverviewCard";
import PaymentSection from "../components/member/PaymentSection";
import ProfileSection from "../components/member/ProfileSection";
import NoticesSection from "../components/member/NoticesSection";
import FAQSection     from "../components/member/FAQSection";
import usePageTitle   from "../hooks/usePageTitle";

const TAB_COMPONENTS = {
  overview: OverviewCard,
  payment:  PaymentSection,
  profile:  ProfileSection,
  notices:  NoticesSection,
  faqs:     FAQSection,
};

export default function MemberDashboard() {
  const { memberProfile, loadingProfile, navigate, axios, getToken } = useAppContext();
  const { t } = useTranslation("dashboard");

  const outletCtx    = useOutletContext();
  const activeTab    = outletCtx?.activeTab    ?? "overview";
  const setActiveTab = outletCtx?.setActiveTab ?? (() => {});
  const joinDate     = outletCtx?.joinDate     ?? null;

  const pillsRef = useRef(null);

  const [breakdown,        setBreakdown]        = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(true);

  const fetchBreakdown = useCallback(async () => {
    if (!memberProfile) return;
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/payments/me/breakdown", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setBreakdown(data);
    } catch { /* silent */ }
    finally { setLoadingBreakdown(false); }
  }, [axios, getToken, memberProfile]);

  useEffect(() => { fetchBreakdown(); }, [fetchBreakdown]);

  useEffect(() => {
    if (!loadingProfile && !memberProfile) {
      navigate("/create-profile", { replace: true });
    }
  }, [memberProfile, loadingProfile, navigate]);

  useEffect(() => {
    if (!pillsRef.current) return;
    const el = pillsRef.current.querySelector("[data-active='true']");
    el?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [activeTab]);

  const goToPayment   = useCallback(() => setActiveTab("payment"),  [setActiveTab]);
  const goToNotices   = useCallback(() => setActiveTab("notices"),  [setActiveTab]);
  const goToFAQs      = useCallback(() => setActiveTab("faqs"),     [setActiveTab]);
  const stayOnProfile = useCallback(() => setActiveTab("profile"),  [setActiveTab]);

  if (loadingProfile || !memberProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-gray-200
          border-t-[var(--color-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  const INTERNAL_TABS = [
    { id: "overview", label: t("tabs.overview"), shortLabel: t("tabsShort.overview"), icon: LayoutDashboard },
    { id: "payment",  label: t("tabs.payment"),  shortLabel: t("tabsShort.payment"),  icon: CreditCard      },
    { id: "profile",  label: t("tabs.profile"),  shortLabel: t("tabsShort.profile"),  icon: User            },
    { id: "notices",  label: t("tabs.notices"),  shortLabel: t("tabsShort.notices"),  icon: Bell            },
    { id: "faqs",     label: t("tabs.faqs"),     shortLabel: t("tabsShort.faqs"),     icon: MessageCircle   },
  ];

  const activeTabDef    = INTERNAL_TABS.find(tab => tab.id === activeTab) ?? INTERNAL_TABS[0];
  const ActiveComponent = TAB_COMPONENTS[activeTab] ?? OverviewCard;

  usePageTitle(activeTabDef.label);

  const sectionProps = {
    ...(activeTab === "overview" && {
      onGoToPayment:      goToPayment,
      onGoToNotices:      goToNotices,
      onGoToFAQs:         goToFAQs,
      memberProfile,
      breakdown,
      loadingBreakdown,
      onRefreshBreakdown: fetchBreakdown,
      joinDate,
    }),
    ...(activeTab === "payment" && {
      onPaymentSuccess: fetchBreakdown,
    }),
    ...(activeTab === "profile" && {
      onActionComplete: stayOnProfile,
    }),
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      {/* ── Mobile pill nav ─────────────────────────────────────────── */}
      <div className="lg:hidden sticky top-14 z-30
        bg-white border-b border-gray-200 shadow-sm
        px-3 pt-2.5 pb-2">
        <div
          ref={pillsRef}
          className="flex gap-1.5 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {INTERNAL_TABS.map(({ id, shortLabel, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                data-active={isActive}
                onClick={() => setActiveTab(id)}
                className={`
                  flex items-center gap-1.5 px-3.5 py-1.5 rounded-full
                  text-xs font-semibold whitespace-nowrap flex-shrink-0
                  border transition-all duration-150
                  ${isActive
                    ? "bg-slate-800 border-slate-800 text-white shadow-sm"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                  }
                `}
              >
                <Icon style={{ width: 11, height: 11 }} />
                {shortLabel}
              </button>
            );
          })}

          <Link
            to="/gallery"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full
              text-xs font-semibold whitespace-nowrap flex-shrink-0
              border bg-white border-gray-200 text-gray-500
              hover:border-gray-300 transition-all duration-150"
          >
            <Image style={{ width: 11, height: 11 }} />
            Gallery
          </Link>
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      {/* The white title bar that used to sit here (page <h1> + Plot
          badge) has been removed entirely. Each section component
          (ProfileSection, NoticesSection, FAQSection, PaymentSection)
          already provides its own internal heading — that is now the
          only heading for its tab. bg-gray-50 is the single consistent
          background; each section's own white card floats on it.       */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {activeTab !== "overview" ? (
              <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
                <ActiveComponent {...sectionProps} />
              </div>
            ) : (
              <ActiveComponent {...sectionProps} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}