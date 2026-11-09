import Link from "next/link";
import { Trophy, Calendar, Users, ArrowRight, Clock, CheckCircle } from "lucide-react";
import { listContests } from "@/lib/api/contests";
import { ContestStatusBadge } from "./_components/contest-status-badge";
import { CountdownTimer } from "./_components/countdown-timer";
import { formatDate, formatDuration } from "@/lib/utils";
import type { ContestResponse } from "@/types/contest";

export const dynamic = "force-dynamic";

export default async function ContestsPage() {
  let contests: ContestResponse[] = [];
  let serverTime = new Date().toISOString();
  let fetchError = false;

  try {
    const res = await listContests({ limit: 50 });
    contests = res.contests;
    serverTime = res.server_time;
  } catch {
    fetchError = true;
  }

  const liveContests = contests.filter((c) => c.status === "live");
  const upcomingContests = contests.filter((c) => c.status === "upcoming");
  const endedContests = contests.filter((c) => c.status === "ended");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Header */}
      <div className="border-b border-[var(--border)] pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
              Contests
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Compete against other developers in timed ICPC-style programming challenges.
            </p>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="p-4 rounded-lg border border-red-900/50 bg-red-950/20 text-xs text-red-400">
          Failed to load contests. Please check connection to the backend.
        </div>
      )}

      {/* Live Contests Section */}
      {liveContests.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h2 className="text-base font-bold text-[var(--foreground)] uppercase tracking-wider">
              Live Contests
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveContests.map((c) => (
              <Link
                key={c.id}
                href={`/contests/${c.id}`}
                className="group relative block rounded-xl border-2 border-emerald-500/40 bg-emerald-950/10 hover:bg-emerald-950/20 transition-all p-5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <ContestStatusBadge status={c.status} />
                      {c.is_registered && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <CheckCircle className="h-3 w-3" />
                          Registered
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-[var(--foreground)] group-hover:text-emerald-400 transition-colors">
                      {c.title}
                    </h3>
                    {c.description && (
                      <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">
                        {c.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-emerald-500/20 flex flex-wrap items-center justify-between text-xs text-[var(--muted-foreground)] gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-emerald-400" />
                      Ends in:{" "}
                      <CountdownTimer
                        targetTime={c.end_time}
                        serverTime={serverTime}
                        className="text-emerald-400 ml-1 font-mono"
                      />
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {c.participant_count}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                    Enter Lobby
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Contests Section */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-[var(--foreground)] uppercase tracking-wider">
          Upcoming Contests
        </h2>

        {upcomingContests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-xs text-[var(--muted-foreground)]">
            No upcoming contests scheduled right now. Check back soon!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingContests.map((c) => (
              <Link
                key={c.id}
                href={`/contests/${c.id}`}
                className="group block rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--brand)]/50 transition-all p-5 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <ContestStatusBadge status={c.status} />
                  {c.is_registered && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle className="h-3 w-3" />
                      Registered
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-[var(--foreground)] group-hover:text-[var(--brand)] transition-colors line-clamp-1">
                  {c.title}
                </h3>
                {c.description && (
                  <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 mt-1">
                    {c.description}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-[var(--border)] space-y-1.5 text-xs text-[var(--muted-foreground)]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(c.start_time)}
                    </span>
                    <span>{formatDuration(c.duration_seconds)}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1 text-amber-400 font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      <CountdownTimer
                        targetTime={c.start_time}
                        serverTime={serverTime}
                        className="text-amber-400 font-mono"
                      />
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {c.participant_count} registered
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Past Contests Section */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-[var(--foreground)] uppercase tracking-wider">
          Past Contests
        </h2>

        {endedContests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-xs text-[var(--muted-foreground)]">
            No past contests yet.
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <div className="divide-y divide-[var(--border)]">
              {endedContests.map((c) => (
                <Link
                  key={c.id}
                  href={`/contests/${c.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-[var(--accent)] transition-colors gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[var(--muted-foreground)]">
                        #{c.id}
                      </span>
                      <h4 className="text-sm font-semibold text-[var(--foreground)] hover:underline">
                        {c.title}
                      </h4>
                      <ContestStatusBadge status={c.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                      <span>Ended: {formatDate(c.end_time)}</span>
                      <span>Duration: {formatDuration(c.duration_seconds)}</span>
                      <span>{c.participant_count} participants</span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">
                    View Results
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

