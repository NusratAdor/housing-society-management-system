import React, { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useAppContext } from "../../context/AppContext";
import { toast } from "react-hot-toast";
import Navbar from "../../components/admin/Navbar";
import Sidebar from "../../components/admin/Sidebar";

const Layout = () => {
  const navigate = useNavigate();
  const { isSignedIn, user } = useAuth();
  const { isAdmin, loadingProfile } = useAppContext();

  useEffect(() => {
    if (loadingProfile) return;
    if (!isSignedIn) {
      navigate("/sign-in");
      return;
    }
    if (!isAdmin && user.id !== process.env.ADMIN_CLERK_ID) {
      toast.error("Access denied: Admin permissions required");
      navigate("/dashboard");
    }
  }, [isSignedIn, isAdmin, loadingProfile, navigate, user]);

  if (loadingProfile) {
    return <div className="w-full h-screen flex items-center justify-center bg-white text-gray-600 font-outfit">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <Navbar />
      <div className="flex h-full">
        <Sidebar />
        <div className="flex-1 p-4 pt-10 md:px-10 h-full max-w-7xl mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;