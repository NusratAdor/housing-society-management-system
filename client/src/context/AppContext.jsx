// client/src/context/AppContext.jsx
//
// CHANGE (this pass): added a second, fully independent profile fetch —
// staffProfile (StaffAccount) — following the EXACT same shape as the
// existing memberProfile fetch: own ref-stabilized navigate/getToken,
// own retry/backoff counter, own loading flag. This is deliberate, not
// a shortcut — a user can be a Member, staff, both, or neither, and
// conflating the two fetches into one function would break that
// distinction. Nothing about the existing memberProfile fetch logic,
// retry behavior, or error handling changes.

import axiosInstance from "../utils/axiosInstance.js";
import {
  createContext, useContext, useState,
  useEffect, useCallback, useRef, useMemo,
} from "react";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

const AppContext = createContext();

// Retry config for Render free-tier cold starts
const MAX_RETRIES   = 4;
const RETRY_BASE_MS = 2000;

export const AppProvider = ({ children }) => {
  const navigate = useNavigate();
  const { user }  = useUser();
  const { getToken, isLoaded } = useAuth();

  const [memberProfile,  setMemberProfile]  = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isAdmin,        setIsAdmin]        = useState(false);

  // NEW — staff identity, fully independent of member identity.
  const [staffProfile,        setStaffProfile]        = useState(null);
  const [loadingStaffProfile, setLoadingStaffProfile]  = useState(true);
  const [isSuperAdmin,        setIsSuperAdmin]         = useState(false);
  const [isContentManager,    setIsContentManager]     = useState(false);

  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);

  // Separate retry state for the staff fetch — must not share a counter
  // with the member fetch, since the two requests fail/succeed independently.
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
        setIsAdmin(data.member.role === "admin");
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

  // NEW — staff profile fetch. Deliberately silent on 404 (most users are
  // not staff — that is the expected, common case, not an error worth
  // surfacing) and deliberately does NOT redirect on session expiry itself,
  // since fetchMemberProfile already owns that responsibility. This fetch
  // only ever sets staff-related state.
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

      // 404 = not staff. This is the normal case for the vast majority
      // of users — no toast, no retry, just an empty staff identity.
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

      // Fail closed and quietly — a broken staff-status check should
      // never block a regular member from using the app normally.
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

  
  // Computed once here — the single source of truth for which contexts
  // this user can switch between. Every component that needs to know
  // "where can this user go" (Navbar, WorkspaceSwitcher, etc.) reads
  // THIS instead of re-deriving isAdmin/isContentManager/memberProfile
  // logic independently — that duplication is what caused the Content
  // Manager "Create Profile" button bug.
const availableWorkspaces = useMemo(() => {
    const workspaces = [];
    if (isSuperAdmin) {
      workspaces.push({ key: "super-admin", path: "/super-admin", soloLabel: "Super Admin", switchLabel: "Super Admin" });
    }
    if (isAdmin || isContentManager) {
      workspaces.push({ key: "admin", path: "/admin", soloLabel: "Admin Panel", switchLabel: "Admin Panel" });
    }
    if (memberProfile) {
      workspaces.push({ key: "member", path: "/dashboard", soloLabel: "Dashboard", switchLabel: "My Membership" });
    }
    return workspaces;
  }, [isSuperAdmin, isAdmin, isContentManager, memberProfile]);


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
    // NEW
    availableWorkspaces,
  }), [
    navigate, user, getToken,
    memberProfile, fetchMemberProfile, loadingProfile, isAdmin,
    staffProfile, fetchStaffProfile, loadingStaffProfile, isSuperAdmin, isContentManager,
    availableWorkspaces,
  ]);



  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);