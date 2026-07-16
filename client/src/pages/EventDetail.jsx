// client/src/pages/EventDetail.jsx
//
// Mirrors NoticeDetail/CommitteeMemberDetail's hero+card pattern.

import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAppContext } from "../context/AppContext";
import { toast } from "react-hot-toast";
import { ChevronRight, CalendarClock, MapPin } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

const EventDetail = () => {
  const { axios } = useAppContext();
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  usePageTitle(event?.title ?? null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/events/public/${id}`);
        if (data.success) {
          setEvent(data.event);
        } else {
          toast.error(data.message || "Event not found");
          navigate("/events");
        }
      } catch {
        toast.error("Error loading event. Please try again.");
        navigate("/events");
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id, navigate, axios]);

  if (loading) {
    return (
      <div className="w-full bg-white min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-gray-200 border-t-emerald-500 rounded-full" />
      </div>
    );
  }

  if (!event) return null;

  const d = new Date(event.eventDate);

  return (
    <div className="w-full bg-white min-h-screen">
      <div className="relative w-full overflow-hidden">
        <div className="absolute inset-0 bg-[url('/src/assets/heroImage6.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/75" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-20 flex flex-col items-center text-center">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-base flex-wrap">
              <li>
                <Link to="/" className="text-white/70 hover:text-white font-outfit font-medium transition-colors">
                  Home
                </Link>
              </li>
              <li className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-white/40" strokeWidth={2} />
                <Link to="/events" className="text-white/70 hover:text-white font-outfit font-medium transition-colors">
                  Events
                </Link>
              </li>
              <li className="flex items-center gap-1.5 min-w-0">
                <ChevronRight className="h-3.5 w-3.5 text-white/40 flex-shrink-0" strokeWidth={2} />
                <span className="text-emerald-400 font-outfit font-medium truncate max-w-[200px]" aria-current="page">
                  {event.title}
                </span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            {event.title}
          </motion.h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-8 mt-10 md:mt-12 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="h-1" style={{ backgroundColor: "#84A98C" }} />

          {event.image && (
            <img src={event.image} alt={event.title} className="w-full h-64 md:h-80 object-cover" />
          )}

          <div className="p-6 md:p-10">
            <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <CalendarClock size={14} strokeWidth={2} className="text-emerald-600" />
                {d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </span>
              {event.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} strokeWidth={2} className="text-emerald-600" />
                  {event.location}
                </span>
              )}
            </div>

            <p className="text-gray-700 font-outfit leading-relaxed whitespace-pre-line">
              {event.description}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default EventDetail;