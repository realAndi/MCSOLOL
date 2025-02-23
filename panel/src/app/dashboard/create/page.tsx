"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { ServerSetupWizard } from "@/components/server-setup-wizard";

export default function CreateServerPage() {
  return (
    <DashboardLayout>
      <ServerSetupWizard />
    </DashboardLayout>
  );
} 