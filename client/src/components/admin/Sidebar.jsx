import React from "react";
import { NavLink } from "react-router-dom";
import {
  Users,
  Bell,
  MessageSquare,
  Image,
  LayoutDashboard,
  DollarSign,               // <-- NEW ICON
} from "lucide-react";

const Sidebar = () => {
  const sidebarLinks = [
    { name: "Dashboard", path: "/admin", icon: <LayoutDashboard className="min-h-6 min-w-6" /> },
    { name: "Manage Members", path: "/admin/manage-members", icon: <Users className="min-h-6 min-w-6" /> },
    { name: "Manage Notices", path: "/admin/manage-notices", icon: <Bell className="min-h-6 min-w-6" /> },
    { name: "Manage FAQs", path: "/admin/manage-faqs", icon: <MessageSquare className="min-h-6 min-w-6" /> },
    { name: "Manage Gallery", path: "/admin/manage-gallery", icon: <Image className="min-h-6 min-w-6" /> },

    // ------------------- NEW ITEM -------------------
    { name: "Manage Payments", path: "/admin/payments", icon: <DollarSign className="min-h-6 min-w-6" /> },
    // ------------------------------------------------
  ];

  return (
    <div className="md:w-64 w-16 border-r h-full text-base border-gray-300 pt-4 flex flex-col transition-all duration-300 bg-white">
      {sidebarLinks.map((item, index) => (
        <NavLink
          to={item.path}
          key={index}
          end={item.path === "/admin"}
          className={({ isActive }) =>
            `flex items-center py-3 px-4 md:px-8 gap-3 ${
              isActive
                ? "border-r-4 md:border-r-[6px] bg-blue-600/10 border-[var(--color-primary)] text-[var(--color-primary)]"
                : "hover:bg-gray-100/90 border-white text-gray-700"
            }`
          }
        >
          {item.icon}
          <p className="md:block hidden text-center">{item.name}</p>
        </NavLink>
      ))}
    </div>
  );
};

export default Sidebar;