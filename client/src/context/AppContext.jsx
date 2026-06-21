// client/src/context/AppContext.jsx
//
// THE CORE FIX explained:
//
// Previous behaviour (causes the 3-URL flash):
//   Mount → user=null (Clerk not ready) → fetchMemberProfile runs →
//   sets loadingProfile=false → ProtectedRoute acts → wrong redirects
//
// The problem: loadingProfile=false was being set based on user=null,
// but user=null at mount time does NOT mean "no user" — it means
// "Clerk hasn't told us yet". These are completely different states.
//
// Correct behaviour:
//   Mount → loadingProfile=true (stays true until we actually KNOW)
//   → Clerk finishes (isLoaded=true, user=AdminUser)
//   → fetchMemberProfile runs → profile arrives → loadingProfile=false
//   → ProtectedRoute acts once with real data → correct destination, no flash
//
// The fix: read isLoaded from useAuth() in AppContext.
// Keep loadingProfile=true for as long as Clerk itself is not ready.
// Only set loadingProfile=false when we have a definitive answer.

import axiosInstance from "../utils/axiosInstance.js";
import {
  createContext, useContext, useState,
  useEffect, useCallback, useRef,
} from "react";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

const AppContext = createContext();

// Retry config for Render free-tier cold starts
const MAX_RETRIES   = 4;
const RETRY_BASE_MS = 2000;

export const AppProvider = ({ children }) => {
  const navigate          = useNavigate();
  const { user }          = useUser();
  // WHY we need isLoaded here, not just in App.jsx:
  // App.jsx uses isLoaded to block its own render — that is correct.
  // But AppContext also needs it to know whether user=null means
  // "signed out" or "Clerk not ready yet". Without isLoaded, a
  // user=null at mount sets loadingProfile=false prematurely.
  const { getToken, isLoaded } = useAuth();

  const [memberProfile,  setMemberProfile]  = useState(null);
  // Starts true — stays true until we have a definitive answer.
  // "Definitive" means: Clerk is ready AND the profile fetch completed
  // (or definitively failed after retries).
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isAdmin,        setIsAdmin]        = useState(false);

  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const fetchMemberProfile = useCallback(async () => {
    // CRITICAL GUARD: if Clerk is not ready yet, do nothing.
    // loadingProfile stays true. We will be called again when
    // isLoaded becomes true (because isLoaded is in the dependency array).
    if (!isLoaded) {
      return;
    }

    // Clerk is ready and user is null — definitively signed out.
    // Only NOW is it safe to set loadingProfile=false with no profile.
    if (!user) {
      clearRetryTimer();
      retryCountRef.current = 0;
      setMemberProfile(null);
      setIsAdmin(false);
      setLoadingProfile(false);
      return;
    }

    // Clerk is ready and we have a user — fetch their profile
    try {
      setLoadingProfile(true);

      const token = await getToken();

      if (!token) {
        // getToken() returned null — Clerk in a transient state
        // Treat as retriable, not a hard failure
        throw new Error("NO_TOKEN");
      }

      const { data } = await axiosInstance.get("/api/members/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Success — reset retry counter
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
      // Always resolve loading after a definitive server response
      setLoadingProfile(false);

    } catch (error) {
      const status         = error.response?.status;
      const isNetworkError = !error.response;
      const isNoToken      = error.message === "NO_TOKEN";

      // 404 = user signed in but no profile yet (new user)
      // This is expected — show /create-profile, do not retry
      if (status === 404) {
        retryCountRef.current = 0;
        clearRetryTimer();
        setMemberProfile(null);
        setIsAdmin(false);
        setLoadingProfile(false);
        return;
      }

      // Clerk token invalid or expired
      if (error.response?.data?.errors?.[0]?.code === "authorization_invalid") {
        retryCountRef.current = 0;
        clearRetryTimer();
        setMemberProfile(null);
        setIsAdmin(false);
        setLoadingProfile(false);
        toast.error("Session expired. Please sign in again.");
        navigate("/sign-in");
        return;
      }

      // Network error or no token — backend likely cold-starting on Render.
      // Retry with exponential backoff.
      // loadingProfile stays TRUE so the UI keeps showing a loading state.
      if ((isNetworkError || isNoToken) && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        const delay = RETRY_BASE_MS * Math.pow(2, retryCountRef.current - 1);

        console.info(
          `[AppContext] Profile fetch failed (network). ` +
          `Retry ${retryCountRef.current}/${MAX_RETRIES} in ${delay / 1000}s`
        );

        // Keep loadingProfile=true — UI stays in loading state during retry
        retryTimerRef.current = setTimeout(() => {
          fetchMemberProfile();
        }, delay);
        return;
      }

      // All retries exhausted or non-retriable server error
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
  // isLoaded is in the dependency array — this is the key addition.
  // When Clerk finishes loading (isLoaded: false → true), this function
  // recreates and the useEffect fires again with the real user value.
  }, [isLoaded, user, getToken, navigate, clearRetryTimer]);

  useEffect(() => {
    clearRetryTimer();
    retryCountRef.current = 0;
    fetchMemberProfile();
    return () => clearRetryTimer();
  }, [fetchMemberProfile, clearRetryTimer]);

  const value = {
    navigate,
    user,
    getToken,
    axios: axiosInstance,
    memberProfile,
    setMemberProfile,
    fetchMemberProfile,
    loadingProfile,
    isAdmin,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);