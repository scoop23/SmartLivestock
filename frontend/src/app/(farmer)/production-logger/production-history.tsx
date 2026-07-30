"use client";

import { useState } from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ProductionRecord {
  id: string;
  date: string;
  type: "milk" | "slaughter" | "sale";
  quantity: number;
  unit: string;
  amount?: number;
  notes: string;
}

export default function ProductionHistory({
  records,
}: {
  records: ProductionRecord[];
}) {
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filteredRecords = records.filter(
    (r) => typeFilter === "ALL" || r.type === typeFilter
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search notes..."
            className="pl-9 bg-slate-50/50 border-slate-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="milk">Milk</SelectItem>
              <SelectItem value="slaughter">Katay</SelectItem>
              <SelectItem value="sale">Live Sale</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-slate-200">
          <CardContent>
            <p className="text-slate-500">No production records match your filter.</p>
          </CardContent>
        </Card>
      ) : (
        filteredRecords.map((record) => (
          <Card
            key={record.id}
            className="border-slate-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Badge
                    className={`uppercase tracking-wider ${
                      record.type === "milk"
                        ? "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200"
                        : record.type === "slaughter"
                          ? "bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200"
                          : "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
                    }`}
                  >
                    {record.type}
                  </Badge>
                  <span className="text-sm text-slate-500 font-medium">
                    {new Date(record.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <p className="text-lg font-bold text-slate-900">
                  {record.quantity}{" "}
                  <span className="text-sm font-normal text-slate-500">
                    {record.unit}
                  </span>
                </p>
              </div>
              {record.amount && (
                <p className="text-sm font-medium text-emerald-700 mb-1">
                  Sale Value: ₱{record.amount.toLocaleString()}
                </p>
              )}
              <p className="text-sm text-slate-600 italic">
                &ldquo;{record.notes}&rdquo;
              </p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
