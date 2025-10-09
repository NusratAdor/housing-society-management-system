import axios from "axios";
import { createContext, useContext, useState, useEffect } from "react";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();

  const [memberProfile, setMemberProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const fetchMemberProfile = async () => {
    if (!user) {
      setMemberProfile(null);
      setLoadingProfile(false);
      return;
    }

    try {
      setLoadingProfile(true);
      const token = await getToken();
      const { data } = await axios.get("/api/members/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        setMemberProfile(data.member);
      } else {
        setMemberProfile(null);
        toast.error(data.message || "Failed to fetch profile");
      }
    } catch (error) {
      setMemberProfile(null);
      toast.error(error.message || "Error fetching profile");
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (user) fetchMemberProfile();
  }, [user]);

  const value = {
    navigate,
    user,
    getToken,
    axios,
    memberProfile,
    setMemberProfile,
    fetchMemberProfile,
    loadingProfile,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);