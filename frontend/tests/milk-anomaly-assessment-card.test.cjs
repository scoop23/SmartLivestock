const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const filename = path.join(__dirname, "../src/app/(sibat)/sibat/components/milk-anomaly-assessment-card.tsx");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText;

const wrapper = ({ children, className, ...props }) => React.createElement("div", { className, ...props }, children);

function loadComponent(source) {
  const result = {};
  vm.runInNewContext(source, {
    exports: result,
    require: (id) => {
      if (id === "recharts") return new Proxy({}, { get: () => wrapper });
      if (id.startsWith("@/components/ui/")) return new Proxy({}, { get: () => wrapper });
      return require(id);
    },
  });
  return result;
}

const { MilkAnomalyAssessmentCard } = loadComponent(compiled);

test("MilkAnomalyAssessmentCard renders CBAT friendly wording, numbers, checklist and chart", () => {
  const submission = {
    id: "prod-1",
    rawId: 1,
    sourceType: "PRODUCTION",
    productionType: "milk",
    quantity: 15,
    quantityDisplay: "15 L",
    unit: "L",
    recordDate: "2026-10-22",
    anomalyDetected: true,
    anomalyAssessmentStatus: "ANOMALY_DETECTED",
    anomalyAssessment: {
      assessment_status: "ANOMALY_DETECTED",
      anomaly_detected: true,
      anomaly_direction: "SPIKE",
      severity: "HIGH",
      submitted_quantity: 15,
      unit: "LITERS",
      historical_baseline: {
        baseline_median_liters: 10,
        baseline_mean_liters: 10,
        window_days_used: 14,
        recent_observations: [
          { record_date: "2026-10-20", quantity_liters: 10 },
          { record_date: "2026-10-21", quantity_liters: 10.1 },
        ],
      },
      deviation: {
        absolute_liters: 5,
        percentage_change: 50,
      },
      forecast_comparison: {
        available: true,
        status: "MATCHED",
        expected_liters: 10.2,
      },
    },
  };

  const html = renderToStaticMarkup(React.createElement(MilkAnomalyAssessmentCard, { submission }));

  // Check CBAT friendly header & badges
  assert.ok(html.includes("Pagsusuri sa Gatas (Milk Yield Check)"));
  assert.ok(html.includes("Mataas ang Gatas (+5 L)"));
  assert.ok(html.includes("Kailangan beripikahin sa bukid"));

  // Check plain summary
  assert.ok(html.includes("Ang karaniwang bigay ng gatas ng bakang ito ay humigit-kumulang"));
  assert.ok(html.includes("10 L/araw"));
  assert.ok(html.includes("15 L"));
  assert.ok(html.includes("+5 L (+50%)"));

  // Check intuitive cards
  assert.ok(html.includes("Karaniwan (Normal)"));
  assert.ok(html.includes("Naitala Ngayon (Today)"));
  assert.ok(html.includes("Inaasahang Tantya"));

  // Check CBAT checklist
  assert.ok(html.includes("Ano ang itatanong o titingnan ng CBAT sa bukid?"));
  assert.ok(html.includes("Maling pindot / typo"));
  assert.ok(html.includes("Bagong anak o pakain"));
  assert.ok(html.includes("Pinagsamang gatas"));

  // Check technical toggle
  assert.ok(html.includes("Teknikal na Detalye at Formulas"));
});
