// client/src/components/StaffAccessRevokedScreen.jsx
//
// Shown to a signed-in user whose staff access was revoked. They are not a
// member, so they must not be sent to the member registration form.

import React from "react";
import { useClerk } from "@clerk/clerk-react";

const StaffAccessRevokedScreen = () => {
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <h2 className="font-playfair text-lg font-semibold text-gray-800 mb-2">
          Staff Access Removed
        </h2>
        <p className="text-sm text-gray-500">
          Your staff access to this site has been removed. If you believe this
          is a mistake, please contact the Society office.
        </p>
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: "/" })}
          className="mt-6 rounded-lg bg-gray-800 px-5 py-2 text-sm font-medium text-white hover:bg-gray-900"
        >
          Sign out
        </button>
      </div>
    </div>
  );
};

export default StaffAccessRevokedScreen;