import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import "./styles.css";
import formCatalog from "./formCatalog.json";
import { OverallDashboard, FmsDashboard } from "./dashboard";

type Field = {
  key: string;
  name: string;
  type: string;
  required: boolean;
  options: string[];
  help?: string;
  system?: boolean;
};

type Stage = {
  id: string;
  name: string;
  what: string;
  how: string;
  who: string;
  when: string;
  plannedHours?: number | null;
  plannedAt?: string;
  googleFormUrl?: string;
  responseSheetUrl?: string;
  pcEmail?: string;
  formStatus?: string;
  formSubmittedAt?: string;
  fields: Field[];
  approved?: boolean;
  formVersion?: number;
  contact?: Contact;
  status?: string;
  startedAt?: string;
  formSentAt?: string;
  actualCompletedAt?: string;
  actualTatMinutes?: number | null;
  delayMinutes?: number | null;
  pcReviewStatus?: string;
  pcFeedback?: string;
  slaMinutes?: number | null;
};

type Contact = {
  name: string;
  email: string;
  phone: string;
  channels: string[];
};

type FMS = {
  id: string;
  code: string;
  name: string;
  plant: string;
  department: string;
  description: string;
  stages: Stage[];
  createdAt: string;
  number?: string;
  workflowMode?: "PDF_TEMPLATE" | "ZIP_TEMPLATE" | "MANUAL";
  sourceDocumentName?: string;
};



const API = (import.meta.env.VITE_API_URL || "http://localhost:4000") + "/api";
const FORM_URL_RE = /^https?:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/i;
const DOER_RE = /^[^\s@]+@dinerofoodworks\.com$/i;

/* =========================================================
   API HELPER
   ========================================================= */

async function api(
  path: string,
  options?: RequestInit,
  allowUnauthorized = false,
) {
  const r = await fetch(API + path, {
    ...options,
    credentials: "include",
  });

  const body = await r.json().catch(() => ({}));

  /*
   * A 401 is normal when checking /auth/me before login.
   * Other API errors should still throw.
   */
  if (!r.ok && !(allowUnauthorized && r.status === 401)) {
    throw new Error(body.error || "API error");
  }

  return body;
}

/* =========================================================
   NAVIGATION
   ========================================================= */

const nav = [
  ["/", "⌂", "Plant Tower"],
  ["/fms", "▦", "FMS Catalog"],
  ["/builder", "✦", "FMS Builder"],
  ["/audit", "◷", "Audit Trail"],
  ["/users", "♙", "Users & Access"],
];

type AuthUser = {
  id?: string;
  employeeCode?: string;
  email: string;
  name: string;
  domain?: string;
  role?: string;
  jobTitle?: string;
  permissions?: string[];
};

const STORAGE = "fms-live-v13";

/* =========================================================
   LOCAL FMS STORAGE
   ========================================================= */

const PLANTS = [
  "Indore - DFPL - Tata",
  "Indore - DFPL - Saffola",
  "Indore - DFPL - Dinero1",
  "Indore - DFPL - Dinero2",
  "Nawanshahr - CIPL",
  "Nawanshahr - DFPL",
];

const DEPARTMENTS = [
  "Raw Material",
  "Quality",
  "Production",
  "Packing",
  "Warehouse",
  "Dispatch",
  "Purchase",
  "Inventory",
  "Maintenance",
  "Finance",
  "HR",
  "MIS",
  "Management",
];

function localFmsNumber() {
  const nums = loadFms()
    .map((x) => String(x.number || "").match(/(\d+)$/)?.[1])
    .filter(Boolean)
    .map((x) => Number(x));
  return `FMS-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(6, "0")}`;
}

function normalizeFmsCode(value: string) {
  return value.trim().toUpperCase();
}

function loadFms(): FMS[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]");
  } catch {
    return [];
  }
}

function saveFms(rows: FMS[]) {
  localStorage.setItem(STORAGE, JSON.stringify(rows));
  window.dispatchEvent(new Event("fms-data-changed"));
}

/* =========================================================
   FMS API
   ========================================================= */

async function fetchFmsList(): Promise<FMS[]> {
  const rows = await api("/fms");

  return (rows || []).map((x: any) => ({
    id: String(x.id),
    code: x.code,
    name: x.name,
    plant: x.plant || "",
    department: x.department || "",
    number: x.fms_number ? `FMS-${String(x.fms_number).padStart(6, "0")}` : x.number || "",
    description: x.description || "",
    stages: [],
    createdAt: x.created_at || "",
    workflowMode: x.workflow_mode || "MANUAL",
    sourceDocumentName: x.source_document_name || "",
  }));
}

async function fetchFmsById(id: string): Promise<FMS> {
  const x = await api("/fms/" + encodeURIComponent(id));

  return {
    id: String(x.id),
    code: x.code,
    name: x.name,
    plant: x.plant || "",
    department: x.department || "",
    number: x.fms_number ? `FMS-${String(x.fms_number).padStart(6, "0")}` : x.number || "",
    description: x.description || "",
    stages: (x.stages || []).map((s: any) => ({
      ...s,
      when: s.when || s.when_text || "",
      responseSheetUrl: s.responseSheetUrl || s.response_sheet_url || "",
      pcEmail: s.pcEmail || s.pc_email || "",
      plannedHours: s.planned_tat_minutes === null || s.planned_tat_minutes === undefined ? null : Number(s.planned_tat_minutes) / 60,
      plannedAt: (s.planned_at || s.plannedAt) ? toLocalDateTimeInput(s.planned_at || s.plannedAt) : "",
      startedAt: s.started_at || s.startedAt || "",
      formSentAt: s.form_sent_at || s.formSentAt || "",
      actualCompletedAt: s.actual_completed_at || s.actualCompletedAt || "",
      actualTatMinutes: s.actual_tat_minutes === null || s.actual_tat_minutes === undefined ? (s.actualTatMinutes ?? null) : Number(s.actual_tat_minutes),
      delayMinutes: s.delay_minutes === null || s.delay_minutes === undefined ? (s.delayMinutes ?? null) : Number(s.delay_minutes),
      pcReviewStatus: s.pc_review_status || s.pcReviewStatus || "PENDING",
      pcFeedback: s.pc_feedback || s.pcFeedback || "",
      slaMinutes: s.sla_minutes === null || s.sla_minutes === undefined ? (s.slaMinutes ?? null) : Number(s.sla_minutes),
      fields: s.fields || [],
      contact: s.contact || defaultContact(),
    })),
    createdAt: x.createdAt || x.created_at || "",
    workflowMode: x.workflow_mode || "MANUAL",
    sourceDocumentName: x.source_document_name || "",
  };
}

/* =========================================================
   UTILITIES
   ========================================================= */

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function blankField(n = 1): Field {
  return {
    key: uid("q"),
    name: `Question ${n}`,
    type: "text",
    required: false,
    options: [],
    help: "",
  };
}

function sourceFields(fmsCode = "T-01", step = 1): Field[] {
  const id = `GF-${fmsCode}-S${String(step).padStart(2, "0")}`;

  const t = (formCatalog.forms as any[]).find((x) => x.form_id === id);

  if (!t) return [];

  return (t.fields || [])
    .filter((q: any) => !q.system)
    .slice(0, 6)
    .map((q: any, i: number) => ({
      key: q.key || uid("q"),
      name: q.name || q.label || `Question ${i + 1}`,
      type: q.type || "text",
      required: Boolean(q.required),
      options: q.options || [],
      help: q.help || "",
      system: false,
    }));
}

function systemFields(): Field[] {
  return [
    {
      key: "fms_instance_id",
      name: "FMS Instance ID",
      type: "text",
      required: true,
      options: [],
      system: true,
    },
    {
      key: "stage_code",
      name: "Stage Code",
      type: "text",
      required: true,
      options: [],
      system: true,
    },
    {
      key: "submission_timestamp",
      name: "Submission Timestamp",
      type: "datetime",
      required: true,
      options: [],
      system: true,
    },
  ];
}

function toLocalDateTimeInput(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 16);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function displayDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function displayDuration(minutes?: number | null) {
  if (minutes === null || minutes === undefined || !Number.isFinite(Number(minutes))) return "—";
  const total = Math.max(0, Math.floor(Number(minutes)));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", `${mins}m`].filter(Boolean).join(" ");
}

function stageDelayTone(stage: Stage) {
  const status = String(stage.status || "").toUpperCase();
  if (status === "EXCEPTION" || status === "HOLD" || status === "CORRECTION") return "delayRed";
  if (status === "DONE") return "delayGreen";
  if (["READY", "WORKING", "IN_PROGRESS"].includes(status)) return "delayYellow";
  return "delayNeutral";
}

function stageStatusLabel(stage: Stage, index = 0) {
  const status = String(stage.status || (index === 0 ? "READY" : "LOCKED")).toUpperCase();
  if (status === "DONE") return "DONE";
  if (status === "CORRECTION") return "RETURNED TO DOER";
  if (["READY", "WORKING", "IN_PROGRESS"].includes(status)) return "IN PROGRESS";
  if (status === "HOLD") return "ON HOLD";
  if (status === "EXCEPTION") return "EXCEPTION";
  return "LOCKED";
}

function stageElapsedMinutes(stage: Stage) {
  if (stage.actualTatMinutes !== null && stage.actualTatMinutes !== undefined) return Number(stage.actualTatMinutes);
  if (stage.startedAt && ["READY", "WORKING", "IN_PROGRESS", "CORRECTION"].includes(String(stage.status || "").toUpperCase())) {
    return Math.max(0, Math.floor((Date.now() - new Date(stage.startedAt).getTime()) / 60000));
  }
  return null;
}

function stageStatusClass(stage: Stage, index: number) {
  const status = String(stage.status || (index === 0 ? "READY" : "LOCKED")).toUpperCase();
  if (status === "DONE") return "flowDone";
  if (["READY", "WORKING", "IN_PROGRESS"].includes(status)) return "flowWorking";
  if (status === "HOLD" || status === "EXCEPTION" || status === "CORRECTION") return "flowDelayed";
  return "flowLocked";
}

const TATA_STAGE_NAMES = [
  "RM Inward",
  "Incoming QC",
  "Fumigation",
  "PM Inward",
  "Post-Fum QC",
  "Manual Sorting",
  "Pulses Packing",
  "Makhana Packing",
  "FG Release",
  "Dispatch Planning",
  "FG Dispatch",
  "Daily Inventory",
  "Quarterly Audit",
  "Loss / Breach",
  "SAP Daily Entries",
  "Monthly Invoice",
  "Labour + Consumables Cost",
  "Daily Production MIS",
];

function defaultStage(n: number): Stage {
  return {
    id: uid("stage"),
    name: TATA_STAGE_NAMES[n - 1] || `Stage ${String(n).padStart(2, "0")}`,
    what: "",
    how: "",
    who: "",
    when: "",
    plannedHours: null,
    plannedAt: "",
    googleFormUrl: "",
    fields: [],
    contact: defaultContact(),
    status: n === 1 ? "READY" : "LOCKED",
  };
}

function blankStage(n: number): Stage {
  return {
    id: uid("stage"),
    name: `Stage ${String(n).padStart(2, "0")}`,
    what: "",
    how: "",
    who: "",
    when: "",
    plannedHours: null,
    plannedAt: "",
    googleFormUrl: "",
    fields: [],
    contact: defaultContact(),
    status: n === 1 ? "READY" : "LOCKED",
  };
}

