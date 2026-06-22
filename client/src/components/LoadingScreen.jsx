// client/src/components/LoadingScreen.jsx
import React from "react";

const LoadingScreen = () => {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#ffffff",
      zIndex: 9999,
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>

        <span style={{
          fontSize: "18px",
          letterSpacing: "0.22em",
          color: "#9ca3af",
          fontFamily: "inherit",
          animation: "gohs-in 0.8s ease both",
        }}>
          GOMCS
        </span>

        <div style={{ width: "60px", height: "1px", background: "#f3f4f6", overflow: "hidden" }}>
          <div style={{
            width: "100%",
            height: "100%",
            background: "#534AB7",
            animation: "gohs-line 1.6s cubic-bezier(0.76,0,0.24,1) infinite",
          }} />
        </div>

      </div>

      <style>{`
        @keyframes gohs-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes gohs-line {
          0%    { transform: scaleX(0); transform-origin: left; }
          50%   { transform: scaleX(1); transform-origin: left; }
          50.1% { transform: scaleX(1); transform-origin: right; }
          100%  { transform: scaleX(0); transform-origin: right; }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;