// client/src/components/VisionMissionPreview.jsx
//
// NEW — homepage closing CTA section. Idea taken from the reference
// (a colored banner promoting mission/community near the end of the
// page), but built distinctly different: this site's existing
// emerald-to-teal GRADIENT (used on every other CTA button/banner
// across the app) instead of a flat solid green, an icon badge instead
// of a plain heading, and — most importantly — the primary button
// reuses the EXACT SAME auth-aware logic as Hero.jsx/Navbar.jsx
// (Join / Dashboard / Admin Panel / Create Profile depending on who's
// looking) rather than inventing a separate unrelated "join" flow.
//
// Placed at the END of Home.jsx, after FAQ — a closing CTA
// conventionally comes after all informational content, right before
// the footer.

import React from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useAppContext } from "../context/AppContext";
import { Compass, ArrowRight } from "lucide-react";

const VisionMissionPreview = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { openSignIn } = useClerk();
  const { memberProfile, isAdmin } = useAppContext();

  // Same auth-aware logic as Hero.jsx — one consistent entry point
  // into the app regardless of who's looking, not a separate flow.
  const handleJoinClick = () => {
    if (isAdmin) return navigate("/admin");
    if (memberProfile) return navigate("/dashboard");
    if (!user) return openSignIn();
    return navigate("/create-profile");
  };

  const joinLabel = isAdmin
    ? "Admin Panel"
    : memberProfile
    ? "Go to Dashboard"
    : !user
    ? "Join Our Community"
    : "Create Profile";

  return (
    <div className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 py-16">
      <div className="max-w-4xl mx-auto px-4 md:px-8 text-center">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-full
                    bg-white/15 backdrop-blur-sm mb-5"
        >
          <Compass className="h-6 w-6 text-white" strokeWidth={2} />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-2xl md:text-3xl font-bold text-white mb-3"
        >
          Guided by Purpose, Built on Trust
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-white/85 font-outfit text-sm md:text-base max-w-xl mx-auto mb-8"
        >
          Every decision we make is rooted in a clear mission and a shared
          vision for what our community can become. See what drives us
          forward.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <button
            onClick={handleJoinClick}
            className="flex items-center gap-2 bg-white text-emerald-700 font-outfit
                      font-semibold text-sm rounded-md px-6 py-2.5
                      hover:bg-emerald-50 transition-colors duration-300 shadow-sm"
          >
            {joinLabel}
          </button>
          <Link
            to="/about-us/vision-mission"
            className="flex items-center gap-2 border border-white/70 text-white font-outfit
                      font-medium text-sm rounded-md px-6 py-2.5
                      hover:bg-white/10 transition-colors duration-300"
          >
            Our Vision &amp; Mission
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default VisionMissionPreview;