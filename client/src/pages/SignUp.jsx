// client/src/pages/SignUp.jsx

import { SignUp } from "@clerk/clerk-react";
import usePageTitle from "../hooks/usePageTitle";

const SignUpPage = () => {
  usePageTitle("Sign Up | GOHS");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignUp
        routing="path"
        path="/sign-up"
        fallbackRedirectUrl="/create-profile"
        signInUrl="/sign-in"
      />
    </div>
  );
};

export default SignUpPage;

