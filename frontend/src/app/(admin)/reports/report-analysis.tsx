import type { OfficialReport } from "./report-api";

const numberFormat = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });
const showNumber = (value: number) => numberFormat.format(value);
const showDate = (value: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));

export function ReportAnalysis({ report }: { report: OfficialReport }) {
  // The backend derives these sections from approved filtered rows so exports and preview share the same findings.
  const { analysis } = report;
  const selectedFilters = Object.entries(report.filters).filter(([, value]) => Boolean(value));

  return <div className="space-y-4">
    <section className="space-y-3" aria-labelledby="executive-summary-heading">
      <div><h3 id="executive-summary-heading" className="text-base font-black text-slate-950">Executive Summary</h3><p className="text-sm text-slate-600">Key measures calculated from the approved records in this preview.</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {analysis.executive_summary.map((item) => <article key={`${item.label}-${item.detail ?? ""}`} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">{item.label}</p>
          <p className="mt-1 break-words text-lg font-black text-slate-950">{typeof item.value === "number" ? showNumber(item.value) : item.value}</p>
          {item.detail && <p className="mt-1 text-xs text-slate-500">{item.detail}</p>}
        </article>)}
        {!analysis.executive_summary.length && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">No summary metrics are available for this selection.</p>}
      </div>
    </section>

    <section className="grid min-w-0 gap-4 lg:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="key-findings-heading">
        <h3 id="key-findings-heading" className="font-bold text-slate-900">Key Findings</h3>
        {analysis.key_findings.length ? <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">{analysis.key_findings.map((finding) => <li key={finding}>{finding}</li>)}</ul> : <p className="mt-2 text-sm text-slate-600">There is not enough approved data in this selection to identify a key finding.</p>}
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="coverage-heading">
        <h3 id="coverage-heading" className="font-bold text-slate-900">Data Coverage</h3>
        <p className={`mt-2 text-sm leading-6 ${analysis.coverage_level === "adequate" ? "text-slate-700" : "text-amber-800"}`}>{analysis.coverage_notice}</p>
      </article>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="period-comparison-heading">
      <h3 id="period-comparison-heading" className="font-bold text-slate-900">Previous-Period Comparison</h3>
      <p className="mt-1 text-xs text-slate-500">Current period is compared with an immediately preceding period of equal duration.</p>
      {analysis.comparison.available ? <>
        <p className="mt-2 text-xs text-slate-600">Previous period: {showDate(analysis.comparison.period.date_from)} – {showDate(analysis.comparison.period.date_to)}</p>
        <div className="mt-3 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="py-2 pr-4">Metric</th><th className="py-2 pr-4">Current</th><th className="py-2 pr-4">Previous</th><th className="py-2">Change</th></tr></thead><tbody>
          {analysis.comparison.metrics.map((metric) => <tr key={metric.label} className="border-b last:border-0"><th className="py-2 pr-4 font-medium text-slate-700">{metric.label}</th><td className="py-2 pr-4">{showNumber(metric.current)} {metric.unit}</td><td className="py-2 pr-4">{showNumber(metric.previous)} {metric.unit}</td><td className={`py-2 font-semibold ${metric.change_percent > 0 ? "text-emerald-800" : metric.change_percent < 0 ? "text-rose-700" : "text-slate-600"}`}>{metric.change_percent > 0 ? "+" : ""}{showNumber(metric.change_percent)}%</td></tr>)}
        </tbody></table></div>
      </> : <p className="mt-2 text-sm text-slate-600">{analysis.comparison.unavailable_reason}</p>}
    </section>

    {!!analysis.rankings.length && <section className="space-y-3" aria-labelledby="rankings-heading">
      <div><h3 id="rankings-heading" className="font-bold text-slate-900">Top Rankings</h3><p className="text-xs text-slate-500">Production rankings are separated by unit to keep measurements comparable.</p></div>
      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {analysis.rankings.map((ranking) => <article key={ranking.title} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4"><h4 className="text-sm font-bold text-slate-800">{ranking.title}</h4><ol className="mt-2 space-y-1.5">{ranking.items.map((item, index) => <li key={item.name} className="flex min-w-0 items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-slate-700">{index + 1}. {item.name}</span><span className="shrink-0 font-semibold text-slate-900">{showNumber(item.value)} {ranking.unit}</span></li>)}</ol></article>)}
      </div>
    </section>}

    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5" aria-labelledby="report-metadata-heading">
      <h3 id="report-metadata-heading" className="font-bold text-slate-900">Report Metadata</h3>
      <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-xs text-slate-500">Report</dt><dd className="font-medium text-slate-800">{report.title}</dd></div>
        <div><dt className="text-xs text-slate-500">{report.period_label}</dt><dd className="font-medium text-slate-800">{showDate(report.period.date_from)} – {showDate(report.period.date_to)}</dd></div>
        <div><dt className="text-xs text-slate-500">Data status</dt><dd className="font-medium text-slate-800">{analysis.data_status}</dd></div>
        {selectedFilters.map(([key, value]) => <div key={key}><dt className="text-xs text-slate-500">{key[0].toUpperCase() + key.slice(1)} filter</dt><dd className="font-medium text-slate-800">{value}</dd></div>)}
        <div><dt className="text-xs text-slate-500">Generated</dt><dd className="font-medium text-slate-800">{new Date(report.generated_at).toLocaleString()}</dd></div>
      </dl>
    </section>

  </div>;
}

export function ReportMethodology({ report }: { report: OfficialReport }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="methodology-heading">
    <h3 id="methodology-heading" className="font-bold text-slate-900">Data &amp; Methodology</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">{report.analysis.methodology}</p>
  </section>;
}
