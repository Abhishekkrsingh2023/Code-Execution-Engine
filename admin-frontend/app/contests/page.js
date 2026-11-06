"use client";

import PageWrapper from "@/components/PageWrapper";
import ContestManager from "@/components/ContestManager";

export default function ContestsPage() {
  return (
    <PageWrapper>
      {({ showToast, setConfirmDialog }) => (
        <ContestManager showToast={showToast} setConfirmDialog={setConfirmDialog} />
      )}
    </PageWrapper>
  );
}

