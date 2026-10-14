// client/src/components/Footer.jsx
//
// Dark footer (slate-950, near-black). Text never darker than slate-400 so it
// keeps WCAG AA contrast. Navigation uses real <Link>s. The light logo is used
// (same as the Navbar over the dark hero); the dark-text logo is unreadable here.
//
// NOTE: the class strings are concatenated, not template literals, on purpose:
// this file was once corrupted by a copy/paste of backticks.

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { FaInstagram, FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

import { assets } from "../assets/assets";

const ABOUT_LINKS = [
  { label: "About Society", path: "/about-us" },
  { label: "Vision & Mission", path: "/about-us/vision-mission" },
  { label: "Executive Committee", path: "/about-us/executive-committee" },
];

const SERVICE_LINKS = [
  { label: "Guest House", path: "/our-services/guest-house" },
  { label: "Utility Services", path: "/our-services/utility-services" },
];

const RESOURCE_LINKS = [
  { label: "Notices", path: "/notices" },
  { label: "Gallery", path: "/gallery" },
  { label: "Contact", path: "/contact" },
];

// TODO: replace these with the society's real pages (remove any it doesn't have).
const SOCIAL_LINKS = [
  { icon: FaInstagram, url: "https://instagram.com", label: "Instagram" },
  { icon: FaFacebookF, url: "https://facebook.com", label: "Facebook" },
  { icon: FaXTwitter, url: "https://x.com", label: "X" },
  { icon: FaLinkedinIn, url: "https://linkedin.com", label: "LinkedIn" },
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const FooterColumn = ({ title, links }) => (
  <nav aria-label={title}>
    <h3 className="mb-5 font-outfit text-xs font-semibold uppercase tracking-wider text-slate-400">
      {title}
    </h3>
    <ul className="space-y-3">
      {links.map(({ label, path }) => (
        <li key={path}>
          <Link
            to={path}
            className={
              "group inline-flex items-center font-outfit text-sm text-slate-300 transition-colors duration-200 hover:text-emerald-400 " +
              FOCUS_RING
            }
          >
            <span>{label}</span>
            <ArrowRight
              className="ml-1.5 h-3 w-3 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
              strokeWidth={1.8}
            />
          </Link>
        </li>
      ))}
    </ul>
  </nav>
);

const Footer = () => (
  <footer className="w-full bg-slate-950">
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Main footer content */}
      <div className="grid grid-cols-1 gap-10 py-16 sm:grid-cols-2 lg:grid-cols-12 lg:gap-12">
        {/* Brand / introduction */}
        <div className="sm:col-span-2 lg:col-span-5">
          <Link
            to="/"
            aria-label="Go to GOHS home"
            className={"inline-flex " + FOCUS_RING}
          >
            <img
              src={assets.logo}
              alt="Government Officer's Housing Society (GOHS)"
              className="h-10 w-auto object-contain"
            />
          </Link>

          <p className="mt-5 max-w-md font-outfit text-sm leading-6 text-slate-400">
            Connect with your community, manage your membership, and stay on
            top of dues and notices — all in one secure platform built for our
            500+ society members.
          </p>

          <Link
            to="/contact"
            className={
              "mt-5 inline-flex items-center gap-2 font-outfit text-sm font-medium text-emerald-400 transition-colors duration-200 hover:text-emerald-300 " +
              FOCUS_RING
            }
          >
            Contact the Society
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>

          {/* Social links */}
          <div className="mt-7 flex items-center gap-2.5">
            {SOCIAL_LINKS.map(({ icon: Icon, url, label }) => {
              const ariaLabel = "Follow GOHS on " + label;

              return (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={ariaLabel}
                  className={
                    "flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400 " +
                    FOCUS_RING
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2">
          <FooterColumn title="About" links={ABOUT_LINKS} />
        </div>

        <div className="lg:col-span-2">
          <FooterColumn title="Our Services" links={SERVICE_LINKS} />
        </div>

        <div className="lg:col-span-3">
          <FooterColumn title="Resources" links={RESOURCE_LINKS} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex flex-col gap-4 border-t border-slate-800 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-outfit text-xs text-slate-400 sm:text-sm">
          &copy; {new Date().getFullYear()} Government Officer&apos;s Housing
          Society (GOHS). All rights reserved.
        </p>

        <div className="flex items-center gap-5">
          <Link
            to="/privacy-policy"
            className={
              "font-outfit text-xs text-slate-400 transition-colors duration-200 hover:text-emerald-400 sm:text-sm " +
              FOCUS_RING
            }
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms-of-service"
            className={
              "font-outfit text-xs text-slate-400 transition-colors duration-200 hover:text-emerald-400 sm:text-sm " +
              FOCUS_RING
            }
          >
            Terms of Use
          </Link>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;