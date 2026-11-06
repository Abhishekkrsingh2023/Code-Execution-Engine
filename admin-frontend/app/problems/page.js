"use client";

import PageWrapper from "@/components/PageWrapper";
import ProblemManager from "@/components/ProblemManager";

export default function ProblemsPage() {
  return (
    <PageWrapper>
      {({ showToast, setConfirmDialog }) => (
        <ProblemManager showToast={showToast} setConfirmDialog={setConfirmDialog} />
      )}
    </PageWrapper>
  );
}

