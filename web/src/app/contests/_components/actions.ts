"use server";

import { revalidatePath } from "next/cache";
import { registerContest, unregisterContest } from "@/lib/api/contests";
import { ApiError } from "@/lib/api/client";

export async function registerContestAction(contestId: number) {
  try {
    await registerContest(contestId);
    revalidatePath(`/contests/${contestId}`);
    revalidatePath("/contests");
    return { success: true };
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 409) {
      // Idempotent: already registered
      revalidatePath(`/contests/${contestId}`);
      return { success: true, alreadyRegistered: true };
    }
    const message = err instanceof Error ? err.message : "Failed to register for contest";
    return { success: false, error: message };
  }
}

export async function unregisterContestAction(contestId: number) {
  try {
    await unregisterContest(contestId);
    revalidatePath(`/contests/${contestId}`);
    revalidatePath("/contests");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to unregister from contest";
    return { success: false, error: message };
  }
}
