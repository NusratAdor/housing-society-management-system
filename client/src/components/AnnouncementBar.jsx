// client/src/components/AnnouncementBar.jsx
//
// CHANGE (this pass):
//   1. Removed the dismiss (X) button entirely — a per-visitor
//      "dismiss forever" doesn't fit an official society notice.
//      isActive in Manage Announcements is now the only on/off switch,
//      and it's admin-controlled, not visitor-controlled. This also
//      means useActiveAnnouncement no longer needs localStorage state.
//   2. Removed the max-w-7xl/mx-auto centering that the main nav row
//      uses. That constraint was leaving empty colored space on both
//      sides on wide screens and squeezing the ticker + old dismiss
//      button into a centered strip — which is what made it look
//      broken/overlapping. The bar now runs the full viewport width,
//      edge to edge, the way a ticker should.
//   3. Color: "info" is now a deep indigo-navy (#1E193C) instead of
//      the bright emerald->teal gradient. "urgent" is slate-900
//      (near-black), one clear step darker/more severe than info —
//      no hue jump, still no red anywhere. "warning" (amber) unchanged.
//
// Still rendered as the first child inside Navbar's fixed <nav>
// wrapper — see Navbar.jsx pass 11 notes for why.

import React from "react";
import { Link } from "react-router-dom";
import { Megaphone, AlertTriangle, AlertOctagon } from "lucide-react";
import useActiveAnnouncement from "../hooks/useActiveAnnouncement";

const TYPE_STYLES = {
  info: {
    className: "bg-[#121358] text-white",
    Icon: Megaphone,
  },
  warning: {
    className: "bg-amber-400 text-amber-950",
    Icon: AlertTriangle,
  },
  urgent: {
    className: "bg-slate-900 text-white",
    Icon: AlertOctagon,
  },
};

const AnnouncementBar = () => {
  const { announcement } = useActiveAnnouncement();

  if (!announcement) return null;

  const { className, Icon } = TYPE_STYLES[announcement.type] || TYPE_STYLES.info;
  const isInternalLink = announcement.link?.startsWith("/");

  const MarqueeCopy = ({ ariaHidden }) => {
    const text = <span className="whitespace-nowrap">{announcement.text}</span>;
    const wrapped = announcement.link ? (
      isInternalLink ? (
        <Link to={announcement.link} className="hover:underline underline-offset-2" tabIndex={ariaHidden ? -1 : 0}>
          {text}
        </Link>
      ) : (
        <a
          href={announcement.link}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline underline-offset-2"
          tabIndex={ariaHidden ? -1 : 0}
        >
          {text}
        </a>
      )
    ) : (
      text
    );

    return (
      <span
        aria-hidden={ariaHidden || undefined}
        className="font-outfit text-[13px] sm:text-sm font-medium pr-16 shrink-0"
      >
        {wrapped}
      </span>
    );
  };

  return (
    <div className={`w-full ${className}`}>
      <style>{`
        .announcement-marquee-track {
          display: flex;
          width: max-content;
          animation: announcement-marquee 26s linear infinite;
        }
        .announcement-marquee-wrap:hover .announcement-marquee-track {
          animation-play-state: paused;
        }
        @keyframes announcement-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .announcement-marquee-track {
            animation: none;
          }
        }
      `}</style>

      {/* No max-w/mx-auto here on purpose — full viewport width */}
      <div className="w-full flex items-center gap-2.5 px-4 md:px-8 py-2">
        <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} />

        {/* Real text, once, for screen readers — not part of the
            visual marquee loop. */}
        <span className="sr-only" role="status" aria-live="polite">
          {announcement.text}
        </span>

        <div className="announcement-marquee-wrap flex-1 min-w-0 overflow-hidden">
          <div className="announcement-marquee-track">
            <MarqueeCopy ariaHidden />
            <MarqueeCopy ariaHidden />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementBar;