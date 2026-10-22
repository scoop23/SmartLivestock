// Run with: node --test tests/gis-simulation-fmd.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const filename = path.join(__dirname, "../src/components/gis/simulation.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
vm.runInNewContext(compiled, {
  exports: moduleExports,
  require: () => ({}),
});

const barangays = ["Cawongan", "Manggas", "Bawi"].map((name) => ({
  name,
  active_cases: 0,
  fmd_active_cases: 0,
  cattle: 10,
  total_livestock: 10,
  species_breakdown: [],
}));
const matrices = {
  distances: Object.fromEntries(barangays.map((source) => [
    source.name,
    Object.fromEntries(barangays.map((target) => [target.name, source.name === target.name ? 0 : 1000])),
  ])),
  bearings: Object.fromEntries(barangays.map((source) => [
    source.name,
    Object.fromEntries(barangays.map((target) => [target.name, 0])),
  ])),
};

test("generic disease reports do not seed the FMD model and demo seeds are marked synthetic", () => {
  const records = barangays.map((barangay) => ({ ...barangay }));
  records[0].active_cases = 1;

  const firstMonth = moduleExports.computeAnnualSimulationTrajectory(records, matrices)[0];

  assert.equal(firstMonth.isDemoScenario, true);
  assert.equal(firstMonth.states.Cawongan.cases, 0);
  assert.equal(firstMonth.states.Manggas.cases, 2);
});

test("a reviewer-assessed suspected FMD report from any barangay seeds the FMD model", () => {
  const records = barangays.map((barangay) => ({ ...barangay }));
  records[0].fmd_active_cases = 1;

  const firstMonth = moduleExports.computeAnnualSimulationTrajectory(records, matrices)[0];

  assert.equal(firstMonth.isDemoScenario, false);
  assert.equal(firstMonth.states.Cawongan.cases, 1);
  assert.equal(firstMonth.states.Manggas.cases, 0);
});
