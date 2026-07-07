// client/src/components/member/DashboardPageContainer.jsx
//
// Restores the max-width + padding wrapper that non-overview dashboard
// tabs previously received from MemberDashboard.jsx's conditional render.
// OverviewCard is exempt — it manages this constraint internally.

import React from "react";

export default function DashboardPageContainer({ children }) {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      {children}
    </div>
  );
}