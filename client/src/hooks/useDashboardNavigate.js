// client/src/hooks/useDashboardNavigate.js
//
// Hub-and-spoke navigation for the member dashboard tabs.
//
// "Overview" is the hub; every other tab (payment, profile, notices,
// faqs) is a spoke. This is the same pattern used by Gmail's settings
// panels and Slack's preferences — switching between sibling tabs
// should not stack up browser history one entry per tab, or the back
// button has to be clicked once per tab visited before it actually
// leaves the dashboard.
//
// Rule:
//   hub   -> spoke : push    (a real navigation step)
//   spoke -> spoke : replace (switching tabs doesn't grow the stack —
//                              one back click always returns to the hub)
//   spoke -> hub   : push    (returning to the hub is a real step too)
//
// Result: no matter how many spokes are visited in sequence, the
// history stack only ever holds [hub, currentSpoke]. Back from any
// spoke goes directly to the hub in exactly one click.

import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const HUB_PATH = "/dashboard/overview";

export function useDashboardNavigate() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback((targetPath) => {
    if (location.pathname === targetPath) return; // already there

    const onHub      = location.pathname === HUB_PATH;
    const goingToHub  = targetPath === HUB_PATH;
    const shouldReplace = !onHub && !goingToHub; // spoke -> spoke only

    navigate(targetPath, { replace: shouldReplace });
  }, [navigate, location.pathname]);
}