// client/src/pages/dashboard/DashboardNotices.jsx
import React from "react";
import { useTranslation } from "react-i18next";
import NoticesSection from "../../components/member/NoticesSection";
import DashboardPageContainer from "../../components/member/DashboardPageContainer";
import usePageTitle from "../../hooks/usePageTitle";

export default function DashboardNotices() {
  const { t } = useTranslation("dashboard");
  usePageTitle(t("tabs.notices"));

  return (
    <DashboardPageContainer>
      <NoticesSection />
    </DashboardPageContainer>
  );
}