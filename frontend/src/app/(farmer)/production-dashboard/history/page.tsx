"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import ProductionHistory from "../production-history";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductionType } from "../production-analytics";

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
        action={
          <Link href="/production-dashboard">
            <Button type="button" className="bg-white text-[#2D5A27] hover:bg-white/90 shadow-sm px-4">
              <ArrowLeft className="size-4" /> Back to activities
            </Button>
          </Link>
        }
      />

      <div className="p-4 md:p-8 w-full space-y-6">
        <ProductionHistory initialTypeFilter={typeFilter} />
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
