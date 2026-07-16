// client/src/pages/AboutSociety.jsx
//
// Static content page (no backend model — this is page-level prose
// like the homepage Hero text, not a list of records). Follows the
// same hero + white card pattern as NoticeDetail/GalleryDetail.
// Placeholder copy below — edit freely, this is scaffolding, not
// final content.

import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Target, Eye, Building2 } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

const AboutSociety = () => {
  usePageTitle("About Society");

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
                <span className="text-emerald-400 font-outfit font-medium">About Society</span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            About <span className="text-emerald-400">Our Society</span>
          </motion.h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 mt-10 md:mt-12 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="h-1" style={{ backgroundColor: "#84A98C" }} />

          <div className="p-6 md:p-10 space-y-8">
            <section>
              <h2 className="font-bold text-xl text-gray-900 mb-3 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                Our Story
              </h2>
              <p className="text-gray-700 font-outfit leading-relaxed">
                Government Officer's Housing Society (GOHS) was established to serve the
                residential and community needs of government officers and their families.
                Since our founding, we have grown into a close-knit community built on
                cooperation, transparency, and shared responsibility — replace this
                paragraph with your society's real founding story.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl text-gray-900 mb-3 flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-600" />
                Our Mission
              </h2>
              <p className="text-gray-700 font-outfit leading-relaxed">
                To provide a safe, well-managed, and financially transparent housing
                community for our members — replace with your actual mission statement.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl text-gray-900 mb-3 flex items-center gap-2">
                <Eye className="h-5 w-5 text-emerald-600" />
                Our Vision
              </h2>
              <p className="text-gray-700 font-outfit leading-relaxed">
                To be a model housing society recognized for strong governance, member
                satisfaction, and sustainable community development — replace with your
                actual vision statement.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AboutSociety;