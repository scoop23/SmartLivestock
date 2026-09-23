"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  CheckCheck,
  AlertTriangle,
  Calendar,
  TrendingUp,
  ShieldCheck,
  CloudSun,
  Inbox,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import api from "@/lib/axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type NotificationType =
  | "disease"
  | "vaccination"
  | "production"
  | "sibat"
  | "weather"
  | "general";

export interface HeaderNotification {
  id: string;
  type: NotificationType;
  priority: "high" | "medium" | "low";
  title: string;
  message: string;
  date: string;
  timeAgo: string;
  read: boolean;
  link?: string;
}

interface HeaderNotificationsProps {
  variant?: "admin" | "farmer" | "sibat" | "auction";
  className?: string;
}

interface BackendNotification {
  id: number;
  type: NotificationType;
  type_display: string;
  priority: "high" | "medium" | "low";
  priority_display: string;
  title: string;
  message: string;
  is_read: boolean;
  link?: string | null;
  created_at: string;
  time_ago: string;
}

interface BackendNotificationsResponse {
  unread_count: number;
  notifications: BackendNotification[];
}

export function HeaderNotifications({
  variant = "admin",
  className = "",
}: HeaderNotificationsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isOpen, setIsOpen] = useState(false);

  // Clean up any legacy dummy data stored in client localStorage
  useEffect(() => {
    try {
      localStorage.removeItem("smartlivestock_notifications_v1");
    } catch {}
  }, []);

  // Fetch real notifications from Django Backend
  const { data: backendData, isLoading } = useQuery<BackendNotificationsResponse | null>({
    queryKey: ["notifications"],
    queryFn: async () => {
      try {
        const res = await api.get<BackendNotificationsResponse>("/api/notifications/");
        return res.data;
      } catch (err) {
        return null;
      }
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Mark single as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const numericId = parseInt(id, 10);
      if (!isNaN(numericId)) {
        await api.post(`/api/notifications/${numericId}/read/`);
      }
    },
    onMutate: async (id: string) => {
      // Optimistic update
      // prevents the user to fetch again while the get request is still fetching concurrently.
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      // gets the current cached notifications.
      const previousData = queryClient.getQueryData<BackendNotificationsResponse>(["notifications"]);

      if (previousData) {
        const numericId = parseInt(id, 10);
        queryClient.setQueryData<BackendNotificationsResponse>(["notifications"] , {
          ...previousData,
          unread_count: Math.max(0, previousData.unread_count - 1),
          notifications: previousData.notifications.map((n) => 
            n.id === numericId ? { ...n, is_read: true} : n
          )
        });
      }
      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["notifications"], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.post("/api/notifications/mark-all-read/");
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previousData = queryClient.getQueryData<BackendNotificationsResponse>(["notifications"]);

      if (previousData) {
        queryClient.setQueryData<BackendNotificationsResponse>(["notifications"], {
          ...previousData,
          unread_count: 0,
          notifications: previousData.notifications.map((n) => ({ ...n, is_read: true })),
        });
      }
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["notifications"], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Real database notifications
  const notifications: HeaderNotification[] = (backendData?.notifications || []).map((n) => ({
    id: String(n.id),
    type: n.type,
    priority: n.priority,
    title: n.title,
    message: n.message,
    date: n.created_at ? n.created_at.split("T")[0] : "",
    timeAgo: n.time_ago || "Just now",
    read: n.is_read,
    link: n.link || undefined,
  }));

  const unreadCount = backendData?.unread_count ?? notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: string, link?: string) => {
    markReadMutation.mutate(id);
    if (link) {
      setIsOpen(false);
      router.push(link);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllReadMutation.mutate();
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    return true;
  });

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "disease":
        return <AlertTriangle className="w-5 h-5 text-rose-600" />;
      case "vaccination":
        return <Calendar className="w-5 h-5 text-amber-600" />;
      case "production":
        return <TrendingUp className="w-5 h-5 text-emerald-600" />;
      case "sibat":
        return <ShieldCheck className="w-5 h-5 text-sky-600" />;
      case "weather":
        return <CloudSun className="w-5 h-5 text-amber-500" />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  const getIconBackground = (type: NotificationType) => {
    switch (type) {
      case "disease":
        return "bg-rose-100/90 text-rose-600 border-rose-200/90 shadow-xs";
      case "vaccination":
        return "bg-amber-100/90 text-amber-600 border-amber-200/90 shadow-xs";
      case "production":
        return "bg-emerald-100/90 text-emerald-600 border-emerald-200/90 shadow-xs";
      case "sibat":
        return "bg-sky-100/90 text-sky-600 border-sky-200/90 shadow-xs";
      case "weather":
        return "bg-amber-50 text-amber-500 border-amber-200/90 shadow-xs";
      default:
        return "bg-slate-100 text-slate-500 border-slate-200 shadow-xs";
    }
  };

  const buttonStyle = {
    admin:
      "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-xs",
    farmer:
      "bg-white/15 hover:bg-white/25 text-white border-white/20 shadow-xs",
    sibat:
      "bg-white/15 hover:bg-white/25 text-white border-white/20 shadow-xs",
    auction:
      "bg-white/15 hover:bg-white/25 text-white border-white/20 shadow-xs",
  }[variant];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications (${unreadCount} unread)`}
          className={cn(
            "relative shrink-0 flex items-center justify-center w-11 h-11 rounded-xl sm:rounded-2xl border transition-all duration-150 active:scale-95 cursor-pointer backdrop-blur-xs",
            buttonStyle,
            className
          )}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-rose-600 text-white text-[11px] font-black shadow-xs ring-2 ring-white animate-in zoom-in-75">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-[calc(100vw-24px)] max-w-[460px] sm:w-[440px] md:w-[460px] p-0 rounded-2xl border border-slate-200/90 shadow-2xl bg-white overflow-hidden text-slate-800 z-50 animate-in fade-in-50 zoom-in-95"
      >
        {/* Header Bar */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1E4D2B]/10 text-[#1E4D2B] flex items-center justify-center shrink-0">
              <Bell className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                Notifications & Alerts
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Biosecurity & Program Advisories
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {unreadCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={markAllReadMutation.isPending}
                className="h-8 px-2.5 sm:px-3 text-xs font-bold text-[#1E4D2B] hover:text-[#163b21] hover:bg-emerald-50 rounded-xl gap-1.5 cursor-pointer transition-colors active:scale-95"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark all read</span>
              </Button>
            ) : (
              <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-xs px-2.5 py-1 rounded-full">
                All caught up
              </Badge>
            )}
          </div>
        </div>

        {/* Filter Chips Strip */}
        <div className="px-4 py-2.5 sm:px-5 bg-white border-b border-slate-100 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer active:scale-95",
                filter === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer flex items-center gap-1.5 active:scale-95",
                filter === "unread"
                  ? "bg-[#1E4D2B] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black leading-none">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline">Live MAO Sync</span>
            <span className="sm:hidden">Live</span>
          </div>
        </div>

        {/* Notifications Scrollable List */}
        <ScrollArea className="max-h-[60vh] sm:max-h-[440px] overflow-y-auto">
          {isLoading ? (
            <div className="py-16 px-4 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-[#1E4D2B] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs sm:text-sm font-semibold text-slate-500">Checking for alerts...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-16 px-6 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center shadow-xs">
                {filter === "unread" ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                ) : (
                  <Inbox className="w-7 h-7 text-slate-400" />
                )}
              </div>
              <p className="text-sm sm:text-base font-bold text-slate-800">
                {filter === "unread" ? "No unread alerts" : "No notifications yet"}
              </p>
              <p className="text-xs sm:text-sm text-slate-500 max-w-[280px] leading-relaxed">
                {filter === "unread"
                  ? "All advisory notices have been acknowledged."
                  : "New biosecurity advisories, inspection confirmations, and municipal announcements will appear here."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif.id, notif.link)}
                  className={cn(
                    "p-4 sm:p-4.5 transition-all duration-150 cursor-pointer flex items-start gap-3.5 text-left group active:bg-slate-100/70",
                    notif.read
                      ? "bg-white hover:bg-slate-50/80 opacity-75 hover:opacity-100"
                      : "bg-emerald-50/40 hover:bg-emerald-50/70"
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-2xl border flex items-center justify-center shadow-xs mt-0.5 transition-transform duration-150 group-hover:scale-105",
                      getIconBackground(notif.type)
                    )}
                  >
                    {getNotificationIcon(notif.type)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h5 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                        {notif.title}
                      </h5>
                      <span className="text-xs font-medium text-slate-400 shrink-0 mt-0.5">
                        {notif.timeAgo}
                      </span>
                    </div>

                    <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed line-clamp-3">
                      {notif.message}
                    </p>

                    <div className="flex items-center flex-wrap gap-2 mt-2.5">
                      {notif.priority === "high" && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase tracking-wider">
                          High Priority
                        </span>
                      )}
                      {notif.priority === "medium" && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                          Advisory
                        </span>
                      )}
                      {notif.type === "sibat" && (
                        <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold uppercase tracking-wider">
                          SIBAT
                        </span>
                      )}

                      {notif.link && (
                        <span className="text-xs text-slate-500 group-hover:text-[#1E4D2B] transition-colors flex items-center gap-1 font-semibold">
                          View details <ExternalLink className="w-3 h-3" />
                        </span>
                      )}

                      {!notif.read && (
                        <span className="ml-auto w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-emerald-100 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">Padre Garcia MAO Agriculture Portal</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
