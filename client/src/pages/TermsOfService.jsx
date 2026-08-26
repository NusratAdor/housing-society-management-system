// client/src/pages/TermsOfService.jsx
//
// Same pattern as PrivacyPolicy.jsx. Content reflects the actual
// registration flow, role system, and payment confirmation process
// already built into this system.

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

const TermsOfService = () => {
  usePageTitle("Terms of Service");

  return (
    <div className="w-full bg-white min-h-screen">
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
                  Terms of Service
                </span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            Terms of <span className="text-emerald-400">Service</span>
          </motion.h1>
        </div>
      </div>

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

            <Section title="1. Acceptance of Terms">
              <p>
                By registering for and using this platform, you agree to these
                Terms of Service. If you do not agree, please do not use the
                System.
              </p>
            </Section>

            <Section title="2. Eligibility & Membership Verification">
              <p>
                Registration is limited to individuals holding a membership number
                pre-approved by the Society. Providing false information, or
                attempting to register using a membership number that does not
                belong to you, may result in your account being removed.
              </p>
            </Section>

            <Section title="3. Your Account">
              <p>
                You are responsible for maintaining the confidentiality of your
                account credentials and for all activity that occurs under your
                account. Your membership number, once registered, is permanent and
                cannot be changed — it is the key record tying your profile to your
                dues and payment history.
              </p>
            </Section>

            <Section title="4. Membership Dues & Payments">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Monthly maintenance dues are generated automatically each month
                  at the fee rate approved by the Society at that time.
                </li>
                <li>
                  Payments made through the System are first confirmed by the
                  payment gateway, then reviewed and approved by an authorized
                  Admin before being applied to your account. A receipt is issued
                  once a payment is confirmed.
                </li>
                <li>
                  Advance payments may be made and will be automatically applied
                  to future dues as they become due.
                </li>
                <li>
                  The Society reserves the right to change the monthly fee, with
                  reasonable notice, and to add one-off charges for specific
                  Society expenses.
                </li>
              </ul>
            </Section>

            <Section title="5. Roles & Access">
              <p>
                The System operates with distinct access levels — Member, Admin,
                Content Manager, and Super Admin — each with defined permissions.
                Access beyond the standard Member role is granted solely at the
                discretion of the Society's authorized administrators.
              </p>
            </Section>

            <Section title="6. Acceptable Use">
              <p>You agree not to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Submit false, misleading, or abusive content through the notices, gallery, or question features</li>
                <li>Attempt to access another member's account or data</li>
                <li>Attempt to interfere with or disrupt the System's normal operation</li>
              </ul>
            </Section>

            <Section title="7. Suspension & Termination">
              <p>
                The Society may suspend or remove a member's account for violation
                of these Terms, non-payment of dues, or at the Society's reasonable
                discretion. If your membership is removed, your associated System
                records will be deleted in accordance with our Privacy Policy.
              </p>
            </Section>

            <Section title="8. Limitation of Liability">
              <p>
                The System is provided to facilitate Society administration. While
                reasonable care is taken to ensure accuracy and availability, the
                Society and its System administrators are not liable for
                temporary service interruptions, delays in email delivery, or
                third-party payment gateway issues outside the System's direct
                control.
              </p>
            </Section>

            <Section title="9. Governing Law">
              <p>
                These Terms are governed by the laws of the People's Republic of
                Bangladesh.
              </p>
            </Section>

            <Section title="10. Changes to These Terms">
              <p>
                These Terms may be updated from time to time. Continued use of the
                System after changes take effect constitutes acceptance of the
                revised Terms.
              </p>
            </Section>

            <Section title="11. Contact Us">
              <p>
                For questions about these Terms, please contact the Society office
                through the Contact page or the in-app question feature on your
                member dashboard.
              </p>
            </Section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TermsOfService;