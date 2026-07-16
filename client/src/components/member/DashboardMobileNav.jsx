// client/src/components/member/DashboardMobileNav.jsx
//
// Active pill now uses the sidebar's navy tokens instead of a hardcoded
// slate-800, so mobile and desktop navigation share one exact color
// source — no risk of the two drifting apart if the theme changes later.

import React, { useEffect, useRef } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, CreditCard, User, Bell, MessageCircle, Image,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDashboardNavigate } from "../../hooks/useDashboardNavigate";

const NAV_ITEMS = (t) => [
  { path: "overview", shortLabel: t("tabsShort.overview"), icon: LayoutDashboard },
  { path: "payment",  shortLabel: t("tabsShort.payment"),  icon: CreditCard      },
  { path: "profile",  shortLabel: t("tabsShort.profile"),  icon: User            },
  { path: "notices",  shortLabel: t("tabsShort.notices"),  icon: Bell            },
  { path: "faqs",     shortLabel: t("tabsShort.faqs"),     icon: MessageCircle   },
];

export default function DashboardMobileNav() {
  const { t } = useTranslation("dashboard");
  const items = NAV_ITEMS(t);
  const location = useLocation();
  const dashboardNavigate = useDashboardNavigate();
  const pillsRef = useRef(null);

  useEffect(() => {
    if (!pillsRef.current) return;
    const el = pillsRef.current.querySelector("[data-active='true']");
    el?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [location.pathname]);

  return (
    <div className="lg:hidden bg-white border-b border-gray-200 shadow-sm px-3 pt-2.5 pb-2 flex-shrink-0">
      <div ref={pillsRef} className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {items.map(({ path, shortLabel, icon: Icon }) => {
          const fullPath = `/dashboard/${path}`;
          return (
            <NavLink
              key={path}
              to={fullPath}
              data-active={location.pathname === fullPath}
              onClick={(e) => {
                e.preventDefault();
                dashboardNavigate(fullPath);
              }}
              className={({ isActive }) => `
                flex items-center gap-1.5 px-3.5 py-1.5 rounded-full
                text-xs font-semibold whitespace-nowrap flex-shrink-0
                border transition-all duration-150
                ${isActive
                  ? "bg-sidebar border-sidebar text-sidebar-foreground shadow-sm"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                }
              `}
            >
              <Icon style={{ width: 11, height: 11 }} />
              {shortLabel}
            </NavLink>
          );
        })}
        <Link
          to="/gallery"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full
            text-xs font-semibold whitespace-nowrap flex-shrink-0
            border bg-white border-gray-200 text-gray-500
            hover:border-gray-300 transition-all duration-150"
        >
          <Image style={{ width: 11, height: 11 }} />
          Gallery
        </Link>
      </div>
    </div>
  );
}