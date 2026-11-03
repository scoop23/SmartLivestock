"use client";

import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { getNotificationQueryKey } from "@/lib/notification-query";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface IncomingNotification {
  id: number;
  title: string;
  message: string;
  is_read?: boolean;
  priority?: string;
  created_at?: string;
  link?: string;
}

interface IncomingNotificationsResponse {
  notifications: IncomingNotification[];
  unread_count?: number;
}

export function IncomingNotificationToastListener() {
  const { user } = useAuth();
  const router = useRouter();
  const userIdentity = user?.email ?? user?.username ?? null;
  const seenNotificationIds = useRef(new Set<number>());
  const initializedUser = useRef<string | null>(null);
  const hasBaseline = useRef(false);
  const lastDataUpdatedAt = useRef(0);

  const { data, dataUpdatedAt } = useQuery<IncomingNotificationsResponse | null>({
    queryKey: getNotificationQueryKey(userIdentity),
    queryFn: async ({ signal }) => {
      try {
        const response = await api.get<IncomingNotificationsResponse>(
          "/api/notifications/",
          { signal }
        );
        return response.data;
      } catch {
        return null;
      }
    },
    enabled: Boolean(userIdentity),
    refetchInterval: userIdentity ? 15000 : false,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });

  useEffect(() => {
    if (!userIdentity) {
      initializedUser.current = null;
      seenNotificationIds.current.clear();
      hasBaseline.current = false;
      lastDataUpdatedAt.current = 0;
      return;
    }

    const isNewUserSession = initializedUser.current !== userIdentity;
    if (isNewUserSession) {
      initializedUser.current = userIdentity;
      seenNotificationIds.current.clear();
      hasBaseline.current = false;
      lastDataUpdatedAt.current = 0;
    }

    if (!data) return;

    // On initial sign-in / fresh page load:
    // Establish the baseline so notifications that arrived before the user
    // entered the site do NOT pop up as toasts. Only notifications that arrive
    // in real-time while the user is actively inside the site will trigger popups.
    if (!hasBaseline.current) {
      hasBaseline.current = true;
      lastDataUpdatedAt.current = dataUpdatedAt;
      data.notifications.forEach(({ id }) => seenNotificationIds.current.add(id));
      return;
    }

    if (dataUpdatedAt <= lastDataUpdatedAt.current) return;
    lastDataUpdatedAt.current = dataUpdatedAt;

    const newlyReceived = data.notifications.filter(
      ({ id }) => !seenNotificationIds.current.has(id)
    );

    data.notifications.forEach(({ id }) => seenNotificationIds.current.add(id));
    newlyReceived.forEach((notification) => {
      const title = notification.title?.trim();
      const message = notification.message?.trim();
      if (!title && !message) return;

      toast.info(title || "New notification", {
        id: `incoming-notification-${notification.id}`,
        description: message,
        duration: 9000,
        toasterId: "incoming-notifications",
        action: notification.link
          ? {
              label: "View",
              onClick: () => router.push(notification.link!),
            }
          : undefined,
      });
    });
  }, [data, dataUpdatedAt, router, userIdentity]);

  return null;
}
