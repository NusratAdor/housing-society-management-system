// client/src/pages/MemberSupport.jsx
//
// Same hero + white-card pattern as AboutSociety.jsx / SwimmingPool.jsx.
// Links out to the existing /contact page rather than duplicating a
// contact form here — no need to build a second one.

import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Phone, Mail, Clock, ArrowRight } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

const MemberSupport = () => {
  usePageTitle("Member Support");

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
                <span className="text-emerald-400 font-outfit font-medium">Member Support</span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            Member <span className="text-emerald-400">Support</span>
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
              Have a question about your membership, dues, or the facilities? Our office
              team is here to help — replace this intro with your actual support policy.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
                <Phone className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Phone</p>
                  <p className="text-gray-500 text-sm font-outfit">+880 1XXX-XXXXXX</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
                <Mail className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Email</p>
                  <p className="text-gray-500 text-sm font-outfit">support@gohs.example</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50 sm:col-span-2">
                <Clock className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Office Hours</p>
                  <p className="text-gray-500 text-sm font-outfit">
                    Saturday – Thursday, 9:00 AM – 5:00 PM
                  </p>
                </div>
              </div>
            </div>

            <Link
              to="/contact"
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:underline"
            >
              Or send us a message via the Contact page
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MemberSupport;