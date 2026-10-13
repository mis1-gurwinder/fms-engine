import React from "react";

/* =========================================================
   DASHBOARD CHARTS (plain SVG; layout uses Bootstrap 5 grid)
   ========================================================= */

export type DashStage = {
  name: string;
  status?: string;
  formStatus?: string;
  plannedAt?: string;
  plannedHours?: number | null;
  actualTatMinutes?: number | null;
  delayMinutes?: number | null;
};

type Bucket = "DONE" | "ACTIVE" | "LOCKED" | "EXCEPTION";
const BUCKETS: Bucket[] = ["DONE", "ACTIVE", "LOCKED", "EXCEPTION"];
const BUCKET_COLOR: Record<Bucket, string> = {
  DONE: "#16a34a",
  ACTIVE: "#f59e0b",
  LOCKED: "#94a3b8",
  EXCEPTION: "#dc2626",
};
const ACTIVE_STATUSES = ["READY", "WORKING", "IN_PROGRESS", "CORRECTION"];

function bucketOf(status: string): Bucket {
  const s = String(status || "").toUpperCase();
  if (s === "DONE") return "DONE";
  if (s === "EXCEPTION") return "EXCEPTION";
  if (ACTIVE_STATUSES.includes(s)) return "ACTIVE";
  return "LOCKED";
}

function statusOf(st: DashStage, i: number) {
  return String(st.status || (i === 0 ? "READY" : "LOCKED")).toUpperCase();
}

function bucketCounts(pairs: [string, number][]) {
  const c: Record<Bucket, number> = { DONE: 0, ACTIVE: 0, LOCKED: 0, EXCEPTION: 0 };
  pairs.forEach(([s, v]) => { c[bucketOf(s)] += Number(v) || 0; });
  return c;
}

function fmtMinutes(m: number) {
  const a = Math.abs(Math.round(m));
  const h = Math.floor(a / 60);
  const r = a % 60;
  return h ? `${h}h ${r}m` : `${r}m`;
}

function fmtSigned(m: number | null | undefined) {
  if (m === null || m === undefined) return "—";
  if (m > 0) return `+${fmtMinutes(m)}`;
  if (m < 0) return `-${fmtMinutes(m)}`;
  return "0m";
}

function fmtHours(v: number) {
  if (v < 1) return `${Math.round(v * 60)}m`;
  return `${v.toFixed(1).replace(/\.0$/, "")}h`;
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="col-6 col-xl-2">
      <div className="card metric h-100">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function ChartCard({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="col-12 col-lg-4">
      <div className="card panel h-100">
        <h3 className="chartTitle">{title}</h3>
        {children}
        {note && <small className="chartNote">{note}</small>}
      </div>
    </div>
  );
}

export function DonutChart({ counts, center, sub }: { counts: Record<Bucket, number>; center: string | number; sub: string }) {
  const items = BUCKETS.map((b) => ({ label: b, value: counts[b], color: BUCKET_COLOR[b] }));
  const total = items.reduce((a, b) => a + b.value, 0);
  const R = 38;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="donutWrap">
      <svg viewBox="0 0 100 100" className="donutSvg" role="img" aria-label={`${center} ${sub}`}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="#eef0f3" strokeWidth="14" />
        {total > 0 && items.filter((i) => i.value > 0).map((i) => {
          const len = (i.value / total) * C;
          const seg = (
            <circle
              key={i.label}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={i.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 50 50)"
            />
          );
          acc += len;
          return seg;
        })}
        <text x="50" y="50" textAnchor="middle" className="donutCenter">{center}</text>
        <text x="50" y="63" textAnchor="middle" className="donutSub">{sub}</text>
      </svg>
      <ul className="donutLegend">
        {items.map((i) => (
          <li key={i.label}><i style={{ background: i.color }} />{i.label} <b>{i.value}</b></li>
        ))}
      </ul>
    </div>
  );
}

export function ProgressList({ rows }: { rows: { label: string; sub: string; pct: number }[] }) {
  if (!rows.length) return <div className="chartEmpty">No FMS yet.</div>;
  return (
    <div className="barList">
      {rows.map((r, i) => (
        <div className="barRow" key={i}>
          <span className="barLabel">{r.label}<small>{r.sub}</small></span>
          <div className="barTrack"><i style={{ width: `${Math.max(0, Math.min(100, r.pct))}%` }} /></div>
          <b>{r.pct}%</b>
        </div>
      ))}
    </div>
  );
}

export function DelayBars({ rows }: { rows: { label: string; minutes: number | null | undefined }[] }) {
  const valid = rows.filter((r) => r.minutes !== null && r.minutes !== undefined) as { label: string; minutes: number }[];
  if (!valid.length) return <div className="chartEmpty">Delay appears here after PC marks stages DONE.</div>;
  const max = Math.max(1, ...valid.map((r) => Math.abs(r.minutes)));
  return (
    <div className="delayBars">
      {valid.map((r, i) => {
        const late = r.minutes > 0;
        const w = Math.max(1.5, (Math.abs(r.minutes) / max) * 50);
        return (
          <div className="delayRow" key={i}>
            <span className="barLabel">{r.label}</span>
            <div className="delayTrack">
              <i className="delayCenter" />
              <i className={late ? "delayLate" : "delayEarly"} style={{ width: `${w}%`, left: late ? "50%" : `${50 - w}%` }} />
            </div>
            <b className={late ? "lateText" : "earlyText"}>
              {late ? `+${fmtMinutes(r.minutes)} late` : r.minutes < 0 ? `${fmtMinutes(r.minutes)} early` : "On time"}
            </b>
          </div>
        );
      })}
    </div>
  );
}

export function PlannedActualChart({ rows }: { rows: { label: string; planned: number | null; actual: number | null; late: boolean }[] }) {
  const data = rows.filter((r) => r.planned !== null || r.actual !== null);
  if (!data.length) return <div className="chartEmpty">Planned hours appear here once stages have a planned time.</div>;
  const max = Math.max(1, ...data.flatMap((r) => [r.planned || 0, r.actual || 0]));
  const slot = Math.max(64, 360 / data.length);
  const W = slot * data.length + 16;
  const H = 180;
  const base = H - 26;
  const top = 18;
  const bw = 20;
  const gap = 6;
  const y = (v: number) => base - (v / max) * (base - top);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="plannedChart" role="img" aria-label="Planned vs actual hours per stage">
      <line x1="0" x2={W} y1={base} y2={base} className="chartAxis" />
      {data.map((r, i) => {
        const x0 = i * slot + (slot - (2 * bw + gap)) / 2 + 8;
        return (
          <g key={i}>
            {r.planned !== null && (
              <>
                <rect x={x0} y={y(r.planned)} width={bw} height={base - y(r.planned)} rx="3" fill="#cbd5e1" />
                <text x={x0 + bw / 2} y={y(r.planned) - 4} textAnchor="middle" className="barValue">{fmtHours(r.planned)}</text>
              </>
            )}
            {r.actual !== null && (
              <>
                <rect x={x0 + bw + gap} y={y(r.actual)} width={bw} height={base - y(r.actual)} rx="3" fill={r.late ? "#e0573d" : "#16a34a"} />
                <text x={x0 + bw + gap + bw / 2} y={y(r.actual) - 4} textAnchor="middle" className="barValue">{fmtHours(r.actual)}</text>
              </>
            )}
            <text x={i * slot + slot / 2 + 8} y={H - 8} textAnchor="middle" className="barAxisLabel">{r.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function FlowDiagram({ stages, compact }: { stages: DashStage[]; compact?: boolean }) {
  if (!stages.length) return <div className="chartEmpty">No stages yet.</div>;
  return (
    <div className={`flowDiagram${compact ? " compact" : ""}`}>
      {stages.map((st, i) => {
        const s = statusOf(st, i);
        const b = bucketOf(s).toLowerCase();
        return (
          <React.Fragment key={i}>
            <div className={`flowMini flowMini-${b}`} title={`${st.name} · ${s}`}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <b>{st.name}</b>
              <small>{s}</small>
            </div>
            {i < stages.length - 1 && <span className="flowArrowMini" aria-hidden="true">→</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* Overall dashboard: uses /api/dashboard response */
export function OverallDashboard({ data }: { data: any }) {
  if (!data?.hasLiveData) return null;
  const k = data.kpis || {};
  const counts = bucketCounts(Object.entries(data.statusCounts || {}) as [string, number][]);
  const fmsList: any[] = data.fms || [];
  return (
    <div className="fmsDashboard">
      <div className="dashTitle"><span className="eyebrow">OVERALL DASHBOARD · ALL FMS</span></div>
      <div className="row g-3 dashKpis">
        <Kpi label="STAGE PROGRESS" value={`${k.progressPct ?? 0}%`} sub={`${data.doneStages}/${data.totalStages} stages DONE`} />
        <Kpi label="ON-TIME RATE" value={k.onTimePct == null ? "—" : `${k.onTimePct}%`} sub="DONE stages within planned time" />
        <Kpi label="AVG DELAY" value={fmtSigned(k.avgDelayMinutes)} sub="+ late · - early (DONE stages)" />
        <Kpi label="OVERDUE" value={k.overdue ?? 0} sub="Past planned time, not DONE" />
        <Kpi label="PC PENDING" value={k.pcPending ?? 0} sub="Doer submitted, awaiting PC" />
        <Kpi label="FORMS SENT" value={k.formsSent ?? 0} sub={`${k.formsSubmitted ?? 0} submitted by doers`} />
      </div>
      <div className="row g-3">
        <ChartCard title="Stage status">
          <DonutChart counts={counts} center={data.totalStages} sub="stages" />
        </ChartCard>
        <ChartCard title="Progress by FMS">
          <ProgressList rows={fmsList.map((f) => ({ label: f.code, sub: `${f.done}/${f.total} stages`, pct: f.progressPct }))} />
        </ChartCard>
        <ChartCard title="Average delay by FMS">
          <DelayBars rows={fmsList.map((f) => ({ label: f.code, minutes: f.avgDelayMinutes }))} />
        </ChartCard>
      </div>
      <div className="card panel">
        <h3 className="chartTitle">Flow of all FMS</h3>
        {fmsList.length === 0 ? <div className="chartEmpty">No FMS yet.</div> : fmsList.map((f) => (
          <div className="flowFmsRow" key={f.id}>
            <div className="flowFmsHead">
              <b>{f.code}</b><span>{f.name}</span><small>{f.progressPct}% done · {f.overdue} overdue · {f.pcPending} PC pending</small>
            </div>
            <FlowDiagram stages={f.stages} compact />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Per-FMS dashboard: computed from the FMS detail stages */
export function FmsDashboard({ name, stages }: { name: string; stages: DashStage[] }) {
  if (!stages.length) return null;
  const now = Date.now();
  const counts: Record<Bucket, number> = { DONE: 0, ACTIVE: 0, LOCKED: 0, EXCEPTION: 0 };
  let done = 0;
  let onTime = 0;
  let overdue = 0;
  let pcPending = 0;
  let formsSent = 0;
  const delays: number[] = [];
  stages.forEach((st, i) => {
    const b = bucketOf(statusOf(st, i));
    counts[b] += 1;
    if (b === "DONE") {
      done += 1;
      if (st.delayMinutes !== null && st.delayMinutes !== undefined) {
        delays.push(st.delayMinutes);
        if (st.delayMinutes <= 0) onTime += 1;
      }
    } else {
      if (st.plannedAt && st.plannedHours !== null && st.plannedHours !== undefined && now > new Date(st.plannedAt).getTime() + st.plannedHours * 3600000) overdue += 1;
      if (st.formStatus === "SUBMITTED") pcPending += 1;
    }
    if (st.formStatus === "SENT" || st.formStatus === "SUBMITTED") formsSent += 1;
  });
  const avgDelay = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null;
  const pct = Math.round((done / stages.length) * 100);

  return (
    <div className="fmsDashboard">
      <div className="dashTitle"><span className="eyebrow">DASHBOARD · {name}</span></div>
      <div className="row g-3 dashKpis">
        <Kpi label="STAGE PROGRESS" value={`${pct}%`} sub={`${done}/${stages.length} stages DONE`} />
        <Kpi label="ON-TIME RATE" value={delays.length ? `${Math.round((onTime / delays.length) * 100)}%` : "—"} sub="DONE stages within planned time" />
        <Kpi label="AVG DELAY" value={fmtSigned(avgDelay)} sub="+ late · - early (DONE stages)" />
        <Kpi label="OVERDUE" value={overdue} sub="Past planned time, not DONE" />
        <Kpi label="PC PENDING" value={pcPending} sub="Doer submitted, awaiting PC" />
        <Kpi label="FORMS SENT" value={formsSent} sub="Stages with form emailed" />
      </div>
      <div className="row g-3">
        <ChartCard title="Stage status">
          <DonutChart counts={counts} center={stages.length} sub="stages" />
        </ChartCard>
        <ChartCard title="Planned vs actual hours" note="Grey = planned hours · green = actual on time · red = actual late">
          <PlannedActualChart rows={stages.map((st, i) => ({
            label: String(i + 1).padStart(2, "0"),
            planned: st.plannedHours ?? null,
            actual: bucketOf(statusOf(st, i)) === "DONE" && st.actualTatMinutes !== null && st.actualTatMinutes !== undefined ? st.actualTatMinutes / 60 : null,
            late: (st.delayMinutes ?? 0) > 0,
          }))} />
        </ChartCard>
        <ChartCard title="Time delay per stage">
          <DelayBars rows={stages.map((st, i) => ({
            label: `${String(i + 1).padStart(2, "0")} ${st.name}`,
            minutes: bucketOf(statusOf(st, i)) === "DONE" ? (st.delayMinutes ?? null) : null,
          }))} />
        </ChartCard>
      </div>
      <div className="card panel">
        <h3 className="chartTitle">Stage flow</h3>
        <FlowDiagram stages={stages} />
      </div>
    </div>
  );
}