function defaultContact(): Contact {
  return { name: "", email: "", phone: "", channels: ["email"] };
}

// Auto-fill Stage 01 Google Form link and doer email when the uploaded PDF/ZIP text contains them.
function applyDoerDefaults(list: Stage[], text: string): Stage[] {
  const link = text.match(/https?:\/\/(?:docs\.google\.com\/forms\/|forms\.gle\/)[^\s"'<>)\]]+/i)?.[0];
  const mail = text.match(/[A-Za-z0-9._%+-]+@dinerofoodworks\.com/i)?.[0];
  if (!link && !mail) return list;
  return list.map((st, i) => i !== 0 ? st : {
    ...st,
    googleFormUrl: link || st.googleFormUrl || "",
    contact: { ...(st.contact || defaultContact()), email: mail ? mail.toLowerCase() : (st.contact?.email || ""), channels: ["email"], phone: "" },
  });
}

/* =========================================================
   GOOGLE IDENTITY SERVICES
   ========================================================= */

function loadGoogleIdentityScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    /*
     * Already loaded.
     */
    if ((window as any).google?.accounts?.id) {
      resolve();
      return;
    }

    /*
     * Script is already being loaded.
     */
    const existing = document.querySelector("script[data-google-gsi]");

    if (existing) {
      existing.addEventListener("load", () => resolve());

      existing.addEventListener("error", () =>
        reject(new Error("Google Identity Services could not load.")),
      );

      return;
    }

    /*
     * Load Google Identity Services.
     */
    const script = document.createElement("script");

    script.src = "https://accounts.google.com/gsi/client";

    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = "1";

    script.onload = () => resolve();

    script.onerror = () =>
      reject(new Error("Google Identity Services could not load."));

    document.head.appendChild(script);
  });
}

/* =========================================================
   LOGIN PAGE
   ========================================================= */

function LoginPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();

  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;

    const initializeGoogleLogin = async () => {
      try {
        /*
         * Check whether the browser already has
         * an authenticated FMS session.
         *
         * 401 is EXPECTED for a logged-out visitor.
         */
        const me = await api("/auth/me", undefined, true);

        if (!alive) return;

        if (me?.user) {
          navigate("/", {
            replace: true,
          });

          return;
        }

        /*
         * Client ID must exist.
         */
        if (!clientId) {
          setError(
            "Google login is not configured. Add VITE_GOOGLE_CLIENT_ID to client/.env.",
          );

          setLoading(false);

          return;
        }

        /*
         * Load Google Identity Services.
         */
        await loadGoogleIdentityScript();

        if (!alive) return;

        const google = (window as any).google;

        if (!google?.accounts?.id) {
          throw new Error("Google Identity Services failed to initialize.");
        }

        /*
         * Initialize Google Identity Services.
         */
        google.accounts.id.initialize({
          client_id: clientId,

          /*
           * Suggest/restrict the Google Workspace domain.
           *
           * IMPORTANT:
           * The backend MUST also verify the domain.
           */
          hd: "dinerofoodworks.com",

          callback: async (response: any) => {
            if (!alive) return;

            setLoading(true);
            setError("");

            try {
              if (!response?.credential) {
                throw new Error(
                  "Google did not return an authentication credential.",
                );
              }

              /*
               * Send Google's ID token to the FMS server.
               */
              const result = await api("/auth/google", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  credential: response.credential,
                }),
              });

              if (!alive) return;

              if (result?.user) {
                onAuthenticated();

                navigate("/", {
                  replace: true,
                });

                return;
              }

              throw new Error(
                "Authentication succeeded, but FMS access was not granted.",
              );
            } catch (e: any) {
              if (!alive) return;

              setError(
                e?.message ||
                  "This Google account is not authorized for the FMS Engine.",
              );
            } finally {
              if (alive) {
                setLoading(false);
              }
            }
          },
        });

        /*
         * IMPORTANT:
         *
         * Google Identity Services directly manipulates
         * the contents of this element.
         *
         * React MUST NOT render children inside it.
         *
         * This prevents:
         *
         * NotFoundError:
         * Failed to execute 'removeChild' on 'Node'
         */
        const button = document.getElementById("googleSignInButton");

        if (!button) {
          throw new Error("Google sign-in button container was not found.");
        }

        /*
         * Clear anything from a previous initialization.
         */
        button.innerHTML = "";

        /*
         * Let Google render its own button.
         */
        google.accounts.id.renderButton(button, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          width: 320,
        });

        if (alive) {
          setLoading(false);
        }
      } catch (e: any) {
        if (!alive) return;

        setError(e?.message || "Unable to initialize Google login.");

        setLoading(false);
      }
    };

    initializeGoogleLogin();

    return () => {
      alive = false;

      /*
       * Google owns the contents of this container.
       *
       * Remove Google's injected DOM before the
       * React component disappears.
       */
      const button = document.getElementById("googleSignInButton");

      if (button) {
        button.innerHTML = "";
      }
    };
  }, [clientId, navigate]);

  return (
    <div className="loginPage">
      <div className="loginCard">
        <div className="loginBrand">
          <div className="logo">F</div>

          <div>
            <b>FMS Plant</b>
            <small>Live Operations Engine</small>
          </div>
        </div>

        <span className="eyebrow">RESTRICTED PORTAL</span>

        <h1>Continue with Google</h1>

        <p>
          Only verified Google Workspace accounts ending in{" "}
          <b>@dinerofoodworks.com</b> can enter the FMS Engine.
        </p>

        <div className="loginRule">
          <span>✓ Google account authentication</span>

          <span>✓ Dinero FoodWorks domain required</span>

          <span>✓ Portal access checked on the server</span>
        </div>

        {error && <div className="editorNotice error">{error}</div>}

        {/*
         * IMPORTANT:
         *
         * DO NOT put a React child inside this div.
         *
         * Google Identity Services owns this DOM node.
         */}
        <div
          id="googleSignInButton"
          className="googleButton"
          aria-label="Google sign-in"
          suppressHydrationWarning
        />

        {loading && (
          <small className="googleLoading">Initializing Google sign-in…</small>
        )}

        <small className="loginFoot">
          Your Google password is handled by Google; the FMS Engine does not ask
          you to enter it.
        </small>
      </div>
    </div>
  );
}

/* =========================================================
   AUTH GATE
   ========================================================= */

function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "no">("loading");

  useEffect(() => {
    let alive = true;

    api("/auth/me", undefined, true)
      .then((r) => {
        if (!alive) return;

        setState(r?.user ? "ok" : "no");
      })
      .catch(() => {
        if (!alive) return;

        setState("no");
      });

    return () => {
      alive = false;
    };
  }, []);

  if (state === "loading") {
    return <div className="authLoading">Checking FMS access…</div>;
  }

  if (state === "no") {
    return (
      <LoginPage
        onAuthenticated={() => {
          setState("ok");
        }}
      />
    );
  }

  return <>{children}</>;
}

function useCurrentUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    api("/auth/me", undefined, true).then((r) => setUser(r?.user || null)).catch(() => setUser(null));
  }, []);
  return user;
}

function PermissionGate({ permission, children }: { permission: string; children: React.ReactNode }) {
  const user = useCurrentUser();
  if (!user) return <div className="authLoading">Checking access…</div>;
  if (user.role === "ADMIN" || user.permissions?.includes(permission)) return <>{children}</>;
  return (
    <Page title="Access restricted" sub={`Your role (${user.role || "UNKNOWN"}) does not have the ${permission} permission.`}>
      <Empty title="You do not have access to this workspace" text="Google authentication confirms your identity. The FMS authorization model controls what your role can access." />
    </Page>
  );
}

/* =========================================================
   LAYOUT
   ========================================================= */

function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const user = useCurrentUser();
  const canBuilder = Boolean(user?.role === "ADMIN" || user?.permissions?.includes("FMS_CREATE"));
  const canUsers = Boolean(user?.role === "ADMIN" || user?.permissions?.includes("USER_VIEW"));

  const visibleNav = nav.filter(([to]) => {
    if (to === "/builder") return canBuilder;
    if (to === "/users") return canUsers;
    return true;
  });

  return (
    <div className="app">
      <aside className={"sidebar " + (open ? "open" : "")}>
        <a className="brand" href="https://dinerofoodworks.com/" target="_blank" rel="noreferrer"><img className="brandMarkImage" src="/dinero-mark-white.png" alt="Dinero FoodWorks mark" /><div><b>Dinero FoodWorks</b><small>FMS Operations Engine</small></div></a>
        <div className="navgroup">CONTROL</div>
        {visibleNav.slice(0, 3).map(([to, i, n]) => (
          <NavLink onClick={() => setOpen(false)} className={({ isActive }: { isActive: boolean }) => "nav " + (isActive ? "active" : "")} to={to} key={to}>
            <span>{i}</span>{n}
          </NavLink>
        ))}
        <div className="navgroup">OPERATIONS</div>
        {visibleNav.slice(3).map(([to, i, n]) => (
          <NavLink onClick={() => setOpen(false)} className={({ isActive }: { isActive: boolean }) => "nav " + (isActive ? "active" : "")} to={to} key={to}>
            <span>{i}</span>{n}
          </NavLink>
        ))}
      </aside>

      <main className="main">
        <header className="top">
          <button className="hamb" onClick={() => setOpen(!open)}>☰</button>
          <span>FMS Engine / Live Workspace</span>
          <div className="topright">
            {user && <span className="rolePill"><b>{user.role}</b> · {user.name}</span>}
            <button className="logoutBtn" onClick={async () => { try { await api("/auth/logout", { method: "POST" }); } finally { window.location.href = "/"; } }}>Sign out</button>
            <span className="avatar">{(user?.name || "F").slice(0,1).toUpperCase()}</span>
          </div>
        </header>
        {children}
      </main>

      <nav className="mobileNav">
        {visibleNav.slice(0, 4).map(([to, i, n]) => (
          <NavLink key={to} to={to}><span>{i}</span><small>{n.split(" ")[0]}</small></NavLink>
        ))}
      </nav>
    </div>
  );
}

/* =========================================================
   STATUS
   ========================================================= */

const Status = ({ v }: { v: string }) => (
  <span className={"status " + v.toLowerCase().replace(/_/g, "-")}>{v}</span>
);

/* =========================================================
   PAGE
   ========================================================= */

function Page({
  title,
  sub,
  children,
  action,
}: {
  title: string;
  sub: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="page">
      <div className="pageHead">
        <div>
          <span className="eyebrow">FMS ENGINE · LIVE</span>

          <h1>{title}</h1>

          <p>{sub}</p>
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

/* =========================================================
   EMPTY
   ========================================================= */

function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card emptyState">
      <div className="emptyIcon">＋</div>

      <h3>{title}</h3>

      <p>{text}</p>

      {action}
    </div>
  );
}

/* =========================================================
   Plant TOWER
   ========================================================= */

function ControlTower() {
  const [rows, setRows] = useState<FMS[]>([]);
  const [featuredFms, setFeaturedFms] = useState<FMS | null>(null);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);
  const [dashboardError, setDashboardError] = useState("");

  const testSmtp = async () => {
    setSmtpTesting(true);
    try {
      const r = await api("/email/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      alert(r.message || "SMTP test sent successfully.");
    } catch (e: any) {
      alert(e.message || "SMTP test failed. Check server/.env and the SMTP provider settings.");
    } finally {
      setSmtpTesting(false);
    }
  };

  useEffect(() => {
    let alive = true;

    fetchFmsList()
      .then((r) => {
        if (alive) {
          const local = loadFms();
          const rows = r.length ? r : local;
          setRows(rows);
          if (r.length) saveFms(r);
        }
      })
      .catch(() => setRows(loadFms()));

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!rows.length) { setFeaturedFms(null); return () => { alive = false; }; }
    const first = rows[0];
    fetchFmsById(first.id).then((detail) => { if (alive) setFeaturedFms(detail); })
      .catch(() => { if (alive) setFeaturedFms(loadFms().find((x) => x.id === first.id) || first); });
    return () => { alive = false; };
  }, [rows]);

  useEffect(() => {
    let alive = true;
    const loadDashboard = async () => {
      try { const result = await api("/dashboard"); if (alive) { setDashboard(result); setDashboardError(""); } }
      catch (e: any) { if (alive) { setDashboardError(e.message || "Dashboard metrics are unavailable"); setDashboard(null); } }
    };
    loadDashboard();
    const timer = window.setInterval(loadDashboard, 30000);
    const onChanged = () => loadDashboard();
    window.addEventListener("fms-data-changed", onChanged);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener("fms-data-changed", onChanged); };
  }, []);

  return (
    <Page
      title="Operational Plant Tower"
      sub="Live command center. No sample projects or pre-filled execution data are loaded."
      action={
        <div className="actionBar">
          <button className="btn ghost" type="button" onClick={testSmtp} disabled={smtpTesting}>
            {smtpTesting ? "Testing SMTP…" : "✉ Test SMTP"}
          </button>
          <NavLink className="btn primary" to="/builder">
            ＋ Create FMS
          </NavLink>
        </div>
      }
    >
      <div className="metrics controlTowerMetrics">
        {[
          ["TOTAL FMS", dashboard?.hasLiveData ? dashboard.totalFms : "—", "Reusable process definitions"],
          ["RUNNING FMS", dashboard?.hasLiveData ? dashboard.runningFms : "—", "At least one active stage"],
          ["COMPLETED", dashboard?.hasLiveData ? dashboard.completedFms : "—", "All required stages DONE"],
          ["DELAYED STAGES", dashboard?.hasLiveData ? dashboard.delayedStages : "—", "Past planned due time"],
          ["EXCEPTIONS", dashboard?.hasLiveData ? dashboard.exceptions : "—", "PC exception decisions"],
        ].map((x) => (
          <div className="card metric" key={x[0]}>
            <span>{x[0]}</span>
            <strong>{x[1]}</strong>
            <small>{x[2]}</small>
          </div>
        ))}
      </div>
      <div className="card panel dashboardStageKpis">
        <div className="panelHead"><div><h3>Stage execution overview</h3><small>Calculated from live PostgreSQL workflow stages; refreshed every 30 seconds.</small></div><span className="livePill"><i /> LIVE</span></div>
        {dashboardError ? <div className="warning">{dashboardError}</div> : !dashboard?.hasLiveData ? <div className="emptyLive">No live FMS records yet. Create the first FMS to activate operational KPIs.</div> : <div className="stageKpiStrip">
          <div className="stageKpi kpiGreen"><span>DONE</span><b>{dashboard.doneStages}</b></div>
          <div className="stageKpi kpiYellow"><span>READY / IN PROGRESS</span><b>{dashboard.workingStages}</b></div>
          <div className="stageKpi kpiNeutral"><span>LOCKED / PENDING</span><b>{dashboard.lockedStages}</b></div>
          <div className="stageKpi kpiRed"><span>DELAYED</span><b>{dashboard.delayedStages}</b></div>
          <div className="stageKpi kpiCoral"><span>TOTAL STAGES</span><b>{dashboard.totalStages}</b></div>
        </div>}
      </div>

      <OverallDashboard data={dashboard} />

      {rows.length === 0 ? (
        <Empty
          title="No FMS created yet"
          text="Create the first FMS with real process information. The engine will not invent stages, people or work."
          action={
            <NavLink className="btn primary" to="/builder">
              Create your first FMS
            </NavLink>
          }
        />
      ) : (
        <div className="catalogGrid">
          {rows.map((f) => (
            <NavLink className="card fmsCard" to={`/fms/${f.id}`} key={f.id}>
              <div className="fmsTop">
                <b>{f.code}</b>
                <Status v="ACTIVE" />
              </div>

              <h3>{f.name}</h3>

              <p>{f.description || "No description"}</p>

              <div className="meta">
                <span>
                  <b>PLANT</b>
                  {f.plant}
                </span>

                <span>
                  <b>DEPARTMENT</b>
                  {f.department}
                </span>
              </div>

              <div className="stageCount">
                <small>{f.workflowMode === "PDF_TEMPLATE" ? "PDF TEMPLATE WORKFLOW" : f.workflowMode === "ZIP_TEMPLATE" ? "ZIP STAGE PACK WORKFLOW" : "MANUAL WORKFLOW"}</small> · Open live FMS <span>→</span>
              </div>
            </NavLink>
          ))}
        </div>
      )}

      {featuredFms && featuredFms.stages.length > 0 && (
        <div className="card panel workflowPanel stageFlowPanel dashboardWorkflow">
          <div className="panelHead">
            <div><span className="eyebrow">FIRST ACTIVE WORKFLOW</span><h3>{featuredFms.number || "FMS"} · {featuredFms.name}</h3><small>Stage 01 is ready. The remaining stages stay locked until PC approves each predecessor.</small></div>
            <NavLink className="btn ghost" to={`/fms/${featuredFms.id}`}>Open full workflow ↗</NavLink>
          </div>
          <div className="dashboardStageRail">
            {featuredFms.stages.map((st, i) => <React.Fragment key={st.id}>
              <NavLink className={`dashboardStage ${stageStatusClass(st, i)}`} to={`/fms/${featuredFms.id}/stage/${st.id}/edit`} style={{ animationDelay: `${Math.min(i * 35, 600)}ms` }}>
                <span>{String(i + 1).padStart(2, "0")}</span><b>{st.name}</b><small>{String(st.status || (i === 0 ? "READY" : "LOCKED")).toUpperCase()}</small>
              </NavLink>
              {i < featuredFms.stages.length - 1 && <span className="dashboardStageArrow" aria-hidden="true">→</span>}
            </React.Fragment>)}
          </div>
        </div>
      )}
    </Page>
  );
}

/* =========================================================
   FMS CATALOG
   ========================================================= */

function FmsCatalog() {
  const [rows, setRows] = useState<FMS[]>([]);

  useEffect(() => {
    let alive = true;

    fetchFmsList()
      .then((r) => {
        if (alive) {
          const local = loadFms();
          const rows = r.length ? r : local;
          setRows(rows);
          if (r.length) saveFms(r);
        }
      })
      .catch(() => setRows(loadFms()));

    return () => {
      alive = false;
    };
  }, []);

  return (
    <Page
      title="FMS Catalog"
      sub="Only live FMS definitions created in this workspace appear here."
      action={
        <NavLink className="btn primary" to="/builder">
          ＋ Create FMS
        </NavLink>
      }
    >
      {rows.length === 0 ? (
        <Empty
          title="Catalog is empty"
          text="There are no live FMS records yet. Create a real FMS to populate this catalog."
          action={
            <NavLink className="btn primary" to="/builder">
              ＋ Create FMS
            </NavLink>
          }
        />
      ) : (
        <div className="catalogGrid">
          {rows.map((f) => (
            <NavLink className="card fmsCard" to={`/fms/${f.id}`} key={f.id}>
              <div className="fmsTop">
                <b>{f.code}</b>
                <Status v="ACTIVE" />
              </div>

              <h3>{f.name}</h3>

              <p>{f.description || "No description"}</p>

              <div className="meta">
                <span>
                  <b>PLANT</b>
                  {f.plant}
                </span>

                <span>
                  <b>DEPARTMENT</b>
                  {f.department}
                </span>
              </div>

              <div className="stageCount">
                Open live FMS <span>→</span>
              </div>
            </NavLink>
          ))}
        </div>
      )}
    </Page>
  );
}

/* =========================================================
   PDF PROCESS-TEMPLATE IMPORT (best-effort, user-reviewed)
   ========================================================= */
async function extractPdfText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  if (!binary.startsWith("%PDF-")) throw new Error("Please select a valid PDF file.");
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < binary.length) {
    const start = binary.indexOf("stream", cursor);
    if (start < 0) break;
    let dataStart = start + 6;
    if (binary[dataStart] === "\r" && binary[dataStart + 1] === "\n") dataStart += 2;
    else if (binary[dataStart] === "\n" || binary[dataStart] === "\r") dataStart += 1;
    const end = binary.indexOf("endstream", dataStart);
    if (end < 0) break;
    const dictStart = Math.max(0, binary.lastIndexOf("<<", start));
    const dict = binary.slice(dictStart, start);
    let content = binary.slice(dataStart, end);
    try {
      if (/FlateDecode/.test(dict) && typeof DecompressionStream !== "undefined") {
        const raw = bytes.slice(dataStart, end - (binary.slice(dataStart, end).endsWith("\r\n") ? 2 : binary.slice(dataStart, end).endsWith("\n") || binary.slice(dataStart, end).endsWith("\r") ? 1 : 0));
        const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate"));
        content = new TextDecoder("latin1").decode(await new Response(stream).arrayBuffer());
      }
    } catch { /* Some PDFs use filters this lightweight reader cannot decode. */ }
    if (/\bBT\b/.test(content)) {
      const blocks = content.match(/\bBT\b[\s\S]*?\bET\b/g) || [];
      for (const block of blocks) {
        const values: string[] = [];
        const re = /\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f\s]+)>/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(block))) {
          if (m[1] !== undefined) {
            values.push(m[1].replace(/\\([()\\])/g, "$1").replace(/\\n/g, " ").replace(/\\r/g, " ").replace(/\\t/g, " ").replace(/\\[0-7]{1,3}/g, " "));
          } else if (m[2]) {
            const hex = m[2].replace(/\s/g, "");
            if (hex.length % 4 === 0 && /^(?:[0-9A-Fa-f]{4})+$/.test(hex)) {
              let decoded = "";
              for (let i = 0; i < hex.length; i += 4) decoded += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
              values.push(decoded);
            } else {
              let decoded = "";
              for (let i = 0; i + 1 < hex.length; i += 2) decoded += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
              values.push(decoded);
            }
          }
        }
        if (values.length) chunks.push(values.join(" "));
      }
    }
    cursor = end + 9;
  }
  const text = chunks.join("\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").replace(/[ \t]+/g, " ").trim();
  if (!text) throw new Error("Text could not be extracted from this PDF. It may be scanned or use unsupported font encoding. Use OCR or enter the stage names manually below.");
  return text;
}

function findStageNames(text: string): string[] {
  const normalized = text.replace(/\r/g, "\n").replace(/[\t ]+/g, " ").replace(/\n+/g, " ").trim();
  const found = new Map<number, string>();
  const patterns = [
    /\bT\s*[-–]\s*(\d{1,2})\s*[:.)-]?\s+([A-Z][A-Za-z0-9 /&()+,_-]{2,65}?)(?=\s+T\s*[-–]\s*\d{1,2}\b|\s+(?:STAGE|STEP|PHASE)\s*\d{1,2}\b|$)/g,
    /\b(?:STAGE|STEP|PHASE|PROCESS)\s*0?(\d{1,2})\s*[:.)-]\s*([A-Z][A-Za-z0-9 /&()+,_-]{2,65}?)(?=\s+(?:STAGE|STEP|PHASE|PROCESS)\s*0?\d{1,2}\b|\s+T\s*[-–]\s*\d{1,2}\b|$)/gi,
    /(?:^|\s)0?(\d{1,2})\s*[.)\-–:]\s*([A-Z][A-Za-z0-9 /&()+,_-]{2,65}?)(?=\s+0?\d{1,2}\s*[.)\-–:]|$)/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalized))) {
      const n = Number(match[1]);
      const name = match[2].replace(/\s+/g, " ").replace(/[|;,. -]+$/g, "").trim();
      if (n >= 1 && n <= 250 && name.length >= 3 && !found.has(n)) found.set(n, name);
    }
  }
  return [...found.entries()].sort((a, b) => a[0] - b[0]).map(([, name]) => name);
}

/* =========================================================
   ZIP STAGE PACK IMPORT (no server upload; parsed in browser)
   ========================================================= */
type ZipEntry = { name: string; data: Uint8Array };

async function readZipEntries(file: File): Promise<ZipEntry[]> {
  if (file.size > 100 * 1024 * 1024) throw new Error("ZIP is larger than 100 MB. Split the stage pack into smaller ZIP files.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = Math.max(0, bytes.length - 65557); i <= bytes.length - 22; i++) {
    if (view.getUint32(i, true) === 0x06054b50) eocd = i;
  }
  if (eocd < 0) throw new Error("This file does not look like a valid ZIP archive.");
  const count = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (count > 1000) throw new Error("ZIP contains more than 1,000 entries. Please split it into smaller stage packs.");
  const entries: ZipEntry[] = [];
  let pos = centralOffset;
  for (let n = 0; n < count; n++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = new TextDecoder().decode(bytes.slice(pos + 46, pos + 46 + nameLen));
    pos += 46 + nameLen + extraLen + commentLen;
    if (!name || name.endsWith("/") || name.startsWith("__MACOSX/") || name.split("/").some((part) => part.startsWith("."))) continue;
    if (compressedSize > 40 * 1024 * 1024) continue;
    if (view.getUint32(localOffset, true) !== 0x04034b50) continue;
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    let data: Uint8Array;
    if (method === 0) data = compressed;
    else if (method === 8 && typeof DecompressionStream !== "undefined") {
      try {
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
        data = new Uint8Array(await new Response(stream).arrayBuffer());
      } catch { continue; }
    } else continue;
    entries.push({ name, data });
  }
  if (!entries.length) throw new Error("No readable files were found inside the ZIP. Use a standard ZIP with stored/deflated files.");
  return entries;
}

function stageNameFromFilename(filename: string): { n: number; name: string } | null {
  const base = filename.split("/").pop()?.replace(/\.[^.]+$/, "") || filename;
  const patterns = [
    /^(?:stage|step|phase|process)\s*0*(\d{1,3})\s*[-_.:) ]+(.{2,100})$/i,
    /^T\s*[-_ ]?0*(\d{1,3})\s*[-_.:) ]+(.{2,100})$/i,
    /^0*(\d{1,3})\s*[-_.:) ]+(.{2,100})$/i,
  ];
  for (const re of patterns) {
    const m = base.match(re);
    if (m) { const n = Number(m[1]); const name = m[2].replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(); if (n >= 1 && n <= 250 && name.length >= 2) return { n, name }; }
  }
  return null;
}

async function extractZipStageCandidates(file: File): Promise<{ names: string[]; files: string[]; text: string }> {
  const entries = await readZipEntries(file);
  const candidates = new Map<number, string>();
  let allText = "";
  for (const entry of entries) {
    const candidate = stageNameFromFilename(entry.name);
    if (candidate && !candidates.has(candidate.n)) candidates.set(candidate.n, candidate.name);
  }
  const readable = entries.filter((e) => /\.(txt|md|csv|html?|xml|json|pdf)$/i.test(e.name));
  for (const entry of readable) {
    if (candidates.size >= 250) break;
    const ext = entry.name.toLowerCase().split(".").pop();
    let text = "";
    if (ext === "pdf") {
      try { text = await extractPdfText(new File([entry.data], entry.name, { type: "application/pdf" })); } catch { /* Use filename-derived stage names if PDF text isn't extractable. */ }
    } else {
      text = new TextDecoder().decode(entry.data);
      if (ext === "html" || ext === "htm" || ext === "xml") text = text.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
    }
    allText += text + "\n";
    const names = findStageNames(text);
    for (const name of names) {
      const numMatch = text.match(new RegExp(`(?:stage|step|phase|process|T\\s*[-–]?\\s*)\\s*0*(\\d{1,3})\\s*[:.)-]?\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 16)}`, "i"));
      const n = numMatch ? Number(numMatch[1]) : 0;
      if (n > 0 && n <= 250 && !candidates.has(n)) candidates.set(n, name);
    }
  }
  const ordered = [...candidates.entries()].sort((a, b) => a[0] - b[0]).map(([, name]) => name);
  if (!ordered.length) throw new Error("No stage names could be detected. Name files like ‘Stage 01 - RM Inward.pdf’ or use Manual FMS and add stages yourself.");
  return { names: ordered, files: entries.map((e) => e.name), text: allText };
}

/* =========================================================
   BUILDER
   ========================================================= */

function Builder() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  // Stable creation timestamp shown in the identity step and saved when the FMS is created.
  const [createdTimestamp] = useState(() => new Date().toISOString());
  const [workflowMode, setWorkflowMode] = useState<"PDF_TEMPLATE" | "ZIP_TEMPLATE" | "MANUAL" | "">("");
  const [sourceDocumentName, setSourceDocumentName] = useState("");
  const [pdfText, setPdfText] = useState("");
  const [pdfStatus, setPdfStatus] = useState("");
  const [zipStatus, setZipStatus] = useState("");
  const [zipFiles, setZipFiles] = useState<string[]>([]);
  const [stage1Notice, setStage1Notice] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [identity, setIdentity] = useState({
    name: "",
    code: "",
    plant: "",
    department: "",
    description: "",
  });

  const [stages, setStages] = useState<Stage[]>([blankStage(1)]);

  const [selected, setSelected] = useState(0);

  const [created, setCreated] = useState(false);

  const [error, setError] = useState("");

  const chooseMode = (mode: "PDF_TEMPLATE" | "ZIP_TEMPLATE" | "MANUAL") => {
    setWorkflowMode(mode);
    setError("");
    setPdfStatus("");
    setZipStatus("");
    setZipFiles([]);
    setSourceDocumentName("");
    setPdfText("");
    setStages([blankStage(1)]);
    setSelected(0);
  };

  const importPdf = async (file?: File) => {
    if (!file) return;
    setPdfStatus("Reading PDF and looking for numbered process stages…");
    setError("");
    setSourceDocumentName(file.name);
    try {
      const text = await extractPdfText(file);
      setPdfText(text);
      const names = findStageNames(text);
      if (names.length) {
        setStages(applyDoerDefaults(names.map((name, i) => ({ ...blankStage(i + 1), name, status: i === 0 ? "READY" : "LOCKED" })), text));
        setSelected(0);
        setPdfStatus(`Found ${names.length} candidate stage names. Review and correct every stage before creating the FMS.`);
      } else {
        setStages([blankStage(1)]);
        setPdfStatus("PDF text was extracted, but numbered stage headings were not detected reliably. Add or rename stages manually using the extracted text below.");
      }
    } catch (e: any) {
      setPdfStatus(e.message || "Could not read this PDF. You can still enter stages manually.");
      setPdfText("");
    }
  };

  const importZip = async (file?: File) => {
    if (!file) return;
    setZipStatus("Scanning ZIP files and looking for numbered stage names…");
    setPdfStatus("");
    setError("");
    setSourceDocumentName(file.name);
    setZipFiles([]);
    try {
      const result = await extractZipStageCandidates(file);
      setZipFiles(result.files);
      setStages(applyDoerDefaults(result.names.map((name, i) => ({ ...blankStage(i + 1), name, status: i === 0 ? "READY" : "LOCKED" })), result.text));
      setSelected(0);
      setZipStatus(`Imported ${result.names.length} candidate stages from ${result.files.length} files. Review names, sequence, responsibility, planned time and Google Form URL before creating the FMS.`);
    } catch (e: any) {
      setSourceDocumentName("");
      setZipStatus(e.message || "Could not read the ZIP. You can switch to Manual FMS and add stages yourself.");
    }
  };

  const parseTextStages = () => {
    const names = findStageNames(pdfText);
    if (!names.length) {
      setPdfStatus("No numbered stage headings were detected. Add the stages manually below.");
      return;
    }
    setStages(names.map((name, i) => ({ ...blankStage(i + 1), name, status: i === 0 ? "READY" : "LOCKED" })));
    setSelected(0);
    setPdfStatus(`Parsed ${names.length} candidate stages. Review and correct the list before creating the FMS.`);
  };

  const updateStage = (patch: Partial<Stage>) =>
    setStages((current) => current.map((stage, i) => i === selected ? { ...stage, ...patch } : stage));

  const addStage = () => {
    setStages((a) => [...a, blankStage(a.length + 1)]);

    setSelected(stages.length);
    setStep(2);
  };

  const removeStage = (i: number) => {
    if (stages.length === 1) {
      alert("An FMS must have at least one stage.");

      return;
    }

    if (!confirm(`Delete ${stages[i].name || `Stage ${i + 1}`}?`)) {
      return;
    }

    setStages((a) => a.filter((_, n) => n !== i));

    setSelected(Math.max(0, Math.min(selected, stages.length - 2)));
  };

  const validateStep = (n: number) => {
    if (!workflowMode) { setError("Choose PDF import, ZIP stage pack, or Manual FMS before continuing."); return false; }
    if (n === 2 && (workflowMode === "PDF_TEMPLATE" || workflowMode === "ZIP_TEMPLATE") && !sourceDocumentName) { setError(workflowMode === "ZIP_TEMPLATE" ? "Upload the plant stage ZIP first, or switch to Manual FMS." : "Upload the plant process PDF first, or switch to Manual FMS."); return false; }
    if (n === 1) {
      if (
        !identity.name.trim() ||
        !identity.code.trim() ||
        !identity.plant.trim() ||
        !identity.department.trim()
      ) {
        setError(
          "Complete Process Name, FMS code, plant and department. Description is optional.",
        );

        return false;
      }
    }

    if (n === 2) {
      const bad = stages.find((s) => !s.name.trim());
      if (!stages.length) { setError("Add at least one stage to this FMS."); return false; }
      if (bad) {
        setError(`Stage ${stages.indexOf(bad) + 1} needs a stage name.`);
        return false;
      }
      const incomplete = stages.find((st) => !st.what.trim() || !st.who.trim() || !st.how.trim() || !st.when.trim());
      if (incomplete) {
        const n = stages.indexOf(incomplete) + 1;
        const missing = [
          !incomplete.what.trim() ? "WHAT" : "",
          !incomplete.who.trim() ? "WHO" : "",
          !incomplete.how.trim() ? "HOW" : "",
          !incomplete.when.trim() ? "WHEN" : "",
        ].filter(Boolean);
        setError(`Stage ${n} is missing ${missing.join(", ")}. Complete WHAT, WHO, HOW and WHEN for every stage.`);
        return false;
      }
    }
    if (n === 3) {
      const s1 = stages[0];
      if (!(FORM_URL_RE.test((s1.googleFormUrl || "").trim()) && DOER_RE.test((s1.contact?.email || "").trim()))) {
        setError("Stage 01 needs a Google Form URL and the doer's @dinerofoodworks.com email before you can create the FMS.");
        return false;
      }
      const linkBad = stages.findIndex((st) => (st.googleFormUrl?.trim() || st.contact?.email?.trim()) && !(FORM_URL_RE.test((st.googleFormUrl || "").trim()) && DOER_RE.test((st.contact?.email || "").trim())));
      if (linkBad >= 0) {
        setError(`Stage ${linkBad + 1}: enter a valid Google Form URL and a @dinerofoodworks.com doer email, or leave both empty.`);
        return false;
      }
    }
    // Stage 01 link + doer email are emailed to the doer by the server when Create FMS is clicked.
    // FMS definitions can be created first; stage links can be configured before activation.

    setError("");

    return true;
  };

  const goNext = () => {
    if (validateStep(step)) {
      setStep(Math.min(4, step + 1));
    }
  };

  const goBack = () => {
    setError("");

    setStep(Math.max(1, step - 1));
  };

  const createFms = async () => {
    setError("");

    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    const code = normalizeFmsCode(identity.code);
    const duplicateLocal = loadFms().some((x) => normalizeFmsCode(x.code) === code);
    if (duplicateLocal) {
      setError(`FMS Code ${code} is already available. Choose another Code.`);
      setStep(1);
      return;
    }

    const f: FMS = {
      id: uid("fms"),
      number: localFmsNumber(),
      ...identity,
      code,
      workflowMode: workflowMode as "PDF_TEMPLATE" | "ZIP_TEMPLATE" | "MANUAL",
      sourceDocumentName,
      description: [identity.description.trim(), `Workflow mode: ${workflowMode === "PDF_TEMPLATE" ? "Plant PDF Template" : workflowMode === "ZIP_TEMPLATE" ? "Plant ZIP Stage Pack" : "Manual FMS"}${sourceDocumentName ? `; source file: ${sourceDocumentName}` : ""}`].filter(Boolean).join("\n"),

      stages: stages.map((s, i) => ({
        ...s,
        plannedAt: "",
        status: i === 0 ? "READY" : "LOCKED",
        approved: false,
      })),

      createdAt: createdTimestamp,
    };

    try {
      const createdResult = await api("/fms/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(f),
      });

      setStage1Notice(createdResult?.stage1Email?.message || "");
      if (createdResult?.stage1Email?.sent && f.stages[0]) {
        f.stages[0] = { ...f.stages[0], approved: true, formSentAt: new Date().toISOString(), formStatus: "SENT" };
      }
      if (createdResult?.id) f.id = String(createdResult.id);
      if (createdResult?.fms_number) f.number = `FMS-${String(createdResult.fms_number).padStart(6, "0")}`;
      saveFms([...loadFms(), f]);

      setCreated(true);

      setCreatedId(f.id);
    } catch (e: any) {
      setError(e.message || "FMS could not be created. Nothing was saved.");
    }
  };

  if (created) {
    return (
      <Page
        title="FMS created"
        sub={`The FMS definition is created. Stage 01 is READY; the remaining ${Math.max(0, stages.length - 1)} stages are locked until PC approval. Workflow: ${workflowMode === "PDF_TEMPLATE" ? "Plant PDF Template" : workflowMode === "ZIP_TEMPLATE" ? "Plant ZIP Stage Pack" : "Manual FMS"}.`}
        action={
          <div className="actionBar">
            {createdId && (
              <NavLink className="btn primary" to={`/fms/${createdId}`}>
                Open FMS workflow ↗
              </NavLink>
            )}
            <NavLink className="btn ghost" to="/fms">
              Open FMS Catalog
            </NavLink>
          </div>
        }
      >
        <div className="card successBox">
          <b>✓ FMS created successfully</b>

          <p>
            {identity.code} · {identity.name}
          </p>

          <p>
            <b>Timestamp:</b> {new Date(createdTimestamp).toLocaleString([], { dateStyle: "medium", timeStyle: "medium" })}
          </p>

          {stage1Notice && <p className="editorNotice">{stage1Notice}</p>}

          <p>
            {stages.length} stages configured. Stage 01 is READY; each remaining stage unlocks only after PC marks its predecessor DONE.
          </p>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Create FMS"
      sub="Choose a process-PDF template or build a custom sequential workflow. Review all stages before creating the live FMS."
      action={
        <NavLink className="btn ghost" to="/fms">
          ← Catalog
        </NavLink>
      }
    >
      <div className="workflowModeGrid workflowModeGridThree">
        <button type="button" className={`workflowModeCard ${workflowMode === "PDF_TEMPLATE" ? "selected" : ""}`} onClick={() => chooseMode("PDF_TEMPLATE")}>
          <span className="workflowModeIcon">▤</span><span className="workflowModeTitle">Option 1 · Plant PDF</span>
          <span className="workflowModeText">Upload one process PDF. The engine suggests stage names; review the sequence before creation.</span>
          <span className="workflowModeTag">SINGLE DOCUMENT</span>
        </button>
        <button type="button" className={`workflowModeCard ${workflowMode === "ZIP_TEMPLATE" ? "selected" : ""}`} onClick={() => chooseMode("ZIP_TEMPLATE")}>
          <span className="workflowModeIcon">▣</span><span className="workflowModeTitle">Option 2 · Plant Stage ZIP</span>
          <span className="workflowModeText">Upload one ZIP containing all stage files (Stage 01…18, 19 or more). Stage filenames and readable documents are scanned together.</span>
          <span className="workflowModeTag">BULK STAGE IMPORT · RECOMMENDED</span>
        </button>
        <button type="button" className={`workflowModeCard ${workflowMode === "MANUAL" ? "selected" : ""}`} onClick={() => chooseMode("MANUAL")}>
          <span className="workflowModeIcon">＋</span><span className="workflowModeTitle">Option 3 · Manual FMS</span>
          <span className="workflowModeText">Start blank. Add, rename, reorder and configure as many stages as the process needs.</span>
          <span className="workflowModeTag">CUSTOM WORKFLOW</span>
        </button>
      </div>
      {workflowMode === "PDF_TEMPLATE" && (
        <div className="card pdfImportCard importCardMotion">
          <div><h3>Import plant process PDF</h3><p className="muted">Readable text is extracted where possible. Scanned PDFs may require OCR. Review every suggested stage before creating the workflow.</p></div>
          <label className="pdfUploadLabel"> <span>Choose PDF file</span><input type="file" accept="application/pdf,.pdf" onChange={(e) => importPdf(e.target.files?.[0])} /></label>
          {sourceDocumentName && <div className="pdfFileName">Selected: <b>{sourceDocumentName}</b></div>}
          {pdfStatus && <div className="editorNotice">{pdfStatus}</div>}
          {sourceDocumentName && <details className="pdfTextDetails"><summary>Review / paste extracted PDF text or OCR text</summary><textarea className="textarea pdfTextArea" value={pdfText} onChange={(e) => setPdfText(e.target.value)} placeholder="For scanned PDFs, paste OCR text here and extract candidate stages again." /><button type="button" className="btn ghost" onClick={parseTextStages}>Extract stage candidates again</button></details>}
        </div>
      )}
      {workflowMode === "ZIP_TEMPLATE" && (
        <div className="card pdfImportCard importCardMotion zipImportCard">
          <div><h3>Import the entire plant stage pack</h3><p className="muted">Select one ZIP containing all stage files. Put files in sequence and name them clearly, for example <b>Stage 01 - RM Inward.pdf</b>, <b>Stage 02 - Incoming QC.html</b>. Supported readable content includes filenames, TXT, CSV, Markdown, HTML and many text-based PDFs.</p></div>
          <label className="pdfUploadLabel"><span>Choose stage ZIP file</span><input type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={(e) => importZip(e.target.files?.[0])} /></label>
          {sourceDocumentName && <div className="pdfFileName">Selected: <b>{sourceDocumentName}</b></div>}
          {zipStatus && <div className="editorNotice">{zipStatus}</div>}
          {zipFiles.length > 0 && <div className="zipFileList"><b>Files scanned ({zipFiles.length})</b><div>{zipFiles.slice(0,12).map((f) => <span key={f}>▤ {f}</span>)}{zipFiles.length > 12 && <span>+ {zipFiles.length - 12} more files</span>}</div></div>}
        </div>
      )}
      {!workflowMode && <div className="editorNotice">Choose PDF import, ZIP stage pack, or manual FMS creation.</div>}

      <div className="builderSteps">
        {["Identity", "Stages", "Stage Form", "Review"].map((x, i) => (
          <div
            className={
              "builderStep " +
              (step === i + 1 ? "active" : step > i + 1 ? "done" : "")
            }
            key={x}
          >
            <b>{i + 1}</b>
            {x}
          </div>
        ))}
      </div>

      {error && <div className="editorNotice error">{error}</div>}

      <div className="card builderCard">
        {step === 1 && (
          <>
            <h2>FMS identity</h2>

            <p className="muted">
              All identity fields are required except Description.
            </p>

            <div className="formGrid">
              <Field
                label="Process Name"
                value={identity.name}
                onChange={(v) =>
                  setIdentity({
                    ...identity,
                    name: v,
                  })
                }
                placeholder="e.g. Raw Material Inward"
                required
              />

              

              <label className="fieldLabel">
                <span>FMS Code <em>Required · unique</em></span>
                <input
                  className="input"
                  value={identity.code}
                  onChange={(e) =>
                    setIdentity({ ...identity, code: normalizeFmsCode(e.target.value) })
                  }
                  placeholder="e.g. TATA-RM-INWARD"
                  required
                />
                <small className="fieldHint">The same FMS Code cannot be created twice. Reuse the definition through FMS Instances.</small>
              </label>

              <label className="fieldLabel">
                <span>Plant <em>Required</em></span>
                <select
                  className="input"
                  value={identity.plant}
                  onChange={(e) => setIdentity({ ...identity, plant: e.target.value })}
                  required
                >
                  <option value="">Select plant...</option>
                  {PLANTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>

              <label className="fieldLabel">
                <span>Department <em>Required</em></span>
                <select
                  className="input"
                  value={identity.department}
                  onChange={(e) => setIdentity({ ...identity, department: e.target.value })}
                  required
                >
                  <option value="">Select department...</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>

              <label className="fieldLabel full">
                <span>
                  Description <em>Optional</em>
                </span>

                <textarea
                  className="textarea"
                  value={identity.description}
                  onChange={(e) =>
                    setIdentity({
                      ...identity,
                      description: e.target.value,
                    })
                  }
                  placeholder="Optional: what does this FMS plant control?"
                />
              </label>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Stages</h2>

            <p className="muted">
              {workflowMode === "PDF_TEMPLATE" ? "Stages were suggested from the uploaded PDF. Verify their order and edit them to match the approved plant process." : workflowMode === "ZIP_TEMPLATE" ? "Stages were detected from the files inside the ZIP. Verify sequence and names against the approved plant process before creating the FMS." : "Build a custom sequential workflow. Add as many stages as required; stage 01 is READY and later stages stay LOCKED until PC marks the previous stage DONE."}
            </p>

            <div className="stageBuilderList">
              {stages.map((s, i) => (
                <div
                  className={
                    "stageBuilderRow " + (selected === i ? "selected" : "")
                  }
                  key={s.id}
                >
                  <button
                    type="button"
                    className="stageSelect"
                    onClick={() => setSelected(i)}
                  >
                    <span>{String(i + 1).padStart(2, "0")}</span>

                    <b>{s.name || "Unnamed stage"}</b>
                  </button>

                  {stages.length > 1 ? (
                    <button
                      type="button"
                      className="miniBtn dangerMini"
                      onClick={() => removeStage(i)}
                      title="Delete stage"
                    >
                      🗑 Delete
                    </button>
                  ) : (
                    <span className="stageRequiredTag">Required</span>
                  )}
                </div>
              ))}
            </div>

            <div className="stageEdit card">
              <div className="stageEditHead">
                <div>
                  <span className="eyebrow">
                    STAGE {String(selected + 1).padStart(2, "0")}
                  </span>

                  <h3>Stage definition</h3>
                </div>

                <button type="button" className="btn ghost" onClick={addStage}>
                  ＋ Add stage
                </button>
              </div>

              <div className="formGrid">
                <Field
                  label="Stage name"
                  value={stages[selected].name}
                  onChange={(v) =>
                    updateStage({
                      name: v,
                    })
                  }
                  placeholder="Enter actual stage name"
                  required
                />

                <Field
                  label="Responsible person / role"
                  value={stages[selected].who}
                  onChange={(v) =>
                    updateStage({
                      who: v,
                    })
                  }
                  placeholder="Actual person or role"
                  required
                />

                <Field
                  label="WHAT"
                  value={stages[selected].what}
                  onChange={(v) =>
                    updateStage({
                      what: v,
                    })
                  }
                  placeholder="What is performed?"
                  required
                />

                <Field
                  label="HOW"
                  value={stages[selected].how}
                  onChange={(v) =>
                    updateStage({
                      how: v,
                    })
                  }
                  placeholder="How is it performed?"
                  required
                />

                <Field
                  label="WHEN"
                  value={stages[selected].when}
                  onChange={(v) =>
                    updateStage({
                      when: v,
                    })
                  }
                  placeholder="When should it happen / trigger / frequency?"
                  required
                />

                <Field
                  label="PLANNED HOURS"
                  value={stages[selected].plannedHours == null ? "" : String(stages[selected].plannedHours)}
                  onChange={(v) =>
                    updateStage({
                      plannedHours: v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v),
                    })
                  }
                  placeholder="Hours to complete this stage, e.g. 4 (leave blank for no deadline)"
                />

                <div className="timing-baseline-note">
                  <b>Automatic timing</b>
                  <p>The stage's task-created/activated timestamp is recorded automatically. When PC marks DONE, the system records the actual completion timestamp and calculates time taken. No arbitrary four-hour deadline is assumed.</p>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2>Stage form</h2>

            <p className="muted">
              Paste the existing Google Form URL and enter the responsible person’s Dinero Workspace email. Questions stay in Google Forms; the FMS Engine does not recreate form fields.
            </p>

            <FormEditor
              allowDispatch={false}
              stage={stages[selected]}
              onChange={(s) =>
                setStages((a) => a.map((x, i) => (i === selected ? s : x)))
              }
            />
          </>
        )}

        {step === 4 && (
          <>
            <h2>Review & create</h2>

            <div className="reviewBox">
              <b>
                {identity.code || "FMS code"} · {identity.name || "Process Name"}
              </b>
              <p className="muted">System FMS number is generated automatically. Mode: {workflowMode === "PDF_TEMPLATE" ? "Plant PDF Template" : workflowMode === "ZIP_TEMPLATE" ? "Plant ZIP Stage Pack" : "Manual FMS"}{sourceDocumentName ? ` · Source: ${sourceDocumentName}` : ""}.</p>

              <p>
                {identity.plant || "Plant"} ·{" "}
                {identity.department || "Department"}
              </p>

              <div className="reviewStageList">
                {stages.map((s, i) => (
                  <div key={s.id}>
                    <b>
                      {i + 1}. {s.name}
                    </b>

                    <span>
                      {s.googleFormUrl ? "Google Form linked" : "Form link pending"} · {s.contact?.email ? "Workspace email set" : "Email pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="createNotice">
              Click <b>Create FMS</b> to create the live FMS. There is no draft
              save.
            </div>
          </>
        )}
      </div>

      <div className="builderFoot">
        {step > 1 && (
          <button type="button" className="btn ghost" onClick={goBack}>
            ← Back
          </button>
        )}

        {step < 4 ? (
          <button type="button" className="btn primary" onClick={goNext}>
            Next →
          </button>
        ) : (
          <button type="button" className="btn createBtn" onClick={createFms}>
            ✓ Create FMS
          </button>
        )}
      </div>
    </Page>
  );
}

/* =========================================================
   FORM EDITOR
   ========================================================= */

function FormEditor({
  stage,
  onChange,
  allowDispatch = true,
}: {
  stage: Stage;
  onChange: (s: Stage) => void;
  allowDispatch?: boolean;
}) {
  const [notice, setNotice] = useState("");
  const contact = stage.contact || defaultContact();
  const update = (patch: Partial<Stage>) => onChange({ ...stage, ...patch });
  const setEmail = (email: string) => onChange({ ...stage, contact: { ...contact, email, channels: ["email"], phone: "" }, approved: false });

  const approve = () => {
    if (!/^https?:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/i.test((stage.googleFormUrl || "").trim())) {
      setNotice("Enter a valid Google Forms URL before approving this stage.");
      return;
    }
    if (!/^[^\s@]+@dinerofoodworks\.com$/i.test(contact.email.trim())) {
      setNotice("Use the responsible person’s @dinerofoodworks.com Workspace email.");
      return;
    }
    update({ approved: true, formVersion: (stage.formVersion || 0) + 1 });
    setNotice("Configuration approved. Use Send now to email the Google Form link.");
  };

  const dispatch = async () => {
    if (stage.status === "LOCKED" || stage.status === "DONE") {
      setNotice(stage.status === "DONE" ? "This stage is already complete." : "This stage is locked until the previous stage is approved by PC.");
      return;
    }
    if (!stage.approved) {
      setNotice("Approve the configuration before sending.");
      return;
    }
    if (!stage.googleFormUrl?.trim() || !contact.email?.trim()) {
      setNotice("Add the Google Form URL and responsible Workspace email first.");
      return;
    }
    try {
      const r = await api(`/form-config/${encodeURIComponent(stage.id)}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: stage.id, stage, clientUrl: window.location.origin }),
      });
      setNotice(r.message || "Google Form link emailed.");
    } catch (e: any) {
      setNotice(e.message || "Email dispatch failed. Check SMTP and the backend terminal.");
    }
  };

  return (
    <div className="formEditor googleLinkEditor">
      <div className="editorToolbar">
        <div>
          <span className="eyebrow">GOOGLE FORM LINK</span>
          <h3>{stage.approved ? "Approved stage delivery" : "Stage form delivery"}</h3>
          <small>Google Forms owns the questions and responses. FMS stores the link and sends it to the assigned Workspace account.</small>
        </div>
        <Status v={stage.approved ? "APPROVED" : "EDITING"} />
      </div>
      {notice && <div className="editorNotice">{notice}</div>}
      <div className="googleLinkGrid">
        <label className="fieldLabel">
          <span>Existing Google Form URL <em>Required for sending</em></span>
          <input className="input" type="url" value={stage.googleFormUrl || ""} onChange={(e) => update({ googleFormUrl: e.target.value, approved: false })} placeholder="https://docs.google.com/forms/d/e/.../viewform" />
          {stage.googleFormUrl && <a className="link" href={stage.googleFormUrl} target="_blank" rel="noreferrer">Open Google Form ↗</a>}
        </label>
        <label className="fieldLabel">
          <span>Response Sheet URL <em>PC review link</em></span>
          <input className="input" type="url" value={stage.responseSheetUrl || ""} onChange={(e) => update({ responseSheetUrl: e.target.value, approved: false })} placeholder="https://docs.google.com/spreadsheets/d/.../edit" />
          <small className="fieldHint">Open this stage's Google Form → Responses → green Sheets icon, then paste that sheet's link here.</small>
        </label>
        <label className="fieldLabel">
          <span>PC email <em>receives notifications</em></span>
          <input className="input" type="email" value={stage.pcEmail || ""} onChange={(e) => update({ pcEmail: e.target.value, approved: false })} placeholder="pc@dinerofoodworks.com" />
          <small className="fieldHint">PC gets an email when the form is sent, submitted, marked DONE, or returned.</small>
        </label>
        <label className="fieldLabel">
          <span>Responsible Workspace email <em>@dinerofoodworks.com only</em></span>
          <input className="input" type="email" value={contact.email || ""} onChange={(e) => setEmail(e.target.value)} placeholder="doer@dinerofoodworks.com" />
          <small className="fieldHint">Only email delivery is enabled. Phone/WhatsApp and phone-number fields have been removed.</small>
        </label>
      </div>
      <div className="googleResponseNote">
        <div className="responseIcon">↗</div>
        <div><b>PC reviews responses in Google Sheets</b><p>The doer submits the linked Google Form. PC opens the same Google Form, selects <b>Responses → View in Sheets</b>, and reviews the response sheet there. A form submission alone does not mark the FMS stage DONE.</p></div>
      </div>
      <div className="editorFooter">
        {stage.googleFormUrl && <a className="btn ghost" href={stage.googleFormUrl} target="_blank" rel="noreferrer">↗ Open Google Form</a>}
        {!allowDispatch ? <small className="fieldHint">Stage 01 link and doer email are emailed as soon as you click Create FMS. Other stages are emailed later from their stage page.</small> : <div className="actionBar">
          {!stage.approved ? <button className="btn primary" onClick={approve}>✓ Approve link</button> : <button className="btn ghost" onClick={() => { update({ approved: false }); setNotice("Configuration unlocked for editing."); }}>Edit configuration</button>}
          <button className="btn createBtn" onClick={dispatch} disabled={!stage.approved || stage.status === "LOCKED" || stage.status === "DONE"}>✉ Send now</button>
        </div>}
      </div>
    </div>
  );
}

/* =========================================================
   FMS STAGE EDIT
   ========================================================= */

function FmsStageEdit() {
  const { id, stageId } = useParams();

  const [f, setF] = useState<FMS | null>(null);

  const [stage, setStage] = useState<Stage | null>(null);

  const [loading, setLoading] = useState(true);
  const initialStageLoaded = useRef(false);

  useEffect(() => {
    let alive = true;

    fetchFmsById(id || "")
      .then((x) => {
        if (!alive) return;

        setF(x);

        setStage(x.stages.find((s: Stage) => s.id === stageId) || null);
      })
      .catch(() => {
        const local = loadFms().find((x) => x.id === id) || null;

        setF(local);

        setStage(local?.stages.find((x) => x.id === stageId) || null);
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [id, stageId]);

  useEffect(() => {
    if (!f || !stage) return;

    saveFms(
      loadFms().map((x) =>
        x.id === f.id
          ? {
              ...f,
              stages: f.stages.map((x) => (x.id === stage.id ? stage : x)),
            }
          : x,
      ),
    );

    // Loading an already-approved stage must not create another version automatically.
    if (!initialStageLoaded.current) {
      initialStageLoaded.current = true;
      return;
    }

    if (stage.approved) {
      api(`/form-config/${stage.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage,
        }),
      }).catch(() => {});
    }
  }, [stage]);

  if (loading) {
    return <Page title="Loading stage" sub="Retrieving the live FMS stage." />;
  }

  if (!f || !stage) {
    return (
      <Page title="Stage not found" sub="No matching live stage.">
        <NavLink to="/fms" className="btn ghost">
          Back
        </NavLink>
      </Page>
    );
  }

  return (
    <Page
      title={`${f.code} · ${stage.name} · Form`}
      sub="PC configuration. Add the existing Google Form URL and the assigned Workspace email, approve the link, then send it to the doer."
      action={
        <NavLink className="btn ghost" to={`/fms/${f.id}`}>
          ← FMS
        </NavLink>
      }
    >
      <FormEditor stage={stage} onChange={setStage} />
    </Page>
  );
}

/* =========================================================
   FMS DETAIL
   ========================================================= */

function AddStageForm({ fmsId, onAdded }: { fmsId: string; onAdded: () => void }) {
  const blank: Record<string, string> = { name: "", what: "", how: "", who: "", when: "", plannedHours: "", googleFormUrl: "", responseSheetUrl: "", doerEmail: "", pcEmail: "" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Record<string, string>>(blank);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r: any = await api(`/fms/${fmsId}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: v.name,
          what: v.what,
          how: v.how,
          who: v.who,
          when: v.when,
          plannedHours: v.plannedHours === "" ? null : Number(v.plannedHours),
          googleFormUrl: v.googleFormUrl,
          responseSheetUrl: v.responseSheetUrl,
          pcEmail: v.pcEmail,
          contact: { email: v.doerEmail, channels: ["email"], phone: "", name: "" },
        }),
      });
      setMsg(r.message || "Stage added.");
      setV(blank);
      setOpen(false);
      onAdded();
    } catch (e: any) {
      setMsg(e.message || "Could not add stage.");
    } finally {
      setBusy(false);
    }
  };
  if (!open) {
    return (
      <div className="actionBar">
        <button type="button" className="btn ghost" onClick={() => setOpen(true)}>＋ Add stage</button>
        {msg && <small>{msg}</small>}
      </div>
    );
  }
  return (
    <div className="card panel">
      <div className="panelHead">
        <div>
          <h3>Add stage</h3>
          <small>Saved as the last stage. It stays locked until the previous stage is DONE.</small>
        </div>
      </div>
      <div className="googleLinkGrid">
        <label className="fieldLabel"><span>Stage name</span><input className="input" value={v.name} onChange={set("name")} /></label>
        <label className="fieldLabel"><span>What</span><input className="input" value={v.what} onChange={set("what")} /></label>
        <label className="fieldLabel"><span>Who</span><input className="input" value={v.who} onChange={set("who")} /></label>
        <label className="fieldLabel"><span>How</span><input className="input" value={v.how} onChange={set("how")} /></label>
        <label className="fieldLabel"><span>When</span><input className="input" value={v.when} onChange={set("when")} /></label>
        <label className="fieldLabel"><span>Planned hours</span><input className="input" type="number" min="0" step="0.5" value={v.plannedHours} onChange={set("plannedHours")} /></label>
        <label className="fieldLabel"><span>Google Form URL</span><input className="input" type="url" value={v.googleFormUrl} onChange={set("googleFormUrl")} /></label>
        <label className="fieldLabel"><span>Response Sheet URL</span><input className="input" type="url" value={v.responseSheetUrl} onChange={set("responseSheetUrl")} /></label>
        <label className="fieldLabel"><span>Doer email</span><input className="input" type="email" value={v.doerEmail} onChange={set("doerEmail")} /></label>
        <label className="fieldLabel"><span>PC email</span><input className="input" type="email" value={v.pcEmail} onChange={set("pcEmail")} /></label>
      </div>
      <div className="actionBar">
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className="btn primary" disabled={busy || !v.name.trim()} onClick={save}>{busy ? "Saving…" : "Save stage"}</button>
      </div>
      {msg && <small>{msg}</small>}
    </div>
  );
}

function FmsDetail() {
  const { id } = useParams();

  const [f, setF] = useState<FMS | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    fetchFmsById(id || "")
      .then((x) => {
        if (alive) {
          setF(x);

          saveFms(
            loadFms()
              .map((old) => (old.id === x.id ? x : old))
              .concat(loadFms().some((old) => old.id === x.id) ? [] : [x]),
          );
        }
      })
      .catch(() => setF(loadFms().find((x) => x.id === id) || null))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return <Page title="Loading FMS" sub="Retrieving live FMS data." />;
  }

  if (!f) {
    return (
      <Page
        title="FMS not found"
        sub="This workspace contains no matching live FMS."
      >
        <NavLink to="/fms" className="btn ghost">
          Back
        </NavLink>
      </Page>
    );
  }

  return (
    <Page
      title={`${f.code} · ${f.name}`}
      sub={`${f.plant} · ${f.department} · live configuration`}
      action={
        <NavLink className="btn ghost" to="/fms">
          ← Catalog
        </NavLink>
      }
    >
      <div className="hero card">
        <div>
          <span className="eyebrow">LIVE FMS</span>

          <h2>{f.name}</h2>

          <p>{f.description || "No description"}</p>
        </div>

        <Status v="ACTIVE" />
      </div>

      <div className="metrics stageExecutionMetrics">
        {(() => {
          const doneCount = f.stages.filter((st) => String(st.status || "").toUpperCase() === "DONE").length;
          const readyCount = f.stages.filter((st) => ["READY", "WORKING", "IN_PROGRESS"].includes(String(st.status || "").toUpperCase())).length;
          const lockedCount = f.stages.filter((st) => String(st.status || "").toUpperCase() === "LOCKED").length;
          const now = Date.now();
          const delayedCount = f.stages.filter((st) => {
            const sla = Number(st.slaMinutes || 0);
            if (sla <= 0) return false;
            const elapsed = stageElapsedMinutes(st);
            return elapsed !== null && elapsed > sla;
          }).length;
          const pct = f.stages.length ? Math.round(doneCount / f.stages.length * 100) : 0;
          return <>
            <div className="metric"><span>STAGES COMPLETE</span><strong>{doneCount}/{f.stages.length}</strong><small>{pct}% overall progress</small></div>
            <div className="metric"><span>READY / ACTIVE</span><strong>{readyCount}</strong><small>Current stage work</small></div>
            <div className="metric"><span>LOCKED / PENDING</span><strong>{lockedCount}</strong><small>Waiting for PC gate</small></div>
            <div className="metric"><span>OVER SLA</span><strong>{delayedCount}</strong><small>Configured target exceeded only</small></div>
            <div className="metric"><span>FMS CREATED</span><strong>{f.createdAt ? new Date(f.createdAt).toLocaleDateString() : "—"}</strong><small>{displayDateTime(f.createdAt)}</small></div>
          </>;
        })()}
      </div>
      <div className="card panel fmsTimingSummary">
        <div><span className="eyebrow">TIMESTAMP GENERATED</span><b>Created: {displayDateTime(f.createdAt)}</b><small>Stage 01 start time is recorded when the FMS is created. Every next stage starts when PC approves the preceding stage.</small></div>
        <div className="fmsProgressTrack"><i style={{ width: `${f.stages.length ? Math.round(f.stages.filter(st => String(st.status || "").toUpperCase() === "DONE").length / f.stages.length * 100) : 0}%` }} /></div>
      </div>

      <FmsDashboard name={f.name} stages={f.stages} />

      <div className="card panel workflowPanel stageFlowPanel">
        <div className="panelHead"><div><h3>{f.stages.length}-stage workflow</h3><small>Stage 01 is READY when the workflow starts. Each next stage stays locked until PC marks the current stage DONE.</small></div><span className="flowLegend"><i className="legendReady" /> READY <i className="legendLocked" /> LOCKED</span></div>
        <div className="stageFlowGrid">
          {f.stages.map((st, i) => <React.Fragment key={st.id}>
            <div className={`stageFlowNode ${stageStatusClass(st, i)}`} style={{ animationDelay: `${Math.min(i * 45, 700)}ms` }}>
              <span className="stageFlowNo">{String(i + 1).padStart(2, "0")}</span>
              <b>{st.name}</b>
              <small>{String(st.status || (i === 0 ? "READY" : "LOCKED")).toUpperCase() === "DONE" ? "DONE · PC APPROVED" : String(st.status || (i === 0 ? "READY" : "LOCKED")).toUpperCase() === "READY" ? "READY TO START" : `${String(st.status || "LOCKED").toUpperCase()} · PC GATE`}</small>
              <span className="flowNodeLink">{st.formStatus === "SUBMITTED" ? "✓ Doer submitted · PC review pending" : st.formStatus === "SENT" ? "✉ Form emailed to doer" : st.googleFormUrl ? "Google Form linked" : "Form link pending"}</span>
              <NavLink to={`/fms/${f.id}/stage/${st.id}/edit`}>Configure ↗</NavLink>
            </div>
            {i < f.stages.length - 1 && <div className="stageFlowConnector" aria-hidden="true"><span>↓</span></div>}
          </React.Fragment>)}
        </div>
      </div>

      <div className="card panel">
        <div className="panelHead">
          <div>
            <h3>Stage map</h3>

            <small>
              Stage 1 is the initial READY stage. Later stages unlock only after
              predecessor completion.
            </small>
          </div>
        </div>

        <div className="stageList">
          {f.stages.map((s, i) => (
            <div className="stageRow" key={s.id}>
              <div className={"stageNo " + (String(s.status || (i === 0 ? "READY" : "LOCKED")).toLowerCase() === "done" ? "complete" : String(s.status || (i === 0 ? "READY" : "LOCKED")).toLowerCase() === "ready" ? "working" : "locked")}>
                {String(i + 1).padStart(2, "0")}
              </div>

              <div className="stageMain">
                <div>
                  <b>{s.name}</b>

                  <Status v={s.status || (i === 0 ? "READY" : "LOCKED")} />
                </div>

                <p>{s.what || "No WHAT definition yet."}</p>

                <div className="stageMeta">
                  <span>
                    <b>WHO</b>
                    {s.who || "Not assigned"}
                  </span>

                  <span>
                    <b>WHEN</b>
                    {s.when || "Not configured"}{s.plannedHours ? ` · ${s.plannedHours} h window` : ""}
                  </span>

                  <span>
                    <b>FORM</b>
                    {s.formStatus === "SUBMITTED" ? "Submitted by doer" : s.approved ? "Sent to doer" : "Needs PC approval"}
                  </span>
                  <span><b>FORM SENT</b>{displayDateTime(s.formSentAt)}</span>
                  <span><b>PLANNED</b>{displayDateTime(s.plannedAt)}</span>
                  <span><b>ACTUAL</b>{displayDateTime(s.actualCompletedAt)}</span>
                  <span className={`delayBadge ${stageDelayTone(s)}`}><b>TIME DELAY</b>{s.delayMinutes !== null && s.delayMinutes !== undefined ? (s.delayMinutes < 0 ? `Early by ${displayDuration(-s.delayMinutes)}` : `${displayDuration(s.delayMinutes)} late`) : "Pending PC DONE"}</span>
                </div>
              </div>

              <NavLink
                className="btn ghost"
                to={`/fms/${f.id}/stage/${s.id}/edit`}
              >
                Configure form
              </NavLink>

              <NavLink className="btn ghost" to={`/fms/${f.id}/stage/${s.id}`}>
                Open stage →
              </NavLink>
            </div>
          ))}
        </div>
      </div>
      <AddStageForm fmsId={f.id} onAdded={() => fetchFmsById(f.id).then(setF)} />
    </Page>
  );
}

/* =========================================================
   STAGE LIVE
   ========================================================= */

function StageLive() {
  const { id, stageId } = useParams();
  const currentUser = useCurrentUser();
  const canDecide = Boolean(currentUser?.role === "ADMIN" || currentUser?.permissions?.includes("PC_DECISION"));
  const [f, setF] = useState<FMS | null>(null);
  const [s, setS] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [pcFeedback, setPcFeedback] = useState("");

  const refresh = async () => {
    const x = await fetchFmsById(id || "");
    setF(x);
    setS(x.stages.find((st: Stage) => st.id === stageId) || null);
  };

  useEffect(() => {
    let alive = true;
    fetchFmsById(id || "").then((x) => {
      if (!alive) return;
      setF(x);
      setS(x.stages.find((st: Stage) => st.id === stageId) || null);
    }).catch(() => {
      const local = loadFms().find((x) => x.id === id) || null;
      setF(local);
      setS(local?.stages.find((st) => st.id === stageId) || null);
    }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id, stageId]);

  const decide = async (action: "DONE" | "RETURN_TO_DOER") => {
    if (!f || !s) return;
    if (action === "DONE" && !window.confirm("Confirm you reviewed the Google Sheets response and approve this stage? The next stage will unlock.")) return;
    if (action === "RETURN_TO_DOER" && !pcFeedback.trim()) { setNotice("Enter feedback explaining what the doer must correct before returning the form."); return; }
    setBusy(true); setNotice("");
    try {
      const result = await api(`/fms/${encodeURIComponent(f.id)}/stages/${encodeURIComponent(s.id)}/decision`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, feedback: pcFeedback.trim() }),
      });
      setNotice(result.message || "PC decision recorded.");
      if (action === "RETURN_TO_DOER") setPcFeedback("");
      await refresh();
    } catch (e: any) {
      setNotice(e.message || "Could not record the PC decision. Check permissions and PostgreSQL.");
    } finally { setBusy(false); }
  };

  if (loading) return <Page title="Loading stage" sub="Retrieving live stage data." />;
  if (!f || !s) return <Page title="Stage not found" sub="No matching live stage."><NavLink to="/fms" className="btn ghost">Back</NavLink></Page>;
  const status = String(s.status || "LOCKED").toUpperCase();
  const locked = status === "LOCKED";
  const done = status === "DONE";
  return <Page title={`${f.code} · ${s.name}`} sub="The doer submits through Google Forms. PC checks the linked response Sheet and records the decision here.">
    <div className="whatGrid stageFourMetrics stageLiveMetrics">
      <Info label="PLANNED" value={displayDateTime(s.startedAt || s.plannedAt)} />
      <Info label="ACTUAL" value={displayDateTime(s.actualCompletedAt)} />
      <Info label="STATUS" value={stageStatusLabel(s)} />
      <Info label="TIME DELAY" value={s.delayMinutes === null || s.delayMinutes === undefined ? "Pending PC DONE" : Number(s.delayMinutes) < 0 ? `Early by ${displayDuration(-Number(s.delayMinutes))}` : `${displayDuration(Number(s.delayMinutes))} late`} />
    </div>
    <div className="card panel stageProcessContext">
      <div className="panelHead"><div><h3>Stage process definition</h3><small>Operational instructions for this stage: what must happen, who owns it, how it is performed, and when it applies.</small></div></div>
      <div className="stageWhatWhoHowWhen">
        <section><span>WHAT</span><p>{s.what?.trim() || "Not defined yet"}</p></section>
        <section><span>WHO</span><p>{s.who?.trim() || s.contact?.name || s.contact?.email || "Responsible person not assigned"}</p></section>
        <section><span>HOW</span><p>{s.how?.trim() || "Not defined yet"}</p></section>
        <section><span>WHEN</span><p>{s.when?.trim() || "Not defined yet"}</p></section>
      </div>
      <div className="stageContextEdit"><NavLink className="btn ghost" to={`/fms/${f.id}/stage/${s.id}/edit`}>Configure Google Form link</NavLink></div>
    </div>
    <div className="card panel googleSheetPanel">
      <div className="panelHead"><div><h3>Google Form & response sheet</h3><small>Questions and submissions remain in Google Workspace; the FMS Engine does not duplicate form responses.</small></div></div>
      {s.googleFormUrl ? <div className="formLinkActions"><a className="btn primary" href={s.googleFormUrl} target="_blank" rel="noreferrer">↗ Open Google Form</a>{s.responseSheetUrl ? <a className="btn ghost" href={s.responseSheetUrl} target="_blank" rel="noreferrer">PC: Responses → View in Sheets</a> : <span className="btn ghost" style={{ opacity: 0.6, cursor: "default" }}>Response sheet link not set</span>}</div> : <Empty title="Google Form URL not configured" text="Add the existing Google Form URL and responsible Workspace email before dispatch." action={<NavLink className="btn primary" to={`/fms/${f.id}/stage/${s.id}/edit`}>Configure stage link</NavLink>} />}
      {s.formStatus === "SUBMITTED" && <div className="successBox"><b>✓ Doer submitted the Google Form</b><p>Submitted {displayDateTime(s.formSubmittedAt || "")}. Check the linked Sheet, then mark DONE.</p></div>}
      <div className="googleResponseNote"><div className="responseIcon">✓</div><div><b>PC review checklist</b><p>Open the linked response Sheet, verify the submitted row and evidence, then return here. A form submission does not automatically complete the stage.</p></div></div>
      {notice && <div className="editorNotice">{notice}</div>}
      {s.pcFeedback && <div className="correctionFeedback"><b>PC feedback for doer</b><p>{s.pcFeedback}</p></div>}
      {locked ? <div className="warning">This stage is locked. PC must approve the previous stage first.</div> : done ? <div className="successBox"><b>✓ Stage completed</b><p>PC approval timestamp is saved. The next stage is unlocked if one remains.</p></div> : canDecide ? <div className="pcDecisionBar"><b>PC review decision</b><p>Choose DONE only after checking the Google Sheets response. If the response is incorrect or incomplete, return it to the doer with clear feedback.</p><label className="fieldLabel correctionLabel">Feedback for doer (required when returning)<textarea className="fieldInput correctionTextarea" value={pcFeedback} onChange={(e) => setPcFeedback(e.target.value)} placeholder="Explain what is incorrect and what the doer must submit again…" rows={3} /></label><div className="actionBar"><button className="btn ghost returnDoerBtn" disabled={busy || !s.googleFormUrl} onClick={() => decide("RETURN_TO_DOER")}>↩ Return to doer · resubmit</button><button className="btn createBtn" disabled={busy || !s.googleFormUrl} onClick={() => decide("DONE")}>{busy ? "Saving…" : "✓ DONE & unlock next"}</button></div></div> : <div className="warning">PC decision controls are restricted to accounts with the PC_DECISION permission. You can still open the Google Form to review its responses.</div>}
      <div className="actionBar reviewActions"><NavLink className="btn ghost" to={`/fms/${f.id}/stage/${s.id}/edit`}>Configure Google Form link</NavLink><NavLink className="btn ghost" to={`/fms/${f.id}`}>← Return to workflow</NavLink></div>
    </div>
  </Page>;
}

/* =========================================================
   INFO
   ========================================================= */

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="card info">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

/* =========================================================
   FIELD
   ========================================================= */

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  disabled,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <label className="fieldLabel">
      <span>
        {label}
        {required && <em>Required</em>}
      </span>

      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
  );
}

/* =========================================================
   AUDIT
   ========================================================= */

function Audit() {
  return (
    <Page
      title="Audit Trail"
      sub="Live workspace audit records will appear here as the engine records actions."
    >
      <Empty
        title="No audit records yet"
        text="No sample audit history is loaded."
      />
    </Page>
  );
}

/* =========================================================
   USERS & ACCESS
   ========================================================= */

function UsersAccess() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api("/access/users").then((r) => setRows(r || [])).catch((e) => setError(e.message || "Could not load users")).finally(() => setLoading(false));
  }, []);
  return (
    <PermissionGate permission="USER_VIEW">
      <Page title="Users & Access" sub="Google Workspace proves identity; FMS roles and permissions determine authorization. Unknown or inactive accounts are denied FMS access.">
        {loading && <div className="card panel">Loading authorized users…</div>}
        {error && <div className="card panel error">{error}</div>}
        {!loading && !error && <div className="card panel accessTableWrap">
          <div className="panelHead"><div><h3>Authorized Workspace Users</h3><small>Initial authorization list configured for this FMS Engine.</small></div></div>
          <div className="accessTable">
            <div className="accessRow accessHead"><b>User</b><b>Email</b><b>Role</b><b>Status</b><b>Scope</b></div>
            {rows.map((u) => <div className="accessRow" key={u.id}>
              <div><b>{u.name}</b><small>{u.employee_code} · {u.job_title || ""}</small></div>
              <span>{u.email}</span>
              <span className="status ready">{u.role}</span>
              <span className={"status " + (u.active ? "done" : "blocked")}>{u.active ? "ACTIVE" : "INACTIVE"}</span>
              <small>{u.scope_all_plants ? "All plants" : "Scoped plant"} · {u.scope_all_departments ? "All departments" : "Scoped department"}</small>
            </div>)}
          </div>
        </div>}
        <div className="card panel accessModel">
          <h3>Authorization model</h3>
          <ul>
            <li><b>MD</b> — highest management visibility and authorized control.</li>
            <li><b>MDO</b> — FMS/system administration, configuration, users, workflow setup and reporting.</li>
            <li><b>EA</b> — monitoring, reporting and HR-oriented visibility; no workflow approval by default.</li>
            <li><b>PC</b> — operational workflow controller: review submissions and control DONE/CORRECTION/HOLD/EXCEPTION.</li>
            <li><b>Responsible Person</b> — assigned-stage execution and form/evidence submission only.</li>
          </ul>
        </div>
      </Page>
    </PermissionGate>
  );
}

/* =========================================================
   APP
   ========================================================= */

function App() {
  return (
    <Routes>
      <Route
        path="*"
        element={
          <AuthGate>
            <Layout>
              <Routes>
                <Route path="/" element={<ControlTower />} />

                <Route path="/fms" element={<FmsCatalog />} />

                <Route path="/builder" element={<PermissionGate permission="FMS_CREATE"><Builder /></PermissionGate>} />

                <Route path="/fms/:id" element={<FmsDetail />} />

                <Route
                  path="/fms/:id/stage/:stageId/edit"
                  element={<FmsStageEdit />}
                />

                <Route path="/fms/:id/stage/:stageId" element={<StageLive />} />

                <Route path="/audit" element={<Audit />} />

                <Route path="/users" element={<UsersAccess />} />
              </Routes>
            </Layout>
          </AuthGate>
        }
      />
    </Routes>
  );
}

/* =========================================================
   REACT ENTRY
   ========================================================= */

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
