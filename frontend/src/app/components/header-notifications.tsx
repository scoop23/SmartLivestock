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
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previousData = queryClient.getQueryData<BackendNotificationsResponse>(["notifications"]);

      if (previousData) {
        const numericId = parseInt(id, 10);
        queryClient.setQueryData<BackendNotificationsResponse>(["notifications"], {
          ...previousData,
          unread_count: Math.max(0, previousData.unread_count - 1),
          notifications: previousData.notifications.map((n) =>
            n.id === numericId ? { ...n, is_read: true } : n
          ),
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
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case "vaccination":
        return <Calendar className="w-4 h-4 text-amber-600" />;
      case "production":
        return <TrendingUp className="w-4 h-4 text-emerald-600" />;
      case "sibat":
        return <ShieldCheck className="w-4 h-4 text-sky-600" />;
      case "weather":
        return <CloudSun className="w-4 h-4 text-amber-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const getIconBackground = (type: NotificationType) => {
    switch (type) {
      case "disease":
        return "bg-rose-100/80 border-rose-200/80";
      case "vaccination":
        return "bg-amber-100/80 border-amber-200/80";
      case "production":
        return "bg-emerald-100/80 border-emerald-200/80";
      case "sibat":
        return "bg-sky-100/80 border-sky-200/80";
      case "weather":
        return "bg-amber-50 border-amber-200/80";
      default:
        return "bg-slate-100 border-slate-200";
    }
  };

  const buttonStyle = {
    admin:
      "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-2xs",
    farmer:
      "bg-white/15 hover:bg-white/25 text-white border-white/20 shadow-2xs",
    sibat:
      "bg-white/15 hover:bg-white/25 text-white border-white/20 shadow-2xs",
    auction:
      "bg-white/15 hover:bg-white/25 text-white border-white/20 shadow-2xs",
  }[variant];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications (${unreadCount} unread)`}
          className={cn(
            "relative shrink-0 flex items-center justify-center w-10 h-10 rounded-xl border transition-all duration-150 active:scale-95 cursor-pointer backdrop-blur-xs",
            buttonStyle,
            className
          )}
        >
          <Bell className="w-4.5 h-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-black shadow-xs ring-2 ring-white animate-in zoom-in-75">
              {unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[340px] sm:w-[390px] p-0 rounded-2xl border border-slate-200/90 shadow-2xl bg-white overflow-hidden text-slate-800 z-50 animate-in fade-in-50 zoom-in-95"
      >
        {/* Header Bar */}
        <div className="px-4 py-3.5 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1E4D2B]/10 text-[#1E4D2B] flex items-center justify-center shrink-0">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 tracking-tight leading-none">
                Notifications & Alerts
              </h4>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                Biosecurity & Program Advisories
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={markAllReadMutation.isPending}
                className="h-7 px-2 text-[11px] font-bold text-[#1E4D2B] hover:text-[#163b21] hover:bg-emerald-50 rounded-lg gap-1 cursor-pointer"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            ) : (
              <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-[10px] px-2 py-0.5 rounded-full">
                All caught up
              </Badge>
            )}
          </div>
        </div>

        {/* Filter Chips Strip */}
        <div className="px-3 py-2 bg-white border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer",
                filter === "all"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1",
                filter === "unread"
                  ? "bg-[#1E4D2B] text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <span className="text-[10px] text-slate-400 font-medium">
            Live MAO Sync
          </span>
        </div>

        {/* Notifications Scrollable List */}
        <ScrollArea className="max-h-[360px] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-2">
              <div className="w-6 h-6 border-2 border-[#1E4D2B] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Checking for alerts...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                {filter === "unread" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Inbox className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <p className="text-xs font-bold text-slate-700">
                {filter === "unread" ? "No unread alerts" : "No notifications yet"}
              </p>
              <p className="text-[11px] text-slate-400 max-w-[220px]">
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
                    "p-3.5 transition-colors cursor-pointer flex items-start gap-3 text-left group",
                    notif.read
                      ? "bg-white hover:bg-slate-50/80 opacity-80"
                      : "bg-emerald-50/30 hover:bg-emerald-50/60"
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "shrink-0 w-8 h-8 rounded-xl border flex items-center justify-center shadow-2xs mt-0.5",
                      getIconBackground(notif.type)
                    )}
                  >
                    {getNotificationIcon(notif.type)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5 mb-0.5">
                      <h5 className="text-xs font-bold text-slate-900 truncate">
                        {notif.title}
                      </h5>
                      <span className="text-[10px] font-medium text-slate-400 shrink-0">
                        {notif.timeAgo}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-1.5 mt-2">
                      {notif.priority === "high" && (
                        <span className="px-1.5 py-0.2 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-black uppercase tracking-wider">
                          High Priority
                        </span>
                      )}
                      {notif.priority === "medium" && (
                        <span className="px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold uppercase tracking-wider">
                          Advisory
                        </span>
                      )}
                      {notif.type === "sibat" && (
                        <span className="px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[9px] font-bold uppercase tracking-wider">
                          SIBAT
                        </span>
                      )}

                      {notif.link && (
                        <span className="text-[10px] text-slate-400 group-hover:text-[#1E4D2B] transition-colors flex items-center gap-0.5 ml-1 font-semibold">
                          View details <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      )}

                      {!notif.read && (
                        <span className="ml-auto w-2 h-2 rounded-full bg-emerald-600 ring-4 ring-emerald-100 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Padre Garcia MAO Agriculture Portal</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
