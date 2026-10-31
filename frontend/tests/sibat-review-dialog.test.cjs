// Run with: node --test tests/sibat-review-dialog.test.cjs
// Render the real dialog; replace only API hooks and portal/UI wrappers so
// these state regressions need neither a running server nor database records.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const filename = path.join(__dirname, "../src/app/(sibat)/sibat/components/sibat-review-dialog.tsx");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText;
const wrapper = ({ children, className, disabled, ...props }) => React.createElement(
  "div", { className, "data-disabled": disabled, "aria-current": props["aria-current"] }, children,
);
function loadComponent(source) {
  const result = {};
  vm.runInNewContext(source, {
  exports: result,
  require: (id) => {
    if (id.startsWith("@/components/ui/")) return new Proxy({}, { get: () => wrapper });
    if (id === "@/components/livestock-breed-field") return { LivestockBreedField: wrapper };
    if (id === "@/app/(farmer)/livestock-inventory/components/livestock-silhouette-paths") return {
      LivestockSilhouettePath: () => null,
      resolveSpeciesKey: () => "cattle",
    };
    if (id === "@/lib/http-error") return loadComponent(ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src/lib/http-error.ts"), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText);
    if (id === "@/lib/livestock-age") return loadComponent(ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src/lib/livestock-age.ts"), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText);
    if (id === "../sibat-analytics") return {
      useReviewSubmission: () => ({ isPending: false }),
      useUpdateSubmissionData: () => ({ isPending: false }),
      useAvailableBatches: () => ({ data: [] }),
    };
    if (id === "./milk-anomaly-assessment-card" || id.includes("milk-anomaly-assessment-card")) return { MilkAnomalyAssessmentCard: wrapper };
    if (id === "./sibat-status-badge") return loadComponent(ts.transpileModule(
      fs.readFileSync(path.join(path.dirname(filename), "sibat-status-badge.tsx"), "utf8"),
      { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } },
    ).outputText);
    return require(id);
  },
});
  return result;
}
const exportsObject = loadComponent(compiled);
function render(status, extra = {}) {
  return renderToStaticMarkup(React.createElement(exportsObject.default, {
    open: true, onOpenChange: () => {},
    submission: {
      id: "INVENTORY-1", rawId: 1, sourceType: "INVENTORY", entryType: "INDIVIDUAL",
      farmerName: "Test farmer", barangayName: "Test barangay", livestockTypeName: "Cattle",
      quantityDisplay: "1 head", recordDate: "2026-09-01", status, ...extra,
    },
  }));
}
for (const status of ["SUBJECT_TO_REVISION", "SUBJECT_FOR_REVISION"]) {
  test(`${status}: farmer acts next; MAO is visible but not active`, () => {
    const html = render(status, { reviewedByName: "Known reviewer" });
    assert.ok(html.includes("Revision requested"));
    assert.match(html, /4\. MAO Decision/);
    assert.ok(html.includes("Awaiting farmer resubmission"));
    assert.match(html, /Known reviewer/);
    assert.doesNotMatch(html, /Verify &amp; Forward to MAO/);
  });
}
test("new submission is actionable by SIBAT", () => {
  const html = render("PENDING");
  assert.ok(html.includes("Field Reviewer Check"));
  assert.match(html, /Verify &amp; Forward to MAO/);
});
test("resubmitted PENDING record is actionable even with previous remarks", () => {
  const html = render("PENDING", { reviewRemarks: "Earlier correction request" });
  assert.ok(html.includes("Field Reviewer Check"));
  assert.doesNotMatch(html, /Revision requested/);
});
test("VERIFIED awaits MAO and offers no further SIBAT review", () => {
  const html = render("VERIFIED");
  assert.ok(html.includes("MAO Decision"));
  assert.ok(html.includes("Awaiting MAO decision"));
  assert.doesNotMatch(html, /Verify &amp; Forward to MAO/);
});
test("APPROVED is complete with no active actor", () => {
  const html = render("APPROVED");
  assert.match(html, /MAO approved this record/);
  assert.doesNotMatch(html, /Verify &amp; Forward to MAO/);
});
test("legacy REJECTED is not presented as revision or an active MAO task", () => {
  const html = render("REJECTED");
  assert.match(html, /Record rejected/);
  assert.doesNotMatch(html, /Farmer Revision Required|Subject for Revision/);
});

test("SIBAT revision belongs to the SIBAT step, not MAO", () => {
  const html = render("SUBJECT_TO_REVISION", { reviewedByRole: "SIBAT", reviewedByName: "Field Officer" });
  assert.ok(html.includes("Revision requested"));
  assert.ok(html.includes("Field Officer"));
  assert.ok(html.includes("(SIBAT)"));
});
test("MAO revision retains MAO attribution", () => {
  const html = render("SUBJECT_TO_REVISION", { reviewedByRole: "MAO", reviewedByName: "Municipal Officer" });
  assert.ok(html.includes("Revision requested"));
  assert.ok(html.includes("Municipal Officer"));
  assert.ok(html.includes("(MAO)"));
});

test("flagged milk remains advisory with identity and yield but no field approval action", () => {
  const html = render("PENDING", {
    id: "prod-1", sourceType: "PRODUCTION", productionType: "milk",
    tagNumber: "DEMO-MILK-ANOMALY", quantity: 15, quantityDisplay: "15 L",
    recordDate: "2026-10-22", anomalyDetected: true,
    nextReviewQueue: "CBAT", anomalyAssessmentStatus: "ANOMALY_DETECTED",
  });
  assert.match(html, /Production source.*DEMO-MILK-ANOMALY/s);
  assert.match(html, /Milk yield: 15 L on Oct 22 2026/);
  assert.doesNotMatch(html, /Leaves active inventory after MAO approval/);
  assert.doesNotMatch(html, /15 animals/);
  assert.doesNotMatch(html, /Verify &amp; Forward to MAO/);
  assert.match(html, /does not need SIBAT\/CBAT verification/);
  assert.doesNotMatch(html, /Approve Production|Final Approval/);
});

test("clean milk has no field approval action or inventory warning", () => {
  const html = render("PENDING", {
    id: "prod-2", sourceType: "PRODUCTION", productionType: "milk",
    tagNumber: "DEMO-MILK-CLEAN", quantity: 10, quantityDisplay: "10 L",
    recordDate: "2026-10-22", anomalyAssessmentStatus: "CLEAN",
    nextReviewQueue: "MAO",
  });
  assert.match(html, /DEMO-MILK-CLEAN/);
  assert.doesNotMatch(html, /Leaves active inventory after MAO approval/);
  assert.doesNotMatch(html, /Verify &amp; Forward to MAO/);
});

test("untagged production volume is not rendered as an animal count", () => {
  const html = render("PENDING", {
    id: "prod-4", sourceType: "PRODUCTION", productionType: "milk",
    tagNumber: undefined, batchCode: "HERD-4", quantity: 18, quantityDisplay: "18 L",
    anomalyAssessmentStatus: "ANOMALY_DETECTED", nextReviewQueue: "CBAT",
  });
  assert.match(html, /Production source.*Batch HERD-4/s);
  assert.doesNotMatch(html, /18 animals|Leaves active inventory after MAO approval/);
});

test("slaughter and sale retain the inventory warning", () => {
  const slaughter = render("PENDING", {
    id: "prod-3", sourceType: "PRODUCTION", productionType: "meat",
    quantity: 50, quantityDisplay: "50 kg",
    slaughterDetails: { quantity: 1, animals: [{ id: 3, tag_number: "COW-3" }], inventory_reconciled_at: null },
  });
  const sale = render("PENDING", {
    id: "sale-1", sourceType: "SALE", tagNumber: "COW-4",
  });
  assert.match(slaughter, /1 animal.*COW-3/s);
  assert.match(slaughter, /Leaves active inventory after MAO approval/);
  assert.match(sale, /Leaves active inventory after MAO approval/);
});
