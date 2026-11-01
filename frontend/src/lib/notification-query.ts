export const getNotificationQueryKey = (userIdentity: string | null | undefined) =>
  ["notifications", userIdentity ?? "anonymous"] as const;
