import React from "react";
import { SignUp as ClerkSignUp } from "@clerk/clerk-react";
import Title from "../components/Title";

const SignUp = () => {
  return (
    <div className="w-full bg-white py-20 min-h-screen flex items-center justify-center">
      <div className="max-w-7xl mx-auto px-4 md:px-8 text-center">
        <Title
          title="Join Harmony Society"
          subTitle="Create your account to become a member and access community services."
        />
        <div className="mt-8 flex justify-center">
          <ClerkSignUp
            path="/sign-up"
            routing="path"
            signInUrl="/sign-in"
            redirectUrl="/" // Redirect to home
            appearance={{
              elements: {
                formButtonPrimary: "bg-[var(--color-primary)] hover:bg-blue-700 text-white rounded-md py-2 px-4",
                card: "border border-gray-200 rounded-md shadow-sm",
                headerTitle: "font-playfair text-2xl font-bold text-gray-800",
                headerSubtitle: "text-gray-600",
                formFieldInput: "border border-gray-300 rounded-md p-2",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default SignUp;