// client/src/pages/dashboard/DashboardPayment.jsx
import React from "react";
import { useTranslation } from "react-i18next";
import PaymentSection from "../../components/member/PaymentSection";
import DashboardPageContainer from "../../components/member/DashboardPageContainer";
import usePageTitle from "../../hooks/usePageTitle";

export default function DashboardPayment() {
  const { t } = useTranslation("dashboard");
  usePageTitle(t("tabs.payment"));

  return (
    <DashboardPageContainer>
      <PaymentSection onPaymentSuccess={() => {}} />
    </DashboardPageContainer>
  );
}