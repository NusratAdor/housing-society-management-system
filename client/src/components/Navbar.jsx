// src/components/Navbar.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { assets } from "../assets/assets";
import { useClerk, UserButton } from "@clerk/clerk-react";
import { useAppContext } from "../context/AppContext";
import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";

const Navbar = () => {
  const { t } = useTranslation();

  // ---------- REMOVE FAQs ----------
  const navLinks = [
    { name: t("Home"), path: "/" },
    { name: t("Notices"), path: "/notices" },
    { name: t("Gallery"), path: "/gallery" },
    { name: t("Contact"), path: "/contact" },
  ];

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, navigate, memberProfile, loadingProfile, isAdmin } =
    useAppContext();
  const { openSignIn } = useClerk();
  const location = useLocation();
  const isHome = location.pathname === "/";

  // Scroll handling
  useEffect(() => {
    const handleScroll = () => {
      if (!isHome) setIsScrolled(true);
      else setIsScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  // Button logic (same as Hero)
  const handleMainButtonClick = () => {
    if (isAdmin) return navigate("/admin");
    if (memberProfile) return navigate("/dashboard");
    return navigate("/create-profile");
  };

  const mainButtonLabel = isAdmin
    ? t("Admin Panel")
    : memberProfile
    ? t("Dashboard")
    : t("Create Profile");

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-white shadow-md backdrop-blur-md py-3 md:py-4"
          : "bg-transparent py-4 md:py-6"
      }`}
    >
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img
            src={isScrolled ? assets.logoScrolled : assets.logo}
            alt="Logo"
            className="transform scale-90 h-9"
          />
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-4 lg:gap-8">
          {navLinks.map((link, i) => (
            <Link
              key={i}
              to={link.path}
              className={`group flex flex-col gap-0.5 transition-colors duration-300 ${
                isScrolled ? "text-gray-800" : "text-white"
              }`}
            >
              {link.name}
              <div
                className={`${
                  isScrolled ? "bg-gray-700" : "bg-white"
                } h-0.5 w-0 group-hover:w-full transition-all duration-300`}
              />
            </Link>
          ))}

          {/* ==== GREEN JOIN / CREATE PROFILE BUTTON ==== */}
          {user && !loadingProfile && (
            <button
              onClick={handleMainButtonClick}
              className={`
                bg-gradient-to-r from-emerald-500 to-teal-600
                hover:from-emerald-600 hover:to-teal-700
                text-white font-outfit font-medium text-sm
                rounded-full px-5 py-1.5
                border border-emerald-400/50
                shadow-sm hover:shadow-md
                transition-all duration-300
                group
              `}
            >
              {mainButtonLabel}
            </button>
          )}
        </div>

        {/* Desktop Auth Section */}
        <div className="hidden md:flex items-center gap-3">
          {/* Language toggle – white on transparent */}
          <div className={isScrolled ? "" : "text-white hover:text-black"}>
            <LanguageToggle />
          </div>

          {user ? (
            <UserButton afterSignOut={() => navigate("/")} />
          ) : (
            <button
              onClick={() => openSignIn()}
              className="
        bg-gradient-to-r from-emerald-500 to-teal-600
        hover:from-emerald-600 hover:to-teal-700
        text-white font-outfit font-medium text-sm
        rounded-full px-6 py-2.5
        shadow-sm hover:shadow-md
        transition-all duration-300
        group
      "
            >
              {t("Sign In")}
            </button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex items-center gap-3 md:hidden">
          {user && <UserButton afterSignOut={() => navigate("/")} />}
          <img
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            src={assets.menuIcon}
            alt="menu-icon"
            className={`h-4 cursor-pointer ${isScrolled && "invert"}`}
          />
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`fixed top-0 left-0 w-full h-screen bg-white flex flex-col md:hidden items-center justify-center gap-6 transition-all duration-500 ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          className="absolute top-4 right-4"
          onClick={() => setIsMenuOpen(false)}
        >
          <img src={assets.closeIcon} alt="close-menu" className="h-6" />
        </button>

        <div className="absolute top-4 left-4">
          <LanguageToggle />
        </div>

        {navLinks.map((link, i) => (
          <Link
            key={i}
            to={link.path}
            onClick={() => setIsMenuOpen(false)}
            className="hover:text-[var(--color-primary)] text-gray-700 text-lg"
          >
            {link.name}
          </Link>
        ))}

        {user && !loadingProfile && (
          <button
            onClick={() => {
              handleMainButtonClick();
              setIsMenuOpen(false);
            }}
            className="
              bg-gradient-to-r from-emerald-500 to-teal-600
              hover:from-emerald-600 hover:to-teal-700
              text-white font-outfit font-medium text-base
              rounded-full px-6 py-2
              shadow-sm hover:shadow-md
              transition-all duration-300
            "
          >
            {mainButtonLabel}
          </button>
        )}

        {!user && (
          <button
            onClick={() => {
              openSignIn();
              setIsMenuOpen(false);
            }}
            className="
      bg-gradient-to-r from-emerald-500 to-teal-600
      hover:from-emerald-600 hover:to-teal-700
      text-white font-outfit font-medium text-base
      rounded-full px-8 py-2.5
      shadow-sm hover:shadow-md
      transition-all duration-300
    "
          >
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
