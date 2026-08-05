"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import api from "@/lib/axios";

export type ProductionType = "milk" | "eggs" | "wool";
export type UnitType = "LITERS" | "PIECES" | "KILOGRAMS";
export type ProductionStatus = "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";

export interface ProductionRecord {
  readonly id: number;
  readonly createdAt: string;
  livestockId: number;
  createdBy: number;
  reviewedBy?: number | null;
  productionType: ProductionType;
  quantity: number;
  unit: UnitType;
  recordDate: string;
  status: ProductionStatus;
  reviewedAt?: string | null;
  reviewRemarks?: string;
}

export default function ProductionHistory({
}) {

  const { data: userProductions = [], isError: isError, isLoading: IsLoading } = useQuery<ProductionRecord[]>({
    queryKey: ["production"],
    queryFn: async () => {
      const response = await api.get("production/view_records/");
      return response.data.map((item: any) => ({
        id: item.id,
        livestockId: item.livestock,
        productionType: item.production_type.toLowerCase(),
        quantity: Number(item.quantity),
        unit: item.unit,
        recordDate: item.record_date,
        status: item.status,
        reviewRemarks: item.review_remarks,
        createdAt: item.created_at,
      }));
    },
  });

  console.log(userProductions);


  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filteredRecords = userProductions.filter(
    (r) => typeFilter === "ALL" || r.productionType === typeFilter
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
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="milk">Milk</SelectItem>
              <SelectItem value="eggs">Eggs</SelectItem>
              <SelectItem value="wool">Wool</SelectItem>
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
        filteredRecords.map((record: ProductionRecord) => (
          <Card
            key={record.id}
            className="border-slate-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Badge
                    className={`uppercase tracking-wider ${record.productionType === "milk"
                      ? "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200"
                      : record.productionType === "eggs"
                        ? "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200"
                        : "bg-sky-100 text-sky-800 hover:bg-sky-100 border-sky-200"
                      }`}
                  >
                    {record.productionType}
                  </Badge>
                  <span className="text-sm text-slate-500 font-medium">
                    {new Date(record.recordDate).toLocaleDateString("en-US", {
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
              {record.quantity && (
                <p className="text-sm font-medium text-emerald-700 mb-1">
                  Sale Value: ₱{record.quantity.toLocaleString()}
                </p>
              )}
              <p className="text-sm text-slate-600 italic">
                &ldquo;{record.reviewRemarks}&rdquo;
              </p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
