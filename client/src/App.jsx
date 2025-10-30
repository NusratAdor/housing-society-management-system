// App.jsx
import React from "react";
import Navbar from "./components/Navbar";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  useAuth,
} from "@clerk/clerk-react";
import Home from "./pages/Home";
import Footer from "./components/Footer";
import Layout from "./pages/admin/Layout";
import Dashboard from "./pages/admin/Dashboard";
import ManageMembers from "./pages/admin/ManageMembers";
import ManageNotices from "./pages/admin/ManageNotices";
import ManageFAQs from "./pages/admin/ManageFAQs";
import ManageGallery from "./pages/admin/ManageGallery";
import ManagePayments from "./pages/admin/ManagePayments";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import MemberDashboard from "./pages/MemberDashboard";
import Notices from "./pages/Notices";
import NoticeDetail from "./pages/NoticeDetail";
import Gallery from "./pages/Gallery";
import Contact from "./pages/Contact";
import CreateProfile from "./pages/CreateProfile";
import { AnimatePresence, motion } from "framer-motion";
import { useAppContext } from "./context/AppContext";
import { Toaster } from "react-hot-toast";


// PROTECTED ROUTE – FIXED
// App.jsx (only ProtectedRoute part changed)
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { memberProfile, loadingProfile } = useAppContext();
  const { isSignedIn } = useAuth();

  // 1. Wait for Clerk + profile load
  if (!isSignedIn || loadingProfile) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <div className="text-gray-600 font-outfit">Loading...</div>
      </div>
    );
  }

  // 2. No profile → force create profile
  if (!memberProfile) {
    return <Navigate to="/create-profile" replace />;
  }

  // 3. Role check
  const userRole = memberProfile.role || "member";
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const App = () => {
  const { pathname } = useLocation();
  const { isLoaded } = useAuth();
  const { loadingProfile } = useAppContext();

  if (!isLoaded || loadingProfile) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <div className="text-gray-600 font-outfit">Loading...</div>
      </div>
    );
  }

  const isAdminPath = pathname.startsWith("/admin");
  const hideNavbarPaths = ["/sign-in", "/sign-up", "/create-profile"];
  const hideNavbar = isAdminPath || hideNavbarPaths.includes(pathname);

  return (
    <div>
      <Toaster />
      {!hideNavbar && <Navbar />}
      <div
        className={`${
          pathname !== "/" && !hideNavbar ? "mt-[50px]" : ""
        } min-h-[70vh]`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <Routes location={pathname} key={pathname}>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/notices" element={<Notices />} />
              <Route path="/notices/:id" element={<NoticeDetail />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/contact" element={<Contact />} />

              {/* Auth Routes */}
              <Route
                path="/sign-in"
                element={
                  <SignedOut>
                    <SignIn />
                  </SignedOut>
                }
              />
              <Route
                path="/sign-up"
                element={
                  <SignedOut>
                    <SignUp />
                  </SignedOut>
                }
              />

              {/* Member Routes */}
              <Route
                path="/create-profile"
                element={
                  <SignedIn>
                    <CreateProfile />
                  </SignedIn>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <SignedIn>
                    <ProtectedRoute allowedRoles={["member"]}>
                      <MemberDashboard />
                    </ProtectedRoute>
                  </SignedIn>
                }
              />

              {/* Admin Routes */}
              <Route
                path="/admin"
                element={
                  <SignedIn>
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <Layout />
                    </ProtectedRoute>
                  </SignedIn>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="manage-members" element={<ManageMembers />} />
                <Route path="manage-notices" element={<ManageNotices />} />
                <Route path="manage-faqs" element={<ManageFAQs />} />
                <Route path="manage-gallery" element={<ManageGallery />} />
                <Route path="payments" element={<ManagePayments />} />
              </Route>

              {/* Catch All */}
              <Route path="*" element={<Navigate to="/" />} />
              
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
      {!hideNavbar && <Footer />}
    </div>
  );
};

export default App;