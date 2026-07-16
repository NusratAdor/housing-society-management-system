// client/src/pages/GalleryDetail.jsx
//
// REDESIGNED — no longer copies NoticeDetail.jsx's document-card
// pattern. A notice is text that needs a readable container (card,
// accent bar, comfortable line-length); a gallery item IS its photos —
// wrapping them in a document-style card fought against that instead
// of serving it.
//
//   - No white bordered card, no accent bar. Header block (title,
//     meta, description) is LEFT-ALIGNED with the photo count sitting
//     toward the right of the meta row — matches the reference layout
//     more directly than the earlier centered version, and reads
//     better at wider container widths where centered text starts to
//     feel adrift.
//   - Photos: SMALL radius (rounded-md) rather than fully sharp
//     corners — corrected per direct visual reference showing a subtle
//     rounding reads as more modern than either fully sharp or the
//     larger rounded-xl/2xl used elsewhere. Gap between photos also
//     increased slightly (gap-2 -> gap-3) to match that reference.
//     Wider max-width (max-w-6xl vs NoticeDetail's max-w-3xl) since
//     images benefit from more horizontal room than prose does.
//   - Hero: same background/gradient/breadcrumb pattern as other detail
//     pages for consistent site-wide navigation, but slightly taller
//     (py-16 md:py-20, up from py-14 md:py-16) per request — still
//     modest, not a big jump.
//   - Each photo still opens full-size in a new tab on click — same
//     functionality as before, just restyled.
//   - Falls back to the legacy single item.image for pre-migration
//     items without an images array — unchanged from before.

import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAppContext } from "../context/AppContext";
import { toast } from "react-hot-toast";
import { formatDate } from "../utils/formatDate";
import { CalendarDays, ChevronRight, Images } from "lucide-react";

import usePageTitle from "../hooks/usePageTitle";

const GalleryDetail = () => {
  const { axios } = useAppContext();
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [item,    setItem]    = useState(null);
  const [loading, setLoading] = useState(true);

  usePageTitle(item?.title ?? null);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/gallery/${id}`);
        if (data.success) {
          setItem(data.item);
        } else {
          toast.error(data.message || "Failed to load gallery item");
          navigate("/gallery");
        }
      } catch {
        toast.error("Error loading gallery item. Please try again.");
        navigate("/gallery");
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [id, navigate, axios]);

  const photos = item?.images?.length
    ? item.images
    : (item?.image ? [{ url: item.image, publicId: "legacy" }] : []);

  if (loading) {
    return (
      <div className="w-full bg-white min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-gray-200
                        border-t-emerald-500 rounded-full" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="w-full bg-white min-h-screen flex items-center justify-center">
        <p className="text-gray-500 font-outfit">Gallery item not found.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white min-h-screen">

      {/* ── Hero — slightly taller than before ────────────────────────────── */}
      <div className="relative w-full overflow-hidden">
        <div
          className="absolute inset-0 bg-[url('/src/assets/heroImage6.png')]
                     bg-cover bg-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b
                        from-black/75 via-black/55 to-black/75" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8
                        py-16 md:py-20 flex flex-col items-center text-center">

          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-base flex-wrap">
              <li>
                <Link
                  to="/"
                  className="text-white/70 hover:text-white
                             font-outfit font-medium transition-colors"
                >
                  Home
                </Link>
              </li>
              <li className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-white/40" strokeWidth={2} />
                <Link
                  to="/gallery"
                  className="text-white/70 hover:text-white
                             font-outfit font-medium transition-colors"
                >
                  Gallery
                </Link>
              </li>
              <li className="flex items-center gap-1.5 min-w-0">
                <ChevronRight className="h-3.5 w-3.5 text-white/40 flex-shrink-0" strokeWidth={2} />
                <span
                  className="text-emerald-400 font-outfit font-medium
                             truncate max-w-[220px]"
                  aria-current="page"
                >
                  {item.title}
                </span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            Community <span className="text-emerald-400">Gallery</span>
          </motion.h1>
        </div>
      </div>

      {/* ── Header — left-aligned, wider layout matching the reference:
          title + meta row together, photo count sitting toward the
          right of that row rather than everything centered.           */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-12 pb-6">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-bold text-2xl md:text-3xl text-gray-900 mb-2"
        >
          {item.title}
        </motion.h2>

        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1.5
                        text-sm text-gray-500 mb-4">
          <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
            <CalendarDays size={15} strokeWidth={1.8} />
            Posted on {formatDate(item.createdAt)}
          </span>
          {photos.length > 1 && (
            <span className="flex items-center gap-1.5">
              <Images size={15} strokeWidth={1.8} />
              {photos.length} photos
            </span>
          )}
        </div>

        {item.description && (
          <p className="text-gray-600 font-outfit text-base leading-relaxed
                        max-w-2xl">
            {item.description}
          </p>
        )}
      </div>

      {/* ── Photo grid — small radius, slightly larger gap ───────────────── */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 pb-20">
        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((photo, i) => (
              <a
                key={photo.publicId || i}
                href={photo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square overflow-hidden rounded-md
                           hover:opacity-90 transition-opacity duration-200"
              >
                <img
                  src={photo.url}
                  alt={`${item.title} — photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GalleryDetail;