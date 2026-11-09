"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Search,
  Plus,
  AlertCircle,
  Clock,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  createContestAction,
  updateContestAction,
  searchProblemsAction,
} from "./actions";
import type { ContestResponse } from "@/types/contest";
import type { ProblemResponse } from "@/types/problem";

interface ContestFormProps {
  contest?: ContestResponse;
  initialProblems?: ProblemResponse[];
}

interface SelectedProblem {
  id: number;
  title: string;
  difficulty: string;
}

function toLocalDatetimeInputString(isoDateStr?: string): string {
  if (!isoDateStr) return "";
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function ContestForm({ contest }: ContestFormProps) {
  const router = useRouter();
  const isEditing = Boolean(contest);
  const contestStatus = contest?.status;
  const isLive = contestStatus === "live";
  const isEnded = contestStatus === "ended";

  const [title, setTitle] = useState(contest?.title || "");
  const [description, setDescription] = useState(contest?.description || "");
  const [startTime, setStartTime] = useState(
    toLocalDatetimeInputString(contest?.start_time)
  );
  const [endTime, setEndTime] = useState(
    toLocalDatetimeInputString(contest?.end_time)
  );
  const [penaltyMinutes, setPenaltyMinutes] = useState(
    contest?.penalty_minutes ?? 20
  );

  // Initial selected problems
  const [selectedProblems, setSelectedProblems] = useState<SelectedProblem[]>(
    () => {
      if (!contest?.problems) return [];
      return [...contest.problems]
        .sort((a, b) => a.position - b.position)
        .map((p) => ({
          id: p.problem_id,
          title: p.title,
          difficulty: p.difficulty,
        }));
    }
  );

  // Problem search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProblemResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Form submission state
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [timeZone] = useState(() => {
    if (typeof window === "undefined") return "UTC";
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "Local Time";
    }
  });

  // Search problems
  const handleSearchProblems = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchProblemsAction(searchQuery.trim());
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const addProblem = (prob: ProblemResponse) => {
    if (selectedProblems.some((p) => p.id === prob.id)) {
      return; // Already added
    }
    setSelectedProblems((prev) => [
      ...prev,
      { id: prob.id, title: prob.title, difficulty: prob.difficulty },
    ]);
  };

  const removeProblem = (index: number) => {
    setSelectedProblems((prev) => prev.filter((_, i) => i !== index));
  };

  const moveProblem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= selectedProblems.length) return;
    setSelectedProblems((prev) => {
      const updated = [...prev];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (isEnded) {
      setErrorMessage("This contest has ended and cannot be modified.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Title is required.");
      return;
    }

    if (!isLive) {
      if (!startTime || !endTime) {
        setErrorMessage("Both start time and end time are required.");
        return;
      }

      const start = new Date(startTime);
      const end = new Date(endTime);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        setErrorMessage("Please enter valid dates.");
        return;
      }

      if (end <= start) {
        setErrorMessage("Contest end time must be strictly after start time.");
        return;
      }

      if (selectedProblems.length === 0) {
        setErrorMessage("A contest must have at least one problem.");
        return;
      }
    }

    startTransition(async () => {
      if (isEditing && contest) {
        if (isLive) {
          // Rule 7: Only title and description can be updated when live
          const res = await updateContestAction(contest.id, {
            title: title.trim(),
            description: description.trim() || null,
          });
          if (res.success) {
            setSuccessMessage("Contest updated successfully.");
            router.push(`/contests/${contest.id}`);
          } else {
            setErrorMessage(res.error || "Failed to update contest.");
          }
        } else {
          // Full update when upcoming
          const res = await updateContestAction(contest.id, {
            title: title.trim(),
            description: description.trim() || null,
            start_time: new Date(startTime).toISOString(),
            end_time: new Date(endTime).toISOString(),
            penalty_minutes: Number(penaltyMinutes),
            problem_ids: selectedProblems.map((p) => p.id),
          });
          if (res.success) {
            setSuccessMessage("Contest updated successfully.");
            router.push(`/contests/${contest.id}`);
          } else {
            setErrorMessage(res.error || "Failed to update contest.");
          }
        }
      } else {
        // Create contest
        const res = await createContestAction({
          title: title.trim(),
          description: description.trim() || null,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          penalty_minutes: Number(penaltyMinutes),
          problem_ids: selectedProblems.map((p) => p.id),
        });
        if (res.success) {
          router.push(`/contests/${res.contestId}`);
        } else {
          setErrorMessage(res.error || "Failed to create contest.");
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Rule 7 Notice Banners */}
      {isLive && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
          <Lock className="h-4 w-4 mt-0.5 text-amber-400 shrink-0" />
          <div>
            <span className="font-semibold block">Contest is currently Live</span>
            Per platform rules, only the contest title and description can be modified while live. Schedule, penalty, and problem list are locked.
          </div>
        </div>
      )}

      {isEnded && (
        <div className="rounded-md border border-zinc-700 bg-zinc-800/40 p-3.5 text-xs text-zinc-400 flex items-start gap-2.5">
          <Lock className="h-4 w-4 mt-0.5 text-zinc-400 shrink-0" />
          <div>
            <span className="font-semibold block text-zinc-200">Contest has Ended</span>
            This contest has ended and is fully locked. No changes can be saved.
          </div>
        </div>
      )}

      {/* Error / Success Notifications */}
      {errorMessage && (
        <div className="rounded-md border border-red-900/60 bg-red-950/30 p-3.5 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="rounded-md border border-emerald-900/60 bg-emerald-950/30 p-3.5 text-xs text-emerald-300">
          {successMessage}
        </div>
      )}

      {/* Basic Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Contest Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title" required>
              Contest Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Contest 42"
              required
              disabled={isEnded || isPending}
              maxLength={255}
            />
          </div>

          <div>
            <Label htmlFor="description">Description & Rules</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide contest guidelines, rules, format, or sponsor details..."
              rows={4}
              disabled={isEnded || isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Timing and Scoring Card */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule & Scoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 pb-1">
            <Clock className="h-3.5 w-3.5 text-zinc-500" />
            <span>
              Timezone: <strong className="text-zinc-200">{timeZone}</strong>. Values will be saved as UTC on the server.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_time" required>
                Start Time
              </Label>
              <Input
                id="start_time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                disabled={isLive || isEnded || isPending}
              />
            </div>

            <div>
              <Label htmlFor="end_time" required>
                End Time
              </Label>
              <Input
                id="end_time"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                disabled={isLive || isEnded || isPending}
              />
            </div>
          </div>

          <div className="max-w-xs">
            <Label htmlFor="penalty_minutes" required>
              Wrong Attempt Penalty (Minutes)
            </Label>
            <Input
              id="penalty_minutes"
              type="number"
              min={0}
              max={120}
              value={penaltyMinutes}
              onChange={(e) => setPenaltyMinutes(parseInt(e.target.value, 10) || 0)}
              disabled={isLive || isEnded || isPending}
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Standard ICPC penalty is 20 minutes per incorrect verdict before AC.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Ordered Problem Picker Card */}
      <Card>
        <CardHeader>
          <CardTitle>Contest Problems (Ordered)</CardTitle>
          <p className="text-xs text-zinc-500">
            Problems are mapped to tabs in the arena as P1, P2, P3... in the exact order below.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selected Problems List */}
          {selectedProblems.length === 0 ? (
            <div className="rounded border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
              No problems added yet. Use the search tool below to add problems to this contest.
            </div>
          ) : (
            <div className="space-y-2">
              {selectedProblems.map((prob, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === selectedProblems.length - 1;

                return (
                  <div
                    key={prob.id}
                    className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/60 p-2.5 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-8 items-center justify-center rounded bg-zinc-800 font-mono text-[11px] font-bold text-zinc-200">
                        P{idx + 1}
                      </span>
                      <div>
                        <span className="font-medium text-zinc-100">{prob.title}</span>
                        <span className="text-[11px] text-zinc-500 ml-2 font-mono">
                          #{prob.id}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize ml-1 border-zinc-700 text-zinc-400"
                      >
                        {prob.difficulty}
                      </Badge>
                    </div>

                    {!isLive && !isEnded && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
                          onClick={() => moveProblem(idx, idx - 1)}
                          disabled={isFirst || isPending}
                          aria-label={`Move problem P${idx + 1} up`}
                          title="Move Up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
                          onClick={() => moveProblem(idx, idx + 1)}
                          disabled={isLast || isPending}
                          aria-label={`Move problem P${idx + 1} down`}
                          title="Move Down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-950/20"
                          onClick={() => removeProblem(idx)}
                          disabled={isPending}
                          aria-label={`Remove problem P${idx + 1}`}
                          title="Remove Problem"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Search to Add Problem (Disabled when Live or Ended) */}
          {!isLive && !isEnded && (
            <div className="pt-2 border-t border-zinc-800/80 space-y-3">
              <Label>Search & Add Problem</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <Input
                    placeholder="Search problem title or topic..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchProblems();
                      }
                    }}
                    className="pl-8 text-xs h-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSearchProblems()}
                  isLoading={isSearching}
                  disabled={!searchQuery.trim()}
                >
                  Search
                </Button>
              </div>

              {/* Search Results Dropdown/List */}
              {searchResults.length > 0 && (
                <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2 space-y-1 max-h-48 overflow-y-auto">
                  {searchResults.map((prob) => {
                    const isAlreadyAdded = selectedProblems.some(
                      (p) => p.id === prob.id
                    );
                    return (
                      <div
                        key={prob.id}
                        className="flex items-center justify-between p-2 rounded hover:bg-zinc-900 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-zinc-500">#{prob.id}</span>
                          <span className="text-zinc-200">{prob.title}</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] capitalize border-zinc-800 text-zinc-400"
                          >
                            {prob.difficulty}
                          </Badge>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20"
                          onClick={() => addProblem(prob)}
                          disabled={isAlreadyAdded}
                        >
                          {isAlreadyAdded ? (
                            "Added"
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        {!isEnded && (
          <Button type="submit" isLoading={isPending}>
            {isEditing ? "Save Changes" : "Create Contest"}
          </Button>
        )}
      </div>
    </form>
  );
}
