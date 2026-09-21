"use client";

import Link from "next/link";
import { PlusCircle, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function EnterpriseEmptyState() {
  return (
    <Card className="border-dashed border-2 border-slate-200 bg-white/80 backdrop-blur-sm rounded-3xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs">
      <CardContent className="p-0 flex flex-col items-center space-y-4">
        <div className="size-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-inner">
          <Sparkles className="size-8" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h3 className="text-xl font-bold text-slate-900">
            No Approved Livestock Found
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            You don't have any approved animals in your livestock inventory yet. Add your cattle, goats, sheep, swine, or poultry to start logging daily yields, births, and weights.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <Button
            asChild
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl gap-2 shadow-xs"
          >
            <Link href="/livestock-inventory">
              <PlusCircle className="size-4" /> Go to Livestock Inventory
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
