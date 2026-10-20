"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import heroImage from "@/assets/hero-image.png";
import Code0Loader from "@/components/Code0Loader";

const SUPPORTED_LANGUAGES = [
  { name: "Python", icon: "/languages/python.png" },
  { name: "C", icon: "/languages/c.png" },
  { name: "C++", icon: "/languages/c-.png" },
  { name: "Java", icon: "/languages/java.png" },
  { name: "JavaScript", icon: "/languages/java-script.png" },
];

function LanguageCard({ name, icon, isMore = false }) {
  if (isMore) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0a0d14] border border-white/[0.08] hover:border-white/20 hover:text-white transition-all text-sm font-medium text-slate-400 cursor-default shadow-sm shadow-black/40">
        <span>+ More</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#0a0d14] border border-white/[0.08] hover:border-white/[0.16] hover:bg-[#0d111c] transition-all duration-200 text-sm font-medium text-white shadow-sm shadow-black/40 group">
      <div className="w-5 h-5 relative flex items-center justify-center shrink-0">
        <Image
          src={icon}
          alt={`${name} logo`}
          width={20}
          height={20}
          className="w-5 h-5 object-contain group-hover:scale-110 transition-transform duration-200"
        />
      </div>
      <span>{name}</span>
    </div>
  );
}

export default function LandingPage() {
  const [loading, setLoading] = useState(true);
  const [fading, setFading] = useState(false);

  // Initial loading transition
  useEffect(() => {
    let isMounted = true;

    const fadeTimer = setTimeout(() => {
      if (isMounted) setFading(true);
    }, 200);

    const doneTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
      {/* Code0 Doodle Loading Screen */}
      {loading && <Code0Loader fading={fading} fullscreen={true} />}

      {/* Background ambient lighting glows */}
      <div
        className="fixed top-0 right-0 w-[600px] h-[550px] bg-indigo-600/[0.12] rounded-full blur-[140px] pointer-events-none -z-10 transform translate-x-1/4 -translate-y-1/4"
        aria-hidden="true"
      />
      <div
        className="fixed top-1/3 left-0 w-[500px] h-[500px] bg-purple-600/[0.08] rounded-full blur-[140px] pointer-events-none -z-10 transform -translate-x-1/3"
        aria-hidden="true"
      />
      <div
        className="fixed bottom-10 right-1/4 w-[450px] h-[450px] bg-blue-600/[0.06] rounded-full blur-[120px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      {/* --- HERO SECTION --- */}
      <section className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6 sm:py-10 lg:py-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center my-auto">
          {/* Left Column */}
          <div className="lg:col-span-5 flex flex-col items-start text-left z-10">
            {/* Tag Badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-xs font-medium text-slate-300 mb-6 backdrop-blur-md">
              <span>Fast</span>
              <span className="text-slate-600 text-[10px]">•</span>
              <span>Secure</span>
              <span className="text-slate-600 text-[10px]">•</span>
              <span>Scalable</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-black text-white tracking-tight leading-[1.08] mb-6">
              Your Code,
              <br />
              <span className="bg-gradient-to-r from-[#6366f1] via-[#818cf8] to-[#a855f7] bg-clip-text text-transparent">
                We Execute
              </span>{" "}
              Anywhere.
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-400 font-normal leading-relaxed mb-8 max-w-md">
              Code0 is a powerful, secure, and scalable code execution platform built for developers to write, test, and run code across multiple languages.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 mb-9">
              <Link
                href="/problems"
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 active:scale-98"
              >
                <span>Try It Now</span>
                <span className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
              {/* <a
                href="#features"
                className="inline-flex items-center px-6 py-3 rounded-full bg-[#0e1320] hover:bg-[#141b2c] border border-white/10 hover:border-white/20 text-slate-200 font-medium text-sm transition-all shadow-sm"
              >
                View Docs
              </a> */}
            </div>

            {/* Social Proof Dev Avatars */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <div className="w-7 h-7 rounded-full border-2 border-[#07090e] bg-indigo-500/80 flex items-center justify-center text-[10px] font-bold text-white shadow-sm overflow-hidden">
                  <svg
                    className="w-full h-full text-slate-300 bg-slate-800 p-0.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <div className="w-7 h-7 rounded-full border-2 border-[#07090e] bg-purple-500/80 flex items-center justify-center text-[10px] font-bold text-white shadow-sm overflow-hidden">
                  <svg
                    className="w-full h-full text-indigo-300 bg-indigo-950 p-0.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <div className="w-7 h-7 rounded-full border-2 border-[#07090e] bg-blue-500/80 flex items-center justify-center text-[10px] font-bold text-white shadow-sm overflow-hidden">
                  <svg
                    className="w-full h-full text-purple-300 bg-purple-950 p-0.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                Built for developers, by developers.
              </span>
            </div>
          </div>

          {/* Right Column: Hero Window Image */}
          <div className="lg:col-span-7 relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-2xl">
              {/* Vibrant ambient backdrop glow behind the window */}
              <div
                className="absolute -inset-4 bg-gradient-to-tr from-indigo-600/30 via-purple-600/25 to-blue-500/20 rounded-3xl blur-2xl -z-10 opacity-80"
                aria-hidden="true"
              />

              {/* Window Frame Container */}
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.1] shadow-2xl shadow-indigo-950/40 bg-[#0a0d14] backdrop-blur-sm transition-transform duration-300 hover:scale-[1.01]">
                <Image
                  src={heroImage}
                  alt="Code0 Interactive Code Execution IDE Mockup"
                  priority
                  fetchPriority="high"
                  className="w-full h-auto block select-none pointer-events-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Subtle scroll down indicator */}
        <div className="hidden sm:flex justify-center pt-2 pb-1">
          <a
            href="#features"
            className="inline-flex flex-col items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors group"
            aria-label="Scroll to features"
          >
            <span className="text-[10px] uppercase tracking-widest text-slate-500 group-hover:text-slate-400">
              Scroll to explore
            </span>
            <svg
              className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </a>
        </div>
      </section>

      {/* --- FEATURES SECTION --- */}
      <section
        id="features"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 w-full border-t border-white/[0.04] scroll-mt-16"
      >
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase block mb-3">
            FEATURES
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
            Everything You Need for Safe and Fast Code Execution
          </h2>
          <p className="text-sm text-slate-400 mt-3 max-w-lg mx-auto">
            Engineered for high performance, isolation and instant developer feedback.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1 */}
          <div className="bg-[#0a0d14] hover:bg-[#0d111c] border border-white/[0.08] hover:border-white/[0.16] rounded-2xl p-6 transition-all duration-200 group flex flex-col justify-start shadow-lg shadow-black/40 hover:shadow-indigo-950/20">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              {/* Lightning Zap Icon */}
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white mb-2 tracking-tight">
              Multi-Language Support
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Run code in Python, C, C++, Java and more. No setup, no hassle.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-[#0a0d14] hover:bg-[#0d111c] border border-white/[0.08] hover:border-white/[0.16] rounded-2xl p-6 transition-all duration-200 group flex flex-col justify-start shadow-lg shadow-black/40 hover:shadow-indigo-950/20">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              {/* Shield Icon */}
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white mb-2 tracking-tight">
              Secure Sandboxing
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Your code runs in isolated containers with strict resource limits.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-[#0a0d14] hover:bg-[#0d111c] border border-white/[0.08] hover:border-white/[0.16] rounded-2xl p-6 transition-all duration-200 group flex flex-col justify-start shadow-lg shadow-black/40 hover:shadow-indigo-950/20">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              {/* Cloud Icon */}
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white mb-2 tracking-tight">
              Async & Real-time
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Get results instantly with live logs, streams and job status.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-[#0a0d14] hover:bg-[#0d111c] border border-white/[0.08] hover:border-white/[0.16] rounded-2xl p-6 transition-all duration-200 group flex flex-col justify-start shadow-lg shadow-black/40 hover:shadow-indigo-950/20">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              {/* Database Layers Icon */}
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white mb-2 tracking-tight">
              Redis + Postgres
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Built for scale with reliable queues, storage and synchronization.
            </p>
          </div>
        </div>
      </section>

      {/* --- SUPPORTED LANGUAGES SECTION --- */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 w-full text-center border-t border-white/[0.04]">
        <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase block mb-3">
          SUPPORTED LANGUAGES
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-8">
          Code in Your Favorite Runtime
        </h2>

        <div className="flex flex-wrap items-center justify-center gap-3.5 max-w-4xl mx-auto">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <LanguageCard key={lang.name} name={lang.name} icon={lang.icon} />
          ))}
          <LanguageCard isMore />
        </div>
      </section>

      {/* --- STATS / BENCHMARK SECTION --- */}
      <section
        id="performance"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 w-full border-t border-white/[0.04] scroll-mt-16"
      >
        <div className="relative rounded-2xl border border-white/[0.08] bg-[#0a0d14]/90 p-7 sm:p-10 backdrop-blur-md overflow-hidden shadow-xl shadow-black/50">
          {/* Subtle grid pattern background */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
              backgroundSize: "32px 32px",
            }}
            aria-hidden="true"
          />

          {/* 4 Stats Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {/* Stat 1: Fast Execution */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">
                  Fast Execution
                </div>
                <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                  ~ 1.5 ms
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  average response time
                </div>
              </div>
            </div>

            {/* Stat 2: High Throughput */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">
                  High Throughput
                </div>
                <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                  69k+
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  requests per second (local benchmark)
                </div>
              </div>
            </div>

            {/* Stat 3: Secure by Design */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">
                  Secure by Design
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
                  Resource limits
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  CPU • Memory • Network
                </div>
              </div>
            </div>

            {/* Stat 4: Built for Developers */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">
                  Built for Developers
                </div>
                <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                  Simple API
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Easy to integrate
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="mt-auto max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10 w-full border-t border-white/[0.06]">
        {/* Top Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8">
          {/* Logo & Tagline */}
          <div className="flex flex-col items-center md:items-start">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-indigo-400 font-mono font-bold text-xl group-hover:text-indigo-300 transition-colors">
                &lt;/&gt;
              </span>
              <span className="text-white font-bold text-lg tracking-tight">
                Code0
              </span>
            </Link>
            <span className="text-xs text-slate-500 mt-1">
              Execute. Build. Repeat.
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <a href="#features" className="hover:text-white transition-colors">
              Docs
            </a>
            <a href="#performance" className="hover:text-white transition-colors">
              API
            </a>
            <a
              href="https://github.com/Abhishekkrsingh2023/Code-Execution-Engine"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>

          {/* Social Icons */}
          <div className="flex items-center gap-4 text-slate-400">
            {/* GitHub */}
            <a
              href="https://github.com/Abhishekkrsingh2023/Code-Execution-Engine"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors p-1"
              aria-label="GitHub Repository"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            </a>

            {/* Discord */}
            <a
              href="https://discord.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors p-1"
              aria-label="Discord Community"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </a>

            {/* X / Twitter */}
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors p-1"
              aria-label="X (formerly Twitter)"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/[0.04] text-xs text-slate-500">
          <div>© 2026 Code0. All rights reserved.</div>
          <div className="flex items-center gap-1.5">
            <span>Made with</span>
            <span className="text-purple-400">💜</span>
            <span>for developers</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
