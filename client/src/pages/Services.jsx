// client/src/pages/Services.jsx
//
// Landing page for the Services section — same hero pattern as
// AboutSociety.jsx, static content (no backend model; nothing here
// is admin-editable list data the way committee members were).
// Below the hero: two simple cards linking to the sub-pages, since
// there are exactly two and a full grid/list treatment would be
// overkill for two items.

import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Waves, LifeBuoy, ArrowRight } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

const SERVICE_CARDS = [
  {
    title: "Swimming Pool",
    description: "Timings, rules, and safety guidelines for the society pool.",
    path: "/our-services/swimming-pool",
    icon: Waves,
  },
  {
    title: "Member Support",
    description: "How to reach us and get help with membership, dues, or facilities.",
    path: "/our-services/member-support",
    icon: LifeBuoy,
  },
];

const Services = () => {
  usePageTitle("Our Services");

  return (
    <div className="w-full bg-white min-h-screen">

      {/* Hero */}
      <div className="relative w-full overflow-hidden">
        <div className="absolute inset-0 bg-[url('/src/assets/heroImage6.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/75" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-20 flex flex-col items-center text-center">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-base">
              <li>
                <Link to="/" className="text-white/70 hover:text-white font-outfit font-medium transition-colors">
                  Home
                </Link>
              </li>
              <li className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-white/40" strokeWidth={2} />
                <span className="text-emerald-400 font-outfit font-medium">Services</span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            Our <span className="text-emerald-400">Services</span>
          </motion.h1>
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 mt-10 md:mt-12 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {SERVICE_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.path}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
              >
                <Link
                  to={card.path}
                  className="group flex flex-col h-full bg-white border border-gray-100
                            rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 p-6"
                >
                  <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-emerald-600" strokeWidth={2} />
                  </div>

                  <h3 className="font-bold text-lg text-gray-900 mb-1.5">{card.title}</h3>
                  <p className="text-gray-500 text-sm font-outfit leading-relaxed flex-1">
                    {card.description}
                  </p>

                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium
                                   text-emerald-600 group-hover:gap-2.5 transition-all duration-200">
                    Learn more
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Services;