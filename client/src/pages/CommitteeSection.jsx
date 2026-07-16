// client/src/pages/CommitteeSection.jsx
//
// CHANGE (this pass) — "single" layout only (Chairman / General
// Secretary pages). Replaced the old side-by-side (text-left,
// 260px-photo-right) layout with an institutional bio pattern:
// circular photo sits beside the name/title as a header block, then
// the message runs full-width underneath. Reasoning: the side-by-side
// "welcome letter" pattern reads like hospital/corporate marketing;
// this reads like an official record, which fits a housing society
// better, and it doesn't get awkward on mobile once the photo has
// nowhere to sit but above the text. Photo kept CIRCULAR (not the
// squared portrait from the reference) to stay consistent with the
// circular-photo convention already established on the grid pages and
// CommitteeMemberDetail.jsx. Signature close ("Sincerely, name...")
// kept — that's a content choice, not a layout one, and still reads
// well here.
//
// Grid layout (adviser, formerChairman, formerGeneralSecretary,
// executiveCommittee) and everything else in this file — hero,
// breadcrumb, data fetching, category config — UNCHANGED.

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Users } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import usePageTitle from "../hooks/usePageTitle";

const CATEGORY_CONFIG = {
  chairman:                { label: "Chairman",                  layout: "single" },
  generalSecretary:        { label: "General Secretary",         layout: "single" },
  adviser:                 { label: "Advisers",                  layout: "grid"   },
  formerChairman:          { label: "Former Chairmen",            layout: "grid"   },
  formerGeneralSecretary:  { label: "Former General Secretaries",  layout: "grid"   },
  executiveCommittee:      { label: "Executive Committee",         layout: "grid"   },
};

const CommitteeSection = ({ category }) => {
  const { axios } = useAppContext();
  const navigate  = useNavigate();
  const config    = CATEGORY_CONFIG[category];

  usePageTitle(config?.label ?? "About Us");

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/committee?category=${category}`);
        if (data.success) setMembers(data.members);
      } catch {
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [axios, category]);

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
                <span className="text-emerald-400 font-outfit font-medium">{config?.label}</span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            {config?.label}
          </motion.h1>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-gray-200 border-t-emerald-500 rounded-full" />
        </div>
      ) : members.length === 0 ? (
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-20 text-center">
          <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-outfit">No members listed yet.</p>
        </div>

      ) : config?.layout === "single" ? (
        /* ── Single-person institutional bio layout ───────────────────── */
        <div className="max-w-3xl mx-auto px-4 md:px-8 mt-10 md:mt-12 pb-20">
          {members.map((member) => (
            <motion.div
              key={member._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="relative bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden mb-8 last:mb-0"
            >
              <div className="h-1" style={{ backgroundColor: "#84A98C" }} />

              <div className="p-6 md:p-10">
                {/* Header — circular photo beside name/title */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 text-center sm:text-left">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-full overflow-hidden border border-gray-100 bg-gray-50">
                    {member.photo ? (
                      <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="h-10 w-10 text-gray-300" />
                      </div>
                    )}
                  </div>

                  <div className="pt-1">
                    <h2 className="font-bold text-2xl text-gray-900">{member.name}</h2>
                    {member.designation && (
                      <p className="text-emerald-600 font-medium text-base mt-1">{member.designation}</p>
                    )}
                    {/* Org line — placeholder text, edit freely */}
                    <p className="text-gray-400 text-sm font-outfit mt-0.5">
                      Government Officer's Housing Society
                    </p>
                  </div>
                </div>

                {member.message && (
                  <>
                    <div className="h-px bg-gray-100 my-7" />

                    {/* Message — full width below the header, not
                        squeezed beside a photo column anymore */}
                    <p className="text-gray-700 font-outfit leading-relaxed whitespace-pre-line">
                      {member.message}
                    </p>

                    <div className="mt-7 text-sm text-gray-500 font-outfit">
                      <p>Sincerely,</p>
                      <p className="font-semibold text-gray-800 mt-1">{member.name}</p>
                      <p>{member.designation}</p>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>

      ) : (
        /* ── Grid layout — UNCHANGED ───────────────────────────────────── */
        <div className="max-w-6xl mx-auto px-4 md:px-8 mt-10 md:mt-12 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((member, i) => (
              <motion.div
                key={member._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                onClick={() => navigate(`/about-us/member/${member._id}`)}
                className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md
                          transition-shadow duration-300 cursor-pointer p-6 flex flex-col items-center text-center"
              >
                <div className="w-24 h-24 rounded-full overflow-hidden border border-gray-100 bg-gray-50 mb-4">
                  {member.photo ? (
                    <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="h-8 w-8 text-gray-300" />
                    </div>
                  )}
                </div>

                <h3 className="font-bold text-gray-900">{member.name}</h3>
                {member.designation && (
                  <p className="text-emerald-600 text-sm font-medium mt-0.5">{member.designation}</p>
                )}
                {(member.tenureFrom || member.tenureTo) && (
                  <p className="text-gray-400 text-xs mt-1">
                    {member.tenureFrom}{member.tenureFrom && member.tenureTo ? " – " : ""}{member.tenureTo}
                  </p>
                )}

                <span className="mt-4 text-sm font-medium text-emerald-600 hover:underline">
                  Read more
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommitteeSection;