// client/src/App.jsx
//
// App.jsx blocks on !isLoaded only — same as before.
// ProtectedRoute now works correctly because AppContext keeps
// loadingProfile=true until it has a definitive answer.
//
// The sequence is now:
//   Mount → loadingProfile=true (AppContext starts true)
//   → Clerk loads (isLoaded=true, user=Admin)
//   → AppContext fetchMemberProfile runs → profile fetched
//   → loadingProfile=false, memberProfile=admin, isAdmin=true
//   → ProtectedRoute: all checks pass → renders /admin
//   → ONE navigation to /admin, no intermediate flashes
//
// FIX (sign-up/sign-in not completing):
//   "/sign-in" and "/sign-up" are now wildcard routes ("/sign-in/*",
//   "/sign-up/*"). Clerk's routing="path" mode navigates through
//   sub-paths during the flow (e.g. /sign-up/verify-email-address,
//   /sign-in/factor-one, /sign-up/sso-callback). Without the wildcard,
//   React Router had no match for those sub-paths and fell through to
//   the "*" catch-all, bouncing the user back to "/" mid-flow — so
//   sign-up never reached fallbackRedirectUrl="/create-profile".
//
//   hideNavbar was also switched from an exact-match array to a
//   startsWith() check for auth paths, so the navbar stays hidden on
//   sub-steps like /sign-up/verify-email-address too.

import React from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "react-hot-toast";

import { useAppContext } from "./context/AppContext";
import Navbar          from "./components/Navbar";
import Footer          from "./components/Footer";
import Home            from "./pages/Home";
import Notices         from "./pages/Notices";
import NoticeDetail    from "./pages/NoticeDetail";
import Gallery         from "./pages/Gallery";
import Contact         from "./pages/Contact";
import SignIn          from "./pages/SignIn";
import SignUp          from "./pages/SignUp";
import CreateProfile   from "./pages/CreateProfile";
import MemberDashboard from "./pages/MemberDashboard";
import Layout          from "./pages/admin/Layout";
import Dashboard       from "./pages/admin/Dashboard";
import ManageMembers   from "./pages/admin/ManageMembers";
import ManageNotices   from "./pages/admin/ManageNotices";
import ManageFAQs      from "./pages/admin/ManageFAQs";
import ManageGallery   from "./pages/admin/ManageGallery";
import ManagePayments  from "./pages/admin/ManagePayments";

import LoadingScreen   from "./components/LoadingScreen";
import { ScrollRestorer, ScrollToTopButton } from "./components/ScrollToTop";
import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ProtectedRoute
// ─────────────────────────────────────────────────────────────────────────────
// Six steps in strict order. Each step is a gate — if it does not pass,
// the subsequent steps never run.
//
// Step 3 (loadingProfile spinner) is what prevents the flash.
// It holds the gate open while AppContext is fetching the profile,
// so Steps 4 and 5 only run when we have real data.
// ─────────────────────────────────────────────────────────────────────────────



const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isLoaded, isSignedIn } = useAuth();
  const { memberProfile, loadingProfile } = useAppContext();

  // Step 1 — Clerk not yet initialised
  // isLoaded=false means Clerk hasn't confirmed session yet.
  // isSignedIn is meaningless here — always false until isLoaded=true.
  if (!isLoaded) return <LoadingScreen />;

  // Step 2 — Clerk ready, user not signed in
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;

  // Step 3 — Signed in, waiting for profile fetch
  // This is the gate that prevents /create-profile flash.
  // AppContext keeps loadingProfile=true until the fetch definitively
  // succeeds or fails. We wait here — do not make routing decisions yet.
  if (loadingProfile) return <LoadingScreen />;

  // Step 4 — Profile fetch done, no profile found
  // loadingProfile=false AND memberProfile=null means the user
  // genuinely has no Member document (new user, first time).
  if (!memberProfile) return <Navigate to="/create-profile" replace />;

  // Step 5 — Role check
  const userRole = memberProfile.role || "member";
  if (!allowedRoles.includes(userRole)) {
    // Send to the correct home for their actual role
    const fallback = userRole === "admin" ? "/admin" : "/dashboard";
    return <Navigate to={fallback} replace />;
  }

  // Step 6 — All checks passed
  return children;
};

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────

const App = () => {
  const { loadingProfile } = useAppContext();
  const location = useLocation();
  const { isLoaded } = useAuth();
  const [overlayVisible, setOverlayVisible] = useState(true);
const [overlayFading,  setOverlayFading]  = useState(false);

useEffect(() => {
  if (!loadingProfile) {
    setOverlayFading(true);
    const t = setTimeout(() => setOverlayVisible(false), 600);
    return () => clearTimeout(t);
  }
}, [loadingProfile]);



  const isAdminPath = location.pathname.startsWith("/admin");

  // FIX: prefix match (not exact) so navbar stays hidden on Clerk's
  // in-flow sub-paths too, e.g. /sign-up/verify-email-address,
  // /sign-in/factor-one, /sign-up/sso-callback.
  const isAuthPath = location.pathname.startsWith("/sign-in") ||
                      location.pathname.startsWith("/sign-up");

  const hideNavbar = isAdminPath || isAuthPath || location.pathname === "/create-profile";

  // Pages that manage their own navbar offset internally (pt-16 inside the page).
  // Exclude them from the App-level mt-[50px] wrapper to avoid double-offset.
  const selfOffsetPaths = ["/dashboard"];
  const hasSelfOffset   = selfOffsetPaths.includes(location.pathname);

  // mt-[50px] applies only to non-home pages that use the navbar
  // AND don't manage their own offset.
  const needsTopMargin =
    location.pathname !== "/" &&
    !hideNavbar &&
    !hasSelfOffset;


  return (
    <div>
      <Toaster />

      {overlayVisible && (
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: overlayFading ? 0 : 1,
        transition: "opacity 0.6s ease",
        pointerEvents: overlayFading ? "none" : "auto",
      }}>
        <LoadingScreen />
      </div>
    )}


      {/* Scrolls window to top on every route change — no visible output */}
      <ScrollRestorer />

      {!hideNavbar && <Navbar />}

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

              {/* Public routes — no auth dependency, render immediately */}
              <Route path="/"            element={<Home />} />
              <Route path="/notices"     element={<Notices />} />
              <Route path="/notices/:id" element={<NoticeDetail />} />
              <Route path="/gallery"     element={<Gallery />} />
              <Route path="/contact"     element={<Contact />} />

              {/* FIX: wildcard routes so Clerk's path-based sub-steps
                  (verify-email-address, factor-one, sso-callback, etc.)
                  resolve within the SPA instead of falling through to
                  the "*" catch-all below. */}
              <Route path="/sign-in/*"   element={<SignIn />} />
              <Route path="/sign-up/*"   element={<SignUp />} />

              <Route path="/create-profile" element={<CreateProfile />} />

              {/* Member dashboard */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["member"]}>
                    <MemberDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Admin routes — Layout is the shell, ProtectedRoute is the guard */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index                 element={<Dashboard />} />
                <Route path="manage-members" element={<ManageMembers />} />
                <Route path="manage-notices" element={<ManageNotices />} />
                <Route path="manage-faqs"    element={<ManageFAQs />} />
                <Route path="manage-gallery" element={<ManageGallery />} />
                <Route path="payments"       element={<ManagePayments />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>

      {!hideNavbar && <Footer />}

       {/* Floating scroll-to-top button — always in viewport corner,
          outside all layout containers so nothing clips it */}
      <ScrollToTopButton />
      
    </div>
  );
};

export default App;