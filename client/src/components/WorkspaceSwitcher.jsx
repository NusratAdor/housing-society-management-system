// client/src/components/WorkspaceSwitcher.jsx
//
// Single unified navigation control. Replaces the old pattern of a
// separate plain CTA button + a separate switcher living side by side —
// that duplication was the actual bug (Navbar's "Dashboard" button and
// this switcher were both visible at once for Admin+Member accounts).
//
// Now this component alone decides what to render, based purely on
// availableWorkspaces.length:
//   0 workspaces -> nothing (caller renders "Create Profile" instead)
//   1 workspace  -> a single plain button, no dropdown chrome
//   2+ workspaces -> the dropdown switcher
// Every consumer (Navbar, Hero, DashboardTopBar, admin Navbar) renders
// ONLY this component for their "logged-in, has an identity" case —
// no parallel button logic anywhere else anymore.

import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, LayoutDashboard } from "lucide-react";
import { useAppContext } from "../context/AppContext";

export default function WorkspaceSwitcher({ variant = "light" }) {
  const { availableWorkspaces } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

    // This component ONLY handles the multi-workspace dropdown case now.
  // A single workspace (the common case — plain Member, or staff-only)
  // is rendered by the caller itself, using whatever button style
  // already matches that surface (e.g. Navbar/Hero's brand gradient
  // CTA) — that styling shouldn't be dictated by a shared dropdown
  // component. Returning null here for 0 or 1 workspaces means every
  // caller must handle those cases itself; see Navbar.jsx/Hero.jsx for
  // the pattern.
  if (availableWorkspaces.length < 2) return null;

  const current = availableWorkspaces.find((w) => location.pathname.startsWith(w.path))
    ?? availableWorkspaces[0];

  // "brand" — solid emerald→teal gradient, matching every other CTA on
  // the public site (Hero's button, Navbar's single-workspace button).
  // Used only by the public Navbar, where a translucent pill read as a
  // washed-out gray box against photo backgrounds. "light"/"dark" stay
  // as they were for the dashboard/admin shells, which have solid,
  // non-photo backgrounds where the translucent pill always looked fine.
  const pillClass =
    variant === "brand"
      ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
      : variant === "light"
      ? "bg-white/15 text-white border border-white/25 hover:bg-white/25"
      : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200";

  return (
    <div className="relative" ref={ref}>
            <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${pillClass}`}
      >
        <LayoutDashboard className="h-4 w-4" />
        {current.switchLabel}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 min-w-[180px] rounded-lg border border-gray-200 bg-white shadow-lg py-1 z-50">
          {availableWorkspaces.map((w) => (
            <button
              key={w.key}
              onClick={() => { navigate(w.path); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                w.key === current.key
                  ? "bg-emerald-50 text-emerald-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {w.switchLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}