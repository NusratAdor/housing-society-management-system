import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSignUp } from "@clerk/clerk-react";
import Title from "../components/Title";

const SignUp = () => {
  const { signUp, isLoaded } = useSignUp();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    designation: "",
    email: "",
    phone: "",
    membershipNo: "",
    plotNo: "",
    paymentStatus: "Due",
    role: "member",
    password: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;

    try {
      // Create user with Clerk
      const clerkResult = await signUp.create({
        emailAddress: formData.email,
        password: formData.password,
        firstName: formData.name.split(" ")[0],
        lastName: formData.name.split(" ").slice(1).join(" ") || " ",
        unsafeMetadata: { role: formData.role }, // Use unsafeMetadata for initial role
      });

      if (clerkResult.status === "complete") {
        // Save profile to MongoDB
        const profileData = {
          clerkUserId: clerkResult.createdUserId,
          name: formData.name,
          address: formData.address,
          designation: formData.designation,
          email: formData.email,
          phone: formData.phone,
          membershipNumber: formData.membershipNo,
          plotNumber: formData.plotNo,
          paymentStatus: formData.paymentStatus,
        };

        const response = await fetch("/api/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profileData),
        });

        if (!response.ok) {
          throw new Error("Failed to save profile");
        }

        // If role is admin, require manual approval (set role to member by default)
        const role = formData.role === "admin" ? "member" : "member"; // Admin role needs approval
        await fetch("/api/clerk/update-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: clerkResult.createdUserId, role }),
        });

        // Redirect based on role
        navigate(role === "admin" ? "/admin" : "/dashboard");
      }
    } catch (err) {
      setError(err.message || "Failed to create profile");
    }
  };

  return (
    <div className="w-full bg-white py-20 min-h-screen flex items-center justify-center">
      <div className="max-w-7xl mx-auto px-4 md:px-8 text-center">
        <Title
          title="Housing Society"
          subTitle="Create your profile to become a member and access community services."
        />
        <form onSubmit={handleSubmit} className="mt-8 max-w-md mx-auto">
          {error && <p className="text-red-500 mb-4">{error}</p>}
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Designation</label>
            <input
              type="text"
              name="designation"
              value={formData.designation}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Membership Number</label>
            <input
              type="text"
              name="membershipNo"
              value={formData.membershipNo}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Plot Number</label>
            <input
              type="text"
              name="plotNo"
              value={formData.plotNo}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Payment Status</label>
            <select
              name="paymentStatus"
              value={formData.paymentStatus}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="Due">Due</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="member">Member</option>
              <option value="admin">Admin (requires approval)</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-[var(--color-primary)] text-white rounded-md py-2 px-4 font-medium hover:bg-blue-700"
          >
            Create Profile
          </button>
        </form>
      </div>
    </div>
  );
};

export default SignUp;