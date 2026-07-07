// // client/src/pages/DashboardTab.jsx
// //
// // REPLACES MemberDashboard.jsx — one route element per tab, URL-driven.
// // Receives `tab` prop directly from the route definition in App.jsx
// // (no more activeTab state or outlet-context tab passing).
// //
// // CHANGES per your last request:
// //   - Redundant white title bar removed entirely. Each section component
// //     already has its own internal header (ProfileSection: "Profile
// //     details", PaymentSection's own summary card, etc.) — that is now
// //     the only heading, no duplicate page title above it.
// //   - Plot badge removed from the (now-deleted) title bar. It already
// //     lives in the OverviewCard hero and ProfileSection fields, so no
// //     information is lost.
// //   - Background is bg-gray-50 throughout with no extra white strip —
// //     matches the clean, professional look you wanted.
// //   - Mobile pill nav: now real <Link> elements, active state from URL.
// //   - All tab content wrapped in the same max-w-6xl container so every
// //     tab aligns identically with Overview.

// import React, { useState, useEffect, useCallback, useRef } from "react";
// import { useOutletContext, Link, useLocation } from "react-router-dom";
// import {
//   LayoutDashboard, CreditCard, User,
//   Bell, MessageCircle, Image,
// } from "lucide-react";
// import { useTranslation } from "react-i18next";
// import { useAppContext }  from "../context/AppContext";

// import OverviewCard   from "../components/member/OverviewCard";
// import PaymentSection from "../components/member/PaymentSection";
// import ProfileSection from "../components/member/ProfileSection";
// import NoticesSection from "../components/member/NoticesSection";
// import FAQSection     from "../components/member/FAQSection";
// import usePageTitle   from "../hooks/usePageTitle";

// const TAB_COMPONENTS = {
//   overview: OverviewCard,
//   payment:  PaymentSection,
//   profile:  ProfileSection,
//   notices:  NoticesSection,
//   faqs:     FAQSection,
// };

// export default function DashboardTab({ tab }) {
//   const { memberProfile, loadingProfile, navigate, axios, getToken } = useAppContext();
//   const { t } = useTranslation("dashboard");
//   const { pathname } = useLocation();

//   const { joinDate } = useOutletContext() ?? {};

//   const pillsRef = useRef(null);

//   const [breakdown,        setBreakdown]        = useState(null);
//   const [loadingBreakdown, setLoadingBreakdown] = useState(true);

//   const fetchBreakdown = useCallback(async () => {
//     if (!memberProfile) return;
//     try {
//       const token = await getToken();
//       const { data } = await axios.get("/api/payments/me/breakdown", {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (data.success) setBreakdown(data);
//     } catch { /* silent */ }
//     finally { setLoadingBreakdown(false); }
//   }, [axios, getToken, memberProfile]);

//   useEffect(() => { fetchBreakdown(); }, [fetchBreakdown]);

//   useEffect(() => {
//     if (!loadingProfile && !memberProfile) {
//       navigate("/create-profile", { replace: true });
//     }
//   }, [memberProfile, loadingProfile, navigate]);

//   useEffect(() => {
//     if (!pillsRef.current) return;
//     const el = pillsRef.current.querySelector("[data-active='true']");
//     el?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
//   }, [tab]);

//   const goToPayment   = useCallback(() => navigate("/dashboard/payment"), [navigate]);
//   const goToNotices   = useCallback(() => navigate("/dashboard/notices"), [navigate]);
//   const goToFAQs      = useCallback(() => navigate("/dashboard/faqs"),    [navigate]);
//   const stayOnProfile = useCallback(() => navigate("/dashboard/profile"), [navigate]);

//   if (loadingProfile || !memberProfile) {
//     return (
//       <div className="flex items-center justify-center h-64">
//         <div className="w-6 h-6 border-2 border-gray-200
//           border-t-[var(--color-primary)] rounded-full animate-spin" />
//       </div>
//     );
//   }

