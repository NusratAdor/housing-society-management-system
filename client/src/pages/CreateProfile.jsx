import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { useUser } from "@clerk/clerk-react";
import { useAppContext } from "../context/AppContext";

const CreateProfile = () => {
  const { getToken, navigate, axios, setMemberProfile } = useAppContext();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [designation, setDesignation] = useState("");
  const [membershipNo, setMembershipNo] = useState("");
  const [plotNo, setPlotNo] = useState("");
  const [phoneError, setPhoneError] = useState(""); // Track real-time phone error

  const validatePhone = (input) => {
    const normalizedPhone = input.replace(/[\s-+]/g, "").replace(/^\+880/, "");
    const phoneRegex = /^(013|014|015|016|017|018|019)\d{0,8}$/;
    if (!input) {
      setPhoneError(""); // Clear error if empty
      return true;
    }
    if (!phoneRegex.test(normalizedPhone)) {
      setPhoneError("Please enter a valid mobile number");
      return false;
    }
    setPhoneError(""); // Clear error if valid
    return true;
  };

  const validateForm = () => {
    const normalizedPhone = phone.replace(/[\s-+]/g, "").replace(/^\+880/, "");
    const phoneRegex = /^(013|014|015|016|017|018|019)\d{8}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      toast.error("Phone number must be a valid 11-digit Bangladeshi mobile number");
      return false;
    }
    if (!/^[A-Za-z0-9-]+$/.test(membershipNo)) {
      toast.error("Membership number must contain only letters, numbers, or hyphens");
      return false;
    }
    return true;
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    setPhone(value);
    validatePhone(value); // Validate in real-time
  };

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    if (loading || phoneError) return;
    if (!validateForm()) return;
    setLoading(true);

    try {
      const token = await getToken();
      const email = user?.emailAddresses[0]?.emailAddress;
      if (!email) {
        throw new Error("No email address found in Clerk profile");
      }
      const normalizedPhone = phone.replace(/[\s-+]/g, "").replace(/^\+880/, "");
      const formData = { name, email, phone: normalizedPhone, address, designation, membershipNo, plotNo };
      const { data } = await axios.post("/api/members", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        toast.success(data.message || "Profile created successfully!");
        setMemberProfile(data.member);
        navigate("/dashboard");
      } else {
        toast.error(data.message || "Could not create profile");
        setLoading(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Error creating profile");
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 px-4">
      <form
        onSubmit={onSubmitHandler}
        className="bg-white shadow-lg rounded-xl p-8 w-full max-w-2xl"
      >
        <h2 className="text-2xl font-semibold mb-6 text-center">
          🏡 Create Your Member Profile
        </h2>

        {[
          { label: "Full Name", value: name, setValue: setName, type: "text" },
          {
            label: "Phone Number",
            value: phone,
            setValue: setPhone,
            type: "tel",
            
            error: phoneError,
          },
          { label: "Address", value: address, setValue: setAddress, type: "text" },
          { label: "Designation", value: designation, setValue: setDesignation, type: "text" },
          { label: "Membership No", value: membershipNo, setValue: setMembershipNo, type: "text" },
          { label: "Plot No", value: plotNo, setValue: setPlotNo, type: "text" },
        ].map((f) => (
          <div key={f.label} className="mb-4">
            <label className="block text-gray-700 mb-1">{f.label}</label>
            <input
              type={f.type}
              value={f.value}
              onChange={f.label === "Phone Number" ? handlePhoneChange : (e) => f.setValue(e.target.value)}
              required
              placeholder={f.placeholder || ""}
              className={`border ${
                f.error ? "border-red-500" : "border-gray-300"
              } rounded-lg px-3 py-2 w-full outline-indigo-500`}
            />
            {f.error && <p className="text-red-500 text-sm mt-1">{f.error}</p>}
          </div>
        ))}

        <button
          type="submit"
          disabled={loading || phoneError}
          className={`w-full py-2 rounded-lg text-white transition ${
            loading || phoneError
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