import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ClipboardCheck } from "lucide-react";

const workspaces = [
  { title: "Field Overview", href: "/sibat", description: "View assigned field tasks, farmer submissions, and items awaiting follow-up." },
  { title: "Farmers & Registered Animals", href: "/sibat/livestock-registry", description: "Find farmers and registered animals within your authorized barangay scope." },
  { title: "Herd Monitoring", href: "/sibat/batches", description: "Inspect registered herds and review animal registrations requiring field validation." },
  { title: "Livestock Census", href: "/sibat/census/submit", description: "Record observed headcounts through the existing census submission workflow." },
  { title: "Census History", href: "/sibat/census-submissions", description: "Review previous census submissions and records returned for correction." },
  { title: "Health Reports for Follow-up", href: "/sibat-alerts", description: "Follow up disease and mortality reports and submit field findings for official assessment." },
  { title: "Sales, Births & Slaughter Notices", href: "/sibat/production-records", description: "Access the existing reviews for sales and birth records, and view farmer-reported slaughter notices." },
  { title: "Field Schedules", href: "/sibat-scheduling", description: "Use existing programs and schedules to coordinate field activities." },
];

export default function BarangayLivestockMonitoringPage() {
  return <>
    <PageHeader title="Barangay Livestock Monitoring" subtitle="Monitor registered livestock, conduct census work, and follow up field reports within your assigned barangay." variant="sibat" icon={<ClipboardCheck className="size-5" />} maxWidthClass="w-full" />
    <div className="space-y-5 p-4 sm:p-6">
      <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">Document findings through the appropriate census, registration, or health-report workflow. Official record changes and final approvals follow the existing MAO review process.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{workspaces.map((workspace) => <Link key={workspace.href} href={workspace.href} className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
        <Card className="h-full rounded-2xl border-slate-200 transition-colors group-hover:border-emerald-500">
          <CardHeader><CardTitle className="flex items-center justify-between gap-3 text-base">{workspace.title}<ArrowRight className="size-4 shrink-0 text-emerald-700" /></CardTitle></CardHeader>
          <CardContent><p className="text-sm leading-relaxed text-slate-600">{workspace.description}</p></CardContent>
        </Card>
      </Link>)}</div>
    </div>
  </>;
}
