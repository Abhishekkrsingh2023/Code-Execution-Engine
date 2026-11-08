import { PageHeader } from "@/components/shared/page-header";
import { ProblemForm } from "../_components/problem-form";

export default function NewProblemPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Author New Problem"
        description="Create a coding problem with statement, execution constraints, test suites, and starter templates."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Problems", href: "/problems" },
          { label: "New Problem" },
        ]}
      />

      <ProblemForm isEdit={false} />
    </div>
  );
}

