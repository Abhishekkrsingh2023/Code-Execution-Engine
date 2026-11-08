"use server";

import { redirect } from "next/navigation";
import { logoutUser } from "@/lib/api/auth";

export async function logoutAction(): Promise<void> {
  await logoutUser();
  redirect("/login");
}

