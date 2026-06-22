// client/src/pages/MemberDashboard.jsx
//
// FIX: Account status in sidebar now reads from computed breakdown data
// instead of memberProfile.paymentStatus which is never set (payment status
// is always computed from charge records, never stored on Member model).
//
// CHANGE: breakdown state lifted from OverviewCard into MemberDashboard.
// fetchBreakdown runs once here and passes data down to OverviewCard as props.
// This means one fetch serves both the sidebar status badge AND OverviewCard —
// no duplicate API calls, no stale data between the two.
//
// OverviewCard receives: breakdown, loadingBreakdown, onRefreshBreakdown
// so it can still trigger a refresh after payment completes.
//
// All other features unchanged: TABS, i18n, navigation, animations, mobile
// pills, ProfileSection stayOnProfile callback — all identical.

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, CreditCard, User, Bell,
  MessageCircle, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../context/AppContext";

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

  const [activeTab, setActiveTab] = useState("overview");
  const pillsRef = useRef(null);

  // ── Breakdown state lifted here ───────────────────────────────────────────
  // WHY lifted: sidebar account status and OverviewCard both need
  // breakdown.paymentStatus. Lifting avoids two parallel fetches for
  // the same data and keeps the sidebar always in sync with OverviewCard.
  const [breakdown,        setBreakdown]        = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(true);

  const fetchBreakdown = useCallback(async () => {
    // Only fetch when the member profile exists — we need the auth context
    if (!memberProfile) return;
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/payments/me/breakdown", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setBreakdown(data);
    } catch {
      // Silent — sidebar stays in loading state, OverviewCard shows skeleton
    } finally {
      setLoadingBreakdown(false);
    }
  }, [axios, getToken, memberProfile]);

  useEffect(() => {
    fetchBreakdown();
  }, [fetchBreakdown]);

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loadingProfile && !memberProfile) {
      navigate("/create-profile", { replace: true });
    }
  }, [memberProfile, loadingProfile, navigate]);

  // Scroll active pill into view on mobile
  useEffect(() => {
    if (!pillsRef.current) return;
    const el = pillsRef.current.querySelector("[data-active='true']");
    el?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [activeTab]);

  const goToPayment    = useCallback(() => setActiveTab("payment"), []);
  const stayOnProfile  = useCallback(() => setActiveTab("profile"), []);

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-gray-200
            border-t-[var(--color-primary)] rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-outfit">Loading…</p>
        </div>
      </div>
    );
  }

  if (!memberProfile) return null;

  const TABS = [
    { id: "overview", label: t("tabs.overview"), shortLabel: t("tabsShort.overview"), icon: LayoutDashboard },
    { id: "payment",  label: t("tabs.payment"),  shortLabel: t("tabsShort.payment"),  icon: CreditCard      },
    { id: "profile",  label: t("tabs.profile"),  shortLabel: t("tabsShort.profile"),  icon: User            },
    { id: "notices",  label: t("tabs.notices"),  shortLabel: t("tabsShort.notices"),  icon: Bell            },
    { id: "faqs",     label: t("tabs.faqs"),     shortLabel: t("tabsShort.faqs"),     icon: MessageCircle   },
  ];

  const activeTabDef    = TABS.find(tab => tab.id === activeTab) ?? TABS[0];
  const ActiveComponent = TAB_COMPONENTS[activeTab] ?? OverviewCard;

  usePageTitle(activeTabDef.label);

  // ── Sidebar payment status ─────────────────────────────────────────────────
  // Reads from computed breakdown, not memberProfile.paymentStatus.
  // Three states:
  //   loadingBreakdown=true  → show neutral skeleton badge (data not yet known)
  //   breakdown=null         → fetch failed, show nothing rather than wrong info
  //   breakdown exists       → show correct computed status
  const isPaid = breakdown?.paymentStatus === "Paid";

  const sectionProps = {
    ...(activeTab === "overview" && {
      onGoToPayment: goToPayment,
      memberProfile,
      // Pass breakdown down — OverviewCard no longer fetches its own
      breakdown,
      loadingBreakdown,
      onRefreshBreakdown: fetchBreakdown,
    }),
    ...(activeTab === "profile" && { onActionComplete: stayOnProfile }),
  };

  const initials = (memberProfile.name ?? "M")
    .split(" ").filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join("");

  return (
    <div
      className="pt-16 min-h-screen bg-gray-100 font-outfit"
      style={{ animation: "page-fade 0.4s ease both" }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8">

        {/* ── MOBILE pill nav ──────────────────────────────────────────── */}
        <div className="lg:hidden sticky top-16 z-30 -mx-4 px-4
          bg-gray-100/95 backdrop-blur-sm border-b border-gray-200 pt-3 pb-2.5">
          <div
            ref={pillsRef}
            className="flex gap-2 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {TABS.map(({ id, shortLabel, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  data-active={isActive}
                  onClick={() => setActiveTab(id)}
                  className={`
                    flex items-center gap-1.5 px-4 py-2 rounded-full
                    text-xs font-semibold whitespace-nowrap flex-shrink-0 border
                    transition-all duration-150
                    ${isActive
                      ? "bg-gray-900 border-gray-900 text-white shadow-sm"
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    }
                  `}
                >
                  <Icon style={{ width: 11, height: 11 }} />
                  {shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-start">

          {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
          <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0
            sticky top-16 self-start min-h-[calc(100vh-64px)]
            bg-white border-r border-gray-200
            shadow-[1px_0_12px_rgba(0,0,0,0.04)]">

            <div className="h-[2px] w-full flex-shrink-0
              bg-gradient-to-r from-[var(--color-primary)] to-teal-400" />

            {/* Identity block */}
            <div className="px-5 pt-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex-shrink-0
                  bg-gradient-to-br from-[var(--color-primary)]/20 to-teal-100
                  flex items-center justify-center ring-2 ring-white shadow-sm">
                  <span className="text-xs font-bold text-[var(--color-primary)]">
                    {initials}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                    {memberProfile.name ?? "Member"}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5 font-mono">
                    {memberProfile.membershipNo ?? ""}
                  </p>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 py-3 px-3 space-y-0.5">
              {TABS.map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`
                      relative w-full flex items-center gap-3 px-3 py-2.5
                      rounded-xl text-sm transition-colors duration-150 text-left group
                      ${isActive
                        ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold"
                        : "text-gray-500 font-medium hover:bg-gray-50 hover:text-gray-800"
                      }
                    `}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2
                        w-[3px] h-5 bg-[var(--color-primary)] rounded-r-full" />
                    )}
                    <Icon
                      style={{ width: 16, height: 16 }}
                      strokeWidth={isActive ? 2.2 : 1.6}
                      className={`flex-shrink-0 transition-colors ${
                        isActive
                          ? "text-[var(--color-primary)]"
                          : "text-gray-400 group-hover:text-gray-600"
                      }`}
                    />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Account status footer */}
            <div className="px-4 pb-5 pt-3 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 px-1">
                {t("sidebar.accountStatus")}
              </p>

              {/* THREE STATES — loading, known-paid, known-pending */}
              {loadingBreakdown ? (
                // Data not yet loaded — show neutral skeleton, not wrong status
                <div className="h-9 rounded-xl bg-gray-100 animate-pulse" />
              ) : !breakdown ? (
                // Fetch failed — show nothing rather than misleading info
                null
              ) : (
                <div className={`flex items-center gap-2 px-3 py-2.5
                  rounded-xl border text-xs font-semibold
                  ${isPaid
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-amber-50  border-amber-200  text-amber-700"
                  }`}>
                  {isPaid
                    ? <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                    : <AlertCircle  size={13} className="text-amber-500  flex-shrink-0" />
                  }
                  {isPaid
                    ? t("sidebar.duesPaid")
                    : t("sidebar.duesPending")
                  }
                </div>
              )}
            </div>
          </aside>

          {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0 lg:pl-8 pt-6 pb-20 border-t border-gray-200">

            <div className="flex items-center justify-between mb-7">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 font-playfair">
                  {activeTabDef.label}
                </h1>
                {activeTab === "overview" && (
                  <p className="text-sm text-gray-400 mt-1">
                    {t("header.welcomeBack", {
                      name: memberProfile.name?.split(" ")[0] ?? "there",
                    })}
                  </p>
                )}
              </div>

              {memberProfile.plotNo && (
                <span className="flex-shrink-0 inline-flex items-center gap-1.5
                  px-3 py-1.5 bg-white border border-gray-200 shadow-sm
                  text-xs rounded-full">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest">
                    {t("header.plot")}
                  </span>
                  <span className="font-semibold text-gray-800">
                    {memberProfile.plotNo}
                  </span>
                </span>
              )}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0  }}
                exit={{    opacity: 0, y: -6  }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <ActiveComponent {...sectionProps} />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}