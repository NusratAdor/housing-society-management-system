// src/components/Hero.jsx
//
// CHANGE (this pass): only "(GOHS)" should be emerald, not the whole
// heading. Rather than re-splitting the t() call into two translation
// keys (the exact thing the previous pass avoided, specifically to
// keep the Bengali translation lookup intact), the single t() call is
// left exactly as it was — one key, one lookup. The already-translated
// STRING that comes back is then sliced at "(GOHS)" purely for
// rendering: text before it and after it render white, the "(GOHS)"
// substring itself renders emerald-300. If "(GOHS)" isn't found in the
// translated string for some reason (e.g. a future translation edit
// removes the parenthetical), it falls back to rendering the whole
// heading in white rather than throwing — no silent breakage either way.
//
// Everything else — auth-aware button logic, subtitle, layout, sizing
// from the previous pass — UNCHANGED.

import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useAppContext } from "../context/AppContext";
import { useTranslation } from "react-i18next";

const Hero = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { openSignIn } = useClerk();
  const { memberProfile, loadingProfile, isAdmin } = useAppContext();
  const { t } = useTranslation();

  const handleMainButtonClick = () => {
    if (isAdmin) return navigate("/admin");
    if (memberProfile) return navigate("/dashboard");
    if (!user) return openSignIn();
    return navigate("/create-profile");
  };

  const mainButtonLabel = isAdmin
    ? t("Admin Panel")
    : memberProfile
    ? t("Dashboard")
    : !user
    ? t("Join or Log In to Get Started")
    : t("Create Profile");

  const isWhiteOutlined = isAdmin || memberProfile;

  // Single translation key, unchanged — only the RENDERING of the
  // returned string is split, at "(GOHS)", so only that part is emerald.
  const fullHeading = t("Government Officer's Housing Scheme (GOHS)");
  const gohsMarker  = "(GOHS)";
  const markerIndex = fullHeading.indexOf(gohsMarker);

  return (
    <div className="relative h-screen w-full">
      <div
        className="absolute inset-0 bg-[url('/src/assets/heroImage6.png')] bg-cover bg-center bg-no-repeat"
        style={{ filter: "brightness(75%)" }}
      ></div>

      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col h-full px-4 md:px-8 items-center justify-center md:items-start md:justify-center text-center md:text-left">
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="font-outfit font-bold text-2xl sm:text-3xl md:text-4xl lg:text-[44px] lg:leading-[48px] max-w-xl mt-4 text-white"
        >
          {markerIndex === -1 ? (
            fullHeading
          ) : (
            <>
              {fullHeading.slice(0, markerIndex)}
              <span className="text-emerald-300">
                {fullHeading.slice(markerIndex, markerIndex + gohsMarker.length)}
              </span>
              {fullHeading.slice(markerIndex + gohsMarker.length)}
            </>
          )}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mt-2 max-w-lg text-sm md:text-base text-white"
        >
          {t(
            "Connect with your community, manage your membership, track payments, view notices, and stay updated — all in one secure platform designed for our 500+ society members."
          )}
        </motion.p>

        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          onClick={handleMainButtonClick}
          className={`
            mt-8 mb-6 flex items-center gap-2
            rounded-full px-5 py-2
            text-xs md:text-sm font-medium font-outfit
            transition-all duration-300 group
            ${
              isWhiteOutlined
                ? "border-2 border-white text-white bg-transparent hover:bg-white/10"
                : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-md hover:shadow-lg"
            }
          `}
          type="button"
        >
          <span>{mainButtonLabel}</span>

          <motion.span
            className={`
              flex items-center justify-center size-5 rounded-full
              ${isWhiteOutlined ? "bg-white/20 backdrop-blur-sm" : "bg-white/15 backdrop-blur-sm"}
            `}
            whileHover={{ x: 4 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <svg
              width="12"
              height="10"
              viewBox="0 0 16 13"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-white"
            >
              <path
                d="M1 6.5h14M9.5 1 15 6.5 9.5 12"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.span>
        </motion.button>
      </div>
    </div>
  );
};

export default Hero;