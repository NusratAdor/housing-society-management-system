import React, { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import usePageTitle from "../../hooks/usePageTitle";
import { useAppContext } from "../../context/AppContext";
import { UTILITY_SERVICES } from "../../utils/serviceInfo";
import { ServiceHero, MemberGate, Field, inputClass, SubmitButton, RequestSent } from "../../components/services/ServiceParts";

const RequestForm = ({ type, service }) => {
  const { axios, getToken, memberProfile } = useAppContext();
  const plots = memberProfile.plots || [];

  const initial = { plotNo: plots.length === 1 ? plots[0].plotNo : "", issueType: "", description: "" };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const validate = () => {
    const e = {};
    if (!form.plotNo) e.plotNo = "Choose your plot";
    if (!form.issueType) e.issueType = "Choose a service type";
    if (form.description.trim().length < 10) e.description = "Please describe it in at least 10 characters";
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
      await axios.post("/api/service-requests", { serviceType: type, ...form }, { headers: { Authorization: `Bearer ${token}` } });
      setSent(true);
      setForm(initial);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not send your request");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) return <RequestSent onAnother={() => setSent(false)} />;

  return (
    <form onSubmit={submit} noValidate className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Member information</h3>
      <dl className="grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-gray-500">Name</dt><dd className="font-medium text-gray-800">{memberProfile.name}</dd></div>
        <div><dt className="text-xs text-gray-500">Membership No.</dt><dd className="font-medium text-gray-800">{memberProfile.membershipNo}</dd></div>
        <div><dt className="text-xs text-gray-500">Phone</dt><dd className="font-medium text-gray-800">{memberProfile.phone}</dd></div>
      </dl>

      <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">Request information</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="u-plot" label="Plot" error={errors.plotNo}>
          <select id="u-plot" value={form.plotNo} onChange={(e) => setField("plotNo", e.target.value)} className={inputClass(errors.plotNo)}>
            <option value="">Select your plot</option>
            {plots.map((p) => (
              <option key={p.plotNo} value={p.plotNo}>{p.plotNo} · {p.plotSize} Katha</option>
            ))}
          </select>
        </Field>
        <Field id="u-type" label="Service type" error={errors.issueType}>
          <select id="u-type" value={form.issueType} onChange={(e) => setField("issueType", e.target.value)} className={inputClass(errors.issueType)}>
            <option value="">Select</option>
            {service.issueTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="u-desc" label="Description" error={errors.description} className="mt-4">
        <textarea id="u-desc" rows={4} maxLength={1000} value={form.description} onChange={(e) => setField("description", e.target.value)} className={`${inputClass(errors.description)} resize-y`} />
      </Field>

      <SubmitButton submitting={submitting}>Submit Request</SubmitButton>
    </form>
  );
};

const UtilityRequest = () => {
  const { type } = useParams();
  const service = UTILITY_SERVICES[type];
  usePageTitle(service ? `${service.title} Service` : "Utility Services");

  if (!service) return <Navigate to="/our-services/utility-services" replace />;

  return (
    <div className="w-full bg-white min-h-screen">
      <ServiceHero
        crumbs={[
          { label: "Home", to: "/" },
          { label: "Services", to: "/our-services" },
          { label: "Utility Services", to: "/our-services/utility-services" },
          { label: service.title },
        ]}
        title={service.title}
        highlight="Service"
        subtitle={service.intro}
      />

      <div className="max-w-3xl mx-auto px-4 md:px-8 mt-10 pb-20">
        <MemberGate>
          <RequestForm key={type} type={type} service={service} />
        </MemberGate>
      </div>
    </div>
  );
};

export default UtilityRequest;