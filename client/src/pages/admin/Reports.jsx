// client/src/pages/admin/Reports.jsx
// Four reports, each answering one real question an administrator asks.
import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, FileText, Users, Wallet } from "lucide-react";
import Title from "../../components/Title";
import usePageTitle from "../../hooks/usePageTitle";

const REPORT_CARDS = [
  { key: "directory", title: "Member Directory", icon: Users,
    description: "Members, contact details and plot information." },
  { key: "collection", title: "Collection & Payments", icon: Wallet,
    description: "Cash received during a selected period and how it was applied." },
  { key: "outstanding", title: "Outstanding Dues", icon: AlertCircle,
    description: "Members with unpaid charges, oldest unpaid month and available credit." },
  { key: "statement", title: "Member Account Statement", icon: FileText,
    description: "A member's account activity for a selected period, including charges, payments, credit applications and balances." },
];

const Reports = () => {
  usePageTitle("Reports");

  return (
    <div className="min-h-screen bg-white pb-12">
      <Title title="Reports" subTitle="Choose a report to view on screen or download as PDF or CSV." />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {REPORT_CARDS.map(({ key, title, description, icon: Icon }) => (
          <Link
            key={key}
            to={`/admin/reports/${key}`}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm
              transition hover:border-emerald-300 hover:shadow-md focus:outline-none
              focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 flex-1 text-sm leading-6 text-slate-500">{description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
              Open report
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Reports;