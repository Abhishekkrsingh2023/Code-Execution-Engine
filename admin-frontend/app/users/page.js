"use client";

import PageWrapper from "@/components/PageWrapper";
import UserManager from "@/components/UserManager";

export default function UsersPage() {
  return (
    <PageWrapper requireAdmin>
      {({ showToast, setConfirmDialog }) => (
        <UserManager showToast={showToast} setConfirmDialog={setConfirmDialog} />
      )}
    </PageWrapper>
  );
}

