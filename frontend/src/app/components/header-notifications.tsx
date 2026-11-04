"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { getNotificationQueryKey } from "@/lib/notification-query";
import { useIsMutating,useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  CloudSun,
  ExternalLink,
  FileText,
  Inbox,
  Info,
  MoreVertical,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { usePathname,useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
  location?: string | null;
}

export interface HeaderNotificationsProps {
  variant?: "admin" | "farmer" | "sibat" | "cbat" | "auction" | "slaughterhouse";
  className?: string;
}

export interface BackendNotification {
  id: number;
  type: NotificationType;
  type_display: string;
  priority: "high" | "medium" | "low";
  priority_display: string;
  title: string;
  message: string;
  is_read: boolean;
  link?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: number | null;
  related_barangay_name?: string | null;
  created_at: string;
  time_ago: string;
}

export interface BackendNotificationsResponse {
  unread_count: number;
  notifications: BackendNotification[];
}

export const getEffectiveRole = (
  variant?: HeaderNotificationsProps["variant"],
  userRole?: string | null,
  currentPath?: string | null
): "admin" | "farmer" | "sibat" | "auction" | "slaughterhouse" => {
  // 1. Path-based detection (most accurate for the active portal workspace)
  if (currentPath) {
    if (currentPath.startsWith("/sibat")) return "sibat";
    if (
      currentPath.startsWith("/farmer") ||
      currentPath.startsWith("/livestock-") ||
      currentPath.startsWith("/production-") ||
      currentPath.startsWith("/report-") ||
      currentPath.startsWith("/alerts") ||
      currentPath.startsWith("/gis-user-map")
    ) {
      return "farmer";
    }
    if (currentPath.startsWith("/auction")) return "auction";
    if (currentPath.startsWith("/slaughterhouse")) return "slaughterhouse";
    if (
      currentPath.startsWith("/admin") ||
      currentPath.startsWith("/data-validation") ||
      currentPath.startsWith("/data-overview") ||
      currentPath.startsWith("/gis-map") ||
      currentPath.startsWith("/reports") ||
      currentPath.startsWith("/analytics") ||
      currentPath.startsWith("/analysis") ||
      currentPath.startsWith("/user-management")
    ) {
      return "admin";
    }
  }

  // 2. Auth user role detection
  const normalized = userRole?.toUpperCase();
  if (normalized === "SIBAT" || normalized === "CBAT") return "sibat";
  if (normalized === "FARMER") return "farmer";
  if (normalized === "AUCTION") return "auction";
  if (normalized === "SLAUGHTERHOUSE" || normalized === "MEAT_INSPECTOR") return "slaughterhouse";
  if (normalized === "MAO" || normalized === "ADMIN") return "admin";

  // 3. Fallback to passed variant
  if (variant && variant !== "admin") return variant === "cbat" ? "sibat" : variant;
  if (variant === "admin" && (!normalized || normalized === "MAO" || normalized === "ADMIN")) return "admin";

  return "farmer";
};

export const getNotificationRouteForRole = (
  variant?: HeaderNotificationsProps["variant"],
  userRole?: string | null,
  currentPath?: string | null
): string => {
  const role = getEffectiveRole(variant, userRole, currentPath);
  switch (role) {
    case "farmer":
      return "/farmer/notifications";
    case "sibat":
      return "/sibat/notifications";
    case "auction":
      return "/auction/notifications";
    case "slaughterhouse":
      return "/slaughterhouse/notifications";
    case "admin":
    default:
      return "/notifications";
  }
};

export const resolveNotificationLink = (
  notification: BackendNotification,
  variant: HeaderNotificationsProps["variant"],
  userRole?: string | null,
  currentPath?: string | null
) => {
  const effectiveVariant = getEffectiveRole(variant, userRole, currentPath);
  if (effectiveVariant === "admin") {
    const adminRoutes: Record<string, (id: number) => string> = {
      livestock_inventory: (id) => `/livestock-records?tab=individual&recordId=${id}`,
      livestock_batch: (id) => `/livestock-records?tab=herd&batchId=${id}`,
      production_record: (id) => `/production-dashboard?recordId=${id}`,
      program_booking: (id) => `/schedules?bookingId=${id}`,
      livestock_sale: (id) => `/ownership-transfers?tab=ownership&saleId=${id}`,
      calving_record: (id) => `/livestock-records?tab=individual&recordId=${id}`,
      disease_case: (id) => `/disease-mortality?tab=disease&recordId=${id}`,
      mortality_record: (id) => `/disease-mortality?tab=mortality&recordId=${id}`,
      ownership_transfer: (id) => `/ownership-transfers?transferId=${id}`,
      census_submission: (id) => `/data-validation?domain=census&recordType=CENSUS&recordId=${id}`,
      inspection: (id) => `/ownership-transfers?tab=inspections&inspectionId=${id}`,
      slaughter_record: () => `/slaughter-record-review`,
      slaughter_report: () => `/slaughter-record-review`,
    };
    const routeFromEntity = notification.related_entity_type
      ? adminRoutes[notification.related_entity_type]
      : undefined;
    if (routeFromEntity && notification.related_entity_id != null) {
      return routeFromEntity(notification.related_entity_id);
    }

    // Older livestock resubmission notices already contain the primary key in
    // their URL but predate the explicit record type parameter.
    const oldReviewId = notification.link?.match(/[?&](?:reviewId|recordId)=(\d+)/)?.[1];
    if (oldReviewId && (notification.title.includes("Livestock Entry Resubmitted") || notification.title.includes("Livestock Entry"))) {
      return `/livestock-records?tab=individual&recordId=${oldReviewId}`;
    }
    if (oldReviewId && (notification.title.includes("Herd Resubmitted") || notification.title.includes("Batch Resubmitted") || notification.title.includes("Livestock Batch"))) {
      return `/livestock-records?tab=herd&batchId=${oldReviewId}`;
    }

    // Health notifications with DIS / MOR code
    const diseaseId = notification.title.match(/\bDIS-(\d+)\b/i)?.[1]
      ?? notification.message.match(/\bDIS-(\d+)\b/i)?.[1]
      ?? notification.link?.match(/[?&]recordId=(\d+)/)?.[1];
    if (diseaseId && /disease|dis-\d+/i.test(notification.title + " " + notification.message + " " + (notification.link || ""))) {
      return `/disease-mortality?tab=disease&recordId=${diseaseId}`;
    }

    const mortalityId = notification.title.match(/\bMOR-(\d+)\b/i)?.[1]
      ?? notification.message.match(/\bMOR-(\d+)\b/i)?.[1]
      ?? notification.link?.match(/[?&]recordId=(\d+)/)?.[1];
    if (mortalityId && /mortality|mor-\d+/i.test(notification.title + " " + notification.message + " " + (notification.link || ""))) {
      return `/disease-mortality?tab=mortality&recordId=${mortalityId}`;
    }

    // Inspection notifications with inspection ID
    const inspectionId = notification.message.match(/\bInspection\s*#(\d+)/i)?.[1]
      ?? notification.title.match(/\bInspection\s*#(\d+)/i)?.[1]
      ?? notification.link?.match(/[?&]inspectionId=(\d+)/)?.[1];
    if (inspectionId || /inspection/i.test(notification.title + " " + notification.message)) {
      return `/ownership-transfers?tab=inspections${inspectionId ? `&inspectionId=${inspectionId}` : ""}`;
    }

    // Ownership transfer notices
    const transferId = notification.message.match(/\bTransfer\s*#(\d+)/i)?.[1]
      ?? notification.title.match(/\bTransfer\s*#(\d+)/i)?.[1]
      ?? notification.link?.match(/[?&]transferId=(\d+)/)?.[1];
    if (transferId || /transfer/i.test(notification.title + " " + notification.message)) {
      return `/ownership-transfers${transferId ? `?transferId=${transferId}` : ""}`;
    }

    // Slaughterhouse records
    if (/slaughter/i.test(notification.title + " " + notification.message + " " + (notification.link || ""))) {
      return `/slaughter-record-review`;
    }

    // Legacy links starting with /data-validation or /admin/data-validation
    const rawLink = notification.link || "";
    if (rawLink.includes("/data-validation")) {
      try {
        const url = new URL(rawLink, "http://localhost");
        const domain = url.searchParams.get("domain")?.toLowerCase();
        const recordType = (url.searchParams.get("recordType") || "").toUpperCase();
        const recordId = url.searchParams.get("recordId") || url.searchParams.get("reviewId") || url.searchParams.get("highlightId")?.replace(/^(batch-|ind-)/, "");
        const transferIdParam = url.searchParams.get("transferId");
        const slaughterReportId = url.searchParams.get("slaughterReportId");

        if (domain === "census" || recordType === "CENSUS") {
          return rawLink.replace("/admin/data-validation", "/data-validation");
        }
        if (domain === "slaughter" || slaughterReportId) {
          return "/slaughter-record-review";
        }
        if (recordType === "DISEASE" || /disease/i.test(notification.title)) {
          return `/disease-mortality?tab=disease${recordId ? `&recordId=${recordId}` : ""}`;
        }
        if (recordType === "MORTALITY" || /mortality/i.test(notification.title)) {
          return `/disease-mortality?tab=mortality${recordId ? `&recordId=${recordId}` : ""}`;
        }
        if (recordType === "INSPECTION" || /inspection/i.test(notification.title)) {
          return `/ownership-transfers?tab=inspections${recordId ? `&inspectionId=${recordId}` : ""}`;
        }
        if (recordType === "SALE" || /sale/i.test(notification.title)) {
          return `/ownership-transfers?tab=ownership${recordId ? `&saleId=${recordId}` : ""}`;
        }
        if (recordType === "CALVING" || /calving|birth/i.test(notification.title)) {
          return `/livestock-records?tab=individual${recordId ? `&recordId=${recordId}` : ""}`;
        }
        if (domain === "inventory" || recordType === "INVENTORY" || recordType === "BATCH") {
          if (recordType === "BATCH" || /batch|herd/i.test(notification.title)) {
            return `/livestock-records?tab=herd${recordId ? `&batchId=${recordId}` : ""}`;
          }
          return `/livestock-records?tab=individual${recordId ? `&recordId=${recordId}` : ""}`;
        }
        if (domain === "incidents") {
          return `/disease-mortality`;
        }
        if (domain === "transfers" || transferIdParam) {
          return `/ownership-transfers${transferIdParam ? `?transferId=${transferIdParam}` : ""}`;
        }
      } catch {
        // Fallback below
      }
    }

    const combinedText = `${notification.title} ${notification.message}`.toLowerCase();
    if (combinedText.includes("disease")) {
      return "/disease-mortality?tab=disease";
    }
    if (combinedText.includes("mortality") || combinedText.includes("death")) {
      return "/disease-mortality?tab=mortality";
    }
    if (combinedText.includes("inspection")) {
      return "/ownership-transfers?tab=inspections";
    }
    if (combinedText.includes("transfer") || combinedText.includes("clearance") || combinedText.includes("ownership")) {
      return "/ownership-transfers";
    }
    if (combinedText.includes("slaughter")) {
      return "/slaughter-record-review";
    }
    if (combinedText.includes("herd") || combinedText.includes("batch")) {
      return "/livestock-records?tab=herd";
    }
    if (combinedText.includes("livestock") || combinedText.includes("entry") || combinedText.includes("animal")) {
      return "/livestock-records?tab=individual";
    }
  }

  if (effectiveVariant === "sibat") {
    const reviewRoutes: Record<string, (id: number) => string> = {
      livestock_inventory: (id) => `/sibat?tab=inventory&reviewType=INVENTORY&reviewId=${id}`,
      livestock_batch: (id) => `/sibat?tab=inventory&reviewType=BATCH&reviewId=${id}`,
      production_record: () => `/sibat`,
      program_booking: (id) => `/sibat-scheduling?bookingId=${id}`,
      livestock_sale: (id) => `/sibat?tab=production&reviewType=SALE&reviewId=${id}`,
      calving_record: (id) => `/sibat?tab=calving&reviewType=CALVING&reviewId=${id}`,
      disease_case: (id) => `/sibat-alerts?recordType=DISEASE&recordId=${id}`,
      mortality_record: (id) => `/sibat-alerts?recordType=MORTALITY&recordId=${id}`,
      ownership_transfer: (id) => `/sibat/ownership-transfers?transferId=${id}`,
      census_submission: (id) => `/sibat?tab=census&censusId=${id}`,
    };
    const routeFromEntity = notification.related_entity_type
      ? reviewRoutes[notification.related_entity_type]
      : undefined;
    if (routeFromEntity && notification.related_entity_id != null) {
      return routeFromEntity(notification.related_entity_id);
    }

    const oldReviewId = notification.title.match(/\b(inventory|batch|record|sale|calving)\s*#(\d+)/i);
    if (oldReviewId) {
      const entityType = oldReviewId[1].toLowerCase();
      const reviewType = entityType === "inventory" ? "INVENTORY"
        : entityType === "batch" ? "BATCH"
          : entityType === "sale" ? "SALE"
            : entityType === "calving" ? "CALVING" : "PRODUCTION";
      const tab = reviewType === "INVENTORY" || reviewType === "BATCH" ? "inventory" : reviewType === "CALVING" ? "calving" : "production";
      return `/sibat?tab=${tab}&reviewType=${reviewType}&reviewId=${oldReviewId[2]}`;
    }

    // Older notices did not store an entity ID. Pass their text for a careful
    // exact match against the authorized queue rather than opening its home tab.
    const legacyTypes: Array<[string, string]> = [
      ["New Livestock Entry", "INVENTORY"],
      ["Livestock Entry Resubmitted", "INVENTORY"],
      ["New Livestock Batch", "BATCH"],
      ["Herd Resubmitted", "BATCH"],
      ["New Production Entry", "PRODUCTION"],
      ["Production Record Resubmitted", "PRODUCTION"],
      ["New Livestock Sale", "SALE"],
      ["Sale Resubmitted", "SALE"],
      ["New Calving Entry", "CALVING"],
      ["Calving Record Resubmitted", "CALVING"],
    ];
    const legacyType = legacyTypes.find(([titlePart]) => notification.title.includes(titlePart))?.[1];
    if (legacyType) {
      const tab = legacyType === "CALVING" ? "calving" : legacyType === "INVENTORY" || legacyType === "BATCH" ? "inventory" : "production";
      const params = new URLSearchParams({ tab, legacyType, legacyMessage: notification.message });
      return `/sibat?${params.toString()}`;
    }

    const healthId = notification.title.match(/\b(DIS|MOR)-(\d+)\b/i);
    const healthDeclarationId = notification.title.match(/\b(disease|mortality) declaration\s*#(\d+)/i);
    if (healthId || healthDeclarationId) {
      const type = healthId
        ? healthId[1].toUpperCase() === "DIS" ? "DISEASE" : "MORTALITY"
        : healthDeclarationId?.[1].toLowerCase() === "disease" ? "DISEASE" : "MORTALITY";
      return `/sibat-alerts?recordType=${type}&recordId=${healthId?.[2] ?? healthDeclarationId?.[2]}`;
    }
  }

  if (effectiveVariant === "farmer") {
    if (
      /biosecurity|monitoring radius|disease advisory/i.test(
        notification.title + " " + notification.message,
      )
    ) {
      return "/gis-user-map?layer=disease";
    }

    const farmerRoutes: Record<string, (id: number) => string> = {
      livestock_inventory: (id) => `/livestock-inventory/${id}`,
      production_record: (id) => `/production-dashboard/history?recordId=${id}`,
      program_booking: (id) => `/farmer-scheduling?bookingId=${id}`,
      disease_case: (id) => `/report-observation?reportId=DIS-${id}`,
      mortality_record: (id) => `/report-observation?reportId=MOR-${id}`,
    };
    const routeFromEntity = notification.related_entity_type
      ? farmerRoutes[notification.related_entity_type]
      : undefined;
    if (routeFromEntity && notification.related_entity_id != null) {
      return routeFromEntity(notification.related_entity_id);
    }

    // Older health notifications may not include related entity metadata.
    const healthId = notification.title.match(/\b(DIS|MOR)-(\d+)\b/i);
    const healthDeclarationId = notification.title.match(/\b(disease|mortality) declaration\s*#(\d+)/i);
    if (healthId || healthDeclarationId) {
      const type = healthId
        ? healthId[1].toUpperCase() === "DIS" ? "DIS" : "MOR"
        : healthDeclarationId?.[1].toLowerCase() === "disease" ? "DIS" : "MOR";
      const id = healthId?.[2] ?? healthDeclarationId?.[2];
      return `/report-observation?reportId=${type}-${id}`;
    }
  }

  if (
    notification.related_entity_type === "PROGRAM_SCHEDULE" &&
    notification.related_entity_id
  ) {
    return `/farmer-scheduling?scheduleId=${notification.related_entity_id}`;
  }

  if (notification.link !== "/livestock-inventory") {
    // Account status notices used to send signed-in users back to the login
    // screen. The notification is already being opened from an authenticated
    // workspace, so take them to their account details instead of creating a
    // confusing apparent logout.
    if (notification.title === "Account status updated" && notification.link === "/login") {
      return "/profile";
    }
    if (effectiveVariant === "admin" && notification.link?.startsWith("/data-validation") && !notification.link.includes("domain=census")) {
      return "/disease-mortality";
    }
    return notification.link || undefined;
  }

  const isLivestockReviewNotification = [
    "Verified by SIBAT Inspector",
    "Livestock Record Approved",
    "Revision Required on Livestock Record",
  ].includes(notification.title);
  const tagMatch = notification.message.match(/\[([^\]]+)\]/);

  if (isLivestockReviewNotification && tagMatch?.[1] && !tagMatch[1].startsWith("Batch (")) {
    return `/livestock-inventory/${encodeURIComponent(tagMatch[1])}`;
  }

  return notification.link;
};

const getSafeNotificationPath = (link: string | null | undefined): string | undefined => {
  if (!link || !link.startsWith("/") || link.startsWith("//") || link.startsWith("/\\")) {
    return undefined;
  }
  return link;
};

export function HeaderNotifications({
  variant = "admin",
  className = "",
}: HeaderNotificationsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const notificationUserIdentity = user?.email ?? user?.username ?? null;
  const notificationQueryKey = getNotificationQueryKey(notificationUserIdentity);
  const notificationActionsPending = useIsMutating({ mutationKey: ["notification-actions"] }) > 0;
  const [filter, setFilter] = useState<"all" | "unread" | "action">("all");
  const [isOpen, setIsOpen] = useState(false);
  // Fetch real notifications from Django Backend
  const { data: backendData, isLoading } = useQuery<BackendNotificationsResponse | null>({
    queryKey: notificationQueryKey,
    queryFn: async ({ signal }) => {
      try {
        const res = await api.get<BackendNotificationsResponse>("/api/notifications/", { signal });
        return res.data;
      } catch (err) {
        return null;
      }
    },
    refetchInterval: () => queryClient.isMutating({ mutationKey: ["notification-actions"] }) ? false : 15000,
    refetchOnWindowFocus: !notificationActionsPending,
    refetchOnMount: "always",
    staleTime: 5000,
    enabled: Boolean(notificationUserIdentity),
  });

  // Mark single as read mutation
  const markReadMutation = useMutation({
    mutationKey: ["notification-actions"],
    mutationFn: async (id: string) => {
      const numericId = parseInt(id, 10);
      if (!isNaN(numericId)) {
        await api.post(`/api/notifications/${numericId}/read/`);
      }
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: notificationQueryKey });
      const previousData = queryClient.getQueryData<BackendNotificationsResponse>(notificationQueryKey);

      if (previousData) {
        const numericId = parseInt(id, 10);
        queryClient.setQueryData<BackendNotificationsResponse>(notificationQueryKey, {
          ...previousData,
          unread_count: Math.max(0, previousData.unread_count - (previousData.notifications.some((n) => n.id === numericId && !n.is_read) ? 1 : 0)),
          notifications: previousData.notifications.map((n) =>
            n.id === numericId ? { ...n, is_read: true } : n
          )
        });
      }
      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(notificationQueryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKey });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationKey: ["notification-actions"],
    mutationFn: async () => {
      await api.post("/api/notifications/mark-all-read/");
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationQueryKey });
      const previousData = queryClient.getQueryData<BackendNotificationsResponse>(notificationQueryKey);

      if (previousData) {
        queryClient.setQueryData<BackendNotificationsResponse>(notificationQueryKey, {
          ...previousData,
          unread_count: 0,
          notifications: previousData.notifications.map((n) => ({ ...n, is_read: true })),
        });
      }
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(notificationQueryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationKey: ["notification-actions"],
    mutationFn: async (id: number) => {
      await api.delete(`/api/notifications/${id}/`);
    },
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: notificationQueryKey });
      const previousData = queryClient.getQueryData<BackendNotificationsResponse | null>(notificationQueryKey);
      if (previousData) {
        const removed = previousData.notifications.find((notification) => notification.id === id);
        queryClient.setQueryData<BackendNotificationsResponse>(notificationQueryKey, {
          ...previousData,
          notifications: previousData.notifications.filter((notification) => notification.id !== id),
          unread_count: Math.max(0, previousData.unread_count - (removed && !removed.is_read ? 1 : 0)),
        });
      }
      return { previousData };
    },
    onError: (_error, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(notificationQueryKey, context.previousData);
      }
      toast.error("Could not delete the notification. It has been restored.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKey });
    },
  });

  // Notifications come only from the authenticated user's backend inbox.
  // Static fallback cards can show another barangay's sample data as real alerts.
  const notifications: HeaderNotification[] = (backendData?.notifications || []).map((n) => ({
        id: String(n.id),
        type: n.type,
        priority: n.priority,
        title: n.title,
        message: n.message,
        date: n.created_at ? n.created_at.split("T")[0] : "",
        timeAgo: n.time_ago || "Just now",
        read: n.is_read,
        link: getSafeNotificationPath(resolveNotificationLink(n, variant, user?.role, pathname)),
        location: n.related_barangay_name,
      }));

  const unreadCount = backendData?.unread_count ?? notifications.filter((n) => !n.read).length;

  const isActionRequired = (n: HeaderNotification) => {
    const title = n.title.toLowerCase();
    const msg = n.message.toLowerCase();
    return (
      n.priority === "high" ||
      n.type === "disease" ||
      title.includes("disease") ||
      title.includes("mortality") ||
      title.includes("review") ||
      title.includes("dis-") ||
      title.includes("mor-") ||
      msg.includes("requires") ||
      msg.includes("verification")
    );
  };

  const actionCount = notifications.filter(isActionRequired).length;

  const handleMarkAsRead = (id: string, link?: string) => {
    if (!notificationActionsPending) {
      markReadMutation.mutate(id);
    }
    if (link) {
      setIsOpen(false);
      router.push(link);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllReadMutation.mutate();
  };

  const handleDeleteNotification = (id: string) => {
    const numId = Number(id);
    if (!isNaN(numId)) deleteMutation.mutate(numId);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "action") return isActionRequired(n);
    return true;
  });

  const getNotificationLocation = (notif: HeaderNotification) => {
    if (notif.location) return notif.location;
    const match =
      notif.message.match(/Brgy\.?\s+([A-Za-z\-]+)/i) ||
      notif.message.match(/Barangay\s+([A-Za-z\-]+)/i) ||
      notif.title.match(/Brgy\.?\s+([A-Za-z\-]+)/i) ||
      notif.title.match(/Barangay\s+([A-Za-z\-]+)/i);
    if (match) return match[1];

    const role = user?.role?.toUpperCase();
    if (role === "FARMER") return user?.barangay || "Location not specified";
    if (role === "SIBAT" || role === "CBAT") {
      if (user?.accessScope === "ALL_BARANGAYS") return "All barangays";
      return user?.assignedBarangayName || "Unassigned";
    }

    return "Location not specified";
  };

  const getNotificationStatusBadge = (notif: HeaderNotification) => {
    const title = notif.title.toLowerCase();
    const msg = notif.message.toLowerCase();

    if (
      title.includes("disease") ||
      title.includes("mortality") ||
      title.includes("dis-") ||
      title.includes("mor-") ||
      msg.includes("requires") ||
      msg.includes("verification") ||
      notif.priority === "high"
    ) {
      return {
        label: "Needs Review",
        className: "bg-[#FEF0F2] text-[#E11D48] border-[#FECDD3]",
      };
    }

    if (
      title.includes("sent to mao") ||
      title.includes("forwarded") ||
      title.includes("submitted to mao") ||
      title.includes("for review") ||
      msg.includes("forwarded to the mao")
    ) {
      return {
        label: "Sent to MAO",
        className: "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]",
      };
    }

    if (
      title.includes("vaccination") ||
      title.includes("scheduled") ||
      title.includes("activity") ||
      title.includes("reminder") ||
      notif.type === "vaccination"
    ) {
      return {
        label: "Reminder",
        className: "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]",
      };
    }

    if (
      title.includes("approved") ||
      title.includes("reviewed") ||
      title.includes("completed") ||
      title.includes("updated by mao") ||
      msg.includes("has been reviewed") ||
      msg.includes("approved")
    ) {
      return {
        label: "Completed",
        className: "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]",
      };
    }

    if (notif.priority === "medium") {
      return {
        label: "Advisory",
        className: "bg-amber-50 text-amber-700 border-amber-200/60",
      };
    }

    return null;
  };

  const getNotificationActionText = (notif: HeaderNotification) => {
    const title = notif.title.toLowerCase();
    const link = notif.link?.toLowerCase() || "";
    if (
      link.includes("farmer-scheduling") ||
      title.includes("open program") ||
      title.includes("program")
    ) {
      return "View Report";
    }
    if (
      title.includes("vaccination") ||
      title.includes("activity") ||
      title.includes("schedule") ||
      notif.type === "vaccination"
    ) {
      return "View Details";
    }
    return "View Report";
  };

  const getCardIcon = (notif: HeaderNotification) => {
    const title = notif.title.toLowerCase();
    const msg = notif.message.toLowerCase();

    if (
      notif.type === "disease" ||
      title.includes("disease") ||
      title.includes("mortality") ||
      title.includes("dis-") ||
      title.includes("mor-") ||
      notif.priority === "high"
    ) {
      return {
        icon: AlertTriangle,
        bg: "bg-[#FDF2F4] text-[#E11D48] border-[#FCD9E0]",
      };
    }

    if (
      title.includes("sent to mao") ||
      title.includes("report") ||
      title.includes("document") ||
      title.includes("forwarded") ||
      notif.type === "sibat" ||
      notif.type === "production"
    ) {
      return {
        icon: FileText,
        bg: "bg-[#EDF5FD] text-[#2563EB] border-[#D8EBFA]",
      };
    }

    if (
      notif.type === "vaccination" ||
      title.includes("vaccination") ||
      title.includes("scheduled") ||
      title.includes("activity") ||
      msg.includes("scheduled")
    ) {
      return {
        icon: Calendar,
        bg: "bg-[#EAF5ED] text-[#15803D] border-[#D2ECD7]",
      };
    }

    return {
      icon: Info,
      bg: "bg-[#EDF5FB] text-[#0284C7] border-[#D9EBF9]",
    };
  };

  const buttonStyle = {
    admin:
      "bg-white hover:bg-slate-50 text-slate-800 border-slate-200/90 shadow-xs",
    farmer:
      "bg-white/15 hover:bg-white/25 text-white border-white/20 shadow-xs",
    sibat:
      "bg-white hover:bg-slate-50 text-slate-800 border-slate-200/90 shadow-xs",
    cbat:
      "bg-white hover:bg-slate-50 text-slate-800 border-slate-200/90 shadow-xs",
    auction:
      "bg-white hover:bg-slate-50 text-slate-800 border-slate-200/90 shadow-xs",
    slaughterhouse:
      "bg-white hover:bg-slate-50 text-slate-800 border-slate-200/90 shadow-xs",
  }[variant];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications (${unreadCount} unread)`}
          className={cn(
            "relative shrink-0 flex items-center justify-center w-11 h-11 rounded-full border transition-all duration-150 active:scale-95 cursor-pointer backdrop-blur-xs",
            buttonStyle,
            className
          )}
        >
          <Bell className="w-5 h-5 text-current" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-[#E11D48] text-white text-[11px] font-black shadow-xs ring-2 ring-white animate-in zoom-in-75">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={16}
        className="w-[480px] max-w-[calc(100vw-24px)] flex flex-col p-3 rounded-2xl border border-slate-200/90 shadow-2xl bg-white overflow-hidden text-slate-800 z-50 animate-in fade-in-50 zoom-in-95"
        style={{
          maxHeight: "min(560px, var(--radix-popover-content-available-height, calc(100dvh - 96px)))",
        }}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="size-9 sm:size-10 rounded-xl bg-[#EAF5EC] text-[#2D5A27] flex items-center justify-center shrink-0 shadow-2xs">
              <Bell className="size-5 text-[#2D5A27] stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none truncate">
                Notifications
              </h3>
              <p className="text-xs sm:text-[13px] text-slate-500 font-medium mt-1 sm:mt-1.5 truncate">
                Important updates and reports from your barangay.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#1A3D22] hover:text-[#2D5A27] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 pt-0.5"
            title="Mark all notifications as read"
          >
            <Check className="size-3.5 sm:size-4 stroke-[3]" />
            <span>Mark all as read</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 my-3 shrink-0">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-full text-xs font-bold transition-all text-center cursor-pointer",
              filter === "all"
                ? "bg-[#1A3D22] text-white shadow-xs"
                : "bg-[#EFF3F0] hover:bg-[#E4ECE6] text-slate-700"
            )}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-full text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer",
              filter === "unread"
                ? "bg-[#1A3D22] text-white shadow-xs"
                : "bg-[#EFF3F0] hover:bg-[#E4ECE6] text-slate-700"
            )}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="bg-[#F43F5E] text-white text-[10px] sm:text-xs font-black px-1.5 sm:px-2 py-0.5 rounded-full min-w-4 sm:min-w-5 text-center leading-none">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilter("action")}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-full text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer",
              filter === "action"
                ? "bg-[#1A3D22] text-white shadow-xs"
                : "bg-[#EFF3F0] hover:bg-[#E4ECE6] text-slate-700"
            )}
          >
            <span>Needs Action</span>
            {actionCount > 0 && (
              <span className="bg-[#F59E0B] text-white text-[10px] sm:text-xs font-black px-1.5 sm:px-2 py-0.5 rounded-full min-w-4 sm:min-w-5 text-center leading-none">
                {actionCount}
              </span>
            )}
          </button>
        </div>

        {/* Notifications Scrollable List */}
        <div className="space-y-1 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
          {isLoading ? (
            <div className="py-16 px-4 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-[#1E4D2B] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs sm:text-sm font-semibold text-slate-500">Checking for alerts...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-14 px-6 text-center flex flex-col items-center justify-center space-y-3">
              <div className="size-14 rounded-2xl bg-emerald-50 text-[#2D5A27] flex items-center justify-center shadow-xs">
                {filter === "unread" ? (
                  <CheckCircle2 className="size-7" />
                ) : (
                  <Inbox className="size-7" />
                )}
              </div>
              <p className="text-sm sm:text-base font-bold text-slate-800">
                {filter === "unread"
                  ? "No unread alerts"
                  : filter === "action"
                  ? "No actions required"
                  : "No notifications yet"}
              </p>
              <p className="text-xs text-slate-500 max-w-[280px] leading-relaxed">
                {filter === "unread"
                  ? "All updates and advisories have been acknowledged."
                  : filter === "action"
                  ? "There are no pending actions or high-priority reviews at this time."
                  : "Important updates, disease alerts, and reports from your barangay will appear here."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const cardIcon = getCardIcon(notif);
              const IconComp = cardIcon.icon;
              const badge = getNotificationStatusBadge(notif);
              const actionText = getNotificationActionText(notif);
              const location = getNotificationLocation(notif);

              return (
                <div
                  key={notif.id}
                  className="p-2.5 rounded-xl border border-transparent bg-white hover:bg-slate-50 transition-colors text-left flex items-start gap-2.5 relative group"
                >
                  {/* Left Icon Container */}
                  <div
                    className={cn(
                      "size-9 sm:size-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5",
                      cardIcon.bg
                    )}
                  >
                    <IconComp className="size-5 stroke-[2.2]" />
                  </div>

                  {/* Content Container */}
                  <div className="flex-1 min-w-0">
                    {/* Header Row: Title + Unread Dot + MoreVertical Menu */}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm sm:text-[15px] font-black text-slate-900 leading-snug tracking-tight">
                        {notif.title}
                      </h4>
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {!notif.read && (
                          <span className="size-2 sm:size-2.5 rounded-full bg-[#10B981] shrink-0" />
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                              aria-label="Notification actions"
                            >
                              <MoreVertical className="size-3.5 sm:size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl p-1 text-xs font-semibold">
                            {!notif.read && (
                              <DropdownMenuItem
                                onClick={() => handleMarkAsRead(notif.id)}
                                className="cursor-pointer"
                              >
                                <Check className="size-3.5 mr-1.5" />
                                <span>Mark as read</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDeleteNotification(notif.id)}
                              className="text-rose-600 focus:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="size-3.5 mr-1.5" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Description Body */}
                    <p className="text-xs sm:text-[13px] text-slate-600 mt-1 leading-relaxed font-normal">
                      {notif.message}
                    </p>

                    {/* Bottom Row: Time/Location + Badge + Action Button */}
                    <div className="flex items-center justify-between gap-2 mt-2 pt-0.5 flex-wrap">
                      <span className="text-[11px] sm:text-xs text-slate-400 font-medium">
                        {notif.timeAgo} • {location}
                      </span>

                      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto">
                        {badge && (
                          <span
                            className={cn(
                              "text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-md sm:rounded-lg border",
                              badge.className
                            )}
                          >
                            {badge.label}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(notif.id, notif.link)}
                          className="bg-[#EDF6FD] hover:bg-[#DBEEFF] text-[#0284C7] hover:text-[#0369A1] border border-[#BAE6FD] text-[11px] sm:text-xs font-bold px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl inline-flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>{actionText}</span>
                          <ArrowRight className="size-3 sm:size-3.5 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: View All Notifications */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            const targetRoute = getNotificationRouteForRole(variant, user?.role, pathname);
            router.push(targetRoute);
          }}
          className="w-full py-2.5 bg-[#EAF5EC] hover:bg-[#DCF0DF] text-[#1A3D22] border border-[#2D5A27]/25 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer mt-3 shadow-2xs active:scale-[0.99] shrink-0"
        >
          <FileText className="size-4 sm:size-4.5 stroke-[2.2]" />
          <span>View All Notifications</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
