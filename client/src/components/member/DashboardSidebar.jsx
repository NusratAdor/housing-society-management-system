// client/src/components/member/DashboardSidebar.jsx
//
// Active tab is now derived from the URL via NavLink's isActive —
// no activeTab/onTabChange props needed. This eliminates an entire
// class of bugs where displayed content and highlighted nav item
// could fall out of sync.

import React from "react";
import { NavLink, Link } from "react-router-dom";
import {
  LayoutDashboard, CreditCard, User,
  Bell, MessageCircle, Image, ShieldCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDashboardNavigate } from "../../hooks/useDashboardNavigate";


const NAV_ITEMS = (t) => [
  { path: "overview", label: t("tabs.overview"), icon: LayoutDashboard },
  { path: "payment",  label: t("tabs.payment"),  icon: CreditCard      },
  { path: "profile",  label: t("tabs.profile"),  icon: User            },
  { path: "notices",  label: t("tabs.notices"),  icon: Bell            },
  { path: "faqs",     label: t("tabs.faqs"),     icon: MessageCircle   },
];

export default function DashboardSidebar({ memberProfile, joinDate }) {
  const { t } = useTranslation("dashboard");
  const items = NAV_ITEMS(t);
  const dashboardNavigate = useDashboardNavigate();

  const initials = (memberProfile?.name ?? "M")
    .split(" ").filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join("");

  const memberSinceDate = joinDate || memberProfile?.createdAt;
  const memberSinceStr = memberSinceDate
    ? new Date(memberSinceDate).toLocaleDateString(undefined, {
        month: "long", year: "numeric",
      })
    : null;

  return (
    <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0
      h-full bg-sidebar text-sidebar-foreground
      shadow-[1px_0_16px_rgba(0,0,0,0.15)]">

      {/* Top accent bar — gold, matches the reference's warm accent line */}
      <div className="h-[2px] w-full flex-shrink-0
        bg-[var(--color-secondary)]" />

      <div className="px-5 pt-5 pb-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex-shrink-0
            bg-white/10 flex items-center justify-center
            ring-2 ring-white/10">
            <span className="text-sm font-bold text-[var(--color-secondary)]">
              {initials}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">
              {memberProfile?.name ?? "Member"}
            </p>
            <p className="text-[11px] text-sidebar-foreground/50 truncate mt-0.5 font-mono">
              {memberProfile?.membershipNo ?? ""}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {items.map(({ path, label, icon: Icon }) => {
          const fullPath = `/dashboard/${path}`;
          return (
            <NavLink
              key={path}
              to={fullPath}
              onClick={(e) => {
                e.preventDefault();
                dashboardNavigate(fullPath);
              }}
              className={({ isActive }) => `
                relative w-full flex items-center gap-3 px-3 py-2.5
                rounded-xl text-sm transition-colors duration-150 text-left group
                ${isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                  : "text-sidebar-foreground/60 font-medium hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }
              `}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2
                      w-[3px] h-5 bg-sidebar-primary rounded-r-full" />
                  )}
                  <Icon
                    style={{ width: 16, height: 16 }}
                    strokeWidth={isActive ? 2.2 : 1.6}
                    className={`flex-shrink-0 transition-colors ${
                      isActive ? "text-sidebar-primary" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/80"
                    }`}
                  />
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          );
        })}

        <div className="pt-2 pb-1">
          <p className="text-[10px] text-sidebar-foreground/40 uppercase tracking-widest font-medium px-3">
            Community
          </p>
        </div>

        <Link
          to="/gallery"
          className="relative w-full flex items-center gap-3 px-3 py-2.5
            rounded-xl text-sm transition-colors duration-150 text-left group
            text-sidebar-foreground/60 font-medium hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Image style={{ width: 16, height: 16 }} strokeWidth={1.6}
            className="flex-shrink-0 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/80 transition-colors" />
          <span className="truncate">Gallery</span>
        </Link>
      </nav>

      <div className="px-4 pb-5 pt-3 border-t border-sidebar-border space-y-2.5">
        <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-sidebar-border">
          <p className="text-[10px] text-sidebar-foreground/40 uppercase tracking-widest
            font-medium mb-1">
            Member since
          </p>
          {memberSinceStr ? (
            <p className="text-xs font-semibold text-sidebar-foreground/90">{memberSinceStr}</p>
          ) : (
            <div className="h-3.5 bg-white/10 rounded animate-pulse" />
          )}
        </div>

        <div className="flex items-center gap-1.5 px-3 py-2
          bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-emerald-300">
            Member · Verified
          </span>
        </div>
      </div>
    </aside>
  );
}