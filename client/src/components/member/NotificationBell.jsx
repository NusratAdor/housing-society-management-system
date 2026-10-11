// client/src/components/member/NotificationBell.jsx
//
// CHANGE (this pass): read state comes from the server (n.isRead) instead of a
// per-session "seen" set that reset on reload. Items are marked read on click
// or with "Mark all as read". Layout: message, date, "New" pill, action link.
// Props, panel positioning and outside-click behavior are unchanged.
//
// Adjust ACTION_LINKS to your real routes.

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, X } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { formatDate, getDhakaDateInputValue } from "../../utils/formatDate";

const ACTION_LINKS = {
  Payment: { label: "View payment", to: "/dashboard" },
  Notice: { label: "View notice", to: "/notices" },
};

const DAY_MS = 24 * 60 * 60 * 1000;

const relativeDay = (value) => {
  const day = getDhakaDateInputValue(new Date(value));
  if (day === getDhakaDateInputValue()) return "Today";
  if (day === getDhakaDateInputValue(new Date(Date.now() - DAY_MS)))
    return "Yesterday";
  return formatDate(value);
};

const NotificationBell = ({
  notifications = [],
  onOpenChange,
  iconClassName = "text-gray-600",
  hoverBgClassName = "hover:bg-gray-100",
  useFixedPanel = false,
  onMarkedRead,
}) => {
  const { axios, getToken } = useAppContext();
  const [open, setOpen] = useState(false);
  // Ids marked read in this session, shown immediately; the server is the
  // source of truth on the next fetch.
  const [readNow, setReadNow] = useState(() => new Set());
  const [panelPos, setPanelPos] = useState({ top: 56, right: 16 });
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const isUnread = useCallback(
    (n) => n.isRead !== true && !readNow.has(n._id),
    [readNow],
  );

  const unreadCount = useMemo(
    () => notifications.filter(isUnread).length,
    [notifications, isUnread],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markRead = useCallback(
    async (ids, url) => {
      setReadNow((prev) => new Set([...prev, ...ids]));
      try {
        const token = await getToken();
        await axios.patch(url, null, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        onMarkedRead?.();
      } catch {
        // Roll back so the item stays unread and the member can try again.
        setReadNow((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }
    },
    [axios, getToken],
  );

  const handleItemClick = (n) => {
    if (isUnread(n)) markRead([n._id], `/api/notifications/me/${n._id}/read`);
  };

  const handleMarkAll = () => {
    markRead(
      notifications.filter(isUnread).map((n) => n._id),
      "/api/notifications/me/read-all",
    );
  };

  const handleToggle = () => {
    const next = !open;
    if (next && useFixedPanel && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const right = window.innerWidth - rect.right;
      setPanelPos({ top: 56, right: Math.max(right - 8, 8) });
    }
    setOpen(next);
    onOpenChange?.(next);
  };

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
        className={`relative p-2 rounded-full ${hoverBgClassName}
          transition-colors focus:outline-none`}
      >
        <Bell className={`h-5 w-5 ${iconClassName}`} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center
            justify-center min-w-[18px] h-[18px] px-1 rounded-full
            bg-red-500 text-white text-[10px] font-bold leading-none"
          >
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
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`${panelBaseClass} max-h-[28rem] bg-white border
              border-gray-200 rounded-lg shadow-xl overflow-hidden z-50
              flex flex-col`}
          >
            <div
              className="flex items-center justify-between px-4 py-3
              border-b border-gray-100 flex-shrink-0"
            >
              <p className="text-sm font-semibold text-gray-800">
                Notifications
              </p>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAll}
                    className="text-xs font-medium text-gray-500 hover:text-gray-800
                      transition-colors"
                  >
                    Mark all as read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close notifications"
                  className="text-gray-400 hover:text-gray-600 transition-colors
                    p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Bell className="h-8 w-8 text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">You're all caught up</p>
                  <p className="text-xs text-gray-300 mt-1">
                    No notifications yet
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {notifications.map((n) => {
                    const unread = isUnread(n);
                    const action = ACTION_LINKS[n.type];

                    return (
                      <li
                        key={n._id}
                        onClick={() => handleItemClick(n)}
                        className="px-4 py-3.5 hover:bg-gray-50 transition-colors cursor-default"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p
                            className={`text-sm leading-relaxed ${
                              unread ? "text-gray-800" : "text-gray-500"
                            }`}
                          >
                            {n.content}
                          </p>
                          {unread && (
                            <span
                              className="flex-shrink-0 px-2 py-0.5 rounded-full
                              bg-emerald-50 text-emerald-700 text-[10px] font-semibold"
                            >
                              New
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[11px] text-gray-400">
                            {relativeDay(n.createdAt)}
                          </span>
                          {action && (
                            <Link
                              to={action.to}
                              onClick={() => setOpen(false)}
                              className="text-xs font-semibold text-gray-600
                                hover:text-gray-900 hover:underline"
                            >
                              {action.label}
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
