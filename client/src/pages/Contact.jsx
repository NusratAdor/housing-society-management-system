// client/src/pages/Contact.jsx
//
// Public contact page. Messages are posted to POST /api/contact, which emails
// the society office with the visitor's address as Reply-To. No login is
// required, so the form carries a honeypot field and the endpoint is rate
// limited server-side.

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import usePageTitle from "../hooks/usePageTitle";

// Keep in sync with server/controllers/contactController.js.
const LIMITS = { name: 100, email: 254, subject: 200, message: 3000 };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INITIAL_FORM = {
  name: "",
  email: "",
  subject: "",
  message: "",
  companyWebsite: "", // honeypot: hidden from users, filled in by bots
};

const inputClass = (hasError) =>
  `w-full rounded-md border px-4 py-2 text-sm focus:outline-none focus:ring-2 ${
    hasError
      ? "border-red-400 focus:ring-red-300"
      : "border-gray-300 focus:ring-blue-500"
  }`;

// Returns a map of field -> translation key for every invalid field.
const validate = (form) => {
  const errors = {};
  if (!form.name.trim()) errors.name = "form.errors.nameRequired";
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "form.errors.emailInvalid";
  if (!form.message.trim()) errors.message = "form.errors.messageRequired";
  return errors;
};

const FieldError = ({ id, message }) =>
  message ? (
    <p id={id} className="mt-1 text-xs text-red-600">
      {message}
    </p>
  ) : null;

const Contact = () => {
  const { t } = useTranslation("contact");
  const { t: tNav } = useTranslation("navbar");
  const { axios } = useAppContext();
  usePageTitle(tNav("contact"));

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [submitError, setSubmitError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) =>
      previous[name] ? { ...previous, [name]: undefined } : previous,
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (status === "sending") return;

    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus("sending");
    setSubmitError("");

    try {
      await axios.post("/api/contact", {
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
        companyWebsite: form.companyWebsite,
      });
      setForm(INITIAL_FORM);
      setStatus("sent");
    } catch (error) {
      setSubmitError(
        error.response?.status === 429
          ? t("form.errors.rateLimited")
          : t("form.errors.generic"),
      );
      setStatus("idle");
    }
  };

  const sending = status === "sending";

  return (
    <div className="w-full bg-white">
      {/* Google Map */}
      <div className="w-full h-[350px]">
        <iframe
          className="w-full h-full"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d14599.079516776896!2d90.2303675626977!3d23.826780736850576!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755eb6c78b0bda7%3A0x6134ba1b3c074efa!2sGOHS%20-%20Fordnagar%20Singair%20Manikganj!5e0!3m2!1sen!2sbd!4v1757558746658!5m2!1sen!2sbd"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="GOHS Location"
        />
      </div>

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
          {status === "sent" ? (
            <div
              role="status"
              className="self-start rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center"
            >
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <h3 className="mt-3 text-base font-semibold text-emerald-900">
                {t("form.successTitle")}
              </h3>
              <p className="mt-1 text-sm text-emerald-800">
                {t("form.successBody")}
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="mt-4 text-sm font-medium text-emerald-700 hover:underline"
              >
                {t("form.sendAnother")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder={t("form.name")}
                    aria-label={t("form.name")}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "contact-name-error" : undefined}
                    maxLength={LIMITS.name}
                    autoComplete="name"
                    className={inputClass(errors.name)}
                  />
                  <FieldError id="contact-name-error" message={errors.name && t(errors.name)} />
                </div>

                <div>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder={t("form.email")}
                    aria-label={t("form.email")}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "contact-email-error" : undefined}
                    maxLength={LIMITS.email}
                    autoComplete="email"
                    className={inputClass(errors.email)}
                  />
                  <FieldError id="contact-email-error" message={errors.email && t(errors.email)} />
                </div>
              </div>

              <input
                type="text"
                name="subject"
                value={form.subject}
                onChange={handleChange}
                placeholder={t("form.subject")}
                aria-label={t("form.subject")}
                maxLength={LIMITS.subject}
                className={inputClass(false)}
              />

              <div>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  placeholder={t("form.message")}
                  aria-label={t("form.message")}
                  aria-invalid={!!errors.message}
                  aria-describedby={errors.message ? "contact-message-error" : undefined}
                  maxLength={LIMITS.message}
                  rows={5}
                  className={`${inputClass(errors.message)} resize-none`}
                />
                <FieldError id="contact-message-error" message={errors.message && t(errors.message)} />
              </div>

              {/* Honeypot: off-screen, skipped by keyboard and screen readers. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <input
                  type="text"
                  name="companyWebsite"
                  value={form.companyWebsite}
                  onChange={handleChange}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {submitError && (
                <p role="alert" className="text-sm text-red-600">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-2 px-6 py-2 rounded-full
                  bg-[var(--color-primary)] text-white text-sm font-medium
                  hover:bg-blue-700 transition-all
                  disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                {sending ? t("form.sending") : t("form.send")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Contact;