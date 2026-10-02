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
    if (id === "../sibat-analytics") return {
      useReviewSubmission: () => ({ isPending: false }),
      useUpdateSubmissionData: () => ({ isPending: false }),
    };
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
function currentStep(html) {
  return html.match(/<div aria-current="step"[^>]*>(.*?)<\/span>/s)?.[1] || "";
}
for (const status of ["SUBJECT_TO_REVISION", "SUBJECT_FOR_REVISION"]) {
  test(`${status}: farmer acts next; MAO is visible but not active`, () => {
    const html = render(status, { reviewedByName: "Known reviewer" });
    assert.match(currentStep(html), /Farmer Revision Required/);
    assert.match(html, /4\. MAO Decision/);
    assert.match(html, /Awaiting resubmission &amp; verification/);
    assert.match(html, /Known reviewer/);
    assert.doesNotMatch(html, /Subject for Revision|Verify &amp; Forward to MAO/);
  });
}
test("new submission is actionable by SIBAT", () => {
  const html = render("PENDING");
  assert.match(currentStep(html), /SIBAT Field Check/);
  assert.match(html, /Verify &amp; Forward to MAO/);
});
test("resubmitted PENDING record is actionable even with previous remarks", () => {
  const html = render("PENDING", { reviewRemarks: "Earlier correction request" });
  assert.match(currentStep(html), /SIBAT Field Check/);
  assert.doesNotMatch(html, /Farmer Revision Required/);
});
test("VERIFIED awaits MAO and offers no further SIBAT review", () => {
  const html = render("VERIFIED");
  assert.match(currentStep(html), /MAO Decision/);
  assert.match(html, /Awaiting MAO Decision/);
  assert.doesNotMatch(html, /Verify &amp; Forward to MAO/);
});
test("APPROVED is complete with no active actor", () => {
  const html = render("APPROVED");
  assert.equal(currentStep(html), "");
  assert.match(html, /MAO approved this record/);
});
test("legacy REJECTED is not presented as revision or an active MAO task", () => {
  const html = render("REJECTED");
  assert.equal(currentStep(html), "");
  assert.match(html, /Record rejected/);
  assert.doesNotMatch(html, /Farmer Revision Required|Subject for Revision/);
});

test("SIBAT revision belongs to the SIBAT step, not MAO", () => {
  const html = render("SUBJECT_TO_REVISION", { reviewedByRole: "SIBAT" });
  assert.match(html, /Returned by SIBAT for revision/);
  assert.match(html, /Not reached — awaiting SIBAT verification/);
  assert.doesNotMatch(html, /Returned by MAO/);
  assert.match(currentStep(html), /Farmer Revision Required/);
});
test("MAO revision retains MAO attribution", () => {
  const html = render("SUBJECT_TO_REVISION", { reviewedByRole: "MAO" });
  assert.match(html, /Returned by MAO for revision/);
  assert.doesNotMatch(html, /Returned by SIBAT/);
});
