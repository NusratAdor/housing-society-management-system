
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, FileQuestion, Home } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

const NotFound = () => {
  usePageTitle("Page Not Found");

  const navigate = useNavigate();

  useEffect(() => {
    // Prevent search engines from indexing this error page.
    const existingMeta = document.querySelector('meta[name="robots"]');
    const previousContent = existingMeta?.getAttribute("content");

    const meta = existingMeta || document.createElement("meta");

    meta.name = "robots";
    meta.content = "noindex";

    if (!existingMeta) {
      document.head.appendChild(meta);
    }

    return () => {
      if (existingMeta) {
        if (previousContent === null) {
          existingMeta.removeAttribute("content");
        } else {
          existingMeta.setAttribute("content", previousContent);
        }
      } else {
        meta.remove();
      }
    };
  }, []);

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <main className="flex min-h-[75vh] items-center justify-center bg-slate-50 px-5 py-16">
      <section className="w-full max-w-lg text-center">
        {/* Simple icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50">
          <FileQuestion
            className="h-8 w-8 text-emerald-700"
            strokeWidth={1.6}
            aria-hidden="true"
          />
        </div>

        {/* Error code */}
        <p
          className="mt-7 text-8xl font-extrabold leading-none tracking-tight text-emerald-700 sm:text-9xl"
          aria-label="Error 404"
        >
          404
        </p>

        {/* Message */}
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Page Not Found
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-600 sm:text-base">
          Sorry, we couldn't find the page you're looking for. The
          address may be incorrect, or the page may have been moved.
        </p>

        {/* Navigation actions */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:w-auto"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Go to Home
          </Link>

          <button
            type="button"
            onClick={handleGoBack}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go Back
          </button>
        </div>

        {/* Subtle footer detail */}
        <div className="mx-auto mt-10 max-w-xs border-t border-slate-200 pt-5">
          <p className="text-xs text-slate-500">
            GOMCS · Government Officers' Housing Scheme
          </p>
        </div>
      </section>
    </main>
  );
};

export default NotFound;
