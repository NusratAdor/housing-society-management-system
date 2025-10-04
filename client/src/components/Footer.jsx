import React from "react";
import { useNavigate } from "react-router-dom";
import { assets } from "../assets/assets";

const Footer = () => {
  const navigate = useNavigate();
  

  return (
    <footer className="bg-[#F6F9FC] text-gray-600 pt-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Logo + Description */}
          <div>
            <img
              src={assets.logoScrolled}
              alt="Gomcs Logo"
              className="mb-4 h-9 opacity-80"
            />
            <p className="text-sm leading-relaxed">
              Serving 500+ residents with community updates, events, and services for a vibrant and connected society.
            </p>
            <div className="flex items-center gap-4 mt-4">
              {[assets.instagramIcon, assets.facebookIcon, assets.twitterIcon, assets.linkedinIcon].map((icon, i) => (
                <a key={i} href="#" target="_blank" rel="noopener noreferrer">
                  <img src={icon} alt="social" className="w-6 opacity-80 hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </div>

          {/* Society Links */}
          <div>
            <h3 className="font-playfair text-lg text-gray-800 mb-3">SOCIETY</h3>
            <ul className="space-y-2 text-sm">
              {[
                { label: "About Society", path: "/about" },
                { label: "Committee", path: "/committee" },
                { label: "Events", path: "/gallery" },
                { label: "News", path: "/notices" },
              ].map(({ label, path }) => (
                <li key={label}>
                  <button onClick={() => navigate(path)} className="hover:text-[var(--color-primary)]">
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
                { label: "FAQs", path: "/faqs" },
                { label: "Contact Admin", path: "/contact" },
                { label: "Submit Query", path: "/dashboard" },
                { label: "Maintenance Requests", path: "/maintenance" },
              ].map(({ label, path }) => (
                <li key={label}>
                  <button onClick={() => navigate(path)} className="hover:text-[var(--color-primary)]">
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-playfair text-lg text-gray-800 mb-3">STAY UPDATED</h3>
            <p className="text-sm leading-relaxed mb-4">
              Subscribe to our newsletter for society events, notices, and updates.
            </p>
            <div className="flex">
              <input
                type="email"
                className="bg-white rounded-l border border-gray-300 h-9 px-3 w-full text-sm outline-none"
                placeholder="Your email"
              />
              <button className="bg-black h-9 w-9 flex items-center justify-center rounded-r">
                <img src={assets.arrowIcon} alt="Submit" className="w-4 invert" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <hr className="border-gray-300 mt-10" />
        <div className="flex flex-col md:flex-row items-center justify-between py-6 gap-4 text-sm text-gray-500/80">
          <p>© {new Date().getFullYear()} Harmony Society. All rights reserved.</p>
          <ul className="flex gap-4">
            {[
              { label: "Privacy", path: "/privacy" },
              { label: "Terms", path: "/terms" },
              { label: "Sitemap", path: "/sitemap" },
            ].map(({ label, path }) => (
              <li key={label}>
                <button onClick={() => navigate(path)} className="hover:text-[var(--color-primary)]">
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
