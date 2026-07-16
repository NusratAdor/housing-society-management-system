// client/src/pages/VisionMission.jsx
//
// NEW — About Us submenu page. Same hero pattern as AboutSociety.jsx/
// CommitteeSection.jsx for consistent site-wide navigation. Content
// structure deliberately built as a clean two-panel split (Mission |
// Vision side by side) rather than the reference's stacked full-width
// sections with a highlight box — kept tightly scoped to Mission +
// Vision only, no invented "Strategic Goals"/"Future Plans" sections
// since those weren't requested. Dummy content — replace with the
// society's real mission/vision statements.

import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Target, Compass } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

const VisionMission = () => {
  usePageTitle("Vision & Mission");

  return (
    <div className="w-full bg-white min-h-screen">

      {/* Hero */}
      <div className="relative w-full overflow-hidden">
        <div className="absolute inset-0 bg-[url('/src/assets/heroImage6.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/75" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-20 flex flex-col items-center text-center">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-base flex-wrap">
              <li>
                <Link to="/" className="text-white/70 hover:text-white font-outfit font-medium transition-colors">
                  Home
                </Link>
              </li>
              <li className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-white/40" strokeWidth={2} />
                <Link to="/about-us" className="text-white/70 hover:text-white font-outfit font-medium transition-colors">
                  About Us
                </Link>
              </li>
              <li className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-white/40" strokeWidth={2} />
                <span className="text-emerald-400 font-outfit font-medium">Vision &amp; Mission</span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            Vision <span className="text-emerald-400">&amp; Mission</span>
          </motion.h1>
        </div>
      </div>

      {/* Split panels */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 mt-10 md:mt-12 pb-20">
        <div className="grid md:grid-cols-2 gap-6">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden"
          >
            <div className="h-1" style={{ backgroundColor: "#84A98C" }} />
            <div className="p-6 md:p-8">
              <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <Target className="h-5 w-5 text-emerald-600" strokeWidth={2} />
              </div>
              <h2 className="font-bold text-xl text-gray-900 mb-3">Our Mission</h2>
              <p className="text-gray-600 font-outfit leading-relaxed">
                To provide our members with a well-managed, financially
                transparent, and genuinely welcoming residential community —
                where day-to-day services run smoothly and every family feels
                heard and supported.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden"
          >
            <div className="h-1" style={{ backgroundColor: "#84A98C" }} />
            <div className="p-6 md:p-8">
              <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <Compass className="h-5 w-5 text-emerald-600" strokeWidth={2} />
              </div>
              <h2 className="font-bold text-xl text-gray-900 mb-3">Our Vision</h2>
              <p className="text-gray-600 font-outfit leading-relaxed">
                To be recognized as a model housing society — one where
                strong governance, modern digital services, and an active
                sense of community set the standard other societies look to.
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
};

export default VisionMission;