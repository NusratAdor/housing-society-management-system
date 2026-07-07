// client/src/context/AppContext.jsx
//
// THE CORE FIX (isLoaded) — unchanged, still correct:
//   Mount → loadingProfile=true (stays true until we actually KNOW)
//   → Clerk finishes (isLoaded=true) → fetchMemberProfile runs →
//   profile arrives → loadingProfile=false.
//
// ADDITIONAL FIX — navigate/getToken stability:
//   fetchMemberProfile previously listed `navigate` and `getToken`
//   directly in its useCallback dependency array. Because AppProvider
//   re-renders on every route change (it calls useNavigate, which
//   subscribes to the router), and neither Clerk's getToken nor
//   React Router's navigate are guaranteed to keep the same function
//   reference across every render, fetchMemberProfile was being
//   recreated on every tab switch. That triggered its effect again,
//   which calls setLoadingProfile(true) — and ProtectedRoute swaps
//   DashboardLayout out for LoadingScreen the instant that flips true,
//   which is what caused TopBar/Sidebar to visibly unmount and remount
//   on every navigation.
//
//   Fix: hold the latest navigate/getToken in refs. fetchMemberProfile
//   reads through the ref, so its own identity only changes when
//   isLoaded or user actually change — which is the only time it
//   should ever re-run. Behaviour (session-expiry redirect, retries,
//   error handling) is completely unchanged — only its re-render
//   sensitivity is fixed.
//
// ADDITIONAL FIX — context value memoization:
//   The context `value` object was a new object literal on every
//   render, forcing every consumer of useAppContext() to re-render
//   on every AppProvider render regardless of whether anything they
//   actually use changed. Wrapped in useMemo so consumers only
//   re-render when a value they depend on actually changes.

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

  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);

  // Latest navigate/getToken, read through refs so fetchMemberProfile's
  // identity doesn't change just because these functions got a new
  // reference on an unrelated re-render (e.g. route navigation).
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

        console.info(
          `[AppContext] Profile fetch failed (network). ` +
          `Retry ${retryCountRef.current}/${MAX_RETRIES} in ${delay / 1000}s`
        );

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
  // navigate/getToken intentionally excluded — accessed via ref above.
  // This callback now only changes identity when isLoaded or user
  // actually change, which is the only time it should re-run.
  }, [isLoaded, user, clearRetryTimer]);

  useEffect(() => {
    clearRetryTimer();
    retryCountRef.current = 0;
    fetchMemberProfile();
    return () => clearRetryTimer();
  }, [fetchMemberProfile, clearRetryTimer]);

  // Memoized so consumers of useAppContext() only re-render when a
  // value they actually use changes — not on every AppProvider render.
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
  }), [navigate, user, getToken, memberProfile, fetchMemberProfile, loadingProfile, isAdmin]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);