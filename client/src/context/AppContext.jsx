import axios from "axios";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-hot-toast";

axios.defaults.baseURL =
  import.meta.env.VITE_BACKEND_URL ||
  "https://housing-society-backend.vercel.app";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { getToken } = useAuth();
  const [memberProfile, setMemberProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchMemberProfile = useCallback(async () => {
    if (!user) {
      setMemberProfile(null);
      setIsAdmin(false);
      setLoadingProfile(false);
      return;
    }

    try {
      setLoadingProfile(true);
      const token = await getToken();
      if (!token) {
        console.error("No token received from getToken");
        throw new Error("Failed to get authentication token");
      }

      console.log("Fetching /api/members/me with token:", token.slice(0, 10) + "...");
      const { data } = await axios.get("/api/members/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        setMemberProfile(data.member);
        setIsAdmin(data.member.role === "admin");
        console.log("Profile fetched, isAdmin:", data.member.role === "admin");
      } else {
        console.log("Fetch profile failed:", data.message);
        setMemberProfile(null);
        setIsAdmin(false);
        if (location.pathname !== "/create-profile" && user.id !== process.env.ADMIN_CLERK_ID) {
          toast.error(data.message || "Could not fetch profile");
        }
      }
    } catch (error) {
      console.error("Fetch profile error:", error.response?.data || error.message);
      setMemberProfile(null);
      setIsAdmin(false);
      if (error.response?.status === 404 && location.pathname !== "/create-profile" && user.id !== process.env.ADMIN_CLERK_ID) {
        toast.error("Profile not found. Please create your profile.");
      } else if (error.response?.data?.errors?.[0]?.code === "authorization_invalid") {
        console.error("Clerk authorization error:", error.response.data);
        toast.error("Authentication failed. Please sign in again.");
        navigate("/sign-in");
      } else {
        toast.error(
          error.response?.data?.message || error.message || "Error fetching profile"
        );
      }
    } finally {
      setLoadingProfile(false);
    }
  }, [user, getToken, location.pathname, navigate]);

  useEffect(() => {
    if (user) {
      fetchMemberProfile();
    } else {
      setMemberProfile(null);
      setIsAdmin(false);
      setLoadingProfile(false);
    }
  }, [user, fetchMemberProfile]);

  const value = {
    navigate,
    user,
    getToken,
    axios,
    memberProfile,
    setMemberProfile,
    fetchMemberProfile,
    loadingProfile,
    isAdmin,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);
