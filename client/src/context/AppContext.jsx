// client/src/context/AppContext.jsx
//
// FIX (this pass): availableWorkspaces now only includes the member
// workspace when memberProfile.status is "active". A removed member's
// profile is still returned by GET /me (by design — see
// requireActiveMember's reasoning), so checking "memberProfile exists"
// alone was wrong: it kept showing the "Dashboard" button on the
// homepage/navbar even after removal. Also added isRemovedMember, a
// simple flag Navbar.jsx and Hero.jsx use to show a clear
// "Membership Removed" message instead of a misleading button.
//
// (Also includes the earlier fix: isAdmin now checks
// memberProfile.status === "active" too, for the same reason.)

import axiosInstance from "../utils/axiosInstance.js";
import {
  createContext, useContext, useState,
  useEffect, useCallback, useRef, useMemo,
} from "react";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

const AppContext = createContext();

const MAX_RETRIES   = 4;
const RETRY_BASE_MS = 2000;

export const AppProvider = ({ children }) => {
  const navigate = useNavigate();
  const { user }  = useUser();
  const { getToken, isLoaded } = useAuth();

  const [memberProfile,  setMemberProfile]  = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isAdmin,        setIsAdmin]        = useState(false);

  const [staffProfile,        setStaffProfile]        = useState(null);
  const [loadingStaffProfile, setLoadingStaffProfile]  = useState(true);
  const [isSuperAdmin,        setIsSuperAdmin]         = useState(false);
  const [isContentManager,    setIsContentManager]     = useState(false);

  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);

  const staffRetryCountRef = useRef(0);
  const staffRetryTimerRef = useRef(null);

  const navigateRef = useRef(navigate);
  const getTokenRef = useRef(getToken);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const clearStaffRetryTimer = useCallback(() => {
    if (staffRetryTimerRef.current) {
      clearTimeout(staffRetryTimerRef.current);
      staffRetryTimerRef.current = null;
    }
  }, []);

  const fetchMemberProfile = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    if (!user) {
      clearRetryTimer();
      retryCountRef.current = 0;
      setMemberProfile(null);
      setIsAdmin(false);
      setLoadingProfile(false);
      return;
    }

    try {
      setLoadingProfile(true);

      const token = await getTokenRef.current();

      if (!token) {
        throw new Error("NO_TOKEN");
      }

      const { data } = await axiosInstance.get("/api/members/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      retryCountRef.current = 0;
      clearRetryTimer();

      if (data.success) {
        setMemberProfile(data.member);
        // FIX: a removed member's role should never count as active
        // admin power — status must be active too.
        setIsAdmin(data.member.role === "admin" && data.member.status === "active");
      } else {
        setMemberProfile(null);
        setIsAdmin(false);
        if (data.message && data.message !== "Profile not found") {
          toast.error(data.message);
        }
      }
      setLoadingProfile(false);

    } catch (error) {
      const status         = error.response?.status;
      const isNetworkError = !error.response;
      const isNoToken      = error.message === "NO_TOKEN";

      if (status === 404) {
        retryCountRef.current = 0;
        clearRetryTimer();
        setMemberProfile(null);
        setIsAdmin(false);
        setLoadingProfile(false);
        return;
      }

      if (error.response?.data?.errors?.[0]?.code === "authorization_invalid") {
        retryCountRef.current = 0;
        clearRetryTimer();
        setMemberProfile(null);
        setIsAdmin(false);
        setLoadingProfile(false);
        toast.error("Session expired. Please sign in again.");
        navigateRef.current("/sign-in");
        return;
      }

      if ((isNetworkError || isNoToken) && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        const delay = RETRY_BASE_MS * Math.pow(2, retryCountRef.current - 1);

        retryTimerRef.current = setTimeout(() => {
          fetchMemberProfile();
        }, delay);
        return;
      }

      retryCountRef.current = 0;
      clearRetryTimer();
      setMemberProfile(null);
      setIsAdmin(false);
      setLoadingProfile(false);

      if (status >= 500) {
        toast.error("Server error. Please refresh the page.");
      } else if (isNetworkError) {
        toast.error("Could not connect to server. Please refresh the page.");
      }
    }
  }, [isLoaded, user, clearRetryTimer]);

  const fetchStaffProfile = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    if (!user) {
      clearStaffRetryTimer();
      staffRetryCountRef.current = 0;
      setStaffProfile(null);
      setIsSuperAdmin(false);
      setIsContentManager(false);
      setLoadingStaffProfile(false);
      return;
    }

    try {
      setLoadingStaffProfile(true);

      const token = await getTokenRef.current();
      if (!token) {
        throw new Error("NO_TOKEN");
      }

      const { data } = await axiosInstance.get("/api/staff/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      staffRetryCountRef.current = 0;
      clearStaffRetryTimer();

      if (data.success) {
        setStaffProfile(data.staff);
        setIsSuperAdmin(data.staff.role === "super_admin");
        setIsContentManager(data.staff.role === "content_manager");
      } else {
        setStaffProfile(null);
        setIsSuperAdmin(false);
        setIsContentManager(false);
      }
      setLoadingStaffProfile(false);

    } catch (error) {
      const status         = error.response?.status;
      const isNetworkError = !error.response;
      const isNoToken      = error.message === "NO_TOKEN";

      if (status === 404) {
        staffRetryCountRef.current = 0;
        clearStaffRetryTimer();
        setStaffProfile(null);
        setIsSuperAdmin(false);
        setIsContentManager(false);
        setLoadingStaffProfile(false);
        return;
      }

      if ((isNetworkError || isNoToken) && staffRetryCountRef.current < MAX_RETRIES) {
        staffRetryCountRef.current += 1;
        const delay = RETRY_BASE_MS * Math.pow(2, staffRetryCountRef.current - 1);

        staffRetryTimerRef.current = setTimeout(() => {
          fetchStaffProfile();
        }, delay);
        return;
      }

      staffRetryCountRef.current = 0;
      clearStaffRetryTimer();
      setStaffProfile(null);
      setIsSuperAdmin(false);
      setIsContentManager(false);
      setLoadingStaffProfile(false);
    }
  }, [isLoaded, user, clearStaffRetryTimer]);

  useEffect(() => {
    clearRetryTimer();
    retryCountRef.current = 0;
    fetchMemberProfile();
    return () => clearRetryTimer();
  }, [fetchMemberProfile, clearRetryTimer]);

  useEffect(() => {
    clearStaffRetryTimer();
    staffRetryCountRef.current = 0;
    fetchStaffProfile();
    return () => clearStaffRetryTimer();
  }, [fetchStaffProfile, clearStaffRetryTimer]);

  // FIX: only include the member workspace when the member is still
  // active. Without this check, a removed member's still-truthy
  // memberProfile kept the "Dashboard" entry in this list, which is
  // what caused the Navbar and Hero CTA buttons to still say
  // "Dashboard" after removal.
  const availableWorkspaces = useMemo(() => {
    const workspaces = [];
    if (isSuperAdmin) {
      workspaces.push({ key: "super-admin", path: "/super-admin", soloLabel: "Super Admin", switchLabel: "Super Admin" });
    }
    if (isAdmin || isContentManager) {
      workspaces.push({ key: "admin", path: "/admin", soloLabel: "Admin Panel", switchLabel: "Admin Panel" });
    }
    if (memberProfile && memberProfile.status === "active") {
      workspaces.push({ key: "member", path: "/dashboard", soloLabel: "Dashboard", switchLabel: "My Membership" });
    }
    return workspaces;
  }, [isSuperAdmin, isAdmin, isContentManager, memberProfile]);

  // NEW — a simple, explicit flag so any component (Navbar, Hero, etc.)
  // can show a clear "membership removed" message instead of just
  // silently falling back to a generic "Create Profile" button, which
  // would be misleading for someone who already had a membership.
  const isRemovedMember = memberProfile?.status === "removed";

  const value = useMemo(() => ({
    navigate,
    user,
    getToken,
    axios: axiosInstance,
    memberProfile,
    setMemberProfile,
    fetchMemberProfile,
    loadingProfile,
    isAdmin,
    staffProfile,
    fetchStaffProfile,
    loadingStaffProfile,
    isSuperAdmin,
    isContentManager,
    availableWorkspaces,
    // NEW
    isRemovedMember,
  }), [
    navigate, user, getToken,
    memberProfile, fetchMemberProfile, loadingProfile, isAdmin,
    staffProfile, fetchStaffProfile, loadingStaffProfile, isSuperAdmin, isContentManager,
    availableWorkspaces, isRemovedMember,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);