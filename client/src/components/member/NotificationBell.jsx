// client/src/components/member/NotificationBell.jsx
//
// CHANGE: now lives in the Navbar, not MemberDashboard.
// Accepts iconClassName prop so the Navbar can pass the correct
// color — white over hero images, gray over white scrolled navbar.

import React, { useState, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, X } from "lucide-react";
import { formatDate } from "../../utils/formatDate";

const NotificationBell = ({
  notifications = [],
  onOpenChange,
  // Caller passes e.g. "text-white" or "text-gray-600" so the bell
  // icon matches the navbar's current background
  iconClassName = "text-gray-600",
}) => {
  const [open,     setOpen]     = useState(false);
  const [seenIds,  setSeenIds]  = useState(() => new Set());
  const panelRef = useRef(null);
  const btnRef   = useRef(null);

  const unreadCount = useMemo(
    () => notifications.filter(n => !seenIds.has(n._id)).length,
    [notifications, seenIds]
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
    // Mark everything visible as seen the moment the panel opens
    if (next) {
      setSeenIds(prev => {
        const updated = new Set(prev);
        notifications.forEach(n => updated.add(n._id));
        return updated;
      });
    }
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleToggle}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
      >
        <Bell className={`h-5 w-5 transition-colors ${iconClassName}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center
            justify-center min-w-[18px] h-[18px] px-1 rounded-full
            bg-red-500 text-white text-[10px] font-bold leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 8,  scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[28rem]
              bg-white border border-gray-200 rounded-2xl shadow-xl
              overflow-hidden z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3
              border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-800">
                  Notifications
                </p>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-50 text-red-600
                    text-[10px] font-semibold rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center
                  py-12 px-4 text-center">
                  <Bell className="h-8 w-8 text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">
                    You're all caught up
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    No notifications yet
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map(n => {
                    const isUnread = !seenIds.has(n._id);
                    return (
                      <div
                        key={n._id}
                        className={`px-4 py-3 transition-colors ${
                          isUnread
                            ? "bg-blue-50/40 hover:bg-blue-50/60"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        {/* Unread dot */}
                        <div className="flex items-start gap-3">
                          {isUnread && (
                            <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5
                              rounded-full bg-blue-500" />
                          )}
                          <div className={isUnread ? "" : "pl-4"}>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {n.content}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1">
                              {formatDate(n.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;