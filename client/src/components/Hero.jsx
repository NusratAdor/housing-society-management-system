import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";

const Hero = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  return (
    <div className="relative h-screen w-full">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-[url('/src/assets/heroImage1.jpg')] bg-cover bg-center bg-no-repeat"
        style={{ filter: "brightness(60%)" }} // Darken the image
      ></div>

      {/* Overlay content */}
      <div
        className="
          relative z-10 w-full max-w-7xl mx-auto 
          flex flex-col h-full px-4 md:px-8
          items-center justify-center
          md:items-start md:justify-center text-center md:text-left
          text-black
        "
      >
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="font-playfair font-bold md:font-extrabold text-2xl sm:text-4xl md:text-5xl md:text-[56px] md:leading-[56px] max-w-xl mt-4 text-white"
        >
          Government Officer's Housing Society (GOHS)
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mt-2 max-w-lg text-sm md:text-base text-white"
        >
          Connect with your community, manage your membership, track payments,
          view notices, and stay updated — all in one secure platform designed
          for our 500+ society members.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          onClick={() => navigate(user ? "/dashboard" : "/sign-up")}
          className="mt-8 mb-6 flex items-center space-x-2 border border-white text-white text-xs rounded-full px-4 pr-1.5 py-1.5 hover:bg-[#2E8B57] transition font-outfit"
          type="button"
        >
          <span>
            {user ? "Go to Dashboard" : "Join or Log In to Get Started"}
          </span>
          <span className="flex items-center justify-center size-6 p-1 rounded-full bg-[#2E8B57]">
            <svg
              width="14"
              height="11"
              viewBox="0 0 16 13"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 6.5h14M9.5 1 15 6.5 9.5 12"
                stroke="#fff"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </motion.button>
      </div>
    </div>
  );
};

export default Hero;
