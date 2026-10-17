"use client";

import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { ProductionType } from "../production-analytics";
import ProductionHistory from "../production-history";

const PRODUCTION_TYPES: ProductionType[] = ["milk", "meat", "eggs", "wool"];

function ProductionHistoryPageContent() {
  const searchParams = useSearchParams();
  const requestedType = searchParams.get("type")?.toLowerCase();
  const typeFilter = requestedType && PRODUCTION_TYPES.includes(requestedType as ProductionType)
    ? requestedType as ProductionType
    : "ALL";
  const title = typeFilter === "ALL" ? "Production History" : `${typeFilter.charAt(0).toUpperCase()}${typeFilter.slice(1)} Production Records`;
  return (
    <>
      <PageHeader
        title={title}
        subtitle={typeFilter === "ALL" ? "All submitted production records across livestock types." : `Your submitted ${typeFilter} production records and review status.`}
        variant="farmer"
        maxWidthClass="w-full"
      />

      <div className="p-4 md:p-8 w-full space-y-6">
        <Link href="/production-dashboard" className="inline-flex">
          <Button type="button" variant="outline" className="min-h-11 gap-2 rounded-xl border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-50">
            <ArrowLeft className="size-4" /> Back to activities
          </Button>
        </Link>
        <ProductionHistory
          initialTypeFilter={typeFilter}
          initialRecordId={searchParams.get("recordId")}
        />
      </div>
    </>
  );
}

export default function ProductionHistoryPage() {
  return (
    <Suspense fallback={<div className="space-y-4 p-4 md:p-8"><Skeleton className="h-14 w-full" /><Skeleton className="h-64 w-full rounded-2xl" /></div>}>
      <ProductionHistoryPageContent />
    </Suspense>
  );
}
