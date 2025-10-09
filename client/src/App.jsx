import React, { useEffect } from "react";
import Navbar from "./components/Navbar";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  useAuth,
  useUser,
} from "@clerk/clerk-react";
import Home from "./pages/Home";
import Footer from "./components/Footer";
import Layout from "./pages/admin/Layout";
import Dashboard from "./pages/admin/Dashboard";
import ManageMembers from "./pages/admin/ManageMembers";
import ManageNotices from "./pages/admin/ManageNotices";
import ManageFAQs from "./pages/admin/ManageFAQs";
import ManageGallery from "./pages/admin/ManageGallery";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import MemberDashboard from "./pages/MemberDashboard";
import Notices from "./pages/Notices";
import Gallery from "./pages/Gallery";
import Contact from "./pages/Contact";
import CreateProfile from "./pages/CreateProfile";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import { useAppContext } from "./context/AppContext";
import { Toaster } from "react-hot-toast";

const App = () => {
  const { pathname } = useLocation();
  const { isLoaded, getToken } = useAuth();
  const { user, memberProfile, fetchMemberProfile } = useAppContext();

  const isAdminPath = pathname.startsWith("/admin");
  const hideNavbarPaths = ["/sign-in", "/sign-up", "/create-profile"];
  const hideNavbar = isAdminPath || hideNavbarPaths.includes(pathname);

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) return;

      try {
        const token = await getToken();
        const { data } = await axios.get(
          `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/members/me`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (data.success && data.member) {
          if (!memberProfile) fetchMemberProfile();
        }
      } catch (error) {
        // No redirect; let Navbar handle navigation
      }
    };

    checkProfile();
  }, [user, memberProfile, fetchMemberProfile, getToken]);

  if (!isLoaded) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <div className="text-gray-600 font-outfit">Loading...</div>
      </div>
    );
  }

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
              <Route path="/" element={<Home />} />
              <Route path="/notices" element={<Notices />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/contact" element={<Contact />} />
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
                    <MemberDashboard />
                  </SignedIn>
                }
              />
              <Route
                path="/admin"
                element={
                  <SignedIn>
                    <Layout />
                  </SignedIn>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="manage-members" element={<ManageMembers />} />
                <Route path="manage-notices" element={<ManageNotices />} />
                <Route path="manage-faqs" element={<ManageFAQs />} />
                <Route path="manage-gallery" element={<ManageGallery />} />
              </Route>
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>

      {!hideNavbar && <Footer />}
    </div>
  );
};

export default App;