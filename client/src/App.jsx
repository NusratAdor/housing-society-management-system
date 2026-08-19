// client/src/App.jsx
//
// CHANGE (this pass): ProtectedRoute now checks staffProfile BEFORE the
// !memberProfile → /create-profile fallback. Without this, every staff
// login (Content Manager / Super Admin — neither has a Member document
// by design) would be redirected into the member-registration form,
// which asks for a membershipNo they don't have and shouldn't get.
//
// /admin index route now renders role-appropriate content: Dashboard
// for Admin, ContentManagerLanding for Content Manager — via the new
// AdminIndex wrapper, so the route table itself stays simple.
//
// Financial/member-management subroutes under /admin are individually
// wrapped with allowedRoles={["admin"]} — Content Manager reaches
// /admin at all, but not those. Content-manageable subroutes accept
// both roles explicitly (defense in depth, even though the outer gate
// already narrows it).
//
// New /super-admin route tree, gated on role "super_admin" only.
//
// Everything else — Home, Notices, Gallery, Events, About Us, Services,
// dashboard/member shell routing — UNCHANGED.

import React, { useState, useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "react-hot-toast";

import { useAppContext }  from "./context/AppContext";
import Navbar             from "./components/Navbar";
import Footer             from "./components/Footer";
import Home               from "./pages/Home";
import Notices            from "./pages/Notices";
import NoticeDetail       from "./pages/NoticeDetail";
import Gallery            from "./pages/Gallery";
import GalleryDetail      from "./pages/GalleryDetail";
import Contact            from "./pages/Contact";
import SignIn             from "./pages/SignIn";
import SignUp             from "./pages/SignUp";
import CreateProfile      from "./pages/CreateProfile";

import Events        from "./pages/Events";
import EventDetail   from "./pages/EventDetail";

import AboutSociety          from "./pages/AboutSociety";
import VisionMission         from "./pages/VisionMission";
import Achievements          from "./pages/Achievements";
import CommitteeSection      from "./pages/CommitteeSection";
import CommitteeMemberDetail from "./pages/CommitteeMemberDetail";

import Services       from "./pages/Services";
import SwimmingPool   from "./pages/SwimmingPool";
import MemberSupport  from "./pages/MemberSupport";

import DashboardOverview from "./pages/dashboard/DashboardOverview";
import DashboardPayment  from "./pages/dashboard/DashboardPayment";
import DashboardProfile  from "./pages/dashboard/DashboardProfile";
import DashboardNotices  from "./pages/dashboard/DashboardNotices";
import DashboardFAQs     from "./pages/dashboard/DashboardFAQs";

import Layout             from "./pages/admin/Layout";
import AdminIndex         from "./pages/admin/AdminIndex";
import ManageMembers      from "./pages/admin/ManageMembers";
import ManageNotices      from "./pages/admin/ManageNotices";
import ManageEvents       from "./pages/admin/ManageEvents";
import ManageFAQs         from "./pages/admin/ManageFAQs";
import ManageGallery      from "./pages/admin/ManageGallery";
import ManageMemberSeats  from "./pages/admin/ManageMemberSeats";
import ManagePayments     from "./pages/admin/ManagePayments";
import ManageCommittee    from "./pages/admin/ManageCommittee";
import ManageAnnouncement from "./pages/admin/ManageAnnouncement";
import DashboardLayout    from "./layouts/DashboardLayout";

// NEW — Super Admin
import SuperAdminLayout   from "./pages/superadmin/SuperAdminLayout";
import ManageStaff        from "./pages/superadmin/ManageStaff";

import LoadingScreen      from "./components/LoadingScreen";
import { ScrollRestorer, ScrollToTopButton } from "./components/ScrollToTop";

// ─── ProtectedRoute ───────────────────────────────────────────────────────────

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isLoaded, isSignedIn } = useAuth();
  const {
    memberProfile, loadingProfile,
    staffProfile,  loadingStaffProfile,
  } = useAppContext();

  if (!isLoaded)               return <LoadingScreen />;
  if (!isSignedIn)              return <Navigate to="/sign-in" replace />;
  if (loadingProfile || loadingStaffProfile) return <LoadingScreen />;

  // Staff identity is checked FIRST and deliberately. Staff (Content
  // Manager, Super Admin) have no Member document by design — if this
  // check ran after the memberProfile check below, every staff login
  // would fall into the !memberProfile branch and get redirected to
  // /create-profile, which is wrong for them.
  if (staffProfile) {
    if (allowedRoles.includes(staffProfile.role)) {
      return children;
    }
    const fallback = staffProfile.role === "super_admin" ? "/super-admin" : "/admin";
    return <Navigate to={fallback} replace />;
  }

  if (!memberProfile) return <Navigate to="/create-profile" replace />;

  const userRole = memberProfile.role || "member";
  if (!allowedRoles.includes(userRole)) {
    const fallback = userRole === "admin" ? "/admin" : "/dashboard";
    return <Navigate to={fallback} replace />;
  }

  return children;
};

// ─── App ──────────────────────────────────────────────────────────────────────

