"use client";

import PageWrapper from "@/components/PageWrapper";
import AuditLogs from "@/components/AuditLogs";

export default function AuditPage() {
  return (
    <PageWrapper requireAdmin>
      {({ showToast }) => <AuditLogs showToast={showToast} />}
    </PageWrapper>
  );
}

