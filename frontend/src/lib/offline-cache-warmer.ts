/**
 * SmartLivestock Offline Cache Warmer
 * 
 * Automatically pre-caches all essential API data, HTML page shells, and static
 * chunks immediately upon user login or session establishment.
 * 
 * Ensures that if a Farmer or CBAT officer logs in at home/office and immediately
 * steps into the field without Wi-Fi, all sub-pages and livestock records are
 * fully available offline.
 */

import api from "@/lib/axios";

const WARM_STORAGE_KEY = "smartlivestock_cache_warmed_at";
const WARM_INTERVAL_MS = 15 * 60 * 1000; // Re-warm every 15 minutes when online

export async function warmOfflineCache(role?: string | null, force: boolean = false): Promise<void> {
  if (typeof window === "undefined" || !navigator.onLine) return;

  // Debounce warming so it doesn't run excessively on every mount
  if (!force) {
    try {
      const lastWarmed = sessionStorage.getItem(WARM_STORAGE_KEY);
      if (lastWarmed && Date.now() - Number(lastWarmed) < WARM_INTERVAL_MS) {
        return;
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }

  const normalizedRole = (role || "").toUpperCase();

  // 1. Determine API endpoints to pre-fetch for this role
  const baseEndpoints: Array<{ url: string; params?: Record<string, unknown> }> = [
    { url: "users/me/" },
    { url: "livestock/livestock_types/" },
    { url: "livestock/inventory/", params: { include_inactive: true } },
    { url: "livestock/inventory/" },
    { url: "livestock/batches/" },
    { url: "livestock/batches/", params: { include_roster: true } },
    { url: "production/records/" },
    { url: "production/calving/" },
    { url: "diseases/cases/" },
    { url: "diseases/mortality/" },
  ];

  const farmerEndpoints = [
    ...baseEndpoints,
    { url: "livestock/inventory/", params: { mine: true, include_inactive: false } },
    { url: "livestock/inventory/", params: { mine: true, include_inactive: true } },
    { url: "livestock/inventory/", params: { mine: true } },
    { url: "livestock/batches/", params: { mine: true, include_roster: true } },
    { url: "production/records/", params: { mine: true } },
    { url: "production/breeding/" },
    { url: "production/breeding/analytics/" },
    { url: "production/feedings/" },
    { url: "production/feedings/analytics/" },
    { url: "production/weights/" },
    { url: "production/treatments/" },
    { url: "production/dispositions/" },
    { url: "diseases/cases/", params: { mine: true } },
    { url: "diseases/cases/" },
    { url: "diseases/mortality/", params: { mine: true } },
    { url: "diseases/mortality/" },
    { url: "analytics/market-prices/" },
    { url: "livestock/ownership-transfers/", params: { direction: "outgoing", status: "APPROVED" } },
  ];

  const sibatEndpoints = [
    ...baseEndpoints,
    { url: "census/submissions/" },
    { url: "users/", params: { role: "FARMER" } },
  ];

  let endpointsToWarm = baseEndpoints;
  if (normalizedRole === "FARMER") {
    endpointsToWarm = farmerEndpoints;
  } else if (normalizedRole === "SIBAT" || normalizedRole === "CBAT") {
    endpointsToWarm = sibatEndpoints;
  }

  // 2. Determine HTML pages to pre-cache
  const farmerPages = [
    "/farmer",
    "/production-dashboard",
    "/production-dashboard/history",
    "/report-observation",
    "/livestock-inventory",
    "/livestock-inventory/all",
    "/livestock-inventory/batches",
    "/livestock-inventory/history",
    "/market-prices",
    "/farmer-announcement",
    "/farmer-scheduling",
    "/alerts",
  ];

  const sibatPages = [
    "/sibat",
    "/sibat/livestock-registry",
    "/sibat-validation",
    "/sibat-alerts",
  ];

  const pagesToWarm = normalizedRole === "FARMER" ? farmerPages : sibatPages;

  console.log(`[SmartLivestock Warmer] Pre-caching field data for ${normalizedRole || "USER"}...`);

  try {
    sessionStorage.setItem(WARM_STORAGE_KEY, String(Date.now()));
  } catch {
    // Ignore
  }

  // 3. Concurrently fetch API endpoints (Axios interceptor will auto-save to offline cache)
  const apiPromises = endpointsToWarm.map(async ({ url, params }) => {
    try {
      await api.get(url, { params });
    } catch {
      // Non-fatal if a specific endpoint is restricted or temporarily empty
    }
  });

  // 4. Pre-cache HTML pages & their JS/CSS bundles
  const pagePromises = pagesToWarm.map(async (pageUrl) => {
    try {
      const response = await fetch(pageUrl, {
        headers: { Accept: "text/html,application/xhtml+xml" },
        cache: "reload",
      });

      if (!response.ok) return;

      const htmlText = await response.text();
      const contentType = response.headers.get("content-type") || "";

      // Store HTML in CACHE_HTML
      if ("caches" in window && contentType.includes("text/html")) {
        const htmlCache = await caches.open("smartlivestock-html-v7");
        await htmlCache.put(
          pageUrl,
          new Response(htmlText, {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
        );
      }

      // Extract and prefetch script and CSS chunks referenced in the page HTML
      const assetUrls: string[] = [];
      const scriptRegex = /<script[^>]+src=["'](\/_next\/static\/[^"']+)["']/g;
      const cssRegex = /<link[^>]+href=["'](\/_next\/static\/[^"']+\.css[^"']*)["']/g;

      let match: RegExpExecArray | null;
      while ((match = scriptRegex.exec(htmlText)) !== null) {
        assetUrls.push(match[1]);
      }
      while ((match = cssRegex.exec(htmlText)) !== null) {
        assetUrls.push(match[1]);
      }

      // Warm static chunks into the static cache
      if ("caches" in window && assetUrls.length > 0) {
        const staticCache = await caches.open("smartlivestock-static-v7");
        assetUrls.slice(0, 30).forEach((assetUrl) => {
          fetch(assetUrl)
            .then((res) => {
              if (res.ok) staticCache.put(assetUrl, res);
            })
            .catch(() => {});
        });
      }
      // Pre-cache Next.js RSC wire streams strictly into CACHE_RSC partition
      if ("caches" in window) {
        try {
          const rscRes = await fetch(pageUrl, {
            headers: { RSC: "1", Accept: "text/x-component" },
            cache: "reload",
          });
          if (rscRes.ok) {
            const rscCache = await caches.open("smartlivestock-rsc-v7");
            await rscCache.put(pageUrl, rscRes);
          }
        } catch {
          // Non-fatal
        }
      }
    } catch {
      // Non-fatal
    }
  });

  // Await the critical API data so that caller (e.g. login) can guarantee data is cached
  await Promise.allSettled(apiPromises);

  // Shells and static assets continue in the background
  Promise.allSettled(pagePromises).then(() => {
    console.log(`[SmartLivestock Warmer] Field data pre-cache ready for offline use.`);
  });
}
