import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { assets } from "../assets/assets";
import { useClerk, UserButton } from "@clerk/clerk-react";
import { useAppContext } from "../context/AppContext";

const Navbar = () => {
  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Notices", path: "/notices" },
    { name: "Gallery", path: "/gallery" },
    { name: "FAQs", path: "/faqs" },
    { name: "Contact", path: "/contact" },
  ];

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, navigate, memberProfile, loadingProfile } = useAppContext();
  const { openSignIn } = useClerk();
  const location = useLocation();

  const isHome = location.pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      if (!isHome) setIsScrolled(true);
      else setIsScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  const handleMainButtonClick = () => {
    if (!user) return openSignIn();
    if (memberProfile) navigate("/dashboard");
    else navigate("/create-profile");
  };

  const mainButtonLabel = memberProfile ? "Dashboard" : "Create Profile";

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-white shadow-md backdrop-blur-md py-3 md:py-4"
          : "bg-transparent py-4 md:py-6"
      }`}
    >
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8">
        <Link to="/" className="flex items-center gap-2">
          <img
            src={isScrolled ? assets.logoScrolled : assets.logo}
            alt="Logo"
            className="transform scale-90 h-9"
          />
        </Link>

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

          {user && !loadingProfile && (
            <button
              onClick={handleMainButtonClick}
              className={`border px-4 py-1 text-sm font-light rounded-full cursor-pointer ${
                isScrolled
                  ? "text-black border-gray-300"
                  : "text-white border-white"
              } transition-all`}
            >
              {mainButtonLabel}
            </button>
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <UserButton afterSignOut={() => navigate("/")} />
          ) : (
            <>
              <button
                onClick={() => navigate("/sign-up")}
                className="text-white bg-[#2E8B57] px-6 py-2.5 rounded-full text-sm transition-all hover:bg-[#1e40af]"
              >
                Join
              </button>
              <button
                onClick={() => openSignIn()}
                className="text-black bg-[#EE4B2B] px-6 py-2.5 rounded-full text-sm transition-all hover:bg-black"
              >
                Sign In
              </button>
            </>
          )}
        </div>

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

        {navLinks.map((link, i) => (
          <Link
            key={i}
            to={link.path}
            onClick={() => setIsMenuOpen(false)}
            className="hover:text-[var(--color-primary)]"
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
            className="border px-4 py-1 text-sm font-light rounded-full cursor-pointer text-gray-800 transition-all"
          >
            {mainButtonLabel}
          </button>
        )}

        {!user && (
          <>
            <button
              onClick={() => {
                navigate("/sign-up");
                setIsMenuOpen(false);
              }}
              className="text-white bg-[#2E8B57] px-8 py-2.5 rounded-full text-sm hover:bg-[#1e40af]"
            >
              Join
            </button>
            <button
              onClick={() => {
                openSignIn();
                setIsMenuOpen(false);
              }}
              className="text-white bg-gray-800 px-8 py-2.5 rounded-full text-sm hover:bg-black"
            >
              Sign In
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;