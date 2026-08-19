// client/src/pages/staff/ContentManagerLanding.jsx
//
// Content Manager's landing page — deliberately non-financial. Admin's
// Dashboard.jsx shows dues, collection trends, outstanding balances;
// none of that belongs in front of someone with content-only permissions.

import React from "react";
import { Link } from "react-router-dom";
import { Bell, Image, Megaphone, MessageSquare } from "lucide-react";
import Title from "../../components/Title";
import { useAppContext } from "../../context/AppContext";
import usePageTitle from "../../hooks/usePageTitle";

const QUICK_LINKS = [
  { label: "Manage Notices",       path: "/admin/manage-notices",       icon: Bell,          color: "bg-blue-50 border-blue-200 text-blue-700" },
  { label: "Manage Gallery",       path: "/admin/manage-gallery",       icon: Image,         color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { label: "Manage Announcements", path: "/admin/manage-announcements", icon: Megaphone,     color: "bg-amber-50 border-amber-200 text-amber-700" },
  { label: "Manage FAQs",          path: "/admin/manage-faqs",          icon: MessageSquare, color: "bg-purple-50 border-purple-200 text-purple-700" },
];

const ContentManagerLanding = () => {
  const { staffProfile } = useAppContext();
  usePageTitle("Content Manager");

  return (
    <div className="w-full bg-white min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="mb-8">
          <Title
            title={`Welcome${staffProfile?.name ? `, ${staffProfile.name}` : ""}`}
            subTitle="Manage the society's public content."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {QUICK_LINKS.map(({ label, path, icon: Icon, color }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-4 p-5 border rounded-xl hover:shadow-md transition-all duration-200 ${color}`}
            >
              <div className="p-2 rounded-lg bg-white shadow-sm">
                <Icon className="h-5 w-5" />
              </div>
              <p className="font-medium">{label}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContentManagerLanding;