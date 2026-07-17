// client/src/components/member/DashboardTopBar.jsx
//
// CHANGE: removed "Member Portal" text — redundant next to logo.
// Logo + society abbreviation only. Clean, professional.
// CHANGE: logo now links to the public home page ("/") instead of
// "/dashboard" — clicking the logo should always take you back to
// the main site, not just refresh the current dashboard view.

import React, { useCallback, useEffect, useState } from "react";
import { Link }           from "react-router-dom";
import { UserButton }     from "@clerk/clerk-react";
import { assets }         from "../../assets/assets";
import { useAppContext }  from "../../context/AppContext";
import LanguageToggle     from "../LanguageToggle";
import NotificationBell   from "./NotificationBell";

export default function DashboardTopBar() {
  const { user, axios, getToken, navigate } = useAppContext();
  const [notifications, setNotifications]   = useState([]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/notifications/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setNotifications(data.notifications ?? data.payments ?? []);
      }
    } catch { /* silent */ }
  }, [user, axios, getToken]);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14
      bg-white border-b border-gray-200 shadow-sm
      flex items-center justify-between px-4 md:px-6">

      {/* Logo only — no redundant text labels. Links to the public
          home page, not back into the dashboard. */}
      <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
        <img src={assets.logoScrolled} alt="GOMCS" className="h-8 w-auto" />
      </Link>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <LanguageToggle />
        <NotificationBell
          notifications={notifications}
          iconClassName="text-gray-600"
          useFixedPanel
        />
        <UserButton afterSignOut={() => navigate("/")} />
      </div>
    </header>
  );
}