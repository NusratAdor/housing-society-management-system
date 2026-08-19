// client/src/pages/admin/AdminIndex.jsx
//
// The /admin index route now needs to render different content depending
// on who's looking at it. Rather than adding an auth/role branch inside
// Dashboard.jsx itself (which is a financial overview Content Manager
// should never see), this small wrapper picks the right component.
// Layout.jsx stays free of auth/role logic, matching its own documented
// philosophy — this wrapper is presentation routing, not authorization
// (authorization already happened in ProtectedRoute before this mounts).

import React from "react";
import { useAppContext } from "../../context/AppContext";
import Dashboard from "./Dashboard";
import ContentManagerLanding from "../staff/ContentManagerLanding";

const AdminIndex = () => {
  const { isContentManager } = useAppContext();
  return isContentManager ? <ContentManagerLanding /> : <Dashboard />;
};

export default AdminIndex;