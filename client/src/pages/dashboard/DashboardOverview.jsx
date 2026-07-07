// client/src/pages/dashboard/DashboardOverview.jsx
//
// Route: /dashboard/overview
//
// Owns the breakdown fetch previously held in MemberDashboard.jsx.
// Cross-tab navigation now uses real routes via useNavigate() instead
// of setActiveTab() — the URL itself is the source of truth.

import React, { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../context/AppContext";
import OverviewCard from "../../components/member/OverviewCard";
import usePageTitle from "../../hooks/usePageTitle";
import { useDashboardNavigate } from "../../hooks/useDashboardNavigate";

export default function DashboardOverview() {
  const { memberProfile, axios, getToken } = useAppContext();
  const { joinDate } = useOutletContext();
  const dashboardNavigate = useDashboardNavigate();

  const { t } = useTranslation("dashboard");

  usePageTitle(t("tabs.overview"));

  const [breakdown, setBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(true);

  const fetchBreakdown = useCallback(async () => {
    if (!memberProfile) return;
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/payments/me/breakdown", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setBreakdown(data);
    } catch {
      /* silent — OverviewCard renders its own empty state */
    } finally {
      setLoadingBreakdown(false);
    }
  }, [axios, getToken, memberProfile]);

  useEffect(() => {
    fetchBreakdown();
  }, [fetchBreakdown]);

   return (
    <OverviewCard
      memberProfile={memberProfile}
      breakdown={breakdown}
      loadingBreakdown={loadingBreakdown}
      onRefreshBreakdown={fetchBreakdown}
      joinDate={joinDate}
      onGoToPayment={() => dashboardNavigate("/dashboard/payment")}
      onGoToNotices={() => dashboardNavigate("/dashboard/notices")}
      onGoToFAQs={() => dashboardNavigate("/dashboard/faqs")}
    />
  );
}