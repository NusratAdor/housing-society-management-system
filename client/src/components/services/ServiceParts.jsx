import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";
import { useAppContext } from "../../context/AppContext";

export const ServiceHero = ({ crumbs, title, highlight, subtitle }) => (
  <div className="relative w-full overflow-hidden">
    <div className="absolute inset-0 bg-[url('/src/assets/heroImage6.png')] bg-cover bg-center" />
    <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/75" />

    <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-20 flex flex-col items-center text-center">
      <nav aria-label="Breadcrumb" className="mb-5">
        <ol className="flex flex-wrap items-center justify-center gap-1.5 text-base">
          {crumbs.map((crumb, i) => (
            <li key={crumb.label} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-white/40" strokeWidth={2} />}
              {crumb.to ? (
                <Link to={crumb.to} className="text-white/70 hover:text-white font-outfit font-medium transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-emerald-400 font-outfit font-medium">{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl md:text-4xl font-bold text-white leading-tight"
      >
        {title} <span className="text-emerald-400">{highlight}</span>
      </motion.h1>

      {subtitle && <p className="mt-3 max-w-xl text-sm md:text-base text-white/80 font-outfit">{subtitle}</p>}
    </div>
  </div>
);

export const ServiceCard = ({ to, icon: Icon, title, description, detail, action, index = 0 }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08, duration: 0.4 }}>
    <Link
      to={to}
      className="group flex flex-col h-full bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 p-6"
    >
      <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
        <Icon className="h-5 w-5 text-emerald-600" strokeWidth={2} />
      </div>
      <h3 className="font-bold text-lg text-gray-900 mb-1.5">{title}</h3>
      <p className="text-gray-500 text-sm font-outfit leading-relaxed flex-1">{description}</p>
      {detail && <p className="mt-3 text-sm font-medium text-gray-700">{detail}</p>}
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 group-hover:gap-2.5 transition-all duration-200">
        {action}
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  </motion.div>
);

// Shows its children only to a signed-in, active member.
export const MemberGate = ({ children }) => {
  const { user, navigate, memberProfile, loadingProfile } = useAppContext();

  if (loadingProfile) return <div className="h-48 animate-pulse rounded-xl bg-gray-100" />;

  let block = null;
  if (!user) {
    block = { title: "Please sign in", text: "Sign in with your member account to send a request.", label: "Sign in", to: "/sign-in" };
  } else if (!memberProfile) {
    block = { title: "Create your member profile", text: "You need a member profile to send a request.", label: "Create profile", to: "/create-profile" };
  } else if (memberProfile.status !== "active") {
    block = { title: "Your membership is not active", text: "Please contact the society office.", label: "Contact us", to: "/contact" };
  }

  if (!block) return children;

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center">
      <h3 className="font-semibold text-gray-900">{block.title}</h3>
      <p className="mt-1 text-sm text-gray-500 font-outfit">{block.text}</p>
      <button
        onClick={() => navigate(block.to)}
        className="mt-4 rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:from-emerald-600 hover:to-teal-700"
      >
        {block.label}
      </button>
    </div>
  );
};

export const inputClass = (hasError) =>
  `w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:ring-2 focus:ring-emerald-500/20 ${
    hasError ? "border-red-400" : "border-gray-300 focus:border-emerald-500"
  }`;

export const Field = ({ id, label, error, optional, className = "", children }) => (
  <div className={className}>
    <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
      {label} {optional && <span className="font-normal text-gray-400">(optional)</span>}
    </label>
    {children}
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

export const SubmitButton = ({ submitting, children }) => (
  <button
    type="submit"
    disabled={submitting}
    className="mt-5 w-full rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:from-emerald-600 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
  >
    {submitting ? "Sending…" : children}
  </button>
);

export const RequestSent = ({ onAnother }) => (
  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
    <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
    <h3 className="mt-3 text-lg font-semibold text-emerald-900">Request sent</h3>
    <p className="mt-1 text-sm text-emerald-800 font-outfit">The office will review your request and contact you.</p>
    <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
      <Link to="/our-services" className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700">
        Back to services
      </Link>
      <button onClick={onAnother} className="rounded-md border border-emerald-300 px-5 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100">
        Send another request
      </button>
    </div>
  </div>
);