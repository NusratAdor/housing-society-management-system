// client/src/pages/superadmin/SuperAdminLayout.jsx
//
// Deliberately minimal — Super Admin's ONLY permission is managing
// staff accounts, so this shell has no sidebar at all, just the shared
// Navbar (its "Dashboard" link is harmless here — Super Admin simply
// never navigates there) and a single-page Outlet.

import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../../components/admin/Navbar";

const SuperAdminLayout = () => {
  return (
    <div className="flex flex-col h-screen bg-white">
      <Navbar />
      <div className="flex-1 overflow-y-auto p-4 pt-10 md:px-10">
        <div className="max-w-4xl mx-auto w-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLayout;