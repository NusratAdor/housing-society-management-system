// client/src/components/SocietyIntroduction.jsx
//
// i18n PASS — all copy now comes from the "home" namespace (intro.*).
// The heading uses <Trans> with a named <highlight> tag instead of
// splitting the sentence around a <span>: Bengali word order differs
// from English, so the highlighted word has to live INSIDE the
// translated string for each language to place it correctly.
//
// Image import (Vite-tracked asset), layout, animations, floating stat
// card — UNCHANGED.

import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Users, CalendarCheck } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import heroImg from "../assets/heroImage6.png";

const SocietyIntroduction = () => {
  const { t } = useTranslation("home");

  return (
    <div className="w-full bg-white py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 grid md:grid-cols-2 gap-12 items-center">

        {/* Text side */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5
                           rounded-full text-xs font-semibold
                           bg-emerald-50 text-emerald-700
                           border border-emerald-200 mb-5">
            <CalendarCheck size={13} strokeWidth={2} />
            {t("intro.badge")}
          </span>

          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            <Trans
              t={t}
              i18nKey="intro.title"
              components={{ highlight: <span className="text-emerald-600" /> }}
            />
          </h2>

          <p className="text-gray-600 font-outfit leading-relaxed mb-4">
            {t("intro.paragraph1")}
          </p>

          <p className="text-gray-600 font-outfit leading-relaxed mb-8">
            {t("intro.paragraph2")}
          </p>

          <Link
            to="/about-us"
            className="inline-flex items-center gap-2 font-outfit font-medium text-sm
                       text-white rounded-md px-5 py-2.5
                       bg-gradient-to-r from-emerald-500 to-teal-600
                       hover:from-emerald-600 hover:to-teal-700
                       shadow-sm hover:shadow-md transition-all duration-300 group"
          >
            {t("intro.readMore")}
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </motion.div>

        {/* Image side */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative"
        >
          <div className="rounded-2xl overflow-hidden shadow-xl">
            <img
              src={heroImg}
              alt={t("intro.imageAlt")}
              className="w-full h-[380px] md:h-[440px] object-cover"
            />
          </div>

          {/* Floating stat card */}
          <div className="absolute -bottom-6 -left-4 sm:-left-8 bg-white rounded-xl shadow-lg
                          border border-gray-100 px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg leading-none">
                {t("intro.statValue")}
              </p>
              <p className="text-gray-500 text-xs mt-1">{t("intro.statLabel")}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SocietyIntroduction;