// client/src/App.jsx
//
// CHANGE (this pass): full Events system wired up:
//   - /events       -> Events.jsx (public listing, Upcoming/Past)
//   - /events/:id   -> EventDetail.jsx (public single event page)
//   - /admin/manage-events -> ManageEvents.jsx (admin CRUD)
// EventsPreview.jsx (homepage section) now fetches real data from
// GET /api/events/public instead of using dummy arrays — no change
// needed here for that, it was already rendered from Home.jsx.
//
// Everything else — About Us section, Services section, dashboard/
// admin shell routing, ProtectedRoute — UNCHANGED.

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

// Events
import Events        from "./pages/Events";
import EventDetail   from "./pages/EventDetail";

// About Us section
import AboutSociety          from "./pages/AboutSociety";
import VisionMission         from "./pages/VisionMission";
import Achievements          from "./pages/Achievements";
import CommitteeSection      from "./pages/CommitteeSection";
import CommitteeMemberDetail from "./pages/CommitteeMemberDetail";

// Services section
import Services       from "./pages/Services";
import SwimmingPool   from "./pages/SwimmingPool";
import MemberSupport  from "./pages/MemberSupport";

import DashboardOverview from "./pages/dashboard/DashboardOverview";
import DashboardPayment  from "./pages/dashboard/DashboardPayment";
import DashboardProfile  from "./pages/dashboard/DashboardProfile";
import DashboardNotices  from "./pages/dashboard/DashboardNotices";
import DashboardFAQs     from "./pages/dashboard/DashboardFAQs";

import Layout             from "./pages/admin/Layout";
import Dashboard          from "./pages/admin/Dashboard";
import ManageMembers      from "./pages/admin/ManageMembers";
import ManageNotices      from "./pages/admin/ManageNotices";
import ManageEvents       from "./pages/admin/ManageEvents";
import ManageFAQs         from "./pages/admin/ManageFAQs";
import ManageGallery      from "./pages/admin/ManageGallery";
import ManageMemberSeats from "./pages/admin/ManageMemberSeats";
import ManagePayments     from "./pages/admin/ManagePayments";
import ManageCommittee    from "./pages/admin/ManageCommittee";
import ManageAnnouncement from "./pages/admin/ManageAnnouncement";
import DashboardLayout    from "./layouts/DashboardLayout";

import LoadingScreen      from "./components/LoadingScreen";
import { ScrollRestorer, ScrollToTopButton } from "./components/ScrollToTop";

// ─── ProtectedRoute ───────────────────────────────────────────────────────────

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isLoaded, isSignedIn } = useAuth();
  const { memberProfile, loadingProfile } = useAppContext();

  if (!isLoaded)       return <LoadingScreen />;
  if (!isSignedIn)     return <Navigate to="/sign-in" replace />;
  if (loadingProfile)  return <LoadingScreen />;
  if (!memberProfile)  return <Navigate to="/create-profile" replace />;

  const userRole = memberProfile.role || "member";
  if (!allowedRoles.includes(userRole)) {
    const fallback = userRole === "admin" ? "/admin" : "/dashboard";
    return <Navigate to={fallback} replace />;
  }

  return children;
};

// ─── App ──────────────────────────────────────────────────────────────────────

const App = () => {
  const { loadingProfile } = useAppContext();
  const location = useLocation();

  const [overlayVisible, setOverlayVisible] = useState(true);
  const [overlayFading,  setOverlayFading]  = useState(false);

  useEffect(() => {
    if (!loadingProfile) {
      setOverlayFading(true);
      const t = setTimeout(() => setOverlayVisible(false), 600);
      return () => clearTimeout(t);
    }
  }, [loadingProfile]);

  const isAdminPath     = location.pathname.startsWith("/admin");
  const isDashboardPath = location.pathname.startsWith("/dashboard");
  const isAuthPath      = location.pathname.startsWith("/sign-in") ||
                          location.pathname.startsWith("/sign-up");

  const hideNavbar = isAdminPath || isDashboardPath || isAuthPath ||
                     location.pathname === "/create-profile";

  const needsTopMargin = location.pathname !== "/" && !hideNavbar;

  const isShellRoute = isDashboardPath || isAdminPath;

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
    <ProtectedRoute allowedRoles={["member"]}>
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
              <ProtectedRoute allowedRoles={["admin"]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index                  element={<Dashboard />} />
            <Route path="manage-members"  element={<ManageMembers />} />
            <Route path="manage-notices"  element={<ManageNotices />} />
            <Route path="manage-events"   element={<ManageEvents />} />
            <Route path="manage-faqs"     element={<ManageFAQs />} />
            <Route path="manage-gallery"  element={<ManageGallery />} />
            <Route path="manage-seats" element={<ManageMemberSeats />} />
            <Route path="manage-committee" element={<ManageCommittee />} />
            <Route path="manage-announcements" element={<ManageAnnouncement />} />
            <Route path="payments"        element={<ManagePayments />} />
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

                {/* Events */}
                <Route path="/events"      element={<Events />} />
                <Route path="/events/:id"  element={<EventDetail />} />

                {/* About Us section */}
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

                {/* Services section */}
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