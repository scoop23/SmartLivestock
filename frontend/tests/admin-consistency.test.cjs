const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { QueryClient } = require("@tanstack/react-query");
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: id => mocks[id] ?? require(id), console, AbortSignal });
  return exports;
}
const colors = load("lib/species-colors.ts");
const metrics = load("lib/population-metrics.ts", { "./species-colors": colors });
const readCalls = [];
const charts = load("app/(admin)/admin/admin-charts.ts", {
  "@/lib/municipal-read": { municipalRead: async (...args) => { readCalls.push(args); return {data: dashboard}; } }, "@/contexts/auth-context": { useAuth: () => ({ user: { email: "test@example.test" } }) },
  "@/lib/population-metrics": metrics, "@/lib/species-colors": colors,
  "@tanstack/react-query": { useQuery: options => options },
});
const population = {
  total_heads: 12, registered_farmers: 2, barangay_count: 1, pending_inventory_records: 3,
  active_submitted_heads: 15, historical_approved_heads: 20,
  by_species: [{ species_id: 1, species: "Cattle", heads: 3 }, { species_id: 2, species: "Poultry", heads: 7 },
    { species_id: 3, species: "Sheep", heads: 1 }, { species_id: 4, species: "Rabbit", heads: 1 }],
};
population.by_barangay = [{ barangay_id: 1, barangay: "Test", heads: 12, species: population.by_species,
  vaccinated: 3, registered_farmers: 2, active_herds: 1, monthly_milk_l: 2.5, monthly_meat_kg: 0 }];
const dashboard = { descriptive: { population }, monthly_dairy_yield_l: 2.5,
  production_series: [], surveillance_series: [], vaccination_coverage: [], vaccination_totals: { vaccinated: 3, total: 12 } };
test("dashboard and overview use the canonical quantity, keeping all species", () => {
  const chart = charts.computeAdminAnalytics(dashboard);
  const overview = metrics.overviewBarangays({ population });
  assert.equal(chart.totalLivestock, 12);
  assert.equal(chart.specieComposition.reduce((n, row) => n + row.value, 0), 12);
  assert.equal(chart.barangayHerdDistribution[0].total, 12);
  assert.equal(chart.barangayHerdDistribution[0].other, 1);
  assert.equal(chart.barangayHerdDistribution[0].poultry, 7);
  assert.equal(overview[0].totalLivestock, 12);
  assert.equal(overview[0].cattleCount + overview[0].goatCount + overview[0].otherCount, 12);
  assert.equal(overview[0].registeredFarmers, 2);
  assert.equal(chart.monthlyDairyYieldL, overview[0].monthlyMilkLiters);
});
test("navigation and local filtering do not mutate the canonical summary", () => {
  const original = JSON.stringify(dashboard);
  metrics.overviewBarangays({ population }).filter(row => row.barangay === "Missing");
  charts.computeAdminAnalytics(dashboard).barangayHerdDistribution.sort((a,b) => a.total-b.total);
  assert.equal(JSON.stringify(dashboard), original);
  assert.equal(metrics.overviewBarangays({ population })[0].totalLivestock, 12);
});
test("summary query is isolated by user and jurisdiction and cancels HTTP requests", async () => {
  const hook = charts.useAdminDashboardSummary();
  assert.equal(hook.queryKey.at(-3), "test@example.test");
  assert.equal(hook.staleTime, 0);
  assert.equal(hook.refetchOnWindowFocus, true);
  const controller = new AbortController();
  await hook.queryFn({ signal: controller.signal });
  assert.equal(readCalls.at(-1)[1].signal, controller.signal);
});
test("successful workflow invalidation refreshes every summary and cancels older requests", async () => {
  const cache = load("lib/municipal-cache.ts");
  const client = new QueryClient();
  const keys = [["admin", "analytics", "dashboard", 7], ["admin", "analytics", "overview", 7],
    ["admin-inventory-records"], ["admin-batches-overview"]];
  for (const key of keys) client.setQueryData(key, population);
  await cache.invalidateMunicipalSummaries(client);
  for (const key of keys) assert.equal(client.getQueryState(key).isInvalidated, true);
  client.clear();
});
test("failed detail requests are reported as failures, not empty or partial totals", async () => {
  const api = { get: async url => { if (url.includes("inventory")) throw Error("offline"); return { data: [] }; } };
  const validation = load("app/(admin)/data-validation/validation-analytics.ts", {
    "@/lib/municipal-read": { municipalRead: api.get }, "@tanstack/react-query": {},
    "@/app/(sibat)/sibat/sibat-analytics": {},
    "@/app/(farmer)/production-dashboard/production-analytics": {},
  });
  await assert.rejects(validation.fetchAdminInventoryRecords(), /offline/);
});

test("municipal requests stay on their configured database when the primary fails", async () => {
  let received;
  const read = load("lib/municipal-read.ts", { "./axios": { default: { get: async (url, config) => {
    received = config;
    throw Error("primary unavailable");
  } } } });
  await assert.rejects(read.municipalRead("analytics/dashboard/"), /primary unavailable/);
  assert.equal(received._fallbackRetried, true);
});

test("sales carry the stored price instead of a fabricated constant", async () => {
  const validation = load("app/(admin)/data-validation/validation-analytics.ts", {
    "@/lib/municipal-read": { municipalRead: async url => ({ data: url.includes("sales") ? [{ id: 1, total_price: "125.50" }] : [] }) },
    "@tanstack/react-query": {}, "@/app/(sibat)/sibat/sibat-analytics": {},
    "@/app/(farmer)/production-dashboard/production-analytics": {},
  });
  const result = await validation.fetchAdminIncidentRecords();
  assert.equal(result[0].saleValue, 125.5);
});

test("a late pre-mutation response cannot replace the refreshed cache", async () => {
  const cache = load("lib/municipal-cache.ts");
  const client = new QueryClient();
  const key = ["admin", "analytics", "dashboard", 7];
  client.setQueryData(key, population);
  let resolveOld;
  let signal;
  const oldRequest = client.fetchQuery({ queryKey: key, queryFn: context => {
    signal = context.signal;
    return new Promise(resolve => { resolveOld = resolve; });
  } }).catch(() => undefined);
  await Promise.resolve();
  await cache.invalidateMunicipalSummaries(client);
  assert.equal(signal.aborted, true);
  client.setQueryData(key, { ...population, total_heads: 13 });
  resolveOld({ ...population, total_heads: 999 });
  await oldRequest;
  assert.equal(client.getQueryData(key).total_heads, 13);
  client.clear();
});
