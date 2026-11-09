import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Code2, ShieldCheck, Zap } from "lucide-react";
import { Footer } from "@/components/shared/footer";
import { serverFetch } from "@/lib/api/client";
import type { ProblemListResponse } from "@/types/problem";

const RUNTIMES = [
  { name: "Python", icon: "/languages/python.png" },
  { name: "C++", icon: "/languages/cpp.png" },
  { name: "Java", icon: "/languages/java.png" },
  { name: "C", icon: "/languages/c.png" },
];

export default async function LandingPage() {
  let totalProblems = 0;
  try {
    const data = await serverFetch<ProblemListResponse>("/api-v1/problems?limit=1", {
      next: { revalidate: 60 },
    });
    totalProblems = data.total || 0;
  } catch {
    // Backend unreachable or empty during initial setup
  }

  return (
    <div className="flex-1 flex flex-col justify-between overflow-y-auto">
      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 lg:px-8 py-16 sm:py-24 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Value Proposition */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--muted-foreground)] mb-6 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-pulse" />
              <span>Isolated Sandboxing</span>
              <span className="text-[var(--border)]">•</span>
              <span>Multi-Language</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-6 text-[var(--foreground)]">
              Your Code,
              <br />
              <span className="text-[var(--brand)]">We Execute</span> Anywhere.
            </h1>

            <p className="text-base sm:text-lg text-[var(--muted-foreground)] leading-relaxed mb-8 max-w-xl">
              Code0 is a powerful, secure, and scalable code execution platform built for developers to write, test, and run code across multiple languages.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-10">
              <Link
                href="/problems"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[var(--brand)] text-[var(--brand-foreground)] font-semibold text-sm hover:opacity-90 transition-opacity shadow-xs"
              >
                <span>Start solving</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/problems"
                className="inline-flex items-center px-5 py-2.5 rounded-md border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-[var(--foreground)] text-sm font-medium transition-colors"
              >
                Browse problems
              </Link>
            </div>

            {/* Supported Runtimes */}
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-3">
                Supported Runtimes
              </div>
              <div className="flex flex-wrap gap-2.5">
                {RUNTIMES.map((rt) => (
                  <div
                    key={rt.name}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--foreground)]"
                  >
                    <Image
                      src={rt.icon}
                      alt={`${rt.name} icon`}
                      width={16}
                      height={16}
                      className="w-4 h-4 object-contain"
                    />
                    <span>{rt.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Code Editor Preview */}
          <div className="lg:col-span-5 w-full">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-md overflow-hidden">
              {/* Window Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--muted)]/40 text-xs font-mono text-[var(--muted-foreground)]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-sans font-medium text-[var(--foreground)]">solution.py</span>
                </div>
                <span>Python 3.12</span>
              </div>

              {/* Code snippet */}
              <div className="p-4 font-mono text-xs leading-relaxed text-[var(--foreground)] overflow-x-auto bg-[var(--card)]">
                <pre>
                  <code>
                    <span className="text-[var(--muted-foreground)]"># Two Sum — Optimal O(N) Hash Map Solution</span>
                    {"\n"}
                    <span className="text-[var(--brand)]">def</span>{" "}
                    <span className="text-emerald-500 font-semibold">two_sum</span>(nums: list[int], target: int) -&gt; list[int]:
                    {"\n"}    seen = &#123;&#125;
                    {"\n"}    <span className="text-[var(--brand)]">for</span> i, val <span className="text-[var(--brand)]">in</span> enumerate(nums):
                    {"\n"}        diff = target - val
                    {"\n"}        <span className="text-[var(--brand)]">if</span> diff <span className="text-[var(--brand)]">in</span> seen:
                    {"\n"}            <span className="text-[var(--brand)]">return</span> [seen[diff], i]
                    {"\n"}        seen[val] = i
                    {"\n"}    <span className="text-[var(--brand)]">return</span> []
                  </code>
                </pre>
              </div>

              {/* Execution preview bar */}
              <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[var(--muted)]/30 flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-500 font-medium">✓ Accepted</span>
                <span className="text-[var(--muted-foreground)]">Runtime: 1.2 ms</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-[var(--border)] bg-[var(--card)]/30 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 text-left max-w-xl">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--foreground)]">
              Engineered for developer feedback and reliability
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[var(--muted-foreground)]">
              Core platform capabilities without unverified claims or synthetic marketing metrics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-lg border border-[var(--border)] bg-[var(--card)] flex flex-col items-start">
              <div className="w-8 h-8 rounded-md bg-[var(--brand-subtle)] text-[var(--brand)] flex items-center justify-center mb-4">
                <Code2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">
                Multi-Language Support
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Execute code across C, C++, Java, and Python 3 without local toolchain or environment configuration.
              </p>
            </div>

            <div className="p-5 rounded-lg border border-[var(--border)] bg-[var(--card)] flex flex-col items-start">
              <div className="w-8 h-8 rounded-md bg-[var(--brand-subtle)] text-[var(--brand)] flex items-center justify-center mb-4">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">
                Isolated Sandboxing
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Submissions run in dedicated containers with enforced CPU time, memory limits, and process isolation.
              </p>
            </div>

            <div className="p-5 rounded-lg border border-[var(--border)] bg-[var(--card)] flex flex-col items-start">
              <div className="w-8 h-8 rounded-md bg-[var(--brand-subtle)] text-[var(--brand)] flex items-center justify-center mb-4">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">
                Async Job Evaluation
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Asynchronous worker queues evaluate each test case individually and return detailed verdicts.
              </p>
            </div>
          </div>

          {/* Truthful platform stat if available */}
          {totalProblems > 0 && (
            <div className="mt-10 pt-6 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--muted-foreground)]">
              <span>Platform Archive Status</span>
              <span className="font-mono font-medium text-[var(--foreground)]">
                {totalProblems} algorithmic challenge{totalProblems > 1 ? "s" : ""} available
              </span>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

