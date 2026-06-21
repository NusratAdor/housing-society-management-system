// client/src/pages/CreateProfile.jsx
// Only addition: usePageTitle hook. All existing logic unchanged.

import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useUser } from "@clerk/clerk-react";
import { useAppContext } from "../context/AppContext";
import { Navigate } from "react-router-dom";
import usePageTitle from "../hooks/usePageTitle";

const CreateProfile = () => {
  const { getToken, navigate, axios, setMemberProfile, memberProfile, loadingProfile } = useAppContext();
  const { user } = useUser();

  usePageTitle("Create Profile | GOHS");

  const [loading,         setLoading]         = useState(false);
  const [name,            setName]            = useState("");
  const [phone,           setPhone]           = useState("");
  const [address,         setAddress]         = useState("");
  const [designation,     setDesignation]     = useState("");
  const [membershipNo,    setMembershipNo]    = useState("");
  const [plotNo,          setPlotNo]          = useState("");
  const [phoneError,      setPhoneError]      = useState("");
  const [membershipError, setMembershipError] = useState("");

  useEffect(() => {
    if (!loadingProfile && memberProfile) {
      const destination = memberProfile.role === "admin" ? "/admin" : "/dashboard";
      navigate(destination, { replace: true });
    }
  }, [memberProfile, loadingProfile, navigate]);

  if (loadingProfile) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-600 font-outfit">Loading profile...</div>
      </div>
    );
  }

  if (memberProfile) {
    const destination = memberProfile.role === "admin" ? "/admin" : "/dashboard";
    return <Navigate to={destination} replace />;
  }

  const normalizePhone = (input) => {
    let p = input.trim();
    if (p.startsWith("+880")) p = p.replace("+880", "0");
    else if (p.startsWith("880")) p = p.replace("880", "0");
    return p.replace(/[^0-9]/g, "");
  };

  const validatePhone = (input) => {
    if (/[^0-9+]/.test(input)) { setPhoneError("Invalid phone number"); return false; }
    const p = normalizePhone(input);
    if (!p || p === "0" || p === "01") { setPhoneError(""); return true; }
    if (!p.startsWith("01")) { setPhoneError("Must start with 01"); return false; }
    if (p.length < 11) { setPhoneError(""); return true; }
    if (!/^(013|014|015|016|017|018|019)\d{8}$/.test(p)) {
      setPhoneError("Invalid phone number"); return false;
    }
    setPhoneError(""); return true;
  };

  const validateMembership = (value) => {
    if (!/^[A-Za-z0-9-]*$/.test(value)) {
      setMembershipError("Invalid membership"); return false;
    }
    setMembershipError(""); return true;
  };

  const handlePhoneChange = (e) => {
    setPhone(e.target.value);
    validatePhone(e.target.value);
  };

  const handleMembershipChange = (e) => {
    setMembershipNo(e.target.value);
    validateMembership(e.target.value);
  };

  const validateForm = () => {
    const normalized = normalizePhone(phone);
    if (!/^(013|014|015|016|017|018|019)\d{8}$/.test(normalized)) {
      toast.error("Please enter a valid 11-digit Bangladeshi number"); return false;
    }
    if (!/^[A-Za-z0-9-]+$/.test(membershipNo)) {
      toast.error("Membership number invalid"); return false;
    }
    return true;
  };

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    if (loading || phoneError || membershipError) return;
    if (!validateForm()) return;
    setLoading(true);
    try {
      const token = await getToken();
      const email = user?.primaryEmailAddress?.emailAddress;
      if (!email) throw new Error("No primary email found in Clerk profile");

      const { data } = await axios.post(
        "/api/members",
        {
          name,
          email,
          phone: normalizePhone(phone),
          address,
          designation,
          membershipNo,
          plotNo,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        toast.success(data.message || "Profile created successfully!");
        setMemberProfile(data.member);
        navigate("/dashboard");
      } else {
        toast.error(data.message || "Could not create profile");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Error creating profile");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { label: "Full Name",      value: name,         setValue: setName,         type: "text" },
    { label: "Phone Number",   value: phone,         type: "tel",   error: phoneError,      onChange: handlePhoneChange },
    { label: "Address",        value: address,       setValue: setAddress,      type: "text" },
    { label: "Designation",    value: designation,   setValue: setDesignation,  type: "text" },
    { label: "Membership No",  value: membershipNo,  type: "text",  error: membershipError, onChange: handleMembershipChange },
    { label: "Plot No",        value: plotNo,        setValue: setPlotNo,       type: "text" },
  ];

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 px-4">
      <form onSubmit={onSubmitHandler} className="bg-white shadow-lg rounded-xl p-8 w-full max-w-2xl">
        <h2 className="text-2xl font-semibold mb-6 text-center">
          Create Your Member Profile
        </h2>
        {fields.map((f) => (
          <div key={f.label} className="mb-4">
            <label className="block text-gray-700 mb-1">{f.label}</label>
            <input
              type={f.type}
              value={f.value}
              onChange={f.onChange || ((e) => f.setValue(e.target.value))}
              required
              className={`border ${
                f.error ? "border-red-500" : "border-gray-300"
              } rounded-lg px-3 py-2 w-full outline-indigo-500`}
            />
            {f.error && <p className="text-red-500 text-sm mt-1">{f.error}</p>}
          </div>
        ))}
        <button
          type="submit"
          disabled={loading || phoneError || membershipError}
          className={`w-full py-2 rounded-lg text-white transition ${
            loading || phoneError || membershipError
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {loading ? "Creating..." : "Submit"}
        </button>
      </form>
    </div>
  );
};

export default CreateProfile;