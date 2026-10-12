import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { ImageIcon } from "lucide-react";
import usePageTitle from "../../hooks/usePageTitle";
import { useAppContext } from "../../context/AppContext";
import { getDhakaDateInputValue } from "../../utils/formatDate";
import { isValidPhone } from "../../utils/phoneUtils";
import { GUEST_HOUSE_RATE } from "../../utils/serviceInfo";
import {
  ServiceHero,
  MemberGate,
  Field,
  inputClass,
  SubmitButton,
  RequestSent,
} from "../../components/services/ServiceParts";

import guestHouse from "../../assets/guestHouse.jpg";

// ── GUEST HOUSE PHOTO ───────────────────────────────────────────────────────
// 1. Save the photo in src/assets, for example guestHouse.jpg
//    (landscape, about 1600px wide, under 300 KB).
// 2. Add this line at the top of the file:
//      import guestHouseImage from "../../assets/guestHouse.jpg";
// 3. Set:  const GUEST_HOUSE_IMAGE = guestHouseImage;
const GUEST_HOUSE_IMAGE = guestHouse;

const nextDay = (text) =>
  new Date(Date.parse(`${text}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);

const BookingForm = () => {
  const { axios, getToken, memberProfile } = useAppContext();
  const today = getDhakaDateInputValue();

  const initial = {
    checkIn: "",
    checkOut: "",
    guestName: "",
    guests: "1",
    contactNumber: memberProfile.phone || "",
    purpose: "",
    note: "",
  };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const setField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "checkIn" && next.checkOut && next.checkOut <= value)
        next.checkOut = "";
      return next;
    });
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const validate = () => {
    const e = {};
    if (!form.checkIn) e.checkIn = "Choose a check-in date";
    else if (form.checkIn < today) e.checkIn = "Check-in cannot be in the past";
    if (!form.checkOut) e.checkOut = "Choose a check-out date";
    const guests = Number(form.guests);
    if (!Number.isInteger(guests) || guests < 1 || guests > 20)
      e.guests = "Enter 1 to 20";
    if (form.guestName.trim().length < 2)
      e.guestName = "Enter the guest's name";
    if (!isValidPhone(form.contactNumber))
      e.contactNumber = "Enter a valid contact number";
    if (!form.purpose.trim()) e.purpose = "Enter the purpose of stay";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!validate()) {
      toast.error("Please correct the highlighted fields");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      await axios.post(
        "/api/service-requests",
        { serviceType: "guest-house", ...form, guests: Number(form.guests) },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSent(true);
      setForm(initial);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not send your request",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) return <RequestSent onAnother={() => setSent(false)} />;

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="gh-in" label="Check-in date" error={errors.checkIn}>
          <input
            id="gh-in"
            type="date"
            min={today}
            placeholder="YYYY-MM-DD"
            value={form.checkIn}
            onChange={(e) => setField("checkIn", e.target.value)}
            className={inputClass(errors.checkIn)}
          />
        </Field>
        <Field id="gh-out" label="Check-out date" error={errors.checkOut}>
          <input
            id="gh-out"
            type="date"
            min={form.checkIn ? nextDay(form.checkIn) : today}
            placeholder="YYYY-MM-DD"
            value={form.checkOut}
            onChange={(e) => setField("checkOut", e.target.value)}
            className={inputClass(errors.checkOut)}
          />
        </Field>

        <Field id="gh-name" label="Guest name" error={errors.guestName}>
          <input
            id="gh-name"
            type="text"
            maxLength={100}
            value={form.guestName}
            onChange={(e) => setField("guestName", e.target.value)}
            className={inputClass(errors.guestName)}
          />
        </Field>
        <Field id="gh-guests" label="Number of guests" error={errors.guests}>
          <input
            id="gh-guests"
            type="number"
            inputMode="numeric"
            min="1"
            max="20"
            value={form.guests}
            onChange={(e) => setField("guests", e.target.value)}
            className={inputClass(errors.guests)}
          />
        </Field>

        <Field
          id="gh-phone"
          label="Contact number"
          error={errors.contactNumber}
        >
          <input
            id="gh-phone"
            type="tel"
            placeholder="+8801712345678"
            value={form.contactNumber}
            onChange={(e) => setField("contactNumber", e.target.value)}
            className={inputClass(errors.contactNumber)}
          />
        </Field>
        <Field id="gh-purpose" label="Purpose of stay" error={errors.purpose}>
          <input
            id="gh-purpose"
            type="text"
            maxLength={200}
            value={form.purpose}
            onChange={(e) => setField("purpose", e.target.value)}
            className={inputClass(errors.purpose)}
          />
        </Field>
      </div>

      <Field id="gh-note" label="Additional note" optional className="mt-4">
        <textarea
          id="gh-note"
          rows={3}
          maxLength={1000}
          value={form.note}
          onChange={(e) => setField("note", e.target.value)}
          className={`${inputClass(false)} resize-y`}
        />
      </Field>

      <SubmitButton submitting={submitting}>
        Submit Booking Request
      </SubmitButton>
    </form>
  );
};

const GuestHouse = () => {
  usePageTitle("Guest House");

  return (
    <div className="w-full bg-white min-h-screen">
      <ServiceHero
        crumbs={[
          { label: "Home", to: "/" },
          { label: "Services", to: "/our-services" },
          { label: "Guest House" },
        ]}
        title="Guest"
        highlight="House"
        subtitle="A convenient accommodation facility for society members and their guests."
      />

      <div className="max-w-3xl mx-auto px-4 md:px-8 mt-10 pb-20 space-y-8">
        <div className="aspect-[16/9] overflow-hidden rounded-xl border border-gray-100 bg-gray-100">
          {GUEST_HOUSE_IMAGE ? (
            <img
              src={GUEST_HOUSE_IMAGE}
              alt="The society guest house"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
              <ImageIcon className="h-8 w-8" />
              <span className="text-sm">Guest house photo</span>
            </div>
          )}
        </div>

        <div className="inline-flex flex-wrap items-baseline gap-x-2 rounded-xl border border-gray-200 bg-gray-50 px-5 py-3">
          <span className="text-sm text-gray-600">Accommodation Rate</span>
          <span className="text-2xl font-bold text-gray-900">
            ৳{GUEST_HOUSE_RATE}
          </span>
          <span className="text-sm text-gray-600">per night</span>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Booking Request
          </h2>
          <p className="mb-4 mt-1 text-sm text-gray-500 font-outfit">
            Submit a request to stay at the society guest house.
          </p>
          <MemberGate>
            <BookingForm />
          </MemberGate>
        </section>
      </div>
    </div>
  );
};

export default GuestHouse;
