// client/src/pages/admin/Layout.jsx
// CHANGE: Sidebar is now chosen based on isContentManager. This is a
// rendering choice, not an auth check — auth/role gating already
// happened in ProtectedRoute before Layout ever mounts, consistent
// with this file's existing "Layout is not the place for auth logic"
// principle. Navbar is shared unchanged — its "Dashboard" link already
// points to /admin, which now resolves correctly for both roles via
// AdminIndex.

import React from "react";
import { Outlet } from "react-router-dom";
import Navbar        from "../../components/admin/Navbar";
import Sidebar        from "../../components/admin/Sidebar";
import StaffSidebar   from "../../components/admin/StaffSidebar";
import { useAppContext } from "../../context/AppContext";

const Layout = () => {
  const { isContentManager } = useAppContext();

  return (
    <div style={{ animation: "page-fade 0.4s ease both" }} className="flex flex-col h-screen bg-white">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        {isContentManager ? <StaffSidebar /> : <Sidebar />}
        <div className="flex-1 overflow-y-auto p-4 pt-10 md:px-10">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;