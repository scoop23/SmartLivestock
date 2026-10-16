"use client";

import React, { useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  ChevronDown,
  Eye,
  EyeOff,
  Trash2,
  Inbox,
  Bell,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/components/ui/utils";
import api from "@/lib/axios";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BackendNotification,
  BackendNotificationsResponse,
  HeaderNotificationsProps,
  resolveNotificationLink,
} from "./header-notifications";

interface NotificationsViewProps {
  variant?: HeaderNotificationsProps["variant"];
  title?: string;
  subtitle?: string;
}

type FilterStatus = "all" | "read" | "unread";

function getDateGroup(dateString: string): string {
  if (!dateString) return "Older";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Older";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today.getTime() - targetDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

const getInitials = (text: string) => {
  const parts = text.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (text.slice(0, 2) || "NO").toUpperCase();
};

const getAvatarColor = (id: number) => {
  const colors = [
    "bg-purple-100 text-purple-700 border-purple-200",
    "bg-blue-100 text-blue-700 border-blue-200",
    "bg-emerald-100 text-emerald-700 border-emerald-200",
    "bg-amber-100 text-amber-700 border-amber-200",
    "bg-rose-100 text-rose-700 border-rose-200",
    "bg-indigo-100 text-indigo-700 border-indigo-200",
  ];
  return colors[id % colors.length];
};

export function NotificationsView({
  variant = "admin",
  title = "Notifications",
  subtitle,
}: NotificationsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<BackendNotification | null>(null);

  // Fetch notifications
  const { data, isLoading } = useQuery<BackendNotificationsResponse>({
    queryKey: ["header-notifications"],
    queryFn: async () => {
      const res = await api.get("/api/notifications/?limit=100");
      return res.data;
    },
    refetchInterval: 30000,
  });

  const notifications = data?.notifications || [];

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      if (filterStatus === "read") return notif.is_read;
      if (filterStatus === "unread") return !notif.is_read;
      return true;
    });
  }, [notifications, filterStatus]);

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: BackendNotification[] } = {};

    filteredNotifications.forEach((notif) => {
      const groupKey = getDateGroup(notif.created_at);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(notif);
    });

    // Ensure Today and Yesterday come first if present
    const orderedKeys: string[] = [];
    if (groups["Today"]) orderedKeys.push("Today");
    if (groups["Yesterday"]) orderedKeys.push("Yesterday");
    Object.keys(groups).forEach((key) => {
      if (key !== "Today" && key !== "Yesterday") {
        orderedKeys.push(key);
      }
    });

    return orderedKeys.map((key) => ({
      groupName: key,
      items: groups[key],
    }));
  }, [filteredNotifications]);

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: async ({ id, unread }: { id: number; unread?: boolean }) => {
      const res = await api.patch(`/api/notifications/${id}/read/`, { unread: !!unread });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["header-notifications"] });
    },
    onError: () => {
      toast.error("Failed to update notification status.");
    },
  });

  // Bulk actions on checked items
  const handleBulkAction = async (action: "read" | "unread" | "delete") => {
    const idsToActOn = selectedIds.length > 0
      ? selectedIds
      : filteredNotifications.map((n) => n.id);

    if (idsToActOn.length === 0) {
      toast.info("No notifications selected.");
      return;
    }

    try {
      if (action === "read") {
        await Promise.all(
          idsToActOn.map((id) => api.patch(`/api/notifications/${id}/read/`, { unread: false }))
        );
        toast.success(`Marked ${idsToActOn.length} notifications as read.`);
      } else if (action === "unread") {
        await Promise.all(
          idsToActOn.map((id) => api.patch(`/api/notifications/${id}/read/`, { unread: true }))
        );
        toast.success(`Marked ${idsToActOn.length} notifications as unread.`);
      } else if (action === "delete") {
        await Promise.all(
          idsToActOn.map((id) => api.delete(`/api/notifications/${id}/`))
        );
        toast.success(`Deleted ${idsToActOn.length} notifications.`);
      }
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["header-notifications"] });
    } catch {
      toast.error("Some operations could not be completed.");
      queryClient.invalidateQueries({ queryKey: ["header-notifications"] });
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredNotifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map((n) => n.id));
    }
  };

  const handleOpenDetails = (notif: BackendNotification) => {
    if (!notif.is_read) {
      markReadMutation.mutate({ id: notif.id, unread: false });
    }

    const resolvedLink = resolveNotificationLink(notif, variant, user?.role, pathname);
    if (resolvedLink) {
      router.push(resolvedLink);
    } else {
      setSelectedNotification(notif);
    }
  };

  // Helper to format notification title and highlighted tags
  const renderFormattedTitle = (titleText: string, messageText: string) => {
    const matchTag = titleText.match(/(#[A-Za-z0-9_-]+|\[[^\]]+\]|\b(?:DIS|MOR)-\d+\b|\b\d{6,}\b)/);
    if (matchTag && matchTag.index !== undefined) {
      const tag = matchTag[0];
      const before = titleText.slice(0, matchTag.index);
      const after = titleText.slice(matchTag.index + tag.length);

      return (
        <span className="text-slate-800 text-sm font-medium">
          <span className="font-semibold text-slate-900">{before}</span>
          <span className="text-purple-600 font-semibold">{tag}</span>
          <span>{after}</span>
        </span>
      );
    }

    return (
      <span className="text-slate-900 text-sm font-semibold">
        {titleText}
      </span>
    );
  };

  return (
    <div className="w-full flex-1">
      {/* ── PageHeader for visual consistency across role portals ── */}
      <PageHeader
        title={title}
        subtitle={subtitle || "Manage your livestock alerts, inspection updates, and activity notices."}
        variant={variant}
        icon={<Bell className={cn("size-5", variant === "admin" ? "text-slate-800" : "text-white")} />}
        maxWidthClass="w-full"
        showNotifications={false}
        hideIconOnMobile
      />

      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Action Controls matching mock */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          {/* Purple Select Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm h-9 px-4 rounded-lg flex items-center gap-1.5 shadow-sm transition-all focus-visible:ring-purple-400 cursor-pointer"
              >
                <span>
                  Select{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
                </span>
                <ChevronDown className="w-4 h-4 ml-0.5 opacity-90" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44 p-1 shadow-lg border border-slate-200">
              <DropdownMenuItem
                onClick={() => handleBulkAction("read")}
                className="text-xs sm:text-sm text-purple-700 hover:text-purple-900 hover:bg-purple-50 font-medium cursor-pointer"
              >
                <Eye className="w-4 h-4 mr-2 text-purple-600" />
                Mark as Read
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleBulkAction("unread")}
                className="text-xs sm:text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium cursor-pointer"
              >
                <EyeOff className="w-4 h-4 mr-2 text-slate-500" />
                Mark as UnRead
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleBulkAction("delete")}
                className="text-xs sm:text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-medium cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-2 text-rose-500" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Top Right Status Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="bg-white hover:bg-slate-50 border-slate-200 text-slate-800 font-medium text-sm h-9 px-3.5 rounded-lg flex items-center justify-between gap-2 shadow-2xs cursor-pointer min-w-[95px]"
              >
                <span className="capitalize">{filterStatus}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 p-1 shadow-lg border border-slate-200">
              <DropdownMenuItem
                onClick={() => setFilterStatus("all")}
                className={cn(
                  "text-xs sm:text-sm font-medium cursor-pointer",
                  filterStatus === "all" ? "text-purple-600 font-bold bg-purple-50/70" : "text-slate-700 hover:bg-slate-50"
                )}
              >
                All
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterStatus("read")}
                className={cn(
                  "text-xs sm:text-sm font-medium cursor-pointer",
                  filterStatus === "read" ? "text-purple-600 font-bold bg-purple-50/70" : "text-slate-700 hover:bg-slate-50"
                )}
              >
                Read
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterStatus("unread")}
                className={cn(
                  "text-xs sm:text-sm font-medium cursor-pointer",
                  filterStatus === "unread" ? "text-purple-600 font-bold bg-purple-50/70" : "text-slate-700 hover:bg-slate-50"
                )}
              >
                Unread
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

      {/* Select All Bar (Visible when filtered items exist) */}
      {filteredNotifications.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={
                selectedIds.length > 0 &&
                selectedIds.length === filteredNotifications.length
              }
              onCheckedChange={handleSelectAll}
              className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600 size-4.5 rounded"
            />
            <span className="font-medium text-slate-700">
              Select all {filteredNotifications.length} notifications
            </span>
          </label>

          <span className="text-slate-400">
            {selectedIds.length > 0 ? `${selectedIds.length} selected` : `Showing ${filteredNotifications.length} notifications`}
          </span>
        </div>
      )}

      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-4 pt-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-20 bg-white rounded-xl border border-slate-100 shadow-2xs animate-pulse"
            />
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-3">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No notifications found</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1">
            {filterStatus === "all"
              ? "You do not have any notifications right now."
              : `There are currently no ${filterStatus} notifications to display.`}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedNotifications.map((group) => (
            <div key={group.groupName} className="space-y-3">
              {/* Group Title (e.g. Yesterday, Today) */}
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {group.groupName}
              </h2>

              <div className="space-y-3">
                {group.items.map((notif) => {
                  const isChecked = selectedIds.includes(notif.id);
                  const avatarColor = getAvatarColor(notif.id);

                  return (
                    <div
                      key={notif.id}
                      className={cn(
                        "group bg-white rounded-xl border transition-all duration-150 p-3.5 sm:px-5 sm:py-4 shadow-2xs hover:shadow-xs",
                        isChecked
                          ? "border-purple-300 bg-purple-50/20"
                          : !notif.is_read
                          ? "border-slate-200/90 bg-white"
                          : "border-slate-100 bg-slate-50/40"
                      )}
                    >
                      {/* Mobile & Desktop Responsive Layout */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                        {/* Left Section: Checkbox + Avatar + Content */}
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                          {/* Checkbox */}
                          <div className="pt-0.5 sm:pt-0 shrink-0">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleSelect(notif.id)}
                              className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600 size-4.5 rounded"
                            />
                          </div>

                          {/* Avatar Circle */}
                          <div
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border shadow-2xs select-none",
                              avatarColor
                            )}
                          >
                            {getInitials(notif.title)}
                          </div>

                          {/* Text Block */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-1.5 leading-snug">
                              {renderFormattedTitle(notif.title, notif.message)}
                            </div>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2 sm:line-clamp-1 leading-relaxed">
                              {notif.message}
                            </p>
                          </div>
                        </div>

                        {/* Right Section: Time ago + Read/Unread Status + Details Button */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 sm:shrink-0 pl-7 sm:pl-0">
                          {/* Relative Timestamp */}
                          <span className="text-xs sm:text-sm text-slate-400 whitespace-nowrap">
                            {notif.time_ago || "recently"}
                          </span>

                          {/* Status text */}
                          <span
                            className={cn(
                              "text-xs sm:text-sm font-semibold whitespace-nowrap min-w-[50px] text-right sm:text-center",
                              !notif.is_read ? "text-purple-600" : "text-slate-400"
                            )}
                          >
                            {!notif.is_read ? "Unread" : "Read"}
                          </span>

                          {/* Details Button */}
                          <Button
                            type="button"
                            onClick={() => handleOpenDetails(notif)}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm h-8.5 px-4 rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                          >
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fallback Dialog for full notification details */}
      <Dialog
        open={!!selectedNotification}
        onOpenChange={(open) => !open && setSelectedNotification(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {selectedNotification?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {selectedNotification?.time_ago} • {selectedNotification?.priority_display} priority
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 text-sm text-slate-700 leading-relaxed border-y border-slate-100 my-2">
            {selectedNotification?.message}
          </div>

          <DialogFooter className="flex flex-row justify-between gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedNotification(null)}
            >
              Close
            </Button>
            {selectedNotification && resolveNotificationLink(selectedNotification, variant, user?.role, pathname) && (
              <Button
                type="button"
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => {
                  const link = resolveNotificationLink(selectedNotification, variant, user?.role, pathname);
                  setSelectedNotification(null);
                  if (link) router.push(link);
                }}
              >
                Go to Record
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
