// client/src/pages/admin/ManagePayments.jsx
// Shell component — tab router only. No data fetching here.
// All logic lives in the four tab components below.

import React, { useState } from "react";
import Title           from "../../components/Title";
import PendingPayments from "./tabs/PendingPayments";
import CustomCharges   from "./tabs/CustomCharges";
import FeeSettings     from "./tabs/FeeSettings";
import FeeHistory      from "./tabs/FeeHistory";

import usePageTitle from "../../hooks/usePageTitle";

const TABS = [
  { label: "Pending Payments", key: "pending"  },
  { label: "Custom Charges",   key: "charges"  },
  { label: "Fee Settings",     key: "settings" },
  { label: "Fee History",      key: "history"  },
];

const ManagePayments = () => {
  const [activeTab,    setActiveTab]    = useState("pending");
  const [pendingCount, setPendingCount] = useState(0);
  usePageTitle("Manage Payments");

  return (
    <div className="min-h-screen bg-white pb-12">
      <Title
        title="Manage Payments"
        subTitle="Review pending payments, assign charges, and manage fee settings."
      />

      {/* Tab bar */}
      <div className="flex gap-0.5 mt-6 border-b border-gray-200 overflow-x-auto scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-outfit font-medium transition-all
              border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.key
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.key === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px]
                font-bold rounded-full px-1.5 py-0.5 align-middle">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Always-mounted tab panels — visibility toggled with CSS.
          WHY always mounted: PendingPayments polling stays alive so the
          badge count updates even when the user is on another tab. */}
      <div className={activeTab === "pending"  ? "" : "hidden"}>
        <PendingPayments onCountChange={setPendingCount} />
      </div>
      <div className={activeTab === "charges"  ? "" : "hidden"}>
        <CustomCharges />
      </div>
      <div className={activeTab === "settings" ? "" : "hidden"}>
        <FeeSettings />
      </div>
      <div className={activeTab === "history"  ? "" : "hidden"}>
        <FeeHistory />
      </div>
    </div>
  );
};

export default ManagePayments;