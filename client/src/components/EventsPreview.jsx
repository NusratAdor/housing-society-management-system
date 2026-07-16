// client/src/components/EventsPreview.jsx
//
// CHANGE (this pass): dummy data replaced with a real fetch from
// GET /api/events/public — the full Event system now exists (see
// models/Event.js, controllers/eventController.js,
// pages/admin/ManageEvents.jsx). Upcoming vs Past split is computed
// client-side by comparing eventDate to now, same convention used in
// Events.jsx (the full listing page) — the backend never stores a
// status field for this.
//
// UI (toggle, ticket-stub date badge, card layout) — completely
// unchanged from the previous pass. Empty-state message added since a
// fresh install has zero events until the admin creates some.

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { CalendarClock, MapPin, ArrowRight } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { toast } from "react-hot-toast";

const EventCard = ({ event, i }) => {
  const d = new Date(event.eventDate);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay: i * 0.08, duration: 0.4 }}
      className="group bg-white border border-gray-200 rounded-xl overflow-hidden
                 shadow-sm hover:shadow-md transition-shadow duration-300"
    >
      <div className="relative h-40 overflow-hidden bg-gray-50">
        {event.image ? (
          <img
            src={event.image}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <CalendarClock className="h-8 w-8 text-gray-200" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        <div className="absolute top-3 left-3 bg-white rounded-lg shadow-md px-3 py-1.5 text-center leading-none">
          <p className="text-emerald-600 font-bold text-lg">{d.getDate()}</p>
          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide">
            {d.toLocaleString("en-US", { month: "short" })}
          </p>
        </div>
      </div>

      <div className="p-5">
        <h3 className="font-outfit text-gray-900 font-bold text-base leading-snug mb-1.5
                       group-hover:text-emerald-600 transition-colors duration-300">
          {event.title}
        </h3>
        {event.location && (
          <p className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
            <MapPin size={12} strokeWidth={2} />
            {event.location}
          </p>
        )}
        <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 font-outfit">
          {event.excerpt || event.description}
        </p>
      </div>
    </motion.div>
  );
};

const EventsPreview = () => {
  const { axios } = useAppContext();
  const [tab, setTab] = useState("upcoming");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data } = await axios.get("/api/events/public");
        if (data.success) setEvents(data.events);
      } catch {
        toast.error("Failed to load events");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [axios]);

  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.eventDate) >= now)
    .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
  const past = events
    .filter((e) => new Date(e.eventDate) < now)
    .sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));
  const visible = (tab === "upcoming" ? upcoming : past).slice(0, 3);

  return (
    <div className="w-full bg-white py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col items-center text-center">

        <motion.span
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5
                     rounded-full text-xs font-semibold
                     bg-emerald-50 text-emerald-700
                     border border-emerald-200 mb-5"
        >
          <CalendarClock size={13} strokeWidth={2} />
          Community Events
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-3xl md:text-4xl font-bold text-gray-900 mb-3"
        >
          Community <span className="text-emerald-600">Events</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-gray-500 text-sm md:text-base max-w-xl mb-8"
        >
          Celebrating the moments that bring our neighbors together.
        </motion.p>

        <div className="inline-flex items-center gap-0.5 rounded-full border border-gray-200 p-1 mb-12 bg-gray-50">
          {[
            { key: "upcoming", label: "Upcoming" },
            { key: "past", label: "Past" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setTab(opt.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-outfit font-medium transition-colors duration-200 ${
                tab === opt.key
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin h-8 w-8 border-2 border-gray-200 border-t-emerald-500 rounded-full" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-gray-400 font-outfit py-8">
            {tab === "upcoming" ? "No upcoming events scheduled yet." : "No past events yet."}
          </p>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full"
            >
              {visible.map((event, i) => (
                <EventCard key={event._id} event={event} i={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12"
        >
          <Link
            to="/events"
            className="flex items-center gap-2 font-outfit font-medium text-sm
                       border border-emerald-500 text-emerald-600
                       rounded-md px-4 py-2
                       bg-transparent
                       hover:bg-gradient-to-r hover:from-emerald-500 hover:to-teal-600
                       hover:text-white hover:border-transparent hover:shadow-md
                       transition-all duration-300 ease-out
                       group"
          >
            View All Events
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </motion.div>

      </div>
    </div>
  );
};

export default EventsPreview;