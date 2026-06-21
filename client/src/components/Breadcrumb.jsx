// client/src/components/Breadcrumb.jsx
//
// Accepts an array of crumb objects:
//   { label: string, href?: string }
//
// The last crumb is always the current page — rendered as plain text,
// not a link. All earlier crumbs are links.
//
// Visual pattern: Home / Notices / Notice Title
// The separator is a "/" rendered as an SVG chevron for crispness at
// small sizes.

import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const Breadcrumb = ({ crumbs = [] }) => {
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-1 flex-wrap">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <li key={index} className="flex items-center gap-1">
              {/* Separator — not shown before the first crumb */}
              {index > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 text-gray-300 flex-shrink-0"
                  strokeWidth={2}
                />
              )}

              {isLast ? (
                // Current page — no link, visually muted so it reads
                // as "you are here" rather than an action
                <span
                  className="text-sm text-gray-500 font-outfit
                    font-medium truncate max-w-[200px]"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                // Ancestor page — clickable link
                <Link
                  to={crumb.href}
                  className="text-sm text-[var(--color-primary)] font-outfit
                    font-medium hover:underline underline-offset-2
                    transition-colors hover:text-blue-700 flex-shrink-0"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;