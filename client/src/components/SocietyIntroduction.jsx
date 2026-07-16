// client/src/components/SocietyIntroduction.jsx
//
// NEW — homepage "welcome" section. Idea taken from the University of
// Dhaka reference (text + image + read-more), but built distinctly
// different: text on the LEFT / image on the RIGHT as explicitly
// requested, gradient "Read More" button matching this site's existing
// button convention (not a flat solid bar), an "Est. 1998" eyebrow
// badge instead of a play-button video overlay, and a floating member-
// count stat card breaking the image's corner instead of a plain
// static photo. Dummy content — replace with real society history.
//
// Placed right after Hero in Home.jsx — this section introduces WHO
// the society is, which belongs before the transactional sections
// (Notices, Gallery, FAQ) that follow it.
//
// DIVIDER (this pass): removed entirely, per direct request — no wave
// between this section and NoticesPreview, just a plain straight edge
// where this section's white background meets NoticesPreview's tint.
// That also meant dropping the pb-24/overflow-hidden/relative that
// existed only to make room for the wave's absolutely-positioned SVG —
// padding is now a plain, even py-20 on both sides instead of the
// lopsided pt-20/pb-24 split.

import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Users, CalendarCheck } from "lucide-react";
import heroImage6 from "../assets/heroImage6.png";

const SocietyIntroduction = () => {
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
            Est. 1998
          </span>

          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            Where <span className="text-emerald-600">Community</span> Begins
          </h2>

          <p className="text-gray-600 font-outfit leading-relaxed mb-4">
            Government Officer's Housing Society was founded to give government
            officers and their families a safe, well-managed place to call home.
            What began as a small residential initiative has grown into a
            thriving community defined by cooperation, transparency, and
            shared purpose.
          </p>

          <p className="text-gray-600 font-outfit leading-relaxed mb-8">
            Today, GOHS supports over 500 member families through transparent
            financial management, responsive community services, and a
            genuine commitment to keeping neighbors connected.
          </p>

          <Link
            to="/about-us"
            className="inline-flex items-center gap-2 font-outfit font-medium text-sm
                       text-white rounded-md px-5 py-2.5
                       bg-gradient-to-r from-emerald-500 to-teal-600
                       hover:from-emerald-600 hover:to-teal-700
                       shadow-sm hover:shadow-md transition-all duration-300 group"
          >
            Read More About Us
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
              src="/src/assets/heroImage6.png"
              alt="GOHS community"
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
              <p className="font-bold text-gray-900 text-lg leading-none">500+</p>
              <p className="text-gray-500 text-xs mt-1">Registered Members</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SocietyIntroduction;