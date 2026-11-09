import { redirect, notFound } from "next/navigation";
import { getContest, getContestProblemDetail, getContestMyRank } from "@/lib/api/contests";
import { getCurrentUser } from "@/lib/auth/session";
import { ContestArenaShell } from "./_components/contest-arena-shell";
import type { FullProblemResponse, ProblemDifficulty } from "@/types/problem";

export const dynamic = "force-dynamic";

interface ContestArenaPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ContestArenaPage({ params }: ContestArenaPageProps) {
  const resolvedParams = await params;
  const contestId = parseInt(resolvedParams.id, 10);
  if (isNaN(contestId)) {
    notFound();
  }

  // Auth Guard
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/contests/${contestId}/arena`);
  }

  // Contest Guard
  let contest;
  try {
    contest = await getContest(contestId);
  } catch {
    notFound();
  }

  // Rule Guard: Must be live & user must be registered
  if (contest.status !== "live" || !contest.is_registered) {
    redirect(`/contests/${contestId}`);
  }

  // Pre-fetch problem statements for this contest in parallel
  const problemMap: Record<number, FullProblemResponse> = {};
  await Promise.all(
    contest.problems.map(async (prob) => {
      try {
        const detail = await getContestProblemDetail(contestId, prob.problem_id);
        const fullProblem: FullProblemResponse = {
          problem: {
            id: detail.problem_id,
            problem_code: detail.problem_id,
            title: detail.title,
            description: detail.description,
            difficulty: detail.difficulty as ProblemDifficulty,
            category: "Contest",
            topic: "Competitive Programming",
            status: "published",
            time_limit: detail.time_limit,
            memory_limit: detail.memory_limit,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_deleted: false,
            deleted_at: null,
          },
          problem_code: detail.problem_id,
          problem_id: detail.problem_id,
          run_test_cases: (detail.sample_test_cases || []).map((tc, idx) => ({
            id: tc.id ?? idx,
            input: tc.input ?? tc.input_data ?? "",
            expected_output: tc.expected_output ?? "",
            weight: Number(tc.weight ?? 1.0),
          })),
          templates: [],
          test_cases_count: (detail.sample_test_cases || []).length,
        };
        problemMap[prob.problem_id] = fullProblem;
      } catch {
        // Fallback placeholder if single problem fails to fetch
      }
    })
  );

  // Fetch initial rank and problem verdicts
  let myRank = null;
  try {
    myRank = await getContestMyRank(contestId);
  } catch {
    // Non-critical if no rank exists yet
  }

  return (
    <ContestArenaShell
      contest={contest}
      problemMap={problemMap}
      user={user}
      initialRank={myRank}
    />
  );
}

