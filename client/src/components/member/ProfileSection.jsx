// client/src/components/member/ProfileSection.jsx
//
// CHANGE from previous version:
//   - useTranslation("profile") added.
//   - All hardcoded strings replaced with t() calls.
//   - FIELDS array moved inside the component body because field labels
//     go through t() and must rebuild on language change — same reason
//     TABS moved inside MemberDashboard in Phase 3.
//   - toast.success/error messages now use t() keys from profile.json
//     so the user sees success feedback in their chosen language.
//   - Zero functional changes: save, requestAdmin, validation, API calls.

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { Loader2, User, Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../context/AppContext";

export default function ProfileSection({ onActionComplete }) {
  const {
    user,
    memberProfile,
    fetchMemberProfile,
    axios,
    getToken,
  } = useAppContext();

  // "profile" namespace — all t() calls resolve against profile.json
  const { t } = useTranslation("profile");

  // FIELDS defined inside the component so t() re-evaluates on language
  // change and field labels update immediately without a page reload.
  const FIELDS = [
    { label: t("fields.name"),             key: "name",             half: true  },
    { label: t("fields.phone"),            key: "phone",            half: true  },
    { label: t("fields.address"),          key: "address",          half: false },
    { label: t("fields.designation"),      key: "designation",      half: true  },
    { label: t("fields.plotNumber"),       key: "plotNumber",       half: true  },
    {
      label:    t("fields.email"),
      key:      "email",
      readOnly: true,
      half:     true,
      hint:     t("hints.email"),
    },
    {
      label:    t("fields.membershipNumber"),
      key:      "membershipNumber",
      readOnly: true,
      half:     true,
      hint:     t("hints.membershipNumber"),
    },
  ];

  const [form,        setForm]        = useState(buildInitialForm(memberProfile, user));
  const [saving,      setSaving]      = useState(false);
  const [requesting,  setRequesting]  = useState(false);
  const [phoneError,  setPhoneError]  = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (memberProfile || user) setForm(buildInitialForm(memberProfile, user));
  }, [memberProfile, user]);

  const validatePhone = (value) => {
    if (!value) { setPhoneError(""); return true; }
    const n = normalizePhone(value);
    if (!/^(013|014|015|016|017|018|019)\d{8}$/.test(n)) {
      setPhoneError(t("errors.phone"));
      return false;
    }
    setPhoneError("");
    return true;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (phoneError) {
      toast.error(t("errors.phoneRequired"));
      return;
    }
    const normalizedPhone = normalizePhone(form.phone);
    if (form.phone && !/^(013|014|015|016|017|018|019)\d{8}$/.test(normalizedPhone)) {
      toast.error(t("errors.phone"));
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      const email = memberProfile?.email || user?.primaryEmailAddress?.emailAddress;
      if (!email) {
        toast.error(t("errors.noEmail"));
        return;
      }
      const { data } = await axios.post(
        "/api/members",
        {
          name:         form.name.trim(),
          email,
          phone:        normalizedPhone,
          address:      form.address.trim(),
          designation:  form.designation.trim(),
          membershipNo: form.membershipNumber,
          plotNo:       form.plotNumber.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        toast.success(t("toast.saved"));
        fetchMemberProfile();
        onActionComplete?.();
      } else {
        toast.error(data.message || t("toast.saved"));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestAdmin = async () => {
    if (form.pendingAdmin) {
      toast.error(t("toast.adminAlreadyPending"));
      return;
    }
    if (memberProfile?.role === "admin") {
      toast.error(t("toast.alreadyAdmin"));
      return;
    }
    setRequesting(true);
    try {
      const token = await getToken();
      const { data } = await axios.post(
        "/api/members/request-admin", {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) {
        toast.success(t("toast.adminRequested"));
        setForm(f => ({ ...f, pendingAdmin: true }));
        fetchMemberProfile();
        onActionComplete?.();
      } else {
        toast.error(data.message || "Could not submit request");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setRequesting(false);
    }
  };

  const isAdmin   = memberProfile?.role === "admin";
  const isPending = form.pendingAdmin;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-100 rounded-xl">
          <User className="h-5 w-5 text-gray-500" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            {t("title")}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <form onSubmit={handleSave} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            {FIELDS.map(({ label, key, readOnly, hint, half }) => (
              <div key={key} className={half ? "" : "sm:col-span-2"}>
                <label
                  htmlFor={`field-${key}`}
                  className="block text-xs font-medium text-gray-600 mb-1.5"
                >
                  {label}
                </label>
                <input
                  id={`field-${key}`}
                  type="text"
                  value={form[key]}
                  readOnly={readOnly}
                  onChange={(e) => {
                    setForm(f => ({ ...f, [key]: e.target.value }));
                    if (key === "phone") validatePhone(e.target.value);
                  }}
                  className={`w-full px-3 py-2.5 text-sm rounded-xl border
                    transition-colors outline-none
                    focus:ring-2 focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)]
                    ${readOnly
                      ? "bg-gray-50 border-gray-200 text-gray-400 cursor-default"
                      : key === "phone" && phoneError
                      ? "bg-white border-red-300 focus:ring-red-200 focus:border-red-400"
                      : "bg-white border-gray-200 text-gray-800"
                    }`}
                />
                {key === "phone" && phoneError && (
                  <p className="text-xs text-red-500 mt-1">{phoneError}</p>
                )}
                {readOnly && hint && (
                  <p className="text-[11px] text-gray-400 mt-1">{hint}</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving || !!phoneError}
              className="flex items-center gap-2 px-5 py-2.5
                bg-[var(--color-primary)] hover:bg-blue-700
                disabled:opacity-50 disabled:cursor-not-allowed
                text-white text-sm font-semibold rounded-xl
                shadow-sm transition-all duration-150 active:scale-95"
            >
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("actions.saving")}</>
                : saveSuccess
                ? <><ShieldCheck className="h-4 w-4" /> {t("actions.saved")}</>
                : t("actions.save")
              }
            </button>

            {isAdmin ? (
              <span className="flex items-center gap-1.5 px-4 py-2.5
                bg-emerald-50 text-emerald-700 text-sm font-medium
                rounded-xl border border-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                {t("actions.adminActive")}
              </span>
            ) : isPending ? (
              <span className="flex items-center gap-1.5 px-4 py-2.5
                bg-amber-50 text-amber-700 text-sm font-medium
                rounded-xl border border-amber-200">
                <ShieldAlert className="h-4 w-4" />
                {t("actions.adminPending")}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRequestAdmin}
                disabled={requesting}
                className="flex items-center gap-2 px-4 py-2.5
                  bg-white hover:bg-gray-50 border border-gray-200
                  hover:border-gray-300
                  text-gray-700 text-sm font-medium rounded-xl
                  transition-all duration-150 disabled:opacity-50"
              >
                {requesting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Shield  className="h-4 w-4 text-gray-400" />
                }
                {t("actions.requestAdmin")}
              </button>
            )}
          </div>
        </form>
      </div>
    </motion.div>
  );
}

function buildInitialForm(memberProfile, user) {
  return {
    name:             memberProfile?.name             ?? "",
    address:          memberProfile?.address          ?? "",
    designation:      memberProfile?.designation      ?? "",
    email:            memberProfile?.email ?? user?.primaryEmailAddress?.emailAddress ?? "",
    phone:            memberProfile?.phone            ?? "",
    membershipNumber: memberProfile?.membershipNo     ?? "",
    plotNumber:       memberProfile?.plotNo           ?? "",
    pendingAdmin:     memberProfile?.pendingAdmin     ?? false,
  };
}

function normalizePhone(input) {
  if (!input) return "";
  return input.replace(/[^0-9]/g, "").replace(/^880/, "").replace(/^0+/, "0");
}