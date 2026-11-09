"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Trophy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContestLeaderboardResponse } from "@/types/contest";

interface ContestLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  contestId: number;
  currentUsername?: string;
}

export function ContestLeaderboardModal({
  isOpen,
  onClose,
  contestId,
  currentUsername,
}: ContestLeaderboardModalProps) {
  const [data, setData] = useState<ContestLeaderboardResponse | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const handleManualRefresh = useCallback(async () => {
    try {
      setIsManualRefreshing(true);
      const res = await fetch(`/api-v1/contests/${contestId}/leaderboard`);
      if (res.ok) {
        const json = (await res.json()) as ContestLeaderboardResponse;
        setData(json);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch {
      // ignore network errors
    } finally {
      setIsManualRefreshing(false);
    }
  }, [contestId]);

  // Periodic polling when modal is open, paused when document is hidden
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    const fetchStandings = async () => {
      try {
        const res = await fetch(`/api-v1/contests/${contestId}/leaderboard`);
        if (res.ok && !isCancelled) {
          const json = (await res.json()) as ContestLeaderboardResponse;
          setData(json);
          setLastUpdated(new Date().toLocaleTimeString());
        }
      } catch {
        // ignore
      }
    };

    fetchStandings();

    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchStandings();
      }
    }, 20000); // 20s polling

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [isOpen, contestId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-modal-title"
    >
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h2 id="leaderboard-modal-title" className="text-sm font-bold text-[var(--foreground)]">
              Contest Leaderboard (ICPC Standings)
            </h2>
            {lastUpdated && (
              <span className="text-[11px] text-[var(--muted-foreground)] ml-2 hidden sm:inline">
                Updated {lastUpdated}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isManualRefreshing}
              className="h-8 px-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              title="Refresh standings"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isManualRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              aria-label="Close leaderboard modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {(() => {
            const leaderboardEntries = data?.entries ?? data?.leaderboard ?? [];
            if (!data || leaderboardEntries.length === 0) {
              return (
                <div className="py-12 text-center text-xs text-[var(--muted-foreground)]">
                  No submissions or ranked participants yet.
                </div>
              );
            }
            return (
              <div className="border border-[var(--border)] rounded-lg overflow-hidden text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[var(--accent)]/50 border-b border-[var(--border)] text-left font-semibold text-[var(--muted-foreground)]">
                      <th className="py-2.5 px-3 w-16 text-center">Rank</th>
                      <th className="py-2.5 px-3">Competitor</th>
                      <th className="py-2.5 px-3 w-20 text-center">Solved</th>
                      <th className="py-2.5 px-3 w-28 text-right">Penalty Time</th>
                      <th className="py-2.5 px-3 w-20 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {leaderboardEntries.map((entry) => {
                      const isSelf = currentUsername && entry.username.toLowerCase() === currentUsername.toLowerCase();
                      return (
                        <tr
                          key={entry.user_id}
                          className={`transition-colors ${
                            isSelf
                              ? "bg-amber-500/10 hover:bg-amber-500/15 font-semibold"
                              : "hover:bg-[var(--accent)]/40"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-[var(--foreground)]">
                            #{entry.rank}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[var(--foreground)]">
                            <div className="flex items-center gap-1.5">
                              <span>{entry.username}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-normal">
                                  You
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-400">
                            {entry.problems_solved}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[var(--muted-foreground)]">
                            {Math.floor(entry.penalty_seconds / 60)}m
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[var(--foreground)]">
                            {entry.score}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
