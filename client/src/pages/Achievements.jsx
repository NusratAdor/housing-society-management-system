// client/src/pages/Achievements.jsx
//
// NEW — About Us subpage for society achievements/milestones/awards.
// Placed under About Us (not the homepage) because achievements are a
// permanent record of institutional credibility — unlike Notices or
// Events, they aren't time-sensitive content that needs to rotate or
// stay "fresh." They belong alongside Our Story, Vision & Mission, and
// the Committee pages: things that answer "who is this society and
// why should I trust it," not "what's happening right now."
//
// Same hero + breadcrumb structure as CommitteeSection.jsx /
// CommitteeMemberDetail.jsx for consistency across every About Us
// page. Dummy content below — replace with the society's real
// awards/milestones.

import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Award, Trophy, ShieldCheck, Users2, Leaf, BadgeCheck } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

const ACHIEVEMENTS = [
  {
    year: "2023",
    title: "Best Managed Housing Society Award",
    description: "Recognized by the National Housing Cooperative Board for excellence in community governance and member services.",
    icon: Trophy,
  },
  {
    year: "2022",
    title: "500th Member Milestone",
    description: "Welcomed our 500th registered member family, marking two decades of steady community growth.",
    icon: Users2,
  },
  {
    year: "2021",
    title: "ISO 9001 Certification",
    description: "Achieved international certification for quality management in administrative and financial processes.",
    icon: BadgeCheck,
  },
  {
    year: "2020",
    title: "Green Community Recognition",
    description: "Awarded for sustained investment in green spaces, waste management, and energy-efficient common areas.",
    icon: Leaf,
  },
  {
    year: "2019",
    title: "Zero Security Incident Record",
    description: "Completed five consecutive years without a reported security incident across the community.",
    icon: ShieldCheck,
  },
  {
    year: "2018",
    title: "Excellence in Financial Transparency",
    description: "Commended for our fully auditable, member-accessible financial reporting system.",
    icon: Award,
  },
];

const Achievements = () => {
  usePageTitle("Achievements");

  return (
    <div className="w-full bg-white min-h-screen">

      {/* Hero */}
      <div className="relative w-full overflow-hidden">
        <div className="absolute inset-0 bg-[url('/src/assets/heroImage6.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/75" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-16 md:py-20 flex flex-col items-center text-center">
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
                <span className="text-emerald-400 font-outfit font-medium">Achievements</span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            Our <span className="text-emerald-400">Achievements</span>
          </motion.h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 mt-10 md:mt-12 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ACHIEVEMENTS.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                className="relative bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md
                          transition-shadow duration-300 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-emerald-600" strokeWidth={2} />
                  </div>
                  <span className="text-xs font-semibold text-gray-400 tracking-wide">{item.year}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm font-outfit leading-relaxed">{item.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Achievements;