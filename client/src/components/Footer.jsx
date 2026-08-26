// client/src/components/Footer.jsx
//
// CHANGE (this pass): refined an already-strong structure, not a
// rewrite — the 12-column asymmetric grid, lucide icons, arrow-hover
// links, and bottom-bar legal links were all correct calls kept as-is.
//
//   - aria-label reverted to string concatenation (not a template
//     literal) — the exact pattern that previously broke this file via
//     copy/paste corruption. Defensive, given the file's own history.
//   - Column headings: muted, uppercase, wide-tracked (text-xs
//     uppercase tracking-wider text-gray-400) instead of near-body-
//     weight dark text — standard convention so headings recede and
//     links carry the visual weight.
//   - Brand description rewritten to match Hero.jsx's established
//     voice, instead of a keyword-list sentence.
//   - "Services" -> "Our Services" and "Information" -> "Resources",
//     matching Navbar wording / actual column content respectively.
//   - Vertical padding bumped to py-16, matching the py-16/py-20
//     rhythm already used by Hero, FAQ, and VisionMissionPreview.
//   - Divider color aligned to border-gray-100, matching FAQ.jsx's
//     section divider exactly.

import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { FaInstagram, FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

import { assets } from "../assets/assets";


const Footer = () => {
  const navigate = useNavigate();

  const aboutLinks = [
    { label: "About Society", path: "/about-us" },
    { label: "Vision & Mission", path: "/about-us/vision-mission" },
    { label: "Executive Committee", path: "/about-us/executive-committee" },
  ];

  const serviceLinks = [
    { label: "Swimming Pool", path: "/our-services/swimming-pool" },
    { label: "Member Support", path: "/our-services/member-support" },
  ];

  const resourceLinks = [
    { label: "Notices", path: "/notices" },
    { label: "Gallery", path: "/gallery" },
    { label: "Contact", path: "/contact" },
  ];

  const socialLinks = [
    {
      icon: FaInstagram,
      url: "https://instagram.com",
      label: "Instagram",
    },
    {
      icon: FaFacebookF,
      url: "https://facebook.com",
      label: "Facebook",
    },
    {
      icon: FaXTwitter,
      url: "https://x.com",
      label: "X",
    },
    {
      icon: FaLinkedinIn,
      url: "https://linkedin.com",
      label: "LinkedIn",
    },
  ];

  const FooterColumn = ({ title, links }) => (
    <div>
      <h3 className="mb-5 font-outfit text-xs font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </h3>
      <ul className="space-y-3">
        {links.map((item) => (
          <li key={item.path}>
            <button
              type="button"
              onClick={() => navigate(item.path)}
              className="group inline-flex items-center font-outfit text-sm text-gray-500 transition-colors duration-200 hover:text-emerald-600"
            >
              <span>{item.label}</span>
              <ArrowRight
                className="ml-1.5 h-3 w-3 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                strokeWidth={1.8}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <footer className="w-full border-t border-gray-100 bg-[#F8FAFC]">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main footer content */}
        <div className="grid grid-cols-1 gap-10 py-16 sm:grid-cols-2 lg:grid-cols-12 lg:gap-12">
          {/* Brand / introduction */}
          <div className="sm:col-span-2 lg:col-span-5">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex"
              aria-label="Go to GOHS home"
            >
              <img
                src={assets.logoScrolled}
                alt="Government Officer's Housing Society (GOHS)"
                className="h-10 w-auto object-contain"
              />
            </button>

            <p className="mt-5 max-w-md font-outfit text-sm leading-6 text-gray-500">
              Connect with your community, manage your membership, and stay on
              top of dues and notices — all in one secure platform built for our
              500+ society members.
            </p>

            <button
              type="button"
              onClick={() => navigate("/contact")}
              className="mt-5 inline-flex items-center gap-2 font-outfit text-sm font-medium text-emerald-700 transition-colors duration-200 hover:text-emerald-800"
            >
              Contact the Society
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>

            {/* Social links */}
            <div className="mt-7 flex items-center gap-2.5">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                const ariaLabel = "Follow GOHS on " + social.label;

                return (
                  <a
                    key={social.label}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={ariaLabel}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* About */}
          <div className="lg:col-span-2">
            <FooterColumn title="About" links={aboutLinks} />
          </div>

          {/* Our Services */}
          <div className="lg:col-span-2">
            <FooterColumn title="Our Services" links={serviceLinks} />
          </div>

          {/* Resources */}
          <div className="lg:col-span-3">
            <FooterColumn title="Resources" links={resourceLinks} />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-4 border-t border-gray-100 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-outfit text-xs text-gray-400 sm:text-sm">
            &copy; {new Date().getFullYear()} Government Officer&apos;s Housing
            Society (GOHS). All rights reserved.
          </p>

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => navigate("/privacy-policy")}
              className="font-outfit text-xs text-gray-400 transition-colors duration-200 hover:text-emerald-600 sm:text-sm"
            >
              Privacy Policy
            </button>

            <button
              type="button"
              onClick={() => navigate("/terms-of-service")}
              className="font-outfit text-xs text-gray-400 transition-colors duration-200 hover:text-emerald-600 sm:text-sm"
            >
              Terms of Use
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
