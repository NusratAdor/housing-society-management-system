// src/components/Hero.jsx
//
// i18n PASS — all copy now comes from the "home" namespace (hero.*).
// Before, the strings were whole English sentences used as keys in the
// default "dashboard" namespace: no JSON file contained them, and the
// subtitle's trailing "." also collided with i18next's key separator,
// so the Hero could never be translated.
//
// Heading text: now reads "Housing Society", matching the GOHS acronym
// and every other page/email (the previous "Housing Scheme" looked like
// an accidental regression). It's a single string in home.json if the
// client ever wants it changed.
//
// Everything else — loadingProfile-driven stagger animation, click
// handler / label logic, structure, styling, timing — UNCHANGED.

import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useAppContext } from "../context/AppContext";
import { useTranslation } from "react-i18next";

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.14, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 26, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const Hero = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { openSignIn } = useClerk();
  const {
    loadingProfile,
    loadingStaffProfile,
    availableWorkspaces,
    isRemovedMember,
  } = useAppContext();
  const { t } = useTranslation("home");

  const primaryWorkspace = availableWorkspaces[0] ?? null;

  const handleMainButtonClick = () => {
    if (isRemovedMember) return navigate("/contact");
    if (primaryWorkspace) return navigate(primaryWorkspace.path);
    if (!user) return openSignIn();
    return navigate("/create-profile");
  };

  const mainButtonLabel = isRemovedMember
    ? t("hero.cta.membershipRemoved")
    : primaryWorkspace
    ? availableWorkspaces.length === 1
      ? primaryWorkspace.soloLabel
      : primaryWorkspace.switchLabel
    : !user
    ? t("hero.cta.joinOrLogin")
    : t("hero.cta.createProfile");

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div
        className="absolute inset-0 bg-[url('/src/assets/heroImage8.png')] bg-cover bg-center bg-no-repeat"
        style={{ filter: "brightness(70%)" }}
      ></div>

      {/* Heading + subheading + CTA button — synced to the loading
          overlay via loadingProfile instead of scroll position. */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={loadingProfile ? "hidden" : "visible"}
        className="absolute left-1/2 -translate-x-1/2 bottom-[10%] md:bottom-[12%] z-10 w-full max-w-2xl md:max-w-3xl lg:max-w-4xl px-4 md:px-8 flex flex-col items-center text-center"
      >
        <motion.h1
          variants={itemVariants}
          className="font-outfit font-bold text-2xl sm:text-3xl md:text-4xl lg:text-[52px] lg:leading-[52px] lg:whitespace-nowrap text-white"
        >
          <span>{t("hero.title")}</span>{" "}
          <motion.span
            initial={{ color: "#FFFFFF" }}
            animate={
              !loadingProfile ? { color: "#6EE7B7" } : { color: "#FFFFFF" }
            }
            transition={{
              duration: 0.7,
              delay: 0.6,
              type: "spring",
              stiffness: 100,
            }}
            className="text-emerald-300"
          >
            (GOHS)
          </motion.span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mt-2 max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto text-sm md:text-base text-white"
        >
          {t("hero.subtitle")}
        </motion.p>

        {/* CTA button — always the same brand gradient as the Navbar's
            button, regardless of which label is currently showing. */}
        <motion.button
          variants={itemVariants}
          onClick={handleMainButtonClick}
          className="
            mt-6
            flex items-center gap-2
            rounded-md px-4 py-2
            text-xs md:text-sm font-medium font-outfit
            bg-gradient-to-r from-emerald-500 to-teal-600
            hover:from-emerald-600 hover:to-teal-700
            text-white shadow-md hover:shadow-lg
            transition-all duration-300 group
          "
          type="button"
        >
          <span>{mainButtonLabel}</span>

          <motion.span
            className="flex items-center justify-center size-5 rounded-full
              bg-white/15 backdrop-blur-sm"
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
      </motion.div>
    </div>
  );
};

export default Hero;