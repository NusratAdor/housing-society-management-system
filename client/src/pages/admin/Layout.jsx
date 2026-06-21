// client/src/pages/admin/Layout.jsx
// Shell component for all admin pages.
// Renders the persistent Navbar and Sidebar around the <Outlet />.
//
// WHY this file has NO auth logic:
//   Auth is handled entirely by ProtectedRoute in App.jsx before Layout
//   even mounts. Any user who reaches Layout has already passed:
//     - Clerk session check (isSignedIn)
//     - Profile load check (loadingProfile)
//     - Role check (role === "admin")
//   Adding a second useEffect auth guard here (as the original did) meant:
//     1. process.env.ADMIN_CLERK_ID is always undefined in the browser
//        (it is a Node.js concept) so that check never worked
//     2. isAdmin was checked twice — once in ProtectedRoute, once here
//     3. toast.error fired and navigate() ran simultaneously with React
//        Router's own redirect from ProtectedRoute, causing double renders
//     4. useNavigate inside a useEffect with navigate in the dep array
//        can cause infinite loops if the condition is unstable
//   The fix: Layout is purely a layout component. Auth is not its job.

import React from "react";
import { Outlet } from "react-router-dom";
import Navbar  from "../../components/admin/Navbar";
import Sidebar from "../../components/admin/Sidebar";

const Layout = () => {
  return (
    <div style={{ animation: "page-fade 0.4s ease both" }} className="flex flex-col h-screen bg-white">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {/*
          WHY overflow-y-auto here and not h-full:
          The original used h-full on the content pane. h-full makes the div
          exactly as tall as its parent which itself is h-screen. On any admin
          page taller than the viewport (ManageMembers with many rows, etc.)
          the content was clipped — no scroll appeared because the div could
          not grow beyond its fixed height. overflow-y-auto allows the pane
          to scroll independently while the Sidebar and Navbar stay fixed.
        */}
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