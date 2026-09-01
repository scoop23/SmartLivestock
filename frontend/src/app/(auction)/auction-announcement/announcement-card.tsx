"use client";

import { Calendar, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Announcement } from "./types";

interface AnnouncementCardProps {
  announcement: Announcement;
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const getCategoryStyle = (category: Announcement["category"]) => {
    switch (category) {
      case "Policy":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Schedule":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "System":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Market":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <Card className="border-2 border-slate-100 hover:border-purple-200 rounded-2xl bg-white shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden group">
      <CardContent className="p-5 sm:p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              className={`font-extrabold text-[10px] uppercase tracking-wider px-2.5 py-0.5 ${getCategoryStyle(
                announcement.category
              )}`}
            >
              <Tag className="w-3 h-3 mr-1" /> {announcement.category}
            </Badge>
            <span className="text-[11px] font-bold text-slate-400 font-mono flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" /> {announcement.date}
            </span>
          </div>

          <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full w-fit">
            {announcement.author}
          </span>
        </div>

        <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-[#7C3AED] transition-colors">
          {announcement.title}
        </h3>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          {announcement.content}
        </p>
      </CardContent>
    </Card>
  );
}
