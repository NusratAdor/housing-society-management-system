// client/src/pages/SwimmingPool.jsx
//
// Same hero + white-card pattern as AboutSociety.jsx. Placeholder
// content — edit the section text once you have real hours/rules.

import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Clock, ShieldCheck, ListChecks } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

const SwimmingPool = () => {
  usePageTitle("Swimming Pool");

  return (
    <div className="w-full bg-white min-h-screen">

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
                <Link to="/our-services" className="text-white/70 hover:text-white font-outfit font-medium transition-colors">
                  Services
                </Link>
              </li>
              <li className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-white/40" strokeWidth={2} />
                <span className="text-emerald-400 font-outfit font-medium">Swimming Pool</span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            Swimming <span className="text-emerald-400">Pool</span>
          </motion.h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-8 mt-10 md:mt-12 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="h-1" style={{ backgroundColor: "#84A98C" }} />

          <div className="p-6 md:p-10 space-y-8">
            <p className="text-gray-700 font-outfit leading-relaxed">
              The society swimming pool is available to all registered members and their
              families. Please review the timings and rules below before your visit —
              replace this intro with your actual facility description.
            </p>

            <section>
              <h2 className="font-bold text-xl text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-emerald-600" />
                Operating Hours
              </h2>
              <ul className="text-gray-700 font-outfit leading-relaxed space-y-1.5">
                <li>Saturday – Thursday: 6:00 AM – 9:00 PM</li>
                <li>Friday: 8:00 AM – 11:00 AM (Ladies only), 4:00 PM – 9:00 PM</li>
                <li>Closed on public holidays — check Notices for exceptions</li>
              </ul>
            </section>

            <section>
              <h2 className="font-bold text-xl text-gray-900 mb-3 flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-emerald-600" />
                Pool Rules
              </h2>
              <ul className="text-gray-700 font-outfit leading-relaxed space-y-1.5 list-disc list-inside">
                <li>Members must carry a valid membership card</li>
                <li>Children under 12 must be accompanied by an adult</li>
                <li>Proper swimwear is required</li>
                <li>Guests are permitted with prior approval from the office</li>
              </ul>
            </section>

            <section>
              <h2 className="font-bold text-xl text-gray-900 mb-3 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Safety Guidelines
              </h2>
              <p className="text-gray-700 font-outfit leading-relaxed">
                A lifeguard is on duty during all open hours. Diving is not permitted in
                the shallow end. In case of emergency, contact the pool attendant
                immediately.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SwimmingPool;