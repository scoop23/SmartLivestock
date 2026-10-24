import SurveillanceAnalytics from "@/app/components/analytics/surveillance-analytics";
import { PageHeader } from "@/app/components/page-header";
import { BarChart3 } from "lucide-react";

export default function SibatSurveillancePage() {
  return (
    <>
      <PageHeader
        title="Disease & Mortality Surveillance"
        subtitle="Approved event reports and scoped review signals"
        variant="admin"
        maxWidthClass="w-full"
        icon={<BarChart3 className="size-5 text-slate-800" />}
      />
      <div className="w-full space-y-4 p-3 pb-16 sm:p-4 md:p-5">
        <SurveillanceAnalytics />
      </div>
    </>
  );
}