const App = () => {
  const { loadingProfile, loadingStaffProfile } = useAppContext();
  const location = useLocation();

  const [overlayVisible, setOverlayVisible] = useState(true);
  const [overlayFading,  setOverlayFading]  = useState(false);

  useEffect(() => {
    if (!loadingProfile && !loadingStaffProfile) {
      setOverlayFading(true);
      const t = setTimeout(() => setOverlayVisible(false), 600);
      return () => clearTimeout(t);
    }
  }, [loadingProfile, loadingStaffProfile]);

  const isAdminPath      = location.pathname.startsWith("/admin");
  const isSuperAdminPath = location.pathname.startsWith("/super-admin");
  const isDashboardPath  = location.pathname.startsWith("/dashboard");
  const isAuthPath       = location.pathname.startsWith("/sign-in") ||
                           location.pathname.startsWith("/sign-up");

  const hideNavbar = isAdminPath || isSuperAdminPath || isDashboardPath || isAuthPath ||
                     location.pathname === "/create-profile";

  const needsTopMargin = location.pathname !== "/" && !hideNavbar;

  const isShellRoute = isDashboardPath || isAdminPath || isSuperAdminPath;

  return (
    <div>
      <Toaster />

      {overlayVisible && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "#ffffff", display: "flex",
          alignItems: "center", justifyContent: "center",
          opacity: overlayFading ? 0 : 1,
          transition: "opacity 0.6s ease",
          pointerEvents: overlayFading ? "none" : "auto",
        }}>
          <LoadingScreen />
        </div>
      )}

      <ScrollRestorer />
      {!hideNavbar && <Navbar />}

      {isShellRoute ? (
        <Routes location={location}>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={["member", "admin"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index    element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<DashboardOverview />} />
            <Route path="payment"  element={<DashboardPayment />} />
            <Route path="profile"  element={<DashboardProfile />} />
            <Route path="notices"  element={<DashboardNotices />} />
            <Route path="faqs"     element={<DashboardFAQs />} />
            <Route path="*"        element={<Navigate to="overview" replace />} />
          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin", "content_manager"]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Role-aware landing — Admin sees the financial Dashboard,
                Content Manager sees a scoped, non-financial landing page. */}
            <Route index element={<AdminIndex />} />

            {/* Content-manageable — Admin OR Content Manager */}
            <Route
              path="manage-notices"
              element={
                <ProtectedRoute allowedRoles={["admin", "content_manager"]}>
                  <ManageNotices />
                </ProtectedRoute>
              }
            />
            <Route
              path="manage-gallery"
              element={
                <ProtectedRoute allowedRoles={["admin", "content_manager"]}>
                  <ManageGallery />
                </ProtectedRoute>
              }
            />
            <Route
              path="manage-announcements"
              element={
                <ProtectedRoute allowedRoles={["admin", "content_manager"]}>
                  <ManageAnnouncement />
                </ProtectedRoute>
              }
            />
            <Route
              path="manage-faqs"
              element={
                <ProtectedRoute allowedRoles={["admin", "content_manager"]}>
                  <ManageFAQs />
                </ProtectedRoute>
              }
            />

            {/* Admin-only — members, dues, payments, seats, events, committee */}
            <Route
              path="manage-members"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ManageMembers />
                </ProtectedRoute>
              }
            />
            <Route
              path="manage-events"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ManageEvents />
                </ProtectedRoute>
              }
            />
            <Route
              path="manage-seats"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ManageMemberSeats />
                </ProtectedRoute>
              }
            />
            <Route
              path="manage-committee"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ManageCommittee />
                </ProtectedRoute>
              }
            />
            <Route
              path="payments"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ManagePayments />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Super Admin — single-purpose: manage staff accounts only. */}
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute allowedRoles={["super_admin"]}>
                <SuperAdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ManageStaff />} />
            <Route path="*" element={<Navigate to="/super-admin" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <div className={`${needsTopMargin ? "mt-[50px]" : ""} min-h-[70vh]`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Routes location={location} key={location.pathname}>
                <Route path="/"            element={<Home />} />
                <Route path="/notices"     element={<Notices />} />
                <Route path="/notices/:id" element={<NoticeDetail />} />
                <Route path="/gallery"     element={<Gallery />} />
                <Route path="/gallery/:id" element={<GalleryDetail />} />
                <Route path="/contact"     element={<Contact />} />
                <Route path="/sign-in/*"   element={<SignIn />} />
                <Route path="/sign-up/*"   element={<SignUp />} />
                <Route path="/create-profile" element={<CreateProfile />} />

                <Route path="/events"      element={<Events />} />
                <Route path="/events/:id"  element={<EventDetail />} />

                <Route path="/about-us"                          element={<AboutSociety />} />
                <Route path="/about-us/vision-mission"           element={<VisionMission />} />
                <Route path="/about-us/achievements"             element={<Achievements />} />
                <Route path="/about-us/advisers"                 element={<CommitteeSection category="adviser" />} />
                <Route path="/about-us/chairman"                 element={<CommitteeSection category="chairman" />} />
                <Route path="/about-us/general-secretary"        element={<CommitteeSection category="generalSecretary" />} />
                <Route path="/about-us/former-chairman"          element={<CommitteeSection category="formerChairman" />} />
                <Route path="/about-us/former-general-secretary" element={<CommitteeSection category="formerGeneralSecretary" />} />
                <Route path="/about-us/executive-committee"      element={<CommitteeSection category="executiveCommittee" />} />
                <Route path="/about-us/member/:id"               element={<CommitteeMemberDetail />} />

                <Route path="/our-services"                  element={<Services />} />
                <Route path="/our-services/swimming-pool"    element={<SwimmingPool />} />
                <Route path="/our-services/member-support"   element={<MemberSupport />} />

                <Route path="*"            element={<Navigate to="/" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {!hideNavbar && <Footer />}
      <ScrollToTopButton />
    </div>
  );
};

export default App;