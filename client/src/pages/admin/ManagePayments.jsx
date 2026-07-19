// client/src/pages/admin/ManagePayments.jsx
// Shell component — tab router only. No data fetching here.
//
// CHANGE (this pass): added a "Verified Payments" tab — this is now the
// primary actionable queue (gateway-confirmed, awaiting admin
// confirmation). Its badge count, not Pending's, is the one that matters
// day-to-day, since a payment only needs admin attention once it's
// Verified.

import React, { useState } from "react";
import Title            from "../../components/Title";
import PendingPayments  from "./tabs/PendingPayments";
import VerifiedPayments from "./tabs/VerifiedPayments";
import CustomCharges    from "./tabs/CustomCharges";
import FeeSettings      from "./tabs/FeeSettings";
import FeeHistory       from "./tabs/FeeHistory";

import usePageTitle from "../../hooks/usePageTitle";

const TABS = [
  { label: "Verified Payments", key: "verified" },
  { label: "Pending Sessions",  key: "pending"  },
  { label: "Custom Charges",    key: "charges"  },
  { label: "Fee Settings",      key: "settings" },
  { label: "Fee History",       key: "history"  },
];

const ManagePayments = () => {
  const [activeTab,      setActiveTab]      = useState("verified");
  const [pendingCount,   setPendingCount]   = useState(0);
  const [verifiedCount,  setVerifiedCount]  = useState(0);
  usePageTitle("Manage Payments");

  return (
    <div className="min-h-screen bg-white pb-12">
      <Title
        title="Manage Payments"
        subTitle="Review and confirm payments, assign charges, and manage fee settings."
      />

      {/* Tab bar */}
      <div className="flex gap-0.5 mt-6 border-b border-gray-200 overflow-x-auto scrollbar-hide">
        {TABS.map(tab => {
          const count =
            tab.key === "verified" ? verifiedCount :
            tab.key === "pending"  ? pendingCount  :
            0;
          return (
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
              {count > 0 && (
                <span className={`ml-1.5 text-white text-[10px]
                  font-bold rounded-full px-1.5 py-0.5 align-middle ${
                  tab.key === "verified" ? "bg-emerald-500" : "bg-amber-500"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Always-mounted tab panels — visibility toggled with CSS, so
          polling in each tab stays alive and badge counts update even
          when the admin is on another tab. */}
      <div className={activeTab === "verified" ? "" : "hidden"}>
        <VerifiedPayments onCountChange={setVerifiedCount} />
      </div>
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