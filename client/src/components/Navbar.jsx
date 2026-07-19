// client/src/components/Navbar.jsx
//
// REDESIGN PASS 10 — Services submenu replaced with the 2 requested
//   items: Swimming Pool, Member Support (replacing the previous 4
//   placeholder items — Membership, Dues & Payments, Facilities &
//   Amenities, Member Support — which were always marked as
//   placeholders pending real pages). Same treatment as the About
//   submenu replacement in pass 8: hardcoded labels + icon per item,
//   matching the new real routes built for these pages.
//
// PASS 9 (kept) — mobile menu overlay opacity raised to 96/93/96,
//   blur removed. See prior comments for the reasoning; unchanged here.
//
// PASS 8 (kept) — About submenu replaced with the 7 "About Us" items.
//
// Everything else — glass dropdown treatment, hover-only nav color,
// MenuToggle bar-morph, CTA gradient/radius, NotificationBell hover
// fix — UNCHANGED from the previous pass.

import React, { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { assets } from "../assets/assets";
import { UserButton } from "@clerk/clerk-react";
import { useAppContext } from "../context/AppContext";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  BookOpen,
  Target,
  Lightbulb,
  Crown,
  UserCog,
  History,
  Archive,
  Users,
  Waves,
  LifeBuoy,
} from "lucide-react";
import LanguageToggle from "./LanguageToggle";
import NotificationBell from "./member/NotificationBell";
import AnnouncementBar from "./AnnouncementBar";

const dropdownVariants = {
  hidden: { opacity: 0, y: -6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.15, ease: "easeOut" } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.1 } },
};

const BAR_TRANSITION = { duration: 0.32, ease: [0.65, 0, 0.35, 1] };
const MenuToggle = ({ open, onClick, light }) => (
  <button
    onClick={onClick}
    aria-label={open ? "Close menu" : "Open menu"}
    className="relative flex h-9 w-9 shrink-0 items-center justify-center md:hidden"
  >
    <motion.span
      animate={open ? { rotate: 45, y: 0 } : { rotate: 0, y: -5 }}
      transition={BAR_TRANSITION}
      className={`absolute h-[1.5px] w-4 rounded-full ${light ? "bg-white" : "bg-gray-800"}`}
    />
    <motion.span
      animate={open ? { opacity: 0 } : { opacity: 1 }}
      transition={BAR_TRANSITION}
      className={`absolute h-[1.5px] w-4 rounded-full ${light ? "bg-white" : "bg-gray-800"}`}
    />
    <motion.span
      animate={open ? { rotate: -45, y: 0 } : { rotate: 0, y: 5 }}
      transition={BAR_TRANSITION}
      className={`absolute h-[1.5px] w-4 rounded-full ${light ? "bg-white" : "bg-gray-800"}`}
    />
  </button>
);

const Navbar = () => {
  const { t } = useTranslation("navbar");

  const navLinks = [
    { name: t("home"), path: "/" },
    {
      name: t("about"),
      path: "/about-us",
      submenu: [
        { name: "About Society",             path: "/about-us",                              icon: BookOpen  },
        { name: "Vision & Mission",           path: "/about-us/vision-mission",               icon: Target    },
        { name: "Advisers",                  path: "/about-us/advisers",                     icon: Lightbulb },
        { name: "Chairman",                  path: "/about-us/chairman",                     icon: Crown     },
        { name: "General Secretary",         path: "/about-us/general-secretary",            icon: UserCog   },
        { name: "Former Chairman",           path: "/about-us/former-chairman",              icon: History   },
        { name: "Former General Secretary",  path: "/about-us/former-general-secretary",     icon: Archive   },
        { name: "Executive Committee",       path: "/about-us/executive-committee",          icon: Users     },
      ],
    },
    {
      name: t("services"),
      path: "/our-services",
      submenu: [
        { name: "Swimming Pool",  path: "/our-services/swimming-pool",  icon: Waves    },
        { name: "Member Support", path: "/our-services/member-support", icon: LifeBuoy },
      ],
    },
    { name: t("notices"), path: "/notices" },
    { name: t("gallery"), path: "/gallery" },
    { name: t("contact"), path: "/contact" },
  ];

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [openDesktopMenu, setOpenDesktopMenu] = useState(null);
  const [openMobileSubmenu, setOpenMobileSubmenu] = useState(null);

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

  useEffect(() => {
    const handleScroll = () => {
      if (!isHome) setIsScrolled(true);
      else         setIsScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

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

  useEffect(() => {
    setIsMenuOpen(false);
    setOpenMobileSubmenu(null);
    setOpenDesktopMenu(null);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMenuOpen]);

  const btnBase = `bg-gradient-to-r from-emerald-500 to-teal-600
    hover:from-emerald-600 hover:to-teal-700
    text-white font-outfit font-medium
    shadow-sm hover:shadow-md transition-all duration-300`;

  const isLinkActive = (link) => {
    if (link.path === "/") return location.pathname === "/";
    if (link.submenu) {
      return (
        location.pathname.startsWith(link.path) ||
        link.submenu.some((sub) => location.pathname.startsWith(sub.path))
      );
    }
    return location.pathname.startsWith(link.path);
  };

  const navTextClass = isScrolled
    ? "text-gray-700 hover:text-emerald-600"
    : "text-white/90 hover:text-emerald-300";

  return (
    <>
      <nav className={`fixed top-0 left-0 w-full z-[70] transition-all duration-500 ${
        isScrolled
          ? "bg-white shadow-md backdrop-blur-md"
          : "bg-transparent"
      }`}>
               <AnnouncementBar />

        <div className={`w-full max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 transition-all duration-500 ${
          isScrolled ? "py-3 md:py-4" : "py-4 md:py-6"
        }`}>


          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img
              src={isScrolled ? assets.logoScrolled : assets.logo}
              alt="Logo"
              className="transform scale-90 h-9"
            />
          </Link>

          <div className="hidden md:flex items-center gap-0.5 lg:gap-1">
            {navLinks.map((link) =>
              link.submenu ? (
                <div
                  key={link.path}
                  className="relative"
                  onMouseEnter={() => setOpenDesktopMenu(link.path)}
                  onMouseLeave={() => setOpenDesktopMenu(null)}
                >
                  <button
                    onClick={() => navigate(link.path)}
                    className={`relative flex items-center gap-1 px-3 py-1 text-[15px] lg:text-base font-normal capitalize tracking-wide transition-colors duration-300 ${navTextClass}`}
                  >
                    {link.name}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-300 ${
                        openDesktopMenu === link.path ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {openDesktopMenu === link.path && (
                      <motion.div
                        variants={dropdownVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="absolute left-1/2 -translate-x-1/2 top-full pt-3"
                      >
                        <div className="relative min-w-[240px] overflow-hidden rounded-xl border border-white/60 bg-white/90 backdrop-blur-2xl backdrop-saturate-125 shadow-[0_10px_35px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.8)]">
                          <div className="pointer-events-none absolute -top-2 -left-2 h-9 w-9 rounded-full bg-emerald-400/30 blur-xl" />
                          <div className="pointer-events-none absolute -bottom-2 -right-2 h-9 w-9 rounded-full bg-teal-500/25 blur-xl" />

                          <div className="relative py-1.5">
                            {link.submenu.map((sub) => {
                              const Icon = sub.icon;
                              return (
                                <Link
                                  key={sub.path}
                                  to={sub.path}
                                  className="group flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] font-medium capitalize text-gray-900 transition-colors duration-150 hover:bg-white/50 hover:text-emerald-700"
                                >
                                  {Icon && (
                                    <Icon className="h-[18px] w-[18px] text-gray-700 transition-colors duration-150 group-hover:text-emerald-600" />
                                  )}
                                  {sub.name}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative px-3 py-1 text-[15px] lg:text-base font-normal capitalize tracking-wide transition-colors duration-300 ${navTextClass}`}
                >
                  {link.name}
                </Link>
              )
            )}

            {user && !loadingProfile && mainButtonLabel && (
              <button
                onClick={handleMainButtonClick}
                className={`${btnBase} ml-2 text-sm rounded-md px-5 py-1.5`}
              >
                {mainButtonLabel}
              </button>
            )}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <div className={isScrolled ? "text-[#111827]" : "text-white"}>
              <LanguageToggle />
            </div>

            {user && (
              <NotificationBell
                notifications={notifications}
                iconClassName={isScrolled ? "text-gray-600" : "text-white"}
                hoverBgClassName={isScrolled ? "hover:bg-gray-100" : "hover:bg-white/15"}
              />
            )}

            {user ? (
              <UserButton afterSignOut={() => navigate("/")} />
            ) : (
              <button
                onClick={() => navigate("/sign-in")}
                className={`${btnBase} text-sm rounded-md px-6 py-2`}
              >
                {t("signIn")}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 md:hidden">
            {user && !isMenuOpen && (
              <NotificationBell
                notifications={notifications}
                iconClassName={isScrolled ? "text-gray-600" : "text-white"}
                hoverBgClassName={isScrolled ? "hover:bg-gray-100" : "hover:bg-white/15"}
              />
            )}
            {user && !isMenuOpen && <UserButton afterSignOut={() => navigate("/")} />}
            <MenuToggle
              open={isMenuOpen}
              onClick={() => setIsMenuOpen((v) => !v)}
              light={!isScrolled}
            />
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-gradient-to-b from-slate-900/96 via-slate-900/93 to-slate-900/96 md:hidden"
          >
            <div className="h-16 shrink-0" />

            <div className="flex items-center gap-2 px-5 pt-4">
              {user && !loadingProfile && mainButtonLabel && (
                <button
                  onClick={() => { handleMainButtonClick(); setIsMenuOpen(false); }}
                  className={`${btnBase} flex-1 rounded-md py-2.5 text-sm`}
                >
                  {mainButtonLabel}
                </button>
              )}
              <div className="shrink-0 text-white">
                <LanguageToggle />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4">
              <nav className="flex flex-col">
                {navLinks.map((link) => {
                  const active = isLinkActive(link);
                  return link.submenu ? (
                    <div key={link.path} className="border-b border-white/10">
                      <button
                        onClick={() =>
                          setOpenMobileSubmenu(openMobileSubmenu === link.path ? null : link.path)
                        }
                        className={`flex w-full items-center justify-between py-4 text-base font-normal capitalize transition-colors ${
                          active ? "text-emerald-400" : "text-white/90"
                        }`}
                      >
                        {link.name}
                        <ChevronDown
                          className={`h-4 w-4 text-white/40 transition-transform duration-300 ${
                            openMobileSubmenu === link.path ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      <div
                        className={`grid overflow-hidden transition-all duration-300 ease-out ${
                          openMobileSubmenu === link.path
                            ? "grid-rows-[1fr] opacity-100 pb-3"
                            : "grid-rows-[0fr] opacity-0"
                        }`}
                      >
                        <div className="flex min-h-0 flex-col gap-1">
                          {link.submenu.map((sub) => {
                            const Icon = sub.icon;
                            return (
                              <Link
                                key={sub.path}
                                to={sub.path}
                                onClick={() => setIsMenuOpen(false)}
                                className="group flex items-center gap-2.5 rounded-lg py-2 text-sm font-normal capitalize text-white/60 transition-colors hover:text-emerald-300"
                              >
                                {Icon && (
                                  <Icon className="h-3.5 w-3.5 text-white/35 transition-colors group-hover:text-emerald-300" />
                                )}
                                {sub.name}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setIsMenuOpen(false)}
                      className={`border-b border-white/10 py-4 text-base font-normal capitalize transition-colors ${
                        active ? "text-emerald-400" : "text-white/90 hover:text-emerald-300"
                      }`}
                    >
                      {link.name}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {!user && (
              <div className="px-5 pb-6 pt-2">
                <button
                  onClick={() => { navigate("/sign-in"); setIsMenuOpen(false); }}
                  className={`${btnBase} w-full text-base rounded-md px-8 py-3`}
                >
                  {t("signIn")}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;

/*
NEW i18n KEYS NEEDED (namespace: "navbar"):
  (Both About and Services submenus are now hardcoded strings, not
  t() calls — only "home", "about", "services", "notices", "gallery",
  "contact", "adminPanel", "dashboard", "createProfile", "signIn"
  keys are still needed at the top level.)
*/