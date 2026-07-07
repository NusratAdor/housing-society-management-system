// client/src/layouts/DashboardLayout.jsx
//
// Shell for the member dashboard. TopBar and Sidebar render exactly
// once here and never re-mount when the route changes underneath them.
//
// Outlet swap is intentionally unanimated — matching the pattern proven
// in the project-management reference (plain <Outlet/>, no wrapper).
// React Router already unmounts/mounts the matched child instantly and
// correctly on its own; wrapping it in AnimatePresence with mode="wait"
// only introduces a visible flicker for no benefit.

import React, { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import DashboardTopBar    from "../components/member/DashboardTopBar";
import DashboardSidebar   from "../components/member/DashboardSidebar";
import DashboardMobileNav from "../components/member/DashboardMobileNav";
import { useAppContext }  from "../context/AppContext";

export default function DashboardLayout() {
  const { memberProfile, axios, getToken } = useAppContext();
  const [joinDate, setJoinDate] = useState(null);

  const fetchJoinDate = useCallback(async () => {
    if (!memberProfile?.membershipNo) return;
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/members/seat", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success && data.joinDate) setJoinDate(data.joinDate);
    } catch {
      /* non-fatal */
    }
  }, [axios, getToken, memberProfile?.membershipNo]);

  useEffect(() => {
    fetchJoinDate();
  }, [fetchJoinDate]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-50">
      {/* Fixed top bar — mounted once, never re-renders on route change */}
      <DashboardTopBar />

      <div className="flex mt-14" style={{ height: "calc(100vh - 56px)" }}>

        {/* Sidebar — mounted once, active link derived from URL */}
        <DashboardSidebar memberProfile={memberProfile} joinDate={joinDate} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardMobileNav />

          {/* Outlet swaps instantly and correctly on its own —
              no animation wrapper needed or wanted here. */}
          <main className="flex-1 overflow-y-auto bg-gray-50">
            <Outlet context={{ joinDate }} />
          </main>
        </div>
      </div>
    </div>
  );
}