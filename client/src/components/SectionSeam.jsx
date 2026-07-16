// client/src/components/SectionSeam.jsx
//
// Small circular badge that straddles the boundary between two stacked
// homepage sections — half sits in the section above it (via a
// negative bottom offset), half in the section below, so the
// transition is marked BY this element rather than by a separate
// divider line. This replaces the border-t hairline approach from the
// previous pass.
//
// Icon convention (deliberate, not arbitrary): each seam badge uses
// the SAME icon as the pill badge inside the section it's introducing
// — e.g. the seam before NoticesPreview uses Megaphone, matching
// NoticesPreview's own "Notice Board" pill. That makes each badge read
// as a preview of what's coming next, tying the whole page together as
// one thread instead of four unrelated decorative circles.
//
// The parent section must have `relative` positioning for this to
// place correctly — see Hero.jsx / SocietyIntroduction.jsx /
// NoticesPreview.jsx for usage.

import React from "react";

const SectionSeam = ({ icon: Icon }) => (
  <div className="pointer-events-none absolute -bottom-7 left-1/2 z-10 -translate-x-1/2">
    <div className="flex h-14 w-14 items-center justify-center rounded-full
                    border border-gray-100 bg-white shadow-lg">
      <Icon className="h-6 w-6 text-emerald-600" strokeWidth={2} />
    </div>
  </div>
);

export default SectionSeam;