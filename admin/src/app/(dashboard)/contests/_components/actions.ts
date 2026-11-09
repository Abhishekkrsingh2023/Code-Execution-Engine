"use server";

import { revalidatePath } from "next/cache";
import {
  createContest,
  updateContest,
  deleteContest,
} from "@/lib/api/contests";
import { listProblems } from "@/lib/api/problems";
import type {
  ContestCreateRequest,
  ContestUpdateRequest,
} from "@/types/contest";
import type { ProblemResponse } from "@/types/problem";

export async function searchProblemsAction(query: string): Promise<ProblemResponse[]> {
  try {
    const res = await listProblems({ search: query, limit: 10 });
    return res.problems;
  } catch {
    return [];
  }
}

export async function createContestAction(payload: ContestCreateRequest) {
  try {
    const created = await createContest(payload);
    revalidatePath("/contests");
    revalidatePath("/");
    return { success: true, contestId: created.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create contest";
    return { success: false, error: message };
  }
}

export async function updateContestAction(
  contestId: number,
  payload: ContestUpdateRequest
) {
  try {
    const updated = await updateContest(contestId, payload);
    revalidatePath("/contests");
    revalidatePath(`/contests/${contestId}`);
    revalidatePath(`/contests/${contestId}/edit`);
    return { success: true, contest: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update contest";
    return { success: false, error: message };
  }
}

export async function deleteContestAction(contestId: number) {
  try {
    await deleteContest(contestId);
    revalidatePath("/contests");
    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete contest";
    return { success: false, error: message };
  }
}
