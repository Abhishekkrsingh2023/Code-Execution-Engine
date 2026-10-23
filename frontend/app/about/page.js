"use client";

import Image from "next/image";
import Link from "next/link";

// Extensible team configuration - add more members here to dynamically render cards
const TEAM_MEMBERS = [
  {
    id: "abhishek",
    name: "Abhishek Kumar Singh",
    handle: "@abhishek",
    role: "Lead Systems Architect & Backend Engineer",
    image: "/team/Abhishek.webp",
    bio: "Passionate about distributed systems and scalable backends. Built Code0’s Docker judge, async worker pipeline, and secure execution runtime.",
    contributions: [
      "Built a resource-limited, multi-language Docker execution sandbox",
      "Developed Redis-backed async task dispatch with distributed workers",
      "Designed secure database schemas, RBAC, and unified API contracts",
    ],
    skills: ["Python", "Nodejs", "FastAPI", "Express", "Docker", "PostgreSQL", "Redis", "Nginx"],
    socials: {
      github: "https://github.com/Abhishekkrsingh2023",
      linkedin: "#",
      email: "mailto:abhikrsingh.dev@gmail.com",
    },
  },
  {
    id: "akash",
    name: "Akash Kumar",
    handle: "@akash",
    role: "Full-Stack Product Architect",
    image: "/team/Akash.webp",
    bio: "Focused on developer experience and modern web architecture. Built Code0’s Monaco IDE, real-time leaderboard, and responsive UI.",
    contributions: [
      "Built a responsive Next.js interface.",
      "Integrated Monaco Editor, code execution, and test-case views",
      "Implemented paginated leaderboards and competitive scoring",
    ],
    skills: ["Python", "Nodejs", "Next.js", "React", ".NET", "Node.js", "UI/UX"],
    socials: {
      github: "https://github.com/godzaryan",
      linkedin: "#",
      email: "mailto:cronoquillgamers2018@gmail.com",
    },
  },
];

