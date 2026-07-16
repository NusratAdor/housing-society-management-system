// client/src/pages/Events.jsx
//
// Full events listing — hero + breadcrumb matches every other content
// page (CommitteeSection.jsx, Achievements.jsx). Upcoming/Past split
// is computed client-side from eventDate vs now, same as
// EventsPreview.jsx's homepage version — no stored status field to
// keep in sync.

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, CalendarClock, MapPin } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { toast } from "react-hot-toast";
import usePageTitle from "../hooks/usePageTitle";

const Events = () => {
  const { axios, navigate } = useAppContext();
  usePageTitle("Events");

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
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
  const visible = tab === "upcoming" ? upcoming : past;

  return (
    <div className="w-full bg-white min-h-screen">
      <div className="relative w-full overflow-hidden">
        <div className="absolute inset-0 bg-[url('/src/assets/heroImage6.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/75" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-20 flex flex-col items-center text-center">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-base">
              <li>
                <Link to="/" className="text-white/70 hover:text-white font-outfit font-medium transition-colors">
                  Home
                </Link>
              </li>
              <li className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-white/40" strokeWidth={2} />
                <span className="text-emerald-400 font-outfit font-medium">Events</span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            Community <span className="text-emerald-400">Events</span>
          </motion.h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 mt-10 md:mt-12 pb-20">
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-0.5 rounded-full border border-gray-200 p-1 bg-gray-50">
            {[
              { key: "upcoming", label: `Upcoming (${upcoming.length})` },
              { key: "past", label: `Past (${past.length})` },
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
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin h-8 w-8 border-2 border-gray-200 border-t-emerald-500 rounded-full" />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16">
            <CalendarClock className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-outfit">
              {tab === "upcoming" ? "No upcoming events scheduled." : "No past events yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((event, i) => {
              const d = new Date(event.eventDate);
              return (
                <motion.div
                  key={event._id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  onClick={() => navigate(`/events/${event._id}`)}
                  className="group bg-white border border-gray-200 rounded-xl overflow-hidden
                            shadow-sm hover:shadow-md transition-shadow duration-300 cursor-pointer"
                >
                  <div className="relative h-40 overflow-hidden bg-gray-50">
                    {event.image ? (
                      <img
                        src={event.image}
                        alt={event.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <CalendarClock className="h-8 w-8 text-gray-200" />
                      </div>
                    )}
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
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Events;