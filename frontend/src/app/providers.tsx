"use client";

import { useState } from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { invalidateMunicipalSummaries } from "@/lib/municipal-cache";
import { AuthProvider } from "@/contexts/auth-context";
import { PrivacyConsentModal } from "@/app/components/privacy-consent-modal";

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
          },
        },
      });
      return client;
    }
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <PrivacyConsentModal />
      </AuthProvider>
    </QueryClientProvider>
  );
}
