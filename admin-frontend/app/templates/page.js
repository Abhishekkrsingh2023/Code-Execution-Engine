"use client";

import PageWrapper from "@/components/PageWrapper";
import TemplatesManager from "@/components/TemplatesManager";

export default function TemplatesPage() {
  return (
    <PageWrapper>
      {({ showToast }) => <TemplatesManager showToast={showToast} />}
    </PageWrapper>
  );
}