const PLATFORM_HIGHLIGHTS = [
  {
    title: "Isolated Container Sandbox",
    description: "Every submission executes inside a secure, pruned Docker container with strict CPU, RAM, and syscall constraints.",
    icon: (
      <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    title: "Sub-Second Response Times",
    description: "Lightweight asynchronous task orchestration powered by Redis queues delivers execution verdicts in milliseconds.",
    icon: (
      <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: "Multi-Language Ecosystem",
    description: "Native support for Python, C, C++, Java, and JavaScript with custom test case evaluation and memory profiling.",
    icon: (
      <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    title: "Competitive Leaderboard",
    description: "Real-time ranking algorithm honoring accepted solutions, runtime efficiency, and code quality across global coders.",
    icon: (
      <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white relative overflow-x-hidden">
      {/* Background ambient lighting glows */}
      <div
        className="fixed top-0 right-0 w-[550px] h-[500px] bg-indigo-600/[0.1] rounded-full blur-[140px] pointer-events-none -z-10 transform translate-x-1/4 -translate-y-1/4"
        aria-hidden="true"
      />
      <div
        className="fixed top-1/2 left-0 w-[500px] h-[500px] bg-purple-600/[0.08] rounded-full blur-[140px] pointer-events-none -z-10 transform -translate-x-1/3"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 w-full space-y-24">
        {/* HERO SECTION */}
        <section className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/50 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            About Code0 • Built for Builders
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Empowering the Next Generation of{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Problem Solvers
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
            Code0 was born from a shared conviction: competitive programming should be fast, transparent, and beautifully engineered. We built a high-performance execution engine from the bare metal up to provide instant feedback and uncompromised security.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/problems"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40"
            >
              Start Solving Problems
            </Link>
            <Link
              href="/leaderboard"
              className="px-6 py-3 rounded-xl bg-[#0a0d14] border border-white/[0.08] hover:border-white/20 text-slate-300 hover:text-white font-semibold text-sm transition-all shadow-sm shadow-black/40"
            >
              View Leaderboard
            </Link>
          </div>
        </section>

        {/* PLATFORM HIGHLIGHTS GRID */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
              Core Architecture
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Engineered with Precision & Power
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLATFORM_HIGHLIGHTS.map((item, index) => (
              <div
                key={index}
                className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-6 hover:border-white/[0.16] shadow-lg shadow-black/40 transition-all duration-300 hover:-translate-y-1 group"
              >
                <div className="p-3 w-fit rounded-xl bg-[#080b13] border border-white/10 mb-4 group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* MEET THE DEVELOPERS SECTION */}
        <section id="meet-the-developers" className="space-y-12">
          <div className="text-center space-y-3">
            <div className="inline-block px-3 py-1 rounded-full bg-purple-950/40 border border-purple-500/20 text-purple-300 text-xs font-semibold uppercase tracking-wider">
              The Minds Behind Code0
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Meet the Developers
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
              We are a two-person engineering squad obsessed with high-performance code, clean abstractions, and delightful developer experiences.
            </p>
          </div>

          {/* Extensible Developer Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {TEAM_MEMBERS.map((member) => (
              <div
                key={member.id}
                className="bg-[#0a0d14] border border-white/[0.08] hover:border-white/[0.16] rounded-2xl p-6 sm:p-8 transition-all duration-300 shadow-xl shadow-black/40 hover:shadow-indigo-500/10 flex flex-col justify-between group"
              >
                <div className="space-y-6">
                  {/* Developer Card Header */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-white/[0.12] group-hover:border-indigo-400/50 transition-colors shrink-0 shadow-lg shadow-black/60">
                      <Image
                        src={member.image}
                        alt={`${member.name} avatar`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 96px, 112px"
                      />
                    </div>

                    <div className="text-center sm:text-left space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <h3 className="text-xl font-bold text-white tracking-tight">
                          {member.name}
                        </h3>
                        {/* <span className="px-2.5 py-0.5 rounded-full bg-indigo-900/50 border border-indigo-500/30 text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                          {member.roleBadge}
                        </span> */}
                      </div>
                      <p className="text-xs font-mono text-indigo-400">{member.handle}</p>
                      <p className="text-xs sm:text-sm font-semibold text-slate-300">
                        {member.role}
                      </p>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-white/[0.06] pt-4">
                    {member.bio}
                  </p>

                  {/* Key Contributions */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Key Contributions
                    </h4>
                    <ul className="space-y-1.5">
                      {member.contributions.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                          <span className="text-indigo-400 font-bold shrink-0">▹</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Skills Chips */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Specialties
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {member.skills.map((skill, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-[#080b13] border border-white/[0.08] text-[11px] text-slate-300 font-mono font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Socials */}
                <div className="pt-6 mt-6 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Connect</span>
                  <div className="flex items-center gap-3">
                    {member.socials.github && (
                      <a
                        href={member.socials.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-[#080b13] border border-white/10 text-slate-400 hover:text-white hover:border-indigo-500/50 transition-colors"
                        title="GitHub Profile"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                        </svg>
                      </a>
                    )}
                    {member.socials.email && (
                      <a
                        href={member.socials.email}
                        className="p-2 rounded-lg bg-[#080b13] border border-white/10 text-slate-400 hover:text-white hover:border-indigo-500/50 transition-colors"
                        title="Send Email"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CALL TO ACTION BANNER */}
        <section className="bg-gradient-to-r from-indigo-950/40 via-[#0a0d14] to-purple-950/30 border border-white/[0.08] rounded-2xl p-8 sm:p-12 text-center space-y-6 shadow-xl shadow-black/40">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Ready to test your algorithms?
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
            Experience lightning-fast code evaluation, compete with developers around the globe, and climb the Code0 leaderboard today.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/problems"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/30 active:scale-98"
            >
              Browse Problem Library
            </Link>
            <Link
              href="/register"
              className="px-6 py-3 rounded-xl bg-[#0a0d14] border border-white/[0.08] hover:border-white/20 text-slate-200 hover:text-white font-semibold text-sm transition-all shadow-sm"
            >
              Create Account
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
