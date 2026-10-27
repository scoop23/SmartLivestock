const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const filename = path.join(__dirname, "../src/app/(farmer)/production-dashboard/production-analytics.ts");
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, {
  exports: exportsObject,
  require: (id) => id === "@/lib/axios" ? { default: {} } : { useQuery: () => ({}) },
});

test("recorded milk and egg entries contribute to farmer history without pending counts", () => {
  const records = [
    { id: 1, productionType: "milk", quantity: 8, unit: "LITERS", recordDate: "2026-10-20", status: "RECORDED", valuationSnapshot: null },
    { id: 2, productionType: "eggs", quantity: 12, unit: "PIECES", recordDate: "2026-10-20", status: "RECORDED", valuationSnapshot: null },
  ];
  const data = exportsObject.computeProductionAnalytics(records);
  assert.equal(data.by_type.milk.summary.total, 8);
  assert.equal(data.by_type.milk.summary.pending_total, 0);
  assert.equal(data.by_type.eggs.summary.total, 12);
  assert.equal(data.by_type.eggs.summary.pending_total, 0);
  assert.equal(exportsObject.formatProductionStatus("RECORDED"), "Recorded in your farm log");
});
