// client/src/pages/dashboard/DashboardFAQs.jsx
import React from "react";
import { useTranslation } from "react-i18next";
import FAQSection from "../../components/member/FAQSection";
import DashboardPageContainer from "../../components/member/DashboardPageContainer";
import usePageTitle from "../../hooks/usePageTitle";

export default function DashboardFAQs() {
  const { t } = useTranslation("dashboard");
  usePageTitle(t("tabs.faqs"));

  return (
    <DashboardPageContainer>
      <FAQSection />
    </DashboardPageContainer>
  );
}