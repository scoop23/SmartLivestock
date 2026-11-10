"use client";

import { IncomingNotificationToastListener } from "@/app/components/incoming-notification-toast-listener";
import { PrivacyConsentModal } from "@/app/components/privacy-consent-modal";
import { OfflineSyncBar } from "@/components/offline-sync-bar";
import { PwaInstaller } from "@/components/pwa-installer";
import { Toaster } from "@/components/ui/sonner";
import { AccessibilitySettingsProvider } from "@/contexts/accessibility-settings-context";
import { AuthProvider } from "@/contexts/auth-context";
import { invalidateMunicipalSummaries } from "@/lib/municipal-cache";
import { MutationCache,QueryClient,QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => {
      const client: QueryClient = new QueryClient({
        mutationCache: new MutationCache({
          onSuccess: (_data, _variables, _context, mutation) => {
            if (mutation.options.mutationKey?.[0] !== "notification-actions") {
              return invalidateMunicipalSummaries(client);
            }
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
            networkMode: "offlineFirst",
          },
        },
      });
      return client;
    }
  );

  return (
    <AccessibilitySettingsProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <IncomingNotificationToastListener />
          <PwaInstaller />
          <OfflineSyncBar />
          <Toaster
            id="incoming-notifications"
            position="top-right"
            expand={true}
            gap={15}
            offset={{ top: "34px", right: "34px" }}
          />
          {children}
          <PrivacyConsentModal />
        </AuthProvider>
      </QueryClientProvider>
    </AccessibilitySettingsProvider>
  );
}
