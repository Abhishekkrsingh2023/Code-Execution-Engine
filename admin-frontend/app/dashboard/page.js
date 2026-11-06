"use client";

import PageWrapper from "@/components/PageWrapper";
import DashboardStats from "@/components/DashboardStats";

export default function DashboardPage() {
  return (
    <PageWrapper requireAdmin>
      {({ showToast }) => <DashboardStats showToast={showToast} />}
    </PageWrapper>
  );
}

