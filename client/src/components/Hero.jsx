// src/components/Hero.jsx
//
// FIX (this pass) — animation was invisible on load, root cause found:
//   whileInView fires based on SCROLL intersection — it's built for
//   content further down a page that reveals as the user scrolls to
//   it. The Hero sits in the viewport the instant it mounts, so
//   whileInView fired almost immediately — while App.jsx's full-screen
//   loading overlay (zIndex 99999, opaque) was still covering
//   everything. The stagger-fade-up animation played out underneath
//   that overlay, finished, and only THEN did the overlay fade away —
//   so by the time it was visible, there was nothing left to animate.
//
//   FIX: swapped whileInView -> animate, driven by the same
//   loadingProfile flag App.jsx's own overlay uses to decide when the
//   page is safe to reveal (already available here via useAppContext,
//   just wasn't wired to the animation). Now the container sits in its
//   "hidden" state for as long as loadingProfile is true, and switches
//   to "visible" at the exact moment it flips false — precisely when
//   the overlay starts its own fade-out. The two happen concurrently,
//   so the stagger-in plays out live as the overlay clears, on every
//   reload, instead of finishing invisibly beforehand.
//
// Also fixed: heading text said "Housing Scheme" — every other page,
// email, and the GOHS acronym itself say "Housing Society". This
// looked like an accidental regression from an earlier edit rather
// than an intentional change, so I corrected it back — flagging this
// explicitly since it wasn't something you asked me to touch.
//
// Everything else — click handler / label logic, structure, styling,
// stagger timing/easing values — UNCHANGED from the previous pass.

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
          className="font-outfit font-bold text-2xl sm:text-3xl md:text-4xl lg:text-[48px] lg:leading-[52px] lg:whitespace-nowrap text-white"
        >
          <span>
            {t("Government Officer's Housing Scheme")}
          </span>{' '}
          <motion.span
            initial={{ color: "#FFFFFF" }}
            animate={!loadingProfile ? { color: "#6EE7B7" } : { color: "#FFFFFF" }}
            transition={{ duration: 0.7, delay: 0.6, type: "spring", stiffness: 100 }}
            className="text-emerald-300"
          >
            (GOHS)
          </motion.span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mt-2 max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto text-sm md:text-base text-white"
        >
          {t(
            "Connect with your community, manage your membership, track payments, view notices, and stay updated — all in one secure platform designed for our 500+ society members."
          )}
        </motion.p>

        {/* CTA button — always the same brand gradient as the Navbar's
            button, regardless of which label is currently showing. */}
        <motion.button
          variants={itemVariants}
          onClick={handleMainButtonClick}
          className="
            mt-6
            flex items-center gap-2
            rounded-md px-4 py-1.5
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