// client/src/components/Navbar.jsx

import React, { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { assets } from "../assets/assets";
import { UserButton } from "@clerk/clerk-react";  // openSignIn removed
import { useAppContext } from "../context/AppContext";
import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";
import NotificationBell from "./member/NotificationBell";

const Navbar = () => {
  const { t } = useTranslation("navbar");

  const navLinks = [
    { name: t("home"),    path: "/"        },
    { name: t("notices"), path: "/notices" },
    { name: t("gallery"), path: "/gallery" },
    { name: t("contact"), path: "/contact" },
  ];

  const [isScrolled,    setIsScrolled]    = useState(false);
  const [isMenuOpen,    setIsMenuOpen]    = useState(false);
  const [notifications, setNotifications] = useState([]);

  const {
    user,
    navigate,
    memberProfile,
    loadingProfile,
    isAdmin,
    axios,
    getToken,
  } = useAppContext();

  const location = useLocation();
  const isHome   = location.pathname === "/";

  // ── Notifications ─────────────────────────────────────────────────────────
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
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // ── Scroll ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleScroll = () => {
      if (!isHome) setIsScrolled(true);
      else         setIsScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  // ── Main button ───────────────────────────────────────────────────────────
  const handleMainButtonClick = () => {
    if (isAdmin)       return navigate("/admin");
    if (memberProfile) return navigate("/dashboard");
    return navigate("/create-profile");
  };

  const mainButtonLabel = loadingProfile
    ? null
    : isAdmin
    ? t("adminPanel")
    : memberProfile
    ? t("dashboard")
    : t("createProfile");

  useEffect(() => { setIsMenuOpen(false); }, [location.pathname]);

  const btnBase = `bg-gradient-to-r from-emerald-500 to-teal-600
    hover:from-emerald-600 hover:to-teal-700
    text-white font-outfit font-medium
    shadow-sm hover:shadow-md transition-all duration-300`;

  return (
    <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
      isScrolled
        ? "bg-white shadow-md backdrop-blur-md py-3 md:py-4"
        : "bg-transparent py-4 md:py-6"
    }`}>
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img
            src={isScrolled ? assets.logoScrolled : assets.logo}
            alt="Logo"
            className="transform scale-90 h-9"
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4 lg:gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`group flex flex-col gap-0.5 transition-colors duration-300 ${
                isScrolled ? "text-gray-800" : "text-white"
              }`}
            >
              {link.name}
              <div className={`${
                isScrolled ? "bg-gray-700" : "bg-white"
              } h-0.5 w-0 group-hover:w-full transition-all duration-300`} />
            </Link>
          ))}

          {user && !loadingProfile && mainButtonLabel && (
            <button
              onClick={handleMainButtonClick}
              className={`${btnBase} text-sm rounded-full px-5 py-1.5 border border-emerald-400/50`}
            >
              {mainButtonLabel}
            </button>
          )}
        </div>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-3">
          <div className={isScrolled ? "" : "text-white hover:text-black"}>
            <LanguageToggle />
          </div>

          {user && (
            <NotificationBell
              notifications={notifications}
              iconClassName={isScrolled ? "text-gray-600" : "text-white"}
            />
          )}

          {user ? (
            <UserButton afterSignOut={() => navigate("/")} />
          ) : (
            // FIX: navigate to /sign-in instead of openSignIn()
            // This uses the page pattern (routing="path") consistently —
            // the URL changes, Clerk handles the OAuth callbacks correctly,
            // and the browser back button works as expected.
            <button
              onClick={() => navigate("/sign-in")}
              className={`${btnBase} text-sm rounded-full px-6 py-2.5`}
            >
              {t("signIn")}
            </button>
          )}
        </div>

        {/* Mobile right */}
        <div className="flex items-center gap-2 md:hidden">
          {user && (
            <NotificationBell
              notifications={notifications}
              iconClassName={isScrolled ? "text-gray-600" : "text-white"}
            />
          )}
          {user && <UserButton afterSignOut={() => navigate("/")} />}
          <img
            onClick={() => setIsMenuOpen(prev => !prev)}
            src={assets.menuIcon}
            alt="menu"
            className={`h-4 cursor-pointer ${isScrolled ? "invert" : ""}`}
          />
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`fixed top-0 left-0 w-full h-screen bg-white flex flex-col
        md:hidden items-center justify-center gap-6 transition-all duration-500 ${
        isMenuOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <button className="absolute top-4 right-4" onClick={() => setIsMenuOpen(false)}>
          <img src={assets.closeIcon} alt="close" className="h-6" />
        </button>

        <div className="absolute top-4 left-4">
          <LanguageToggle />
        </div>

        {navLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            onClick={() => setIsMenuOpen(false)}
            className="hover:text-[var(--color-primary)] text-gray-700 text-lg"
          >
            {link.name}
          </Link>
        ))}

        {user && !loadingProfile && mainButtonLabel && (
          <button
            onClick={() => { handleMainButtonClick(); setIsMenuOpen(false); }}
            className={`${btnBase} text-base rounded-full px-6 py-2`}
          >
            {mainButtonLabel}
          </button>
        )}

        {!user && (
          // FIX: same change — navigate instead of openSignIn()
          <button
            onClick={() => { navigate("/sign-in"); setIsMenuOpen(false); }}
            className={`${btnBase} text-base rounded-full px-8 py-2.5`}
          >
            {t("signIn")}
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;