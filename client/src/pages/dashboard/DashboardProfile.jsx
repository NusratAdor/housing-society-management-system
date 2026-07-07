// client/src/pages/dashboard/DashboardProfile.jsx
import React from "react";
import { useTranslation } from "react-i18next";
import ProfileSection from "../../components/member/ProfileSection";
import DashboardPageContainer from "../../components/member/DashboardPageContainer";
import usePageTitle from "../../hooks/usePageTitle";

export default function DashboardProfile() {
  const { t } = useTranslation("dashboard");
  usePageTitle(t("tabs.profile"));

  return (
    <DashboardPageContainer>
      <ProfileSection onActionComplete={() => {}} />
    </DashboardPageContainer>
  );
}