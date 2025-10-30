import React from "react";
import { SignIn as ClerkSignIn } from "@clerk/clerk-react";
import Title from "../components/Title";

const SignIn = () => {
  return (
    <div className="w-full bg-white py-20 min-h-screen flex items-center justify-center">
      <div className="max-w-7xl mx-auto px-4 md:px-8 text-center">
        <Title
          title="Sign In to Harmony Society"
          subTitle="Access your member or admin dashboard to manage your profile, view notices, and more."
        />
        <div className="mt-8 flex justify-center">
          <ClerkSignIn
            appearance={{
              elements: {
                formButtonPrimary: "bg-[var(--color-primary)] hover:bg-blue-700 text-white rounded-md py-2 px-4",
                card: "border border-gray-200 rounded-md shadow-sm",
                headerTitle: "font-playfair text-2xl font-bold text-gray-800",
                headerSubtitle: "text-gray-600",
                formFieldInput: "border border-gray-300 rounded-md p-2",
              },
            }}
            redirectUrl="/" // Redirect to home
          />
        </div>
      </div>
    </div>
  );
};

export default SignIn;