import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getFullProblem } from "@/lib/api/problems";
import { getCurrentUser } from "@/lib/auth/session";
import { WorkspaceShell } from "./_components/workspace-shell";

interface ProblemDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata(
  props: ProblemDetailPageProps
): Promise<Metadata> {
  const { id } = await props.params;
  if (!/^\d+$/.test(id)) {
    return { title: "Problem Not Found — Code0" };
  }

  try {
    const data = await getFullProblem(parseInt(id, 10));
    return {
      title: `${data.problem.title} — Code0`,
      description: data.problem.description.slice(0, 160),
    };
  } catch {
    return { title: "Problem Not Found — Code0" };
  }
}

export default async function ProblemDetailPage(props: ProblemDetailPageProps) {
  const { id } = await props.params;

  // Validate positive integer ID
  if (!/^\d+$/.test(id)) {
    notFound();
  }

  const problemId = parseInt(id, 10);
  if (problemId <= 0) {
    notFound();
  }

  let problemData;
  try {
    problemData = await getFullProblem(problemId);
  } catch {
    notFound();
  }

  if (!problemData || !problemData.problem) {
    notFound();
  }

  const user = await getCurrentUser();
  const isAuthenticated = Boolean(user);

  return (
    <WorkspaceShell
      problemData={problemData}
      isAuthenticated={isAuthenticated}
      problemId={problemId}
    />
  );
}

