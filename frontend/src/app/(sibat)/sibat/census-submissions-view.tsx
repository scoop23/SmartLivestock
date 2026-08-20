"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  Plus,
  Search,
  X,
  CheckCircle2,
  Clock,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CensusSubmissionRecord } from "./census-submission-dialog";

interface CensusSubmissionsViewProps {
  censusSubmissions: CensusSubmissionRecord[];
  onOpenSubmitDialog: () => void;
  onSelectCensusForDetail: (census: CensusSubmissionRecord) => void;
}

export default function CensusSubmissionsView({
  censusSubmissions,
  onOpenSubmitDialog,
  onSelectCensusForDetail,
}: CensusSubmissionsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const query = searchQuery.toLowerCase().trim();
  const filteredCensus = censusSubmissions.filter((cen) => {
    if (!query) return true;
    return (
      cen.barangay.toLowerCase().includes(query) ||
      `q${cen.reportQuarter}`.includes(query) ||
      cen.reportYear.toString().includes(query) ||
      cen.id.toString().toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#1A365D]" />
            Barangay Livestock Census Submissions
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Official quarterly livestock population counts submitted to the Municipal Agriculture Office.
          </p>
        </div>

        <Button
          size="sm"
          onClick={onOpenSubmitDialog}
          className="bg-[#1A365D] hover:bg-[#152944] text-white text-xs font-black rounded-xl shadow-md gap-1.5"
        >
          <Plus className="w-4 h-4 text-amber-300" />
          Submit New Census Batch
        </Button>
      </div>

      {/* Census Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search by Barangay, Quarter (e.g. Q2), Year, Batch ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 bg-slate-50/60 border-slate-200 rounded-xl h-10 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Census Batch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCensus.length === 0 ? (
          <Card className="col-span-full py-12 border-dashed border-slate-200 rounded-2xl">
            <div className="flex flex-col items-center text-center space-y-3 px-6">
              <div className="p-3 rounded-2xl bg-slate-100">
                <FileSpreadsheet className="w-6 h-6 text-slate-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-700">No census submissions found</p>
                <p className="text-xs text-slate-500 max-w-xs">
                  Click &ldquo;Submit New Census Batch&rdquo; to record your barangay&apos;s quarterly animal headcount.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          filteredCensus.map((census) => {
            const isApproved = census.status === "APPROVED";
            return (
              <Card
                key={census.id}
                className="border border-slate-200 hover:border-slate-300 rounded-2xl bg-white shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5 space-y-4">
                  {/* Top banner of the card */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#1A365D] text-white hover:bg-[#1A365D] font-black text-xs px-2.5 py-0.5">
                          Q{census.reportQuarter} {census.reportYear}
                        </Badge>
                        <span className="text-xs font-black text-slate-900">
                          {census.barangay}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 mt-1 font-semibold">
                        Batch: {census.id}
                      </p>
                    </div>

                    <Badge
                      className={`font-bold text-[10px] uppercase tracking-wider ${
                        isApproved
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : "bg-amber-100 text-amber-800 border-amber-200"
                      }`}
                    >
                      {isApproved ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 mr-1" /> Pending MAO
                        </>
                      )}
                    </Badge>
                  </div>

                  {/* Counts Highlight */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">
                        Total Population
                      </span>
                      <p className="text-xl font-black text-slate-900 tabular-nums">
                        {census.totalHeads}{" "}
                        <span className="text-xs font-semibold text-slate-500">Heads</span>
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">
                        Surveyed Farmers
                      </span>
                      <p className="text-xl font-black text-slate-900 tabular-nums">
                        {census.totalFarmers}{" "}
                        <span className="text-xs font-semibold text-slate-500">Holders</span>
                      </p>
                    </div>
                  </div>

                  {/* Item previews */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      Species Breakdown Preview
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {census.items.slice(0, 4).map((it, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="text-[10px] font-bold bg-white text-slate-700 border-slate-200"
                        >
                          {it.livestockType.split(" ")[0]}: {it.numberOfHeads}
                        </Badge>
                      ))}
                      {census.items.length > 4 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-bold bg-slate-100 text-slate-500 border-slate-200"
                        >
                          +{census.items.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {census.reviewRemarks && (
                    <p className="text-xs text-slate-500 font-medium italic line-clamp-2">
                      &ldquo;{census.reviewRemarks}&rdquo;
                    </p>
                  )}
                </div>

                {/* Card Footer */}
                <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-slate-500">
                    Submitted: {census.submissionDate}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectCensusForDetail(census)}
                    className="h-8 px-3 rounded-xl text-xs font-extrabold text-[#1A365D] hover:bg-blue-50"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    View Details
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
