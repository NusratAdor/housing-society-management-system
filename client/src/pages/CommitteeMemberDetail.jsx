// client/src/pages/CommitteeMemberDetail.jsx
//
// Detail page for a single grid-type member (Adviser, Former Chairman,
// Former General Secretary, Executive Committee). Mirrors the hero +
// card pattern established by NoticeDetail/GalleryDetail. Chairman/
// General Secretary don't need this — their "single" layout on
// CommitteeSection.jsx already shows everything on one page.

import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAppContext } from "../context/AppContext";
import { toast } from "react-hot-toast";
import { ChevronRight, Users } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

const CATEGORY_LABELS = {
  adviser:                "Advisers",
  formerChairman:         "Former Chairmen",
  formerGeneralSecretary: "Former General Secretaries",
  executiveCommittee:     "Executive Committee",
};

const CommitteeMemberDetail = () => {
  const { axios } = useAppContext();
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [member,  setMember]  = useState(null);
  const [loading, setLoading] = useState(true);

  usePageTitle(member?.name ?? null);

  useEffect(() => {
    const fetchMember = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/committee/${id}`);
        if (data.success) {
          setMember(data.member);
        } else {
          toast.error(data.message || "Member not found");
          navigate("/about-us");
        }
      } catch {
        toast.error("Error loading member. Please try again.");
        navigate("/about-us");
      } finally {
        setLoading(false);
      }
    };
    fetchMember();
  }, [id, navigate, axios]);

  if (loading) {
    return (
      <div className="w-full bg-white min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-gray-200 border-t-emerald-500 rounded-full" />
      </div>
    );
  }

  if (!member) return null;

  const categoryLabel = CATEGORY_LABELS[member.category] || "About Us";
  const categoryPath = {
    adviser: "/about-us/advisers",
    formerChairman: "/about-us/former-chairman",
    formerGeneralSecretary: "/about-us/former-general-secretary",
    executiveCommittee: "/about-us/executive-committee",
  }[member.category] || "/about-us";

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
                <Link to={categoryPath} className="text-white/70 hover:text-white font-outfit font-medium transition-colors">
                  {categoryLabel}
                </Link>
              </li>
              <li className="flex items-center gap-1.5 min-w-0">
                <ChevronRight className="h-3.5 w-3.5 text-white/40 flex-shrink-0" strokeWidth={2} />
                <span className="text-emerald-400 font-outfit font-medium truncate max-w-[200px]" aria-current="page">
                  {member.name}
                </span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            {categoryLabel}
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

          <div className="p-6 md:p-10 flex flex-col items-center text-center">
            <div className="w-32 h-32 rounded-full overflow-hidden border border-gray-100 bg-gray-50 mb-5">
              {member.photo ? (
                <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Users className="h-10 w-10 text-gray-300" />
                </div>
              )}
            </div>

            <h2 className="font-bold text-2xl text-gray-900">{member.name}</h2>
            {member.designation && (
              <p className="text-emerald-600 font-medium text-sm mt-1">{member.designation}</p>
            )}
            {(member.tenureFrom || member.tenureTo) && (
              <p className="text-gray-400 text-sm mt-1">
                {member.tenureFrom}{member.tenureFrom && member.tenureTo ? " – " : ""}{member.tenureTo}
              </p>
            )}

            {member.bio && (
              <p className="text-gray-700 font-outfit leading-relaxed mt-6 max-w-xl whitespace-pre-line">
                {member.bio}
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CommitteeMemberDetail;