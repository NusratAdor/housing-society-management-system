// client/src/pages/SignIn.jsx

import { SignIn } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import usePageTitle from "../hooks/usePageTitle";

const SignInPage = () => {
  const { t } = useTranslation("navbar");
  usePageTitle(t("signIn")); // "Sign In | GOHS" or "সাইন ইন | GOHS"

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignIn
        routing="path"
        path="/sign-in"
        fallbackRedirectUrl="/dashboard"
        signUpUrl="/sign-up"
      />
    </div>
  );
};

export default SignInPage;