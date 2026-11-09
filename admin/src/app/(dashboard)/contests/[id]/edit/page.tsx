import { notFound } from "next/navigation";
import { getContest } from "@/lib/api/contests";
import { PageHeader } from "@/components/shared/page-header";
import { ContestForm } from "../../_components/contest-form";

interface EditContestPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditContestPage({
  params,
}: EditContestPageProps) {
  const resolvedParams = await params;
  const contestId = parseInt(resolvedParams.id, 10);
  if (isNaN(contestId)) {
    notFound();
  }

  let contest;
  try {
    contest = await getContest(contestId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit Contest #${contest.id}`}
        description={`Modify contest settings for "${contest.title}".`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Contests", href: "/contests" },
          { label: `#${contest.id}`, href: `/contests/${contest.id}` },
          { label: "Edit" },
        ]}
      />

      <ContestForm contest={contest} />
    </div>
  );
}