//   const INTERNAL_TABS = [
//     { id: "overview", path: "/dashboard/overview", label: t("tabs.overview"), shortLabel: t("tabsShort.overview"), icon: LayoutDashboard },
//     { id: "payment",  path: "/dashboard/payment",  label: t("tabs.payment"),  shortLabel: t("tabsShort.payment"),  icon: CreditCard      },
//     { id: "profile",  path: "/dashboard/profile",  label: t("tabs.profile"),  shortLabel: t("tabsShort.profile"),  icon: User            },
//     { id: "notices",  path: "/dashboard/notices",  label: t("tabs.notices"),  shortLabel: t("tabsShort.notices"),  icon: Bell            },
//     { id: "faqs",     path: "/dashboard/faqs",     label: t("tabs.faqs"),     shortLabel: t("tabsShort.faqs"),     icon: MessageCircle   },
//   ];

//   const activeTabDef    = INTERNAL_TABS.find(td => td.id === tab) ?? INTERNAL_TABS[0];
//   const ActiveComponent = TAB_COMPONENTS[tab] ?? OverviewCard;

//   usePageTitle(activeTabDef.label);

//   const sectionProps = {
//     ...(tab === "overview" && {
//       onGoToPayment:      goToPayment,
//       onGoToNotices:      goToNotices,
//       onGoToFAQs:         goToFAQs,
//       memberProfile,
//       breakdown,
//       loadingBreakdown,
//       onRefreshBreakdown: fetchBreakdown,
//       joinDate,
//     }),
//     ...(tab === "payment" && {
//       onPaymentSuccess: fetchBreakdown,
//     }),
//     ...(tab === "profile" && {
//       onActionComplete: stayOnProfile,
//     }),
//   };

//   return (
//     <div className="flex flex-col min-h-full bg-gray-50">

//       {/* Mobile pill nav — real Link elements, URL-driven active state.
//           top-0 not top-14: DashboardLayout's flex row already sits below
//           the fixed top bar via mt-14 on its own parent. This nav's sticky
//           positioning is relative to <main>'s scroll box, which already
//           starts beneath the top bar — adding top-14 again here was
//           reserving a second, phantom 56px gap that doesn't correspond
//           to any real element on screen. */}
//       <div className="lg:hidden sticky top-0 z-30
//         bg-white border-b border-gray-200 shadow-sm
//         px-3 pt-2.5 pb-2">
//         <div
//           ref={pillsRef}
//           className="flex gap-1.5 overflow-x-auto"
//           style={{ scrollbarWidth: "none" }}
//         >
//           {INTERNAL_TABS.map(({ id, path, shortLabel, icon: Icon }) => {
//             const isActive = pathname.startsWith(path);
//             return (
//               <Link
//                 key={id}
//                 to={path}
//                 data-active={isActive}
//                 className={`
//                   flex items-center gap-1.5 px-3.5 py-1.5 rounded-full
//                   text-xs font-semibold whitespace-nowrap flex-shrink-0
//                   border transition-all duration-150
//                   ${isActive
//                     ? "bg-slate-800 border-slate-800 text-white shadow-sm"
//                     : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
//                   }
//                 `}
//               >
//                 <Icon style={{ width: 11, height: 11 }} />
//                 {shortLabel}
//               </Link>
//             );
//           })}

//           <Link
//             to="/gallery"
//             className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full
//               text-xs font-semibold whitespace-nowrap flex-shrink-0
//               border bg-white border-gray-200 text-gray-500
//               hover:border-gray-300 transition-all duration-150"
//           >
//             <Image style={{ width: 11, height: 11 }} />
//             Gallery
//           </Link>
//         </div>
//       </div>

//       {/* Tab content — no redundant title bar. Each section component
//           provides its own heading. bg-gray-50 is the only background
//           layer; section components float their own white cards on it.
//           Page-transition animation is handled one level up in
//           DashboardLayout, wrapping the <Outlet /> — that is the only
//           place a true crossfade between tabs can happen, since that's
//           where React Router actually swaps route elements. */}
//       <div className="flex-1">
//         {tab !== "overview" ? (
//           <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
//             <ActiveComponent {...sectionProps} />
//           </div>
//         ) : (
//           <ActiveComponent {...sectionProps} />
//         )}
//       </div>
//     </div>
//   );
// }