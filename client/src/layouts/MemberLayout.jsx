// // client/src/layouts/DashboardLayout.jsx
// //
// // FIXED LAYOUT STRUCTURE:
// // The previous version had pt-14 on the flex row containing sidebar+main.
// // This works only if the flex row is itself NOT a fixed element.
// // The correct structure is:
// //   - Root div: h-screen, flex-col
// //   - Top bar: fixed, h-14, z-40
// //   - Body row: flex-1, flex-row, pt-14 (pushes below fixed top bar)
// //   - Sidebar: h-full within body row
// //   - Main: flex-1, overflow-y-auto

// import React, { useState, useCallback, useEffect } from "react";
// import { Outlet }        from "react-router-dom";
// import DashboardTopBar   from "../components/member/DashboardTopBar";
// import DashboardSidebar  from "../components/member/DashboardSidebar";
// import { useAppContext } from "../context/AppContext";

// export default function DashboardLayout() {
//   const { memberProfile, axios, getToken } = useAppContext();

//   const [activeTab, setActiveTab] = useState("overview");
//   const [joinDate,  setJoinDate]  = useState(null);

//   const fetchJoinDate = useCallback(async () => {
//     if (!memberProfile?.membershipNo) return;
//     try {
//       const token = await getToken();
//       const { data } = await axios.get("/api/members/seat", {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (data.success && data.joinDate) setJoinDate(data.joinDate);
//     } catch { /* non-fatal */ }
//   }, [axios, getToken, memberProfile?.membershipNo]);

//   useEffect(() => { fetchJoinDate(); }, [fetchJoinDate]);

//   return (
//     <div className="h-screen w-screen overflow-hidden bg-gray-50">

//       {/* Fixed top bar — sits above everything */}
//       <DashboardTopBar />

//       {/* Page body — full height, split into sidebar + content.
//           mt-14 pushes this below the fixed top bar (top bar = h-14 = 56px). */}
//       <div
//         className="flex mt-14"
//         style={{ height: "calc(100vh - 56px)" }}
//       >
//         {/* Sidebar — full height of body, fixed width, desktop only */}
//         <DashboardSidebar
//           activeTab={activeTab}
//           onTabChange={setActiveTab}
//           memberProfile={memberProfile}
//           joinDate={joinDate}
//         />

//         {/* Scrollable main content */}
//         <main className="flex-1 overflow-y-auto bg-gray-50">
//           <Outlet context={{ activeTab, setActiveTab, joinDate }} />
//         </main>
//       </div>
//     </div>
//   );
// }