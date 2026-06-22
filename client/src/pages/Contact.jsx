// client/src/pages/Contact.jsx
//
// FIXES from broken version:
//   1. Broken <a> tags restored — the previous version had href= attributes
//      floating without opening <a tags, causing a render crash.
//   2. useTranslation("contact") namespace used — matches i18n/index.js.
//   3. mailto form is functional — clicking Send Message opens the user's
//      email client pre-filled. No backend endpoint needed.
//   4. form.defaultSubject / form.fromLabel / form.emailLabel keys added
//      to JSON files to support the mailto body construction.
//   5. i18n.js bn section correctly uses bnContact (was enContact by mistake).

import React, { useState }    from "react";
import { useTranslation }      from "react-i18next";
import usePageTitle            from "../hooks/usePageTitle";

const SOCIETY_EMAIL = "gomcsadmn975@gmail.com";

const Contact = () => {
  const { t }     = useTranslation("contact");
  const { t: tNav } = useTranslation("navbar");
  usePageTitle(tNav("contact"));

  const [form, setForm] = useState({
    name:    "",
    email:   "",
    subject: "",
    message: "",
  });

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Opens the device email client pre-filled with form content.
  // No backend needed — correct approach for a small society site.
  const handleSubmit = (e) => {
    e.preventDefault();

    const subject = form.subject.trim() || t("form.defaultSubject");
    const body = [
      `${t("form.fromLabel")}: ${form.name.trim()}`,
      `${t("form.emailLabel")}: ${form.email.trim()}`,
      "",
      form.message.trim(),
    ].join("\n");

    const mailtoUrl =
      `mailto:${SOCIETY_EMAIL}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoUrl;
  };

  return (
    <div className="w-full bg-white">

      {/* Google Map */}
      <div className="w-full h-[350px]">
        <iframe
          className="w-full h-full"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d14599.079516776896!2d90.2303675626977!3d23.826780736850576!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755eb6c78b0bda7%3A0x6134ba1b3c074efa!2sGOHS%20-%20Fordnagar%20Singair%20Manikganj!5e0!3m2!1sen!2sbd!4v1757558746658!5m2!1sen!2sbd"
          style={{ border: 0 }}
          allowFullScreen=""
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="GOHS Location"
        />
      </div>

      {/* Contact section */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
        <h2 className="text-3xl font-semibold mb-8 text-gray-800 text-center font-playfair">
          {t("title")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

          {/* Contact info */}
          <div className="space-y-6 text-gray-700 text-sm">
            <div>
              <h3 className="font-semibold text-base mb-1 text-gray-900">
                {t("address.label")}
              </h3>
              <p>{t("address.value")}</p>
            </div>

            <div>
              <h3 className="font-semibold text-base mb-1 text-gray-900">
                {t("phone.label")}
              </h3>
              <a
                href={`tel:${t("phone.value").replace(/\s/g, "")}`}
                className="hover:text-[var(--color-primary)] transition-colors"
              >
                {t("phone.value")}
              </a>
            </div>

            <div>
              <h3 className="font-semibold text-base mb-1 text-gray-900">
                {t("email.label")}
              </h3>
              <a
                href={`mailto:${t("email.value")}`}
                className="hover:text-[var(--color-primary)] transition-colors"
              >
                {t("email.value")}
              </a>
            </div>

            <div>
              <h3 className="font-semibold text-base mb-1 text-gray-900">
                {t("hours.label")}
              </h3>
              <p>{t("hours.weekdays")}</p>
              <p>{t("hours.weekend")}</p>
            </div>
          </div>

          {/* Contact form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder={t("form.name")}
                required
                className="w-full border border-gray-300 rounded-md px-4 py-2
                  text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder={t("form.email")}
                required
                className="w-full border border-gray-300 rounded-md px-4 py-2
                  text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <input
              type="text"
              name="subject"
              value={form.subject}
              onChange={handleChange}
              placeholder={t("form.subject")}
              className="w-full border border-gray-300 rounded-md px-4 py-2
                text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              placeholder={t("form.message")}
              rows={5}
              required
              className="w-full border border-gray-300 rounded-md px-4 py-2
                text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                resize-none"
            />
            <button
              type="submit"
              className="px-6 py-2 rounded-full bg-[var(--color-primary)]
                text-white text-sm font-medium hover:bg-blue-700
                transition-all"
            >
              {t("form.send")}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default Contact;