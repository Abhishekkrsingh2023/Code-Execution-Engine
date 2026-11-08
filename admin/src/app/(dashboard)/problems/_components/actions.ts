"use server";

import { revalidatePath } from "next/cache";
import {
  createFullProblem,
  updateProblem,
  updateProblemStatus,
  deleteProblem,
  createOrUpdateCommonTemplate,
} from "@/lib/api/problems";
import type {
  FullProblemCreateRequest,
  ProblemUpdateRequest,
  ProblemStatus,
  TestCaseItem,
} from "@/types/problem";

export async function createProblemAction(payload: FullProblemCreateRequest) {
  try {
    const created = await createFullProblem(payload);
    revalidatePath("/problems");
    revalidatePath("/");
    return { success: true, problemId: created.problem.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create problem";
    return { success: false, error: message };
  }
}

export async function updateProblemAction(
  problemId: number,
  payload: ProblemUpdateRequest,
  testCases?: {
    run_test_cases: TestCaseItem[];
    submit_test_cases: TestCaseItem[];
  }
) {
  try {
    await updateProblem(problemId, payload);
    if (testCases) {
      await createOrUpdateCommonTemplate({
        problem_id: problemId,
        problem_statement: payload.description || "Updated problem statement",
        time_limit: payload.time_limit ?? 2.0,
        run_test_cases: testCases.run_test_cases,
        submit_test_cases: testCases.submit_test_cases,
      });
    }
    revalidatePath("/problems");
    revalidatePath(`/problems/${problemId}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update problem";
    return { success: false, error: message };
  }
}

export async function updateProblemStatusAction(
  problemId: number,
  status: ProblemStatus
) {
  try {
    await updateProblemStatus(problemId, status);
    revalidatePath("/problems");
    revalidatePath(`/problems/${problemId}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to change problem status";
    return { success: false, error: message };
  }
}

export async function deleteProblemAction(problemId: number) {
  try {
    await deleteProblem(problemId);
    revalidatePath("/problems");
    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete problem";
    return { success: false, error: message };
  }
}

