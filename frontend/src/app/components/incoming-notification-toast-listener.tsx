"use client";

import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { getNotificationQueryKey } from "@/lib/notification-query";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface IncomingNotification {
  id: number;
  title: string;
  message: string;
}

interface IncomingNotificationsResponse {
  notifications: IncomingNotification[];
}

export function IncomingNotificationToastListener() {
  const { user } = useAuth();
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

    // The first successful inbox fetch establishes a baseline so old unread
    // notifications do not all appear as new when a user opens the app.
    if (initializedUser.current !== userIdentity) {
      initializedUser.current = userIdentity;
      seenNotificationIds.current.clear();
      lastDataUpdatedAt.current = dataUpdatedAt;
      hasBaseline.current = Boolean(data && dataUpdatedAt);
      data?.notifications.forEach(({ id }) => seenNotificationIds.current.add(id));
      return;
    }

    if (!data || dataUpdatedAt <= lastDataUpdatedAt.current) return;
    lastDataUpdatedAt.current = dataUpdatedAt;

    if (!hasBaseline.current) {
      data.notifications.forEach(({ id }) => seenNotificationIds.current.add(id));
      hasBaseline.current = true;
      return;
    }

    const newlyReceived = data.notifications.filter(
      ({ id }) => !seenNotificationIds.current.has(id)
    );

    data.notifications.forEach(({ id }) => seenNotificationIds.current.add(id));
    newlyReceived.forEach((notification) => {
      toast.info(notification.title || "New notification", {
        description: notification.message,
        duration: 8000,
        toasterId: "incoming-notifications",
      });
    });
  }, [data, dataUpdatedAt, userIdentity]);

  return null;
}
