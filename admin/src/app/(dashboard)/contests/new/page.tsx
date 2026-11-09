import { PageHeader } from "@/components/shared/page-header";
import { ContestForm } from "../_components/contest-form";

export default function NewContestPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Create New Contest"
        description="Schedule a new contest, set penalty time, and select the ordered problem list."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Contests", href: "/contests" },
          { label: "New Contest" },
        ]}
      />

      <ContestForm />
    </div>
  );
}

