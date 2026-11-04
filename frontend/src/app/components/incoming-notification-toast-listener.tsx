"use client";

import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { getNotificationQueryKey } from "@/lib/notification-query";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
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

const SESSION_SEEN_KEY = "smartlivestock_seen_toast_notifs";

function getSessionSeenIds(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SESSION_SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSessionSeenIds(ids: Set<number>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_SEEN_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

export function IncomingNotificationToastListener() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const userIdentity = user?.email ?? user?.username ?? null;
  const seenNotificationIds = useRef(new Set<number>());
  const activeToastIds = useRef(new Set<string>());
  const initializedUser = useRef<string | null>(null);
  const hasBaseline = useRef(false);
  const lastDataUpdatedAt = useRef(0);
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const isLoginPage = normalizedPathname === "/login" || normalizedPathname === "/";

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
    enabled: Boolean(userIdentity) && !isLoading && !isLoginPage,
    refetchInterval: userIdentity && !isLoading && !isLoginPage ? 15000 : false,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });

  useEffect(() => {
    if (isLoginPage) {
      activeToastIds.current.forEach((id) => toast.dismiss(id));
      activeToastIds.current.clear();
      return;
    }

    if (!userIdentity) {
      initializedUser.current = null;
      seenNotificationIds.current.clear();
      hasBaseline.current = false;
      lastDataUpdatedAt.current = 0;
      return;
    }

    if (isLoading) return;

    const isNewUserSession = initializedUser.current !== userIdentity;
    if (isNewUserSession) {
      initializedUser.current = userIdentity;
      seenNotificationIds.current.clear();
      hasBaseline.current = false;
      lastDataUpdatedAt.current = 0;
    }

    if (!data) return;

    // On initial sign-in / fresh page load:
    // Surface recent unread notifications that haven't been shown yet in this session,
    // so incoming items immediately come up for Admin / CBAT on login or navigation.
    if (!hasBaseline.current) {
      hasBaseline.current = true;
      lastDataUpdatedAt.current = dataUpdatedAt;

      const sessionSeen = getSessionSeenIds();
      const unreadToShow = data.notifications
        .filter((n) => !n.is_read && !seenNotificationIds.current.has(n.id) && !sessionSeen.has(n.id))
        .slice(0, 2);

      data.notifications.forEach(({ id }) => seenNotificationIds.current.add(id));

      unreadToShow.forEach((notification) => {
        sessionSeen.add(notification.id);
        saveSessionSeenIds(sessionSeen);

        const title = notification.title?.trim();
        const message = notification.message?.trim();
        if (!title && !message) return;

        const toastId = `incoming-notification-${notification.id}`;
        activeToastIds.current.add(toastId);
        toast.info(title || "New notification", {
          id: toastId,
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
      return;
    }

    if (dataUpdatedAt <= lastDataUpdatedAt.current) return;
    lastDataUpdatedAt.current = dataUpdatedAt;

    const sessionSeen = getSessionSeenIds();
    const newlyReceived = data.notifications.filter(
      ({ id }) => !seenNotificationIds.current.has(id) && !sessionSeen.has(id)
    );

    data.notifications.forEach(({ id }) => {
      seenNotificationIds.current.add(id);
      sessionSeen.add(id);
    });
    saveSessionSeenIds(sessionSeen);

    newlyReceived.forEach((notification) => {
      const title = notification.title?.trim();
      const message = notification.message?.trim();
      if (!title && !message) return;

      const toastId = `incoming-notification-${notification.id}`;
      activeToastIds.current.add(toastId);
      toast.info(title || "New notification", {
        id: toastId,
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
  }, [data, dataUpdatedAt, isLoading, isLoginPage, pathname, router, userIdentity]);

  return null;
}
