"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import ProductionHistory from "../production-history";

export default function ProductionHistoryPage() {
  return (
    <>
      <PageHeader
        title="Production History"
        subtitle="All submitted production records across livestock types."
        variant="farmer"
        maxWidthClass="max-w-7xl"
        action={
          <Link href="/production-dashboard">
            <Button
              type="button"
              className="bg-white text-[#2D5A27] hover:bg-white/90 shadow-sm px-4"
            >
              <ArrowLeft className="size-4" /> Back to Analytics
            </Button>
          </Link>
        }
      />

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <ProductionHistory />
      </div>
    </>
  );
}
