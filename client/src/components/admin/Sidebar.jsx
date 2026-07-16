import React from "react";
import { NavLink } from "react-router-dom";
import {
  Users,
  Bell,
  MessageSquare,
  Image,
  LayoutDashboard,
  DollarSign,
  UserCog,
  Megaphone,
  CalendarClock,
} from "lucide-react";

const sidebarLinks = [
  { name: "Dashboard", path: "/admin", icon: <LayoutDashboard className="h-5 w-5 shrink-0" strokeWidth={2.25} /> },
  { name: "Manage Members", path: "/admin/manage-members", icon: <Users className="h-5 w-5 shrink-0" strokeWidth={2.25} /> },
  { name: "Manage Notices", path: "/admin/manage-notices", icon: <Bell className="h-5 w-5 shrink-0" strokeWidth={2.25} /> },
   { name: "Manage Events", path: "/admin/manage-events", icon: <CalendarClock className="h-5 w-5 shrink-0" strokeWidth={2.25} /> },
  { name: "Manage FAQs", path: "/admin/manage-faqs", icon: <MessageSquare className="h-5 w-5 shrink-0" strokeWidth={2.25} /> },
  { name: "Manage Gallery", path: "/admin/manage-gallery", icon: <Image className="h-5 w-5 shrink-0" strokeWidth={2.25} /> },
  { name: "Member Seats", path: "/admin/manage-seats", icon: <Users className="h-5 w-5 shrink-0" strokeWidth={2.25} /> },
  { name: "Manage Committee", path: "/admin/manage-committee", icon: <UserCog className="h-5 w-5 shrink-0" strokeWidth={2.25} /> },
  { name: "Manage Announcements", path: "/admin/manage-announcements", icon: <Megaphone className="h-5 w-5 shrink-0" strokeWidth={2.25} /> },
  { name: "Manage Payments", path: "/admin/payments", icon: <DollarSign className="h-5 w-5 shrink-0" strokeWidth={2.25} /> },
];

const Sidebar = () => {
  return (
    <div className="md:w-72 w-16 border-r h-full text-base border-gray-300 pt-4 flex flex-col transition-all duration-300 bg-white">
      {sidebarLinks.map((item, index) => (
        <NavLink
          to={item.path}
          key={index}
          end={item.path === "/admin"}
          className={({ isActive }) =>
            `flex items-center py-3 px-4 md:px-8 gap-3 transition-colors ${
              isActive
                ? "border-r-4 md:border-r-[6px] bg-emerald-600/10 border-emerald-600 text-emerald-600"
                : "hover:bg-gray-100/90 hover:text-emerald-600 border-white text-gray-700"
            }`
          }
        >
          {item.icon}
          <p className="md:block hidden text-center text-[15px] whitespace-nowrap shrink-0">{item.name}</p>
        </NavLink>
      ))}
    </div>
  );
};

export default Sidebar;