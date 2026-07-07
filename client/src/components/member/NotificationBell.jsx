// client/src/components/member/NotificationBell.jsx
//
// FIXED: added useFixedPanel prop.
// When useFixedPanel=true the dropdown panel uses position:fixed anchored
// to the top bar bottom (top:56px). This prevents the panel from being
// clipped by any parent with overflow:hidden — works on all screen sizes.
//
// Default (useFixedPanel=false) keeps the original absolute positioning
// for backward compatibility with any other usage.

import React, { useState, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, X } from "lucide-react";
import { formatDate } from "../../utils/formatDate";

const NotificationBell = ({
  notifications  = [],
  onOpenChange,
  iconClassName  = "text-gray-600",
  useFixedPanel  = false,
}) => {
  const [open,    setOpen]    = useState(false);
  const [seenIds, setSeenIds] = useState(() => new Set());
  const [panelPos, setPanelPos] = useState({ top: 56, right: 16 });
  const btnRef   = useRef(null);
  const panelRef = useRef(null);

  const unreadCount = useMemo(
    () => notifications.filter(n => !seenIds.has(n._id)).length,
    [notifications, seenIds]
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current   && !btnRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    // For fixed panel: compute right offset from button position
    if (next && useFixedPanel && btnRef.current) {
      const rect  = btnRef.current.getBoundingClientRect();
      const right = window.innerWidth - rect.right;
      setPanelPos({ top: 56, right: Math.max(right - 8, 8) });
    }
    setOpen(next);
    onOpenChange?.(next);
    if (next) {
      setSeenIds(prev => {
        const updated = new Set(prev);
        notifications.forEach(n => updated.add(n._id));
        return updated;
      });
    }
  };

  // Panel positioning style
  const panelStyle = useFixedPanel
    ? { position: "fixed", top: panelPos.top, right: panelPos.right }
    : {};

  const panelBaseClass = useFixedPanel
    ? "w-[calc(100vw-32px)] max-w-sm sm:max-w-md"
    : "absolute right-0 mt-2 w-80 sm:w-96";

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleToggle}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className="relative p-2 rounded-full hover:bg-gray-100
          transition-colors focus:outline-none"
      >
        <Bell className={`h-5 w-5 ${iconClassName}`} />
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
            style={panelStyle}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 8,  scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`${panelBaseClass}
              max-h-[28rem] bg-white border border-gray-200
              rounded-2xl shadow-xl overflow-hidden z-50 flex flex-col`}
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
                className="text-gray-400 hover:text-gray-600 transition-colors
                  p-1 rounded-full hover:bg-gray-100"
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
                  <p className="text-sm text-gray-400">You're all caught up</p>
                  <p className="text-xs text-gray-300 mt-1">No notifications yet</p>
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