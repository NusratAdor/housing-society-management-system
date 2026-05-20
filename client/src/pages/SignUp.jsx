import { SignUp } from "@clerk/clerk-react";

const SignUpPage = () => {
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