import React from "react";
import { assets } from '../../assets/assets'
import { UserButton } from "@clerk/clerk-react";
import { Link, useNavigate } from "react-router-dom";

const Navbar = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-4 md:px-8 border-b border-gray-300 py-3 bg-white transition-all duration-300">
      <Link to="/admin" className="flex items-center gap-2">
        <img src={assets.logoScrolled} alt="Logo" className="h-9 opacity-80" />
        
      </Link>
      <div className="flex items-center gap-4">
        <Link
          to="/admin"
          className="text-[var(--color-primary)] font-medium hover:text-blue-700 transition-all"
        >
          Dashboard
        </Link>
        <UserButton afterSignOut={() => navigate("/")} />
      </div>
    </div>
  );
};

export default Navbar;