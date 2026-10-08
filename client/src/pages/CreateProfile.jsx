// client/src/pages/CreateProfile.jsx

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useUser } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

import { normalizePhone, isValidPhone } from "../utils/phoneUtils";
import { useAppContext } from "../context/AppContext";
import usePageTitle from "../hooks/usePageTitle";

const PLOT_SIZES = [13, 10, 9, 7, 6.5];

const INITIAL_FORM = {
  name: "",
  phone: "",
  designation: "",
  permanentAddress: "",
  presentAddress: "",
  membershipNo: "",
  plots: [
    {
      plotNo: "",
      plotSize: "",
    },
  ],
  nominee: {
    name: "",
    phone: "",
    email: "",
  },
};

const normalizeMembershipNo = (value) => {
  return value.trim();
};

const normalizePlotNo = (value) => {
  return value.trim().toUpperCase();
};

const validateEmail = (value) => {
  if (!value.trim()) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
};

const CreateProfile = () => {
  const {
    getToken,
    navigate,
    axios,
    setMemberProfile,
    memberProfile,
    loadingProfile,
    staffProfile,
    loadingStaffProfile,
  } = useAppContext();

  const { user } = useUser();

  usePageTitle("Create Profile");

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  /*
   * ------------------------------------------------------------
   * Redirect already-created profiles / staff
   * ------------------------------------------------------------
   *
   * This effect only depends on profile/loading state.
   * Typing into the form does NOT trigger this effect.
   */
  useEffect(() => {
    if (loadingProfile || loadingStaffProfile) return;

    if (staffProfile) {
      const destination =
        staffProfile.role === "super_admin" ? "/super-admin" : "/admin";

      navigate(destination, { replace: true });
      return;
    }

    if (memberProfile) {
      const destination =
        memberProfile.role === "admin" ? "/admin" : "/dashboard";

      navigate(destination, { replace: true });
    }
  }, [
    loadingProfile,
    loadingStaffProfile,
    staffProfile,
    memberProfile,
    navigate,
  ]);

  /*
   * ------------------------------------------------------------
   * Field update helpers
   * ------------------------------------------------------------
   */

  const updateField = useCallback((field, value) => {
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
  }, []);

  const updateNomineeField = useCallback((field, value) => {
    setForm((previous) => ({
      ...previous,
      nominee: {
        ...previous.nominee,
        [field]: value,
      },
    }));

    setErrors((previous) => {
      if (!previous[`nominee.${field}`]) return previous;

      const next = { ...previous };
      delete next[`nominee.${field}`];

      return next;
    });
  }, []);

  /*
   * ------------------------------------------------------------
   * Plot handlers
   * ------------------------------------------------------------
   */

  const updatePlot = useCallback((index, field, value) => {
    setForm((previous) => {
      const plots = [...previous.plots];

      plots[index] = {
        ...plots[index],
        [field]: field === "plotNo" ? value.toUpperCase() : value,
      };

      return {
        ...previous,
        plots,
      };
    });

    setErrors((previous) => {
      const key = `plot.${index}.${field}`;

      if (!previous[key]) return previous;

      const next = { ...previous };
      delete next[key];

      return next;
    });
  }, []);

  const addPlot = useCallback(() => {
    setForm((previous) => ({
      ...previous,
      plots: [
        ...previous.plots,
        {
          plotNo: "",
          plotSize: "",
        },
      ],
    }));
  }, []);

  const removePlot = useCallback((index) => {
    setForm((previous) => {
      if (previous.plots.length === 1) {
        return previous;
      }

      return {
        ...previous,
        plots: previous.plots.filter((_, plotIndex) => plotIndex !== index),
      };
    });
  }, []);

  /*
   * ------------------------------------------------------------
   * Validation
   * ------------------------------------------------------------
   */

  const validateForm = useCallback(() => {
    const nextErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = "Full name is required";
    }

    if (!isValidPhone(form.phone)) {
      nextErrors.phone = "Enter a valid phone number";
    }

    if (!form.designation.trim()) {
      nextErrors.designation = "Designation is required";
    }

    if (!form.permanentAddress.trim()) {
      nextErrors.permanentAddress = "Permanent address is required";
    }

    if (!form.presentAddress.trim()) {
      nextErrors.presentAddress = "Present address is required";
    }

    if (!form.membershipNo.trim()) {
      nextErrors.membershipNo = "Membership number is required";
    } else if (!/^\d+$/.test(form.membershipNo.trim())) {
      nextErrors.membershipNo = "Membership number must contain digits only";
    }

    if (!form.plots.length) {
      nextErrors.plots = "At least one plot is required";
    }

    form.plots.forEach((plot, index) => {
      if (!plot.plotNo.trim()) {
        nextErrors[`plot.${index}.plotNo`] = "Plot number is required";
      }

      if (!PLOT_SIZES.includes(Number(plot.plotSize))) {
        nextErrors[`plot.${index}.plotSize`] = "Select a valid plot size";
      }
    });

    if (!form.nominee.name.trim()) {
      nextErrors["nominee.name"] = "Nominee name is required";
    }

    if (!isValidPhone(form.nominee.phone)) {
      nextErrors["nominee.phone"] = "Enter a valid nominee phone number";
    }

    if (!validateEmail(form.nominee.email)) {
      nextErrors["nominee.email"] = "Enter a valid nominee email";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }, [form]);

  /*
   * ------------------------------------------------------------
   * Submit
   * ------------------------------------------------------------
   */

  const onSubmitHandler = useCallback(
    async (event) => {
      event.preventDefault();

      if (loading) return;

      if (!validateForm()) {
        toast.error("Please correct the highlighted fields");
        return;
      }

      setLoading(true);

      try {
        const token = await getToken();

        const email = user?.primaryEmailAddress?.emailAddress;

        if (!email) {
          toast.error("No primary email found in your Clerk account.");
          return;
        }

        const payload = {
          name: form.name.trim(),
          email,
          phone: normalizePhone(form.phone),
          designation: form.designation.trim(),

          permanentAddress: form.permanentAddress.trim(),

          presentAddress: form.presentAddress.trim(),

          membershipNo: normalizeMembershipNo(form.membershipNo),

          plots: form.plots.map((plot) => ({
            plotNo: normalizePlotNo(plot.plotNo),
            plotSize: Number(plot.plotSize),
          })),

          nominee: {
            name: form.nominee.name.trim(),
            phone: normalizePhone(form.nominee.phone),
            email: form.nominee.email.trim().toLowerCase(),
          },
        };

        const { data } = await axios.post("/api/members", payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!data.success) {
          toast.error(data.message || "Could not create profile");
          return;
        }

        toast.success(data.message || "Profile created successfully!");

        setMemberProfile(data.member);
        navigate("/dashboard");
      } catch (error) {
        toast.error(
          error.response?.data?.message ||
            error.message ||
            "Error creating profile",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      loading,
      validateForm,
      getToken,
      user,
      form,
      axios,
      setMemberProfile,
      navigate,
    ],
  );

  /*
   * ------------------------------------------------------------
   * Loading / redirect states
   * ------------------------------------------------------------
   */

  if (loadingProfile || loadingStaffProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 font-outfit">Loading profile...</div>
      </div>
    );
  }

  if (staffProfile) {
    const destination =
      staffProfile.role === "super_admin" ? "/super-admin" : "/admin";

    return <Navigate to={destination} replace />;
  }

  if (memberProfile) {
    const destination =
      memberProfile.role === "admin" ? "/admin" : "/dashboard";

    return <Navigate to={destination} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <form
        onSubmit={onSubmitHandler}
        className="mx-auto w-full max-w-3xl rounded-xl bg-white p-6 shadow-lg sm:p-8"
      >
        <h2 className="mb-2 text-center text-2xl font-semibold">
          Create Your Member Profile
        </h2>

        <p className="mb-8 text-center text-sm text-gray-500">
          Enter the information associated with your membership registration.
        </p>

        {/* -------------------------------------------------- */}
        {/* Personal Information */}
        {/* -------------------------------------------------- */}

        <section className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">
            Personal Information
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-700">
                Full Name
              </label>

              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
                className={`w-full rounded-lg border px-3 py-2 outline-none ${
                  errors.name
                    ? "border-red-500"
                    : "border-gray-300 focus:border-indigo-500"
                }`}
              />

              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-700">
                Phone Number
              </label>

              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+8801712345678"
                required
                className={`w-full rounded-lg border px-3 py-2 outline-none ${
                  errors.phone
                    ? "border-red-500"
                    : "border-gray-300 focus:border-indigo-500"
                }`}
              />

              <p className="mt-1 text-xs text-gray-500">
                Use international format when applicable.
              </p>

              {errors.phone && (
                <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-700">
                Designation
              </label>

              <input
                type="text"
                value={form.designation}
                onChange={(e) => updateField("designation", e.target.value)}
                required
                className={`w-full rounded-lg border px-3 py-2 outline-none ${
                  errors.designation
                    ? "border-red-500"
                    : "border-gray-300 focus:border-indigo-500"
                }`}
              />

              {errors.designation && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.designation}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-700">
                Membership No
              </label>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.membershipNo}
                onChange={(e) => updateField("membershipNo", e.target.value)}
                required
                className={`w-full rounded-lg border px-3 py-2 outline-none ${
                  errors.membershipNo
                    ? "border-red-500"
                    : "border-gray-300 focus:border-indigo-500"
                }`}
              />

              {errors.membershipNo && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.membershipNo}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- */}
        {/* Address */}
        {/* -------------------------------------------------- */}

        <section className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Address</h3>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1 block text-sm text-gray-700">
                Permanent Address
              </label>

              <textarea
                value={form.permanentAddress}
                onChange={(e) =>
                  updateField("permanentAddress", e.target.value)
                }
                rows={3}
                required
                className={`w-full rounded-lg border px-3 py-2 outline-none ${
                  errors.permanentAddress
                    ? "border-red-500"
                    : "border-gray-300 focus:border-indigo-500"
                }`}
              />

              {errors.permanentAddress && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.permanentAddress}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-700">
                Present Address
              </label>

              <textarea
                value={form.presentAddress}
                onChange={(e) => updateField("presentAddress", e.target.value)}
                rows={3}
                required
                className={`w-full rounded-lg border px-3 py-2 outline-none ${
                  errors.presentAddress
                    ? "border-red-500"
                    : "border-gray-300 focus:border-indigo-500"
                }`}
              />

              {errors.presentAddress && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.presentAddress}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- */}
        {/* Plots */}
        {/* -------------------------------------------------- */}

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                Plot Information
              </h3>

              <p className="text-sm text-gray-500">
                Add all plots associated with this membership.
              </p>
            </div>

            <button
              type="button"
              onClick={addPlot}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Add Plot
            </button>
          </div>

          <div className="space-y-4">
            {form.plots.map((plot, index) => (
              <div
                key={index}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-gray-700">
                      Plot No
                    </label>

                    <input
                      type="text"
                      value={plot.plotNo}
                      onChange={(e) =>
                        updatePlot(index, "plotNo", e.target.value)
                      }
                      placeholder="AD-10 / AD/10 / AD 10"
                      required
                      className={`w-full rounded-lg border px-3 py-2 uppercase outline-none ${
                        errors[`plot.${index}.plotNo`]
                          ? "border-red-500"
                          : "border-gray-300 focus:border-indigo-500"
                      }`}
                    />

                    {errors[`plot.${index}.plotNo`] && (
                      <p className="mt-1 text-sm text-red-500">
                        {errors[`plot.${index}.plotNo`]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-gray-700">
                      Plot Size
                    </label>

                    <select
                      value={plot.plotSize}
                      onChange={(e) =>
                        updatePlot(index, "plotSize", e.target.value)
                      }
                      required
                      className={`w-full rounded-lg border bg-white px-3 py-2 outline-none ${
                        errors[`plot.${index}.plotSize`]
                          ? "border-red-500"
                          : "border-gray-300 focus:border-indigo-500"
                      }`}
                    >
                      <option value="">Select plot size</option>

                      {PLOT_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>

                    {errors[`plot.${index}.plotSize`] && (
                      <p className="mt-1 text-sm text-red-500">
                        {errors[`plot.${index}.plotSize`]}
                      </p>
                    )}
                  </div>
                </div>

                {form.plots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePlot(index)}
                    className="mt-3 text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Remove Plot
                  </button>
                )}
              </div>
            ))}
          </div>

          {errors.plots && (
            <p className="mt-2 text-sm text-red-500">{errors.plots}</p>
          )}
        </section>

        {/* -------------------------------------------------- */}
        {/* Nominee */}
        {/* -------------------------------------------------- */}

        <section className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">
            Nominee Information
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-700">
                Nominee Name
              </label>

              <input
                type="text"
                value={form.nominee.name}
                onChange={(e) => updateNomineeField("name", e.target.value)}
                required
                className={`w-full rounded-lg border px-3 py-2 outline-none ${
                  errors["nominee.name"]
                    ? "border-red-500"
                    : "border-gray-300 focus:border-indigo-500"
                }`}
              />

              {errors["nominee.name"] && (
                <p className="mt-1 text-sm text-red-500">
                  {errors["nominee.name"]}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-700">
                Nominee Contact No
              </label>

              <input
                type="tel"
                value={form.nominee.phone}
                onChange={(e) => updateNomineeField("phone", e.target.value)}
                placeholder="+8801712345678"
                required
                className={`w-full rounded-lg border px-3 py-2 outline-none ${
                  errors["nominee.phone"]
                    ? "border-red-500"
                    : "border-gray-300 focus:border-indigo-500"
                }`}
              />

              {errors["nominee.phone"] && (
                <p className="mt-1 text-sm text-red-500">
                  {errors["nominee.phone"]}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-gray-700">
                Nominee Email
              </label>

              <input
                type="email"
                value={form.nominee.email}
                onChange={(e) => updateNomineeField("email", e.target.value)}
                required
                className={`w-full rounded-lg border px-3 py-2 outline-none ${
                  errors["nominee.email"]
                    ? "border-red-500"
                    : "border-gray-300 focus:border-indigo-500"
                }`}
              />

              {errors["nominee.email"] && (
                <p className="mt-1 text-sm text-red-500">
                  {errors["nominee.email"]}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- */}
        {/* Submit */}
        {/* -------------------------------------------------- */}

        <button
          type="submit"
          disabled={loading}
          className={`w-full rounded-lg py-3 font-medium text-white transition ${
            loading
              ? "cursor-not-allowed bg-gray-400"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {loading ? "Creating Profile..." : "Create Profile"}
        </button>
      </form>
    </div>
  );
};

export default CreateProfile;
