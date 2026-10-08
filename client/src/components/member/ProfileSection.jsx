
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Home,
  MapPin,
  CreditCard,
  UserRound,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Loader2,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAppContext } from "../../context/AppContext";
import { normalizePhone } from "../../utils/phoneUtils";

const PLOT_SIZES = [13, 10, 9, 7, 6.5];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createPlotRow = (plot = {}) => ({
  id:
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  plotNo: plot.plotNo || "",
  plotSize: plot.plotSize ?? "",
});

const buildInitialForm = (memberProfile) => ({
  name: memberProfile?.name || "",
  email: memberProfile?.email || "",
  phone: memberProfile?.phone || "",
  designation: memberProfile?.designation || "",
  membershipNumber: memberProfile?.membershipNo || "",

  permanentAddress: memberProfile?.permanentAddress || "",
  presentAddress: memberProfile?.presentAddress || "",

  plots:
    Array.isArray(memberProfile?.plots) && memberProfile.plots.length > 0
      ? memberProfile.plots.map(createPlotRow)
      : [createPlotRow()],

  nominee: {
    name: memberProfile?.nominee?.name || "",
    phone: memberProfile?.nominee?.phone || "",
    email: memberProfile?.nominee?.email || "",
  },
});

const Field = ({
  id,
  label,
  value,
  onChange,
  icon: Icon,
  error,
  disabled = false,
  type = "text",
  hint,
  placeholder,
  required = false,
}) => {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="flex items-center gap-2 text-sm font-medium text-slate-700"
      >
        {Icon && <Icon className="h-4 w-4 text-slate-500" />}
        <span>{label}</span>
        {required && <span className="text-red-500">*</span>}
      </label>

      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${id}-error` : hint ? `${id}-hint` : undefined
        }
        className={[
          "w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800",
          "outline-none transition",
          "placeholder:text-slate-400",
          disabled
            ? "cursor-not-allowed bg-slate-50 text-slate-500"
            : "focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10",
          error ? "border-red-400" : "border-slate-200",
        ].join(" ")}
      />

      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}

      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

const TextAreaField = ({
  id,
  label,
  value,
  onChange,
  icon: Icon,
  error,
  placeholder,
  required = false,
}) => {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="flex items-center gap-2 text-sm font-medium text-slate-700"
      >
        {Icon && <Icon className="h-4 w-4 text-slate-500" />}
        <span>{label}</span>
        {required && <span className="text-red-500">*</span>}
      </label>

      <textarea
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        rows={4}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={[
          "w-full resize-y rounded-xl border bg-white px-4 py-3 text-sm",
          "text-slate-800 outline-none transition",
          "placeholder:text-slate-400",
          "focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10",
          error ? "border-red-400" : "border-slate-200",
        ].join(" ")}
      />

      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

export default function ProfileSection({ onActionComplete }) {
  const { t } = useTranslation("profile");

  const {
    user,
    memberProfile,
    setMemberProfile,
    axios,
    getToken,
  } = useAppContext();

  const [form, setForm] = useState(() =>
    buildInitialForm(memberProfile)
  );

  const [errors, setErrors] = useState({});

  const [saving, setSaving] = useState(false);
  const [requestingAdmin, setRequestingAdmin] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  /*
   * Keep the form synchronized when the member profile changes
   * from AppContext, authentication recovery, or another page.
   */
  useEffect(() => {
    setForm(buildInitialForm(memberProfile));
    setErrors({});
  }, [memberProfile]);

  /*
   * The profile page should never be responsible for changing
   * identity-controlled fields such as email, phone, or membershipNo.
   *
   * These values are displayed for reference only.
   */
  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setErrors((previous) => {
      if (!previous[field]) return previous;

      const next = { ...previous };
      delete next[field];
      return next;
    });

    setSaveSuccess(false);
  };

  const updateNomineeField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      nominee: {
        ...previous.nominee,
        [field]: value,
      },
    }));

    const errorKey = `nominee.${field}`;

    setErrors((previous) => {
      if (!previous[errorKey]) return previous;

      const next = { ...previous };
      delete next[errorKey];
      return next;
    });

    setSaveSuccess(false);
  };

  const updatePlot = (plotId, field, value) => {
    setForm((previous) => ({
      ...previous,
      plots: previous.plots.map((plot) =>
        plot.id === plotId
          ? {
              ...plot,
              [field]: value,
            }
          : plot
      ),
    }));

    const errorKey = `plot.${plotId}.${field}`;

    setErrors((previous) => {
      if (!previous[errorKey]) return previous;

      const next = { ...previous };
      delete next[errorKey];
      return next;
    });

    setSaveSuccess(false);
  };

  const addPlot = () => {
    setForm((previous) => ({
      ...previous,
      plots: [...previous.plots, createPlotRow()],
    }));

    setSaveSuccess(false);
  };

  const removePlot = (plotId) => {
    /*
     * At least one plot must always remain.
     */
    if (form.plots.length <= 1) return;

    setForm((previous) => ({
      ...previous,
      plots: previous.plots.filter((plot) => plot.id !== plotId),
    }));

    setErrors((previous) => {
      const next = { ...previous };

      Object.keys(next).forEach((key) => {
        if (key.startsWith(`plot.${plotId}.`)) {
          delete next[key];
        }
      });

      return next;
    });

    setSaveSuccess(false);
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = t("errors.nameRequired");
    }

    if (!form.designation.trim()) {
      nextErrors.designation = t("errors.designationRequired");
    }

    if (!form.permanentAddress.trim()) {
      nextErrors.permanentAddress = t(
        "errors.permanentAddressRequired"
      );
    }

    if (!form.presentAddress.trim()) {
      nextErrors.presentAddress = t(
        "errors.presentAddressRequired"
      );
    }

    if (!Array.isArray(form.plots) || form.plots.length === 0) {
      nextErrors.plots = t("errors.plotRequired");
    } else {
      form.plots.forEach((plot) => {
        if (!plot.plotNo.trim()) {
          nextErrors[`plot.${plot.id}.plotNo`] = t(
            "errors.plotNumberRequired"
          );
        }

        if (
          plot.plotSize === "" ||
          plot.plotSize === null ||
          plot.plotSize === undefined
        ) {
          nextErrors[`plot.${plot.id}.plotSize`] = t(
            "errors.plotSizeRequired"
          );
        } else if (!PLOT_SIZES.includes(Number(plot.plotSize))) {
          nextErrors[`plot.${plot.id}.plotSize`] = t(
            "errors.plotSizeInvalid"
          );
        }
      });
    }

    if (!form.nominee.name.trim()) {
      nextErrors["nominee.name"] = t(
        "errors.nomineeNameRequired"
      );
    }

    if (!form.nominee.phone.trim()) {
      nextErrors["nominee.phone"] = t(
        "errors.nomineePhoneRequired"
      );
    } else if (!normalizePhone(form.nominee.phone)) {
      nextErrors["nominee.phone"] = t(
        "errors.nomineePhoneInvalid"
      );
    }

    if (!form.nominee.email.trim()) {
      nextErrors["nominee.email"] = t(
        "errors.nomineeEmailRequired"
      );
    } else if (!EMAIL_REGEX.test(form.nominee.email.trim())) {
      nextErrors["nominee.email"] = t(
        "errors.nomineeEmailInvalid"
      );
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async (event) => {
    event.preventDefault();

    setSaveSuccess(false);

    if (!validateForm()) {
      toast.error(t("toast.validation"));
      return;
    }

    try {
      setSaving(true);

      const token = await getToken();

      if (!token) {
        toast.error(t("toast.sessionExpired"));
        return;
      }

      /*
       * IMPORTANT:
       * Only editable profile fields are sent.
       *
       * Never send:
       * - membershipNo
       * - email
       * - phone
       * - clerkUserId
       * - role
       * - status
       * - pendingAdmin
       */
      const payload = {
        name: form.name.trim(),
        designation: form.designation.trim(),

        permanentAddress: form.permanentAddress.trim(),
        presentAddress: form.presentAddress.trim(),

        plots: form.plots.map((plot) => ({
          plotNo: plot.plotNo.trim().toUpperCase(),
          plotSize: Number(plot.plotSize),
        })),

        nominee: {
          name: form.nominee.name.trim(),
          phone: normalizePhone(form.nominee.phone),
          email: form.nominee.email.trim().toLowerCase(),
        },
      };

      const { data } = await axios.patch(
        "/api/members/me",
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      /*
       * DO NOT call fetchMemberProfile() here.
       *
       * The PATCH response already contains the updated member.
       * Updating Context directly avoids another GET request.
       */
      if (data?.member) {
        setMemberProfile(data.member);
      }

      setSaveSuccess(true);

      toast.success(
        data?.message || t("toast.saved")
      );

      onActionComplete?.();
    } catch (error) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message;

      if (status === 401) {
        toast.error(t("toast.sessionExpired"));
      } else {
        toast.error(message || t("toast.updateFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRequestAdmin = async () => {
    if (requestingAdmin) return;

    try {
      setRequestingAdmin(true);

      const token = await getToken();

      if (!token) {
        toast.error(t("toast.sessionExpired"));
        return;
      }

      const { data } = await axios.post(
        "/api/members/request-admin",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      /*
       * Keep the local Context synchronized immediately.
       */
      if (data?.member) {
        setMemberProfile(data.member);
      } else {
        setMemberProfile((previous) =>
          previous
            ? {
                ...previous,
                pendingAdmin: true,
              }
            : previous
        );
      }

      toast.success(
        data?.message || t("toast.adminRequested")
      );

      onActionComplete?.();
    } catch (error) {
      const status = error?.response?.status;
      const code = error?.response?.data?.code;
      const message = error?.response?.data?.message;

      if (status === 401) {
        toast.error(t("toast.sessionExpired"));
      } else if (code === "ALREADY_ADMIN") {
        toast.error(t("toast.alreadyAdmin"));
      } else if (code === "ADMIN_REQUEST_PENDING") {
        toast.error(t("toast.adminAlreadyPending"));
      } else {
        toast.error(message || t("toast.adminRequestFailed"));
      }
    } finally {
      setRequestingAdmin(false);
    }
  };

  const isActiveMember = memberProfile?.status === "active";

  const isAdmin =
    memberProfile?.role === "admin" &&
    memberProfile?.status === "active";

  const adminRequestPending =
    memberProfile?.pendingAdmin === true;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full"
    >
      <form onSubmit={handleSave} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {t("title")}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {t("subtitle")}
            </p>
          </div>

          <button
            type="submit"
            disabled={saving || !isActiveMember}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("actions.saving")}
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {t("actions.saved")}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {t("actions.save")}
              </>
            )}
          </button>
        </div>

        {/* Personal information */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-slate-900">
              {t("sections.personal.title")}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {t("sections.personal.description")}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field
              id="member-name"
              label={t("fields.name")}
              value={form.name}
              onChange={(event) =>
                updateField("name", event.target.value)
              }
              icon={User}
              error={errors.name}
              required
              placeholder={t("placeholders.name")}
            />

            <Field
              id="member-designation"
              label={t("fields.designation")}
              value={form.designation}
              onChange={(event) =>
                updateField("designation", event.target.value)
              }
              icon={Briefcase}
              error={errors.designation}
              required
              placeholder={t("placeholders.designation")}
            />

            <Field
              id="member-email"
              label={t("fields.email")}
              value={form.email}
              onChange={() => {}}
              icon={Mail}
              disabled
              hint={t("hints.email")}
            />

            <Field
              id="member-phone"
              label={t("fields.phone")}
              value={form.phone}
              onChange={() => {}}
              icon={Phone}
              disabled
              hint={t("hints.phone")}
            />

            <Field
              id="member-membership-number"
              label={t("fields.membershipNumber")}
              value={form.membershipNumber}
              onChange={() => {}}
              icon={CreditCard}
              disabled
              hint={t("hints.membershipNumber")}
            />
          </div>
        </section>

        {/* Address information */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-slate-900">
              {t("sections.address.title")}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {t("sections.address.description")}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <TextAreaField
              id="permanent-address"
              label={t("fields.permanentAddress")}
              value={form.permanentAddress}
              onChange={(event) =>
                updateField(
                  "permanentAddress",
                  event.target.value
                )
              }
              icon={Home}
              error={errors.permanentAddress}
              required
              placeholder={t("placeholders.permanentAddress")}
            />

            <TextAreaField
              id="present-address"
              label={t("fields.presentAddress")}
              value={form.presentAddress}
              onChange={(event) =>
                updateField(
                  "presentAddress",
                  event.target.value
                )
              }
              icon={MapPin}
              error={errors.presentAddress}
              required
              placeholder={t("placeholders.presentAddress")}
            />
          </div>
        </section>

        {/* Plot information */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {t("sections.plots.title")}
              </h3>

              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                {t("sections.plots.description")}
              </p>
            </div>

            <button
              type="button"
              onClick={addPlot}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <Plus className="h-4 w-4" />
              {t("plot.add")}
            </button>
          </div>

          {errors.plots && (
            <p className="mb-4 text-sm font-medium text-red-600">
              {errors.plots}
            </p>
          )}

          <div className="space-y-4">
            {form.plots.map((plot, index) => (
              <div
                key={plot.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {t("plot.label", {
                        number: index + 1,
                      })}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {t("plot.description")}
                    </p>
                  </div>

                  {form.plots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePlot(plot.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("plot.remove")}
                    </button>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    id={`plot-${plot.id}-number`}
                    label={t("fields.plotNumber")}
                    value={plot.plotNo}
                    onChange={(event) =>
                      updatePlot(
                        plot.id,
                        "plotNo",
                        event.target.value
                      )
                    }
                    icon={MapPin}
                    error={
                      errors[`plot.${plot.id}.plotNo`]
                    }
                    required
                    placeholder={t(
                      "placeholders.plotNumber"
                    )}
                    hint={t("hints.plotNumber")}
                  />

                  <div className="space-y-2">
                    <label
                      htmlFor={`plot-${plot.id}-size`}
                      className="flex items-center gap-2 text-sm font-medium text-slate-700"
                    >
                      <CreditCard className="h-4 w-4 text-slate-500" />
                      <span>{t("fields.plotSize")}</span>
                      <span className="text-red-500">*</span>
                    </label>

                    <select
                      id={`plot-${plot.id}-size`}
                      value={plot.plotSize}
                      onChange={(event) =>
                        updatePlot(
                          plot.id,
                          "plotSize",
                          event.target.value
                        )
                      }
                      aria-invalid={Boolean(
                        errors[`plot.${plot.id}.plotSize`]
                      )}
                      className={[
                        "w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 outline-none transition",
                        "focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10",
                        errors[`plot.${plot.id}.plotSize`]
                          ? "border-red-400"
                          : "border-slate-200",
                      ].join(" ")}
                    >
                      <option value="">
                        {t("plot.selectSize")}
                      </option>

                      {PLOT_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>

                    {errors[`plot.${plot.id}.plotSize`] && (
                      <p className="text-xs font-medium text-red-600">
                        {errors[`plot.${plot.id}.plotSize`]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Nominee information */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-slate-900">
              {t("sections.nominee.title")}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {t("sections.nominee.description")}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field
              id="nominee-name"
              label={t("fields.nomineeName")}
              value={form.nominee.name}
              onChange={(event) =>
                updateNomineeField(
                  "name",
                  event.target.value
                )
              }
              icon={UserRound}
              error={errors["nominee.name"]}
              required
              placeholder={t("placeholders.nomineeName")}
            />

            <Field
              id="nominee-phone"
              label={t("fields.nomineePhone")}
              value={form.nominee.phone}
              onChange={(event) =>
                updateNomineeField(
                  "phone",
                  event.target.value
                )
              }
              icon={Phone}
              error={errors["nominee.phone"]}
              required
              placeholder={t("placeholders.nomineePhone")}
              hint={t("hints.nomineePhone")}
            />

            <Field
              id="nominee-email"
              label={t("fields.nomineeEmail")}
              value={form.nominee.email}
              onChange={(event) =>
                updateNomineeField(
                  "email",
                  event.target.value
                )
              }
              icon={Mail}
              error={errors["nominee.email"]}
              type="email"
              required
              placeholder={t("placeholders.nomineeEmail")}
            />
          </div>
        </section>

        {/* Admin access */}
        {isActiveMember && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                  {isAdmin ? (
                    <Shield className="h-5 w-5" />
                  ) : (
                    <ShieldAlert className="h-5 w-5" />
                  )}
                </div>

                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {isAdmin
                      ? t("actions.adminActive")
                      : adminRequestPending
                      ? t("actions.adminPending")
                      : t("actions.requestAdmin")}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {isAdmin
                      ? t("admin.activeDescription")
                      : adminRequestPending
                      ? t("admin.pendingDescription")
                      : t("admin.requestDescription")}
                  </p>
                </div>
              </div>

              {!isAdmin && !adminRequestPending && (
                <button
                  type="button"
                  onClick={handleRequestAdmin}
                  disabled={requestingAdmin}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {requestingAdmin && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  {requestingAdmin
                    ? t("actions.requesting")
                    : t("actions.requestAdmin")}
                </button>
              )}
            </div>
          </section>
        )}

        {/* Bottom save action for long forms */}
        <div className="flex justify-end border-t border-slate-200 pt-6">
          <button
            type="submit"
            disabled={saving || !isActiveMember}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("actions.saving")}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {t("actions.save")}
              </>
            )}
          </button>
        </div>
      </form>
    </motion.section>
  );
}

