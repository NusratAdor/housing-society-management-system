// client/src/pages/PrivacyPolicy.jsx
//
// Static content page — no data fetching, matches the hero+card
// pattern used across NoticeDetail.jsx / CommitteeMemberDetail.jsx for
// visual consistency with the rest of the site.
//
// Content reflects the ACTUAL system: real data fields collected at
// registration, real third-party services in use (Clerk, MongoDB
// Atlas, Cloudinary, Supabase, SSLCommerz, Resend), and the real
// two-step payment confirmation flow — not generic template text.

import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

const Section = ({ title, children }) => (
  <div className="mb-8 last:mb-0">
    <h3 className="font-bold text-lg text-gray-900 mb-3">{title}</h3>
    <div className="text-gray-700 font-outfit text-sm leading-relaxed space-y-3">
      {children}
    </div>
  </div>
);

const PrivacyPolicy = () => {
  usePageTitle("Privacy Policy");

  return (
    <div className="w-full bg-white min-h-screen">
      {/* Hero — same pattern as NoticeDetail/CommitteeMemberDetail */}
      <div className="relative w-full overflow-hidden">
        <div className="absolute inset-0 bg-[url('/src/assets/heroImage6.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/75" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-20 flex flex-col items-center text-center">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-base flex-wrap">
              <li>
                <Link to="/" className="text-white/70 hover:text-white font-outfit font-medium transition-colors">
                  Home
                </Link>
              </li>
              <li className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-white/40" strokeWidth={2} />
                <span className="text-emerald-400 font-outfit font-medium" aria-current="page">
                  Privacy Policy
                </span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            Privacy <span className="text-emerald-400">Policy</span>
          </motion.h1>
        </div>
      </div>

      {/* Content card */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 mt-10 md:mt-12 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="h-1" style={{ backgroundColor: "#84A98C" }} />

          <div className="p-6 md:p-10">
            <p className="text-xs text-gray-400 mb-8">
              Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>

            <Section title="1. Introduction">
              <p>
                This Privacy Policy explains how the Government Officers' Multipurpose
                Cooperative Society ("the Society," "we," "us") collects, uses, and
                protects the personal information of members who use this platform
                ("the System") for membership registration, dues management, and
                community communication.
              </p>
            </Section>

            <Section title="2. Information We Collect">
              <p>When you register as a member, we collect:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Full name, email address, and phone number</li>
                <li>Residential address and plot number(s)</li>
                <li>Membership number and designation (where applicable)</li>
                <li>Payment and dues history within the System</li>
              </ul>
              <p>
                Account authentication (sign-up and login) is handled by our
                authentication provider, Clerk, which may collect standard sign-in
                details such as your email address and session information.
              </p>
            </Section>

            <Section title="3. How We Use Your Information">
              <ul className="list-disc pl-5 space-y-1">
                <li>To verify your membership and create your account</li>
                <li>To calculate, track, and display your monthly dues and payment history</li>
                <li>To send you notices, payment confirmations, receipts, and due reminders</li>
                <li>To respond to questions you submit to the Society office</li>
                <li>To maintain accurate Society records for administrative and financial purposes</li>
              </ul>
            </Section>

            <Section title="4. Payment Processing">
              <p>
                Online payments are processed through SSLCommerz, a licensed payment
                gateway. We do not collect or store your card, mobile banking, or
                bank account details directly — these are handled entirely by
                SSLCommerz's secure payment systems.
              </p>
              <p>
                For added protection, payments are reviewed and confirmed by an
                authorized Society Admin before they are applied to your account —
                no payment affects your dues automatically without this review.
              </p>
            </Section>

            <Section title="5. Where Your Data Is Stored">
              <p>
                Your account and membership data is stored in a secured MongoDB
                Atlas database. Photos and documents (such as notices or committee
                photos) are stored via Cloudinary and Supabase Storage. All data
                transmission between your device and our servers is encrypted.
              </p>
            </Section>

            <Section title="6. Who Can Access Your Information">
              <p>
                Access to member data is restricted by role within the System:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Admins</strong> can view and manage member records, dues,
                  and payments as part of Society administration.
                </li>
                <li>
                  <strong>Content Managers</strong> (Society staff handling notices,
                  gallery, and announcements) cannot access member dues, payment
                  records, or financial data.
                </li>
                <li>
                  <strong>Other members</strong> cannot view your personal details,
                  dues, or payment history.
                </li>
              </ul>
              <p>
                Every action that affects your membership status, role, or payment
                records is permanently logged for audit and accountability purposes.
              </p>
            </Section>

            <Section title="7. Data Retention">
              <p>
                We retain your membership and payment records for as long as your
                membership is active, and as needed to maintain accurate Society
                financial records. If your membership is removed by an Admin, your
                associated records are deleted from the System, and your membership
                number is released for future use.
              </p>
            </Section>

            <Section title="8. Your Rights">
              <p>
                You may contact the Society office at any time to request a
                correction of inaccurate information in your profile, or to ask
                questions about how your data is used. Certain fields (such as your
                membership number) are permanently fixed once registered, to protect
                the integrity of Society financial records.
              </p>
            </Section>

            <Section title="9. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. Material
                changes will be communicated via a notice on this platform.
              </p>
            </Section>

            <Section title="10. Contact Us">
              <p>
                For questions about this Privacy Policy or your personal data,
                please contact the Society office through the Contact page or the
                in-app question feature on your member dashboard.
              </p>
            </Section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;