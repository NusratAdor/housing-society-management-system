import React from "react";
import { useNavigate } from "react-router-dom";
import { assets } from "../assets/assets";

const Footer = () => {
  const navigate = useNavigate();

  // UPDATE THESE WITH YOUR REAL SOCIAL LINKS
  const socialLinks = [
    {
      icon: assets.instagramIcon,
      url: "https://instagram.com/gohs_official",
      label: "Instagram",
    },
    {
      icon: assets.facebookIcon,
      url: "https://facebook.com/gohs.official",
      label: "Facebook",
    },
    {
      icon: assets.twitterIcon,
      url: "https://twitter.com/gohs_official",
      label: "Twitter",
    },
    {
      icon: assets.linkedinIcon,
      url: "https://linkedin.com/company/gohs",
      label: "LinkedIn",
    },
  ];

  // FIXED: No TypeScript syntax in .jsx
  const handleNewsletter = (e) => {
    e.preventDefault();
    const email = e.currentTarget.email.value.trim();
    if (email) {
      alert(`Thank you! ${email} subscribed to GOHS updates.`);
      e.currentTarget.reset();
      // TODO: Connect to backend API later
    }
  };

  return (
    <footer className="bg-[#F6F9FC] text-gray-600 pt-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Logo + Society Info */}
          <div>
            <img
              src={assets.logoScrolled}
              alt="GOHS Logo"
              className="mb-4 h-9 opacity-85"
            />
            <p className="text-sm leading-relaxed font-light">
              Government Officer’s Housing Society (GOHS) is a secure, member‑centric platform serving over <strong>500+ government officers</strong> with real‑time notices, payment tracking, event updates, and community connectivity.
            </p>
            <div className="flex items-center gap-4 mt-5">
              {socialLinks.map(({ icon, url, label }, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow GOHS on ${label}`}
                  className="opacity-75 hover:opacity-100 transition-opacity duration-200"
                >
                  <img src={icon} alt="" className="w-6" />
                </a>
              ))}
            </div>
          </div>

          {/* Society Links */}
          <div>
            <h3 className="font-playfair text-lg text-gray-800 mb-3">SOCIETY</h3>
            <ul className="space-y-2 text-sm">
              {[
                { label: "About GOHS", path: "/about" },
                { label: "Executive Committee", path: "/committee" },
                { label: "Photo Gallery", path: "/gallery" },
                { label: "Notices & Circulars", path: "/notices" },
              ].map(({ label, path }) => (
                <li key={label}>
                  <button
                    onClick={() => navigate(path)}
                    className="text-gray-600 hover:text-emerald-600 transition-colors duration-200 font-light"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="font-playfair text-lg text-gray-800 mb-3">SUPPORT</h3>
            <ul className="space-y-2 text-sm">
              {[
                { label: "Contact Admin", path: "/contact" },
                { label: "Submit Query", path: "/contact" },
                { label: "Maintenance Request", path: "/maintenance" },
                { label: "Payment Help", path: "/contact" },
              ].map(({ label, path }) => (
                <li key={label}>
                  <button
                    onClick={() => navigate(path)}
                    className="text-gray-600 hover:text-emerald-600 transition-colors duration-200 font-light"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-playfair text-lg text-gray-800 mb-3">STAY UPDATED</h3>
            <p className="text-sm leading-relaxed mb-4 font-light">
              Get the latest society notices, event invites, and payment reminders directly in your inbox.
            </p>
            <form onSubmit={handleNewsletter} className="flex">
              <input
                type="email"
                name="email"
                required
                placeholder="you@office.gov.bd"
                className="bg-white rounded-l border border-gray-300 h-10 px-3 w-full text-sm outline-none focus:border-emerald-500 transition font-light"
              />
              <button
                type="submit"
                className="bg-emerald-600 h-10 w-10 flex items-center justify-center rounded-r hover:bg-emerald-700 transition shadow-sm"
                aria-label="Subscribe to newsletter"
              >
                <img src={assets.arrowIcon} alt="" className="w-4 invert" />
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <hr className="border-gray-300 mt-10" />
        <div className="flex flex-col md:flex-row items-center justify-between py-6 gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Government Officer’s Housing Society (GOHS). All rights reserved.</p>
          <ul className="flex gap-5">
            {[
              { label: "Privacy Policy", path: "/privacy" },
              { label: "Terms of Use", path: "/terms" },
              { label: "Sitemap", path: "/sitemap" },
            ].map(({ label, path }) => (
              <li key={label}>
                <button
                  onClick={() => navigate(path)}
                  className="hover:text-emerald-600 transition-colors font-light"
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default Footer;