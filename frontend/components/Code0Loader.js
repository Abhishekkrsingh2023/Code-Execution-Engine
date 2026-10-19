"use client";

import React from "react";

export default function Code0Loader({
  text = "Loading Code0 environment...",
  fullscreen = true,
  fading = false,
  className = "",
}) {
  const containerClasses = fullscreen
    ? `fixed inset-0 z-[9999] bg-[#07090e]/95 backdrop-blur-md flex flex-col items-center justify-center transition-all duration-500 ease-out ${
        fading ? "opacity-0 pointer-events-none scale-98" : "opacity-100 scale-100"
      }`
    : `flex flex-col items-center justify-center p-6 ${className}`;

  return (
    <div id="code0Loader" className={containerClasses} aria-live="polite" role="status">
      {/* Ambient background glow behind the card */}
      <div
        className="absolute w-72 h-72 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Loader Card */}
      <div className="relative z-10 bg-[#0e1322]/90 border border-white/10 rounded-2xl px-8 py-7 text-center shadow-2xl shadow-black/80 backdrop-blur-xl min-w-[280px] sm:min-w-[340px] overflow-hidden">
        {/* Subtle Brand Tag */}
        <div className="flex items-center justify-center gap-1.5 mb-5 opacity-90">
          <span className="text-indigo-400 font-mono font-bold text-sm">&lt;/&gt;</span>
          <span className="text-white font-bold text-sm tracking-tight">Code0</span>
        </div>

        {/* Bouncing Doodle Dots with Ground Shadows */}
        <div className="relative mb-5 pt-6 pb-2">
          {/* Dots row */}
          <div className="flex gap-4 justify-center items-center">
            <div className="doodle-dot dot-1" />
            <div className="doodle-dot dot-2" />
            <div className="doodle-dot dot-3" />
          </div>

          {/* Corresponding shadows row */}
          <div className="flex gap-4 justify-center items-center mt-2">
            <div className="dot-shadow shadow-1" />
            <div className="dot-shadow shadow-2" />
            <div className="dot-shadow shadow-3" />
          </div>
        </div>

        {/* Status Text */}
        <p className="font-mono text-xs sm:text-sm text-slate-300 font-medium tracking-wide flex items-center justify-center gap-1">
          <span>{text}</span>
        </p>

        {/* Shimmering Progress Bar */}
        <div className="mt-5 w-full h-[2px] bg-slate-800/80 rounded-full overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-400 to-transparent w-full animate-[loaderShimmer_1.6s_infinite_linear]" />
        </div>
      </div>
    </div>
  );
}
