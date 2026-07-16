// client/src/hooks/useActiveAnnouncement.js
//
// SIMPLIFIED — dismiss functionality removed. A per-visitor "dismiss
// forever" doesn't make sense for an official society notice: everyone
// should keep seeing it on every visit until an admin turns it off via
// isActive in Manage Announcements. This hook now does exactly one
// thing: resolve and return whichever announcement (if any) the
// backend says should currently be shown.

import { useState, useEffect } from "react";
import { useAppContext } from "../context/AppContext";

export default function useActiveAnnouncement() {
  const { axios } = useAppContext();
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchAnnouncement = async () => {
      try {
        const { data } = await axios.get("/api/announcements/active");
        if (active && data.success) setAnnouncement(data.announcement);
      } catch {
        /* silent — banner just won't show */
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchAnnouncement();
    return () => { active = false; };
  }, [axios]);

  return { announcement, loading };
}