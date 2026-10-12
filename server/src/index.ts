import path from "path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";
import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";
import crypto from "node:crypto";

dotenv.config();
const { Pool } = pg;
const app = express();
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5174",
    credentials: true,
  }),
);
app.use(express.json({ limit: "15mb" }));
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const SESSION_SECRET =
  process.env.SESSION_SECRET || "change-this-session-secret";
const ALLOWED_DOMAIN = (
  process.env.ALLOWED_GOOGLE_DOMAIN || "dinerofoodworks.com"
).toLowerCase();
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
function b64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function signSession(payload: string) {
  return b64url(
    crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest(),
  );
}
function makeSession(user: any) {
  const payload = b64url(
    JSON.stringify({
      sub: user.sub,
      userId: user.userId,
      email: user.email,
      name: user.name || "",
      hd: user.hd || "",
      role: user.role || "",
      permissions: user.permissions || [],
      jobTitle: user.jobTitle || "",
      iat: Date.now(),
    }),
  );
  return `${payload}.${signSession(payload)}`;
}
function readCookie(req: express.Request, name: string) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
function verifySession(req: express.Request) {
  const raw = readCookie(req, "fms_session");
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = signSession(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      user.hd !== ALLOWED_DOMAIN ||
      !String(user.email || "")
        .toLowerCase()
        .endsWith("@" + ALLOWED_DOMAIN)
    )
      return null;
    return user;
  } catch {
    return null;
  }
}

async function getAuthorizedUser(email: string) {
  if (!pool) return null;
  const rows = await db<any>(
    `select u.id,u.employee_code,u.name,u.email,u.role_code,u.job_title,u.active,
   coalesce(json_agg(distinct p.code) filter (where p.code is not null),'[]') permissions
   from users u
   left join roles r on r.code=coalesce(u.role_code,upper(u.role))
   left join role_permissions rp on rp.role_id=r.id
   left join permissions p on p.id=rp.permission_id
   where lower(u.email)=lower($1) and u.active=true
   group by u.id`,
    [email],
  );
  if (!rows[0]) return null;
  return rows[0];
}

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (req.path.startsWith("/form-config/public/")) return next();
  if (req.path === "/form-submission") return next();
  const user = verifySession(req);
  if (!user) return res.status(401).json({ error: "Authentication required." });
  (req as any).user = user;
  next();
}
function requirePermission(permission: string) {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const user = (req as any).user;
    if (!user)
      return res.status(401).json({ error: "Authentication required." });
    if (
      user.role === "ADMIN" ||
      (Array.isArray(user.permissions) && user.permissions.includes(permission))
    )
      return next();
    return res.status(403).json({
      error: `Permission denied. Required permission: ${permission}.`,
    });
  };
}

async function db<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (!pool) return [];
  const r = await pool.query(sql, params);
  return r.rows as T[];
}

const FORM_URL_RE = /^https?:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/i;
const DOER_EMAIL_RE = /^[^\s@]+@dinerofoodworks\.com$/i;
function validDoerLink(url?: string, email?: string) {
  return (
    FORM_URL_RE.test(String(url || "").trim()) &&
    DOER_EMAIL_RE.test(String(email || "").trim())
  );
}
const htmlEsc = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
// Emails the Google Form link to the doer and records form_status=SENT on the stage.
async function sendPcNotice(pcEmail: string, subject: string, text: string) {
  const to = String(pcEmail || "")
    .trim()
    .toLowerCase();
  if (!to) return { sent: false };
  try {
    const t = await smtpTransport();
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return { sent: true };
  } catch (e: any) {
    return { sent: false, message: e.message || "SMTP error" };
  }
}
async function sendStageFormEmail(a: {
  fmsId?: string;
  stepNo: number;
  stageName: string;
  fmsCode: string;
  formUrl: string;
  email: string;
  pcEmail?: string;
}) {
  const to = String(a.email).trim().toLowerCase();
  const formUrl = String(a.formUrl).trim();
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  )
    return {
      sent: false,
      to,
      message:
        "Stage 01 saved, but email is not configured on the server (set SMTP_* in server/.env). Open the stage and use Send now after SMTP is set.",
    };
  try {
    const transporter = await smtpTransport();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `FMS stage form: ${a.stageName} (${a.fmsCode})`,
      text: `You have been assigned an FMS stage.\n\nStage: ${a.stageName}\nFMS: ${a.fmsCode}\nOpen the Google Form: ${formUrl}\n\nAfter submitting, PC reviews the response in the Google Form's linked response Sheet. Submission alone does not complete the stage.`,
      html: `<div style="font-family:Arial,sans-serif;color:#231F20;max-width:620px;margin:auto;padding:24px;background:#FFF0EE;border-radius:16px"><div style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#FE5E41">DINERO FOODWORKS · FMS ENGINE</div><h2 style="margin:12px 0">Stage form assigned</h2><p>You have been assigned an FMS stage.</p><p><b>Stage:</b> ${htmlEsc(a.stageName)}<br/><b>FMS:</b> ${htmlEsc(a.fmsCode)}</p><p><a href="${htmlEsc(formUrl)}" style="display:inline-block;background:#FE5E41;color:#231F20;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">Open Google Form ↗</a></p><p>After submitting, PC reviews the response in the Google Form's linked Google Sheet. Submission alone does not complete the stage.</p></div>`,
    });
    if (a.pcEmail)
      await sendPcNotice(
        a.pcEmail,
        `Form sent to doer: ${a.stageName} (${a.fmsCode})`,
        `The Google Form for ${a.stageName} (${a.fmsCode}) was emailed to ${a.email}.`,
      );
    if (pool && a.fmsId)
      await db(
        `update workflow_steps set form_status='SENT',form_sent_at=now() where fms_id=$1 and step_no=$2`,
        [a.fmsId, a.stepNo],
      );
    if (pool && a.fmsId)
      await db(
        `update form_versions set status='APPROVED',approved_at=now() where step_id in (select id from workflow_steps where fms_id=$1 and step_no=$2) and status<>'APPROVED'`,
        [a.fmsId, a.stepNo],
      );
    return {
      sent: true,
      to,
      message: `Stage 01 saved and the Google Form was emailed to ${to}.`,
    };
  } catch (e: any) {
    return {
      sent: false,
      to,
      message: `Stage 01 saved, but the email failed: ${e?.message || "SMTP error"}`,
    };
  }
}

app.get("/api/health", async (_req, res) => {
  let database = "browser-live";
  if (pool) {
    try {
      await pool.query("select 1");
      database = "postgresql";
    } catch {
      database = "postgresql-unavailable";
    }
  }
  res.json({ ok: true, database });
});
app.get("/api/auth/me", async (req, res) => {
  const user = verifySession(req);
  if (!user) return res.status(401).json({ user: null });
  if (pool) {
    const current = await getAuthorizedUser(user.email);
    if (!current)
      return res.status(403).json({
        user: null,
        error:
          "This Google Workspace account is not authorized in the FMS Engine.",
      });
    return res.json({
      user: {
        id: current.id,
        employeeCode: current.employee_code,
        email: current.email,
        name: current.name,
        domain: user.hd,
        role: current.role_code,
        jobTitle: current.job_title,
        permissions: current.permissions,
      },
    });
  }
  res.json({
    user: {
      email: user.email,
      name: user.name,
      domain: user.hd,
      role: user.role,
      permissions: user.permissions || [],
    },
  });
});
app.post("/api/auth/google", async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID)
      return res.status(503).json({
        error: "Google authentication is not configured on the server.",
      });
    if (!pool)
      return res.status(503).json({
        error:
          "PostgreSQL authorization is required before Google Workspace users can sign in. Run the v15 access-control migration and seed first.",
      });
    const credential = String(req.body?.credential || "");
    if (!credential)
      return res.status(400).json({ error: "Google credential is required." });
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    const email = String(p?.email || "").toLowerCase();
    const hd = String(p?.hd || "").toLowerCase();
    if (
      !p?.email_verified ||
      hd !== ALLOWED_DOMAIN ||
      !email.endsWith("@" + ALLOWED_DOMAIN)
    )
      return res.status(403).json({
        error: `Only verified Google Workspace accounts in @${ALLOWED_DOMAIN} are allowed.`,
      });
    const account = await getAuthorizedUser(email);
    if (!account)
      return res.status(403).json({
        error: `Google account ${email} is authenticated, but it is not authorized in the FMS Engine. Ask an MDO/authorized administrator to add or activate the user.`,
      });
    const user = {
      sub: String(p?.sub || ""),
      userId: String(account.id),
      email,
      name: String(account.name || p?.name || email),
      hd,
      role: String(account.role_code || ""),
      permissions: Array.isArray(account.permissions)
        ? account.permissions
        : [],
      jobTitle: String(account.job_title || ""),
    };
    const session = makeSession(user);
    res.setHeader(
      "Set-Cookie",
      `fms_session=${encodeURIComponent(session)}; HttpOnly; Path=/; SameSite=Lax${process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}; Max-Age=28800`,
    );
    res.json({
      ok: true,
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        domain: user.hd,
        role: user.role,
        jobTitle: user.jobTitle,
        permissions: user.permissions,
      },
    });
  } catch (e: any) {
    res.status(401).json({
      error:
        e.message ||
        "Google sign-in could not be verified. Please use your Dinero FoodWorks Google Workspace account.",
    });
  }
});
app.post("/api/auth/logout", (_req, res) => {
  res.setHeader(
    "Set-Cookie",
    "fms_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
  );
  res.json({ ok: true });
});

app.use("/api", requireAuth);

app.get("/api/access/me", async (req, res) => {
  const user = (req as any).user;
  res.json({
    user: {
      id: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      jobTitle: user.jobTitle,
      permissions: user.permissions || [],
    },
  });
});
app.get(
  "/api/access/users",
  requirePermission("USER_VIEW"),
  async (_req, res) => {
    if (!pool)
      return res.status(503).json({ error: "PostgreSQL is required." });
    try {
      const rows = await db(
        `select u.id,u.employee_code,u.name,u.email,u.role_code role,u.job_title,u.active,u.scope_all_plants,u.scope_all_departments,coalesce(json_agg(distinct p.name) filter(where p.name is not null),'[]') permission_names from users u left join roles r on r.code=coalesce(u.role_code,upper(u.role)) left join role_permissions rp on rp.role_id=r.id left join permissions p on p.id=rp.permission_id group by u.id order by u.name`,
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Could not load users" });
    }
  },
);
app.post(
  "/api/access/users",
  requirePermission("USER_MANAGE"),
  async (req, res) => {
    if (!pool)
      return res.status(503).json({ error: "PostgreSQL is required." });
    const b = req.body || {};
    const email = String(b.email || "")
      .trim()
      .toLowerCase();
    const role = String(b.role || "")
      .trim()
      .toUpperCase();
    if (!email.endsWith("@" + ALLOWED_DOMAIN))
      return res
        .status(400)
        .json({ error: `User email must belong to @${ALLOWED_DOMAIN}.` });
    if (!email || !b.name || !role)
      return res
        .status(400)
        .json({ error: "Name, Workspace email and role are required." });
    try {
      const rr = await db<any>("select code from roles where code=$1 limit 1", [
        role,
      ]);
      if (!rr[0])
        return res.status(400).json({ error: `Unknown role ${role}.` });
      const rows = await db<any>(
        `insert into users(employee_code,name,email,role,role_code,job_title,active,scope_all_plants,scope_all_departments) values($1,$2,$3,$4,$4,$5,$6,$7,$8) returning id,employee_code,name,email,role_code,job_title,active,scope_all_plants,scope_all_departments`,
        [
          String(b.employeeCode || `USER-${Date.now()}`),
          String(b.name),
          email,
          role,
          String(b.jobTitle || role),
          b.active !== false,
          b.scopeAllPlants !== false,
          b.scopeAllDepartments !== false,
        ],
      );
      await db(
        "insert into audit_logs(entity_type,action,entity_id,actor_user_id,new_state) values($1,$2,$3,$4,$5)",
        [
          "USER",
          "CREATED",
          rows[0].id,
          (req as any).user.userId,
          JSON.stringify(rows[0]),
        ],
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e?.code === "23505")
        return res
          .status(409)
          .json({ error: `User ${email} or employee code already exists.` });
      res.status(500).json({ error: e.message || "Could not create user" });
    }
  },
);

app.patch(
  "/api/access/users/:id",
  requirePermission("USER_MANAGE"),
  async (req, res) => {
    if (!pool)
      return res.status(503).json({ error: "PostgreSQL is required." });
    const b = req.body || {};
    const fields: string[] = [];
    const values: any[] = [];
    const add = (sql: string, v: any) => {
      values.push(v);
      fields.push(sql.replace("?", `$${values.length}`));
    };
    if (b.name !== undefined) add("name=?", String(b.name));
    if (b.role !== undefined) {
      const role = String(b.role).toUpperCase();
      const rr = await db<any>("select code from roles where code=$1 limit 1", [
        role,
      ]);
      if (!rr[0])
        return res.status(400).json({ error: `Unknown role ${role}.` });
      add("role=?", role);
      add("role_code=?", role);
    }
    if (b.jobTitle !== undefined) add("job_title=?", String(b.jobTitle));
    if (b.active !== undefined) add("active=?", Boolean(b.active));
    if (b.scopeAllPlants !== undefined)
      add("scope_all_plants=?", Boolean(b.scopeAllPlants));
    if (b.scopeAllDepartments !== undefined)
      add("scope_all_departments=?", Boolean(b.scopeAllDepartments));
    if (!fields.length)
      return res.status(400).json({ error: "No supported fields supplied." });
    try {
      const rows = await db<any>(
        `update users set ${fields.join(", ")} where id=$${values.length + 1} returning id,employee_code,name,email,role_code,job_title,active,scope_all_plants,scope_all_departments`,
        [...values, req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: "User not found." });
      await db(
        "insert into audit_logs(entity_type,action,entity_id,actor_user_id,new_state) values($1,$2,$3,$4,$5)",
        [
          "USER",
          "UPDATED",
          rows[0].id,
          (req as any).user.userId,
          JSON.stringify(rows[0]),
        ],
      );
      res.json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Could not update user" });
    }
  },
);

app.get("/api/dashboard", async (_req, res) => {
  if (!pool)
    return res.json({
      hasLiveData: false,
      totalFms: 0,
      runningFms: 0,
      completedFms: 0,
      delayedStages: 0,
      exceptions: 0,
      totalStages: 0,
      doneStages: 0,
      workingStages: 0,
      lockedStages: 0,
      kpis: {},
      statusCounts: {},
      fms: [],
    });
  try {
    const fmsRows = await db<any>(
      `select f.id,f.code,f.name,f.workflow_mode,p.name plant,d.name department from fms f join plants p on p.id=f.plant_id left join departments d on d.id=f.department_id order by f.created_at desc`,
    );
    const stageRows = await db<any>(
      `select ws.fms_id,ws.step_no,ws.name,ws.execution_status,ws.form_status,ws.planned_at,ws.actual_completed_at,ws.delay_minutes,ws.planned_tat_minutes,ws.actual_tat_minutes,ws.pc_email from workflow_steps ws order by ws.fms_id,ws.step_no`,
    );
    const now = Date.now();
    const byFms = new Map<string, any>();
    for (const f of fmsRows)
      byFms.set(String(f.id), {
        id: String(f.id),
        code: f.code,
        name: f.name,
        plant: f.plant || "",
        department: f.department || "",
        workflowMode: f.workflow_mode || "",
        stages: [],
      });
    for (const s of stageRows) {
      const f = byFms.get(String(s.fms_id));
      if (!f) continue;
      const status = String(s.execution_status || "LOCKED").toUpperCase();
      const planned = s.planned_at ? new Date(s.planned_at).getTime() : null;
      const tat =
        s.planned_tat_minutes == null ? null : Number(s.planned_tat_minutes);
      const overdue =
        status !== "DONE" &&
        planned != null &&
        tat != null &&
        now > planned + tat * 60000;
      f.stages.push({
        stepNo: Number(s.step_no),
        name: s.name,
        status,
        formStatus: s.form_status || "NOT_SENT",
        plannedAt: s.planned_at ? new Date(s.planned_at).toISOString() : null,
        actualCompletedAt: s.actual_completed_at
          ? new Date(s.actual_completed_at).toISOString()
          : null,
        delayMinutes: s.delay_minutes == null ? null : Number(s.delay_minutes),
        plannedTatMinutes: tat,
        actualTatMinutes:
          s.actual_tat_minutes == null ? null : Number(s.actual_tat_minutes),
        pcEmail: s.pc_email || "",
        overdue,
      });
    }
    const fms = [...byFms.values()].map((f: any) => {
      const st = f.stages;
      const total = st.length;
      const done = st.filter((x: any) => x.status === "DONE").length;
      const ready = st.filter((x: any) =>
        ["READY", "WORKING", "IN_PROGRESS", "CORRECTION"].includes(x.status),
      ).length;
      const locked = st.filter((x: any) => x.status === "LOCKED").length;
      const withDelay = st.filter(
        (x: any) => x.status === "DONE" && x.delayMinutes != null,
      );
      const lateDone = withDelay.filter((x: any) => x.delayMinutes > 0).length;
      const earlyDone = withDelay.filter(
        (x: any) => x.delayMinutes <= 0,
      ).length;
      const avgDelayMinutes = withDelay.length
        ? Math.round(
            withDelay.reduce((a: number, x: any) => a + x.delayMinutes, 0) /
              withDelay.length,
          )
        : null;
      const pcPending = st.filter(
        (x: any) => x.status !== "DONE" && x.formStatus === "SUBMITTED",
      ).length;
      const overdue = st.filter(
        (x: any) => x.overdue || (x.status === "DONE" && x.delayMinutes > 0),
      ).length;
      return {
        id: f.id,
        code: f.code,
        name: f.name,
        plant: f.plant,
        department: f.department,
        workflowMode: f.workflowMode,
        total,
        done,
        ready,
        locked,
        progressPct: total ? Math.round((done / total) * 100) : 0,
        pcPending,
        lateDone,
        earlyDone,
        overdue,
        avgDelayMinutes,
        stages: st,
      };
    });
    const allStages = fms.flatMap((f: any) => f.stages);
    const doneStages = allStages.filter((x: any) => x.status === "DONE");
    const withDelay = doneStages.filter((x: any) => x.delayMinutes != null);
    const statusCounts: Record<string, number> = {};
    for (const x of allStages)
      statusCounts[x.status] = (statusCounts[x.status] || 0) + 1;
    const overdueAll = allStages.filter(
      (x: any) => x.overdue || (x.status === "DONE" && x.delayMinutes > 0),
    ).length;
    const kpis = {
      progressPct: allStages.length
        ? Math.round((doneStages.length / allStages.length) * 100)
        : 0,
      onTimePct: withDelay.length
        ? Math.round(
            (withDelay.filter((x: any) => x.delayMinutes <= 0).length /
              withDelay.length) *
              100,
          )
        : null,
      avgDelayMinutes: withDelay.length
        ? Math.round(
            withDelay.reduce((a: number, x: any) => a + x.delayMinutes, 0) /
              withDelay.length,
          )
        : null,
      lateDone: withDelay.filter((x: any) => x.delayMinutes > 0).length,
      earlyDone: withDelay.filter((x: any) => x.delayMinutes <= 0).length,
      pcPending: allStages.filter(
        (x: any) => x.status !== "DONE" && x.formStatus === "SUBMITTED",
      ).length,
      formsSent: allStages.filter(
        (x: any) => x.formStatus === "SENT" || x.formStatus === "SUBMITTED",
      ).length,
      formsSubmitted: allStages.filter((x: any) => x.formStatus === "SUBMITTED")
        .length,
      overdue: overdueAll,
    };
    const totalFms = fms.length;
    res.json({
      hasLiveData: totalFms > 0,
      totalFms,
      runningFms: fms.filter((f: any) => f.total > 0 && f.done < f.total)
        .length,
      completedFms: fms.filter((f: any) => f.total > 0 && f.done === f.total)
        .length,
      delayedStages: overdueAll,
      exceptions: allStages.filter((x: any) => x.status === "EXCEPTION").length,
      totalStages: allStages.length,
      doneStages: doneStages.length,
      workingStages: allStages.filter((x: any) =>
        ["READY", "WORKING", "IN_PROGRESS", "CORRECTION"].includes(x.status),
      ).length,
      lockedStages: allStages.filter((x: any) => x.status === "LOCKED").length,
      kpis,
      statusCounts,
      fms,
    });
  } catch (e: any) {
    res
      .status(500)
      .json({ error: e.message || "Could not calculate dashboard." });
  }
});
app.get("/api/fms", async (_req, res) => {
  if (pool) {
    try {
      return res.json(
        await db(
          `select f.id,f.fms_number,f.code,f.name,p.name plant,d.name department,f.status,f.description,f.workflow_mode,f.source_document_name,f.created_at from fms f join plants p on p.id=f.plant_id left join departments d on d.id=f.department_id order by f.created_at desc`,
        ),
      );
    } catch {}
  }
  res.json([]);
});
app.get("/api/fms/:id", async (req, res) => {
  if (!pool)
    return res.status(404).json({
      error: "Database persistence is required for server FMS records.",
    });
  try {
    const frows = await db<any>(
      `select f.id,f.fms_number,f.code,f.name,p.name plant,d.name department,f.status,f.description,f.workflow_mode,f.source_document_name,f.created_at from fms f join plants p on p.id=f.plant_id left join departments d on d.id=f.department_id where f.id=$1 limit 1`,
      [req.params.id],
    );
    if (!frows[0]) return res.status(404).json({ error: "FMS not found" });
    const stages = await db<any>(
      `select ws.id,ws.step_no,ws.code,ws.name,ws.what_text what,ws.how_text how,ws.who_role who,ws.when_text when_text,ws.planned_at planned_at,ws.planned_tat_minutes,ws.google_form_url google_form_url,ws.response_sheet_url response_sheet_url,ws.pc_email pc_email,ws.form_status,ws.form_submitted_at,ws.execution_status,ws.started_at,ws.form_sent_at,ws.actual_completed_at,ws.actual_tat_minutes,ws.delay_minutes,ws.pc_review_status,ws.pc_feedback,coalesce(fv.version,0) form_version,coalesce(fv.status,'DRAFT') form_status_latest,fv.responsible_name,fv.responsible_email,fv.responsible_phone,fv.delivery_channels,coalesce(json_agg(json_build_object('key',fq.question_key,'name',fq.label,'type',fq.field_type,'required',fq.required,'system',fq.system_locked,'options',fq.options_json,'help',fq.help_text) order by fq.position) filter(where fq.id is not null),'[]') fields from workflow_steps ws left join lateral (select * from form_versions fvv where fvv.step_id=ws.id order by fvv.version desc limit 1) fv on true left join form_questions fq on fq.form_version_id=fv.id where ws.fms_id=$1 group by ws.id,fv.id,fv.version,fv.status,fv.responsible_name,fv.responsible_email,fv.responsible_phone,fv.delivery_channels order by ws.step_no`,
      [req.params.id],
    );
    res.json({
      ...frows[0],
      stages: stages.map((s: any) => ({
        id: String(s.id),
        name: s.name,
        what: s.what || "",
        how: s.how || "",
        who: s.who || "",
        when: s.when_text || "",
        plannedAt: s.planned_at ? new Date(s.planned_at).toISOString() : "",
        planned_tat_minutes: s.planned_tat_minutes,
        googleFormUrl: s.google_form_url || "",
        responseSheetUrl: s.response_sheet_url || "",
        pcEmail: s.pc_email || "",
        fields: Array.isArray(s.fields) ? s.fields : [],
        approved: s.form_status_latest === "APPROVED",
        formVersion: Number(s.form_version || 0),
        contact: {
          name: s.responsible_name || "",
          email: s.responsible_email || "",
          phone: s.responsible_phone || "",
          channels: s.delivery_channels || ["email"],
        },
        status: s.execution_status || (s.step_no === 1 ? "READY" : "LOCKED"),
        started_at: s.started_at,
        form_sent_at: s.form_sent_at,
        formStatus: s.form_status || "NOT_SENT",
        formSubmittedAt: s.form_submitted_at || "",
        actual_completed_at: s.actual_completed_at,
        actual_tat_minutes: s.actual_tat_minutes,
        delay_minutes: s.delay_minutes,
        pc_review_status: s.pc_review_status,
        pc_feedback: s.pc_feedback || "",
      })),
      createdAt: frows[0].created_at,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Could not load FMS" });
  }
});

app.post(
  "/api/fms/create",
  requirePermission("FMS_CREATE"),
  async (req, res) => {
    const s1chk = (req.body?.stages || [])[0] || {};
    if (
      (s1chk.googleFormUrl || s1chk.contact?.email) &&
      !validDoerLink(s1chk.googleFormUrl, s1chk.contact?.email)
    )
      return res.status(400).json({
        error:
          "Stage 01: enter a valid Google Form URL and a @dinerofoodworks.com doer email, or leave both empty.",
      });
    const body = req.body || {};
    const code = String(body.code || "")
      .trim()
      .toUpperCase();
    const allowedPlants = [
      "Indore - DFPL - Tata",
      "Indore - DFPL - Saffola",
      "Indore - DFPL - Dinero1",
      "Indore - DFPL - Dinero2",
      "Nawanshahr - CIPL",
      "Nawanshahr - DFPL",
    ];
    const allowedDepartments = [
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
    if (!code || !body.name || !body.plant || !body.department)
      return res
        .status(400)
        .json({ error: "FMS code, name, plant and department are required." });
    if (!Array.isArray(body.stages) || body.stages.length < 1)
      return res
        .status(400)
        .json({ error: "An FMS must contain at least one stage." });
    if (!allowedPlants.includes(String(body.plant)))
      return res
        .status(400)
        .json({ error: "Select a valid plant from the approved plant list." });
    if (!allowedDepartments.includes(String(body.department)))
      return res.status(400).json({
        error: "Select a valid department from the approved department list.",
      });
    if (!pool) {
      const s1 = (body.stages || [])[0];
      const stage1Email =
        s1 && (s1.googleFormUrl || s1.contact?.email)
          ? await sendStageFormEmail({
              stepNo: 1,
              stageName: s1.name,
              fmsCode: code,
              formUrl: s1.googleFormUrl,
              email: s1.contact?.email,
              pcEmail: s1.pcEmail,
            })
          : { sent: false, message: "No Stage 01 Google Form entered." };
      return res.json({
        ok: true,
        mode: "browser-live",
        message: "FMS stored in the live browser workspace.",
        stage1Email,
      });
    }
    const duplicate = (
      await db<any>(
        "select code from fms where upper(code)=upper($1) limit 1",
        [code],
      )
    )[0];
    if (duplicate)
      return res.status(409).json({
        error: `FMS Code ${code} is already available. Choose another Code.`,
      });
    const c = await pool.connect();
    try {
      await c.query("begin");
      let company = (
        await c.query("select id from companies order by created_at limit 1")
      ).rows[0];
      if (!company)
        company = (
          await c.query(
            "insert into companies(code,name) values('LIVE','Live Workspace') returning id",
          )
        ).rows[0];
      let plant = (
        await c.query(
          "select id from plants where company_id=$1 and lower(name)=lower($2) limit 1",
          [company.id, body.plant],
        )
      ).rows[0];
      if (!plant)
        plant = (
          await c.query(
            "insert into plants(company_id,code,name) values($1,$2,$3) returning id",
            [
              company.id,
              String(body.plant)
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, "_")
                .slice(0, 30),
              body.plant,
            ],
          )
        ).rows[0];
      let dept = (
        await c.query(
          "select id from departments where plant_id=$1 and lower(name)=lower($2) limit 1",
          [plant.id, body.department],
        )
      ).rows[0];
      if (!dept)
        dept = (
          await c.query(
            "insert into departments(plant_id,code,name) values($1,$2,$3) returning id",
            [
              plant.id,
              String(body.department)
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, "_")
                .slice(0, 30),
              body.department,
            ],
          )
        ).rows[0];
      const f = (
        await c.query(
          "insert into fms(code,name,plant_id,department_id,description,status,workflow_mode,source_document_name) values($1,$2,$3,$4,$5,'ACTIVE',$6,$7) returning id,fms_number,code,created_at",
          [
            code,
            body.name,
            plant.id,
            dept.id,
            body.description || null,
            body.workflowMode === "PDF_TEMPLATE"
              ? "PDF_TEMPLATE"
              : body.workflowMode === "ZIP_TEMPLATE"
                ? "ZIP_TEMPLATE"
                : "MANUAL",
            body.sourceDocumentName || null,
          ],
        )
      ).rows[0];
      for (let i = 0; i < (body.stages || []).length; i++) {
        const st = body.stages[i];
        const stageStart = i === 0 ? new Date(f.created_at) : null;
        const step = (
          await c.query(
            `insert into workflow_steps(fms_id,step_no,code,name,what_text,how_text,who_role,when_text,planned_at,started_at,google_form_url,form_status,execution_status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'NOT_SENT',$12) returning id`,
            [
              f.id,
              i + 1,
              `${code}-S${String(i + 1).padStart(2, "0")}`,
              st.name,
              st.what || null,
              st.how || null,
              st.who || null,
              st.when || null,
              stageStart,
              stageStart,
              st.googleFormUrl || null,
              i === 0 ? "READY" : "LOCKED",
            ],
          )
        ).rows[0];
        const hrs = Number(st.plannedHours);
        const tatMin =
          Number.isFinite(hrs) && hrs > 0 ? Math.round(hrs * 60) : null;
        await c.query(
          "update workflow_steps set planned_tat_minutes=$1 where id=$2",
          [tatMin, step.id],
        );
        await c.query(
          "update workflow_steps set response_sheet_url=$1,pc_email=$3 where id=$2",
          [
            st.responseSheetUrl || null,
            step.id,
            String(st.pcEmail || "").trim() || null,
          ],
        );
        const fv = (
          await c.query(
            `insert into form_versions(fms_id,step_id,form_key,version,title,instructions,status,responsible_name,responsible_email,responsible_phone,delivery_channels) values($1,$2,$3,1,$4,$5,'DRAFT',$6,$7,$8,$9) returning id`,
            [
              f.id,
              step.id,
              st.id || `${code}-S${String(i + 1).padStart(2, "0")}`,
              st.name,
              "Complete the approved stage form and submit it to the PC.",
              st.contact?.name || null,
              st.contact?.email || null,
              st.contact?.phone || null,
              JSON.stringify(st.contact?.channels || ["email"]),
            ],
          )
        ).rows[0];
        for (let q = 0; q < (st.fields || []).length; q++) {
          const x = st.fields[q];
          await c.query(
            `insert into form_questions(form_version_id,question_key,position,label,field_type,required,system_locked,options_json,help_text) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              fv.id,
              x.key || `q_${q + 1}`,
              q,
              x.name || `Question ${q + 1}`,
              x.type || "text",
              Boolean(x.required),
              Boolean(x.system),
              JSON.stringify(x.options || []),
              x.help || null,
            ],
          );
        }
      }
      await c.query("commit");
      const s1 = (body.stages || [])[0];
      const stage1Email =
        s1 && (s1.googleFormUrl || s1.contact?.email)
          ? await sendStageFormEmail({
              fmsId: f.id,
              stepNo: 1,
              stageName: s1.name,
              fmsCode: code,
              formUrl: s1.googleFormUrl,
              email: s1.contact?.email,
              pcEmail: s1.pcEmail,
            })
          : { sent: false, message: "No Stage 01 Google Form entered." };
      res.json({
        ok: true,
        mode: "postgresql",
        id: f.id,
        fms_number: f.fms_number,
        code: f.code,
        stage1Email,
      });
    } catch (e: any) {
      await c.query("rollback");
      if (
        e?.code === "23505" &&
        String(e?.constraint || "").includes("fms_code")
      )
        return res.status(409).json({
          error: `FMS Code ${code} is already available. Choose another Code.`,
        });
      if (
        e?.code === "23505" &&
        String(e?.detail || "")
          .toLowerCase()
          .includes("code")
      )
        return res.status(409).json({
          error: `FMS Code ${code} is already available. Choose another Code.`,
        });
      res.status(500).json({ error: e.message || "Could not create FMS" });
    } finally {
      c.release();
    }
  },
);

async function saveFormVersion(
  key: string,
  body: any,
  status: "DRAFT" | "APPROVED",
) {
  if (!pool) return { version: Number(body.version || 1) };
  const c = await pool.connect();
  try {
    await c.query("begin");
    const stepRows = (
      await c.query(
        "select id,fms_id from workflow_steps where id::text=$1 limit 1",
        [key],
      )
    ).rows;
    const step = stepRows[0];
    const mx = (
      await c.query(
        "select coalesce(max(version),0)::int v from form_versions where form_key=$1",
        [key],
      )
    ).rows[0].v;
    const version = Math.max(Number(body.version) || 1, mx + 1);
    const stage = body.stage || {};
    const contact = stage.contact || body.responsible_contact || {};
    const fv = (
      await c.query(
        `insert into form_versions(fms_id,step_id,form_key,version,title,instructions,status,approved_at,responsible_name,responsible_email,responsible_phone,delivery_channels) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,'["email"]'::jsonb) returning id,version`,
        [
          step?.fms_id || null,
          step?.id || null,
          key,
          version,
          stage.name || body.title || key,
          body.instructions ||
            "Open the existing Google Form and submit responses there.",
          status,
          status === "APPROVED" ? new Date() : null,
          contact.name || null,
          String(contact.email || "")
            .trim()
            .toLowerCase() || null,
        ],
      )
    ).rows[0];
    if (step) {
      await c.query(
        `update workflow_steps set google_form_url=$1,form_status=$2,approved_form_version_id=$3,who_role=coalesce(nullif($4,''),who_role),response_sheet_url=$6,pc_email=$7 where id=$5`,
        [
          stage.googleFormUrl || null,
          status === "APPROVED" ? "APPROVED" : "NOT_SENT",
          status === "APPROVED" ? fv.id : null,
          stage.who || "",
          step.id,
          stage.responseSheetUrl || null,
          String(stage.pcEmail || "").trim() || null,
        ],
      );
    }
    await c.query("commit");
    return { version: fv.version };
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

app.post(
  "/api/form-config/:formId",
  requirePermission("FMS_EDIT"),
  async (req, res) => {
    try {
      const r = await saveFormVersion(req.params.formId, req.body, "DRAFT");
      res.json({ ok: true, status: "DRAFT", ...r });
    } catch (e: any) {
      res
        .status(500)
        .json({ error: e.message || "Could not save form configuration" });
    }
  },
);
app.post(
  "/api/form-config/:formId/approve",
  requirePermission("FMS_EDIT"),
  async (req, res) => {
    try {
      const r = await saveFormVersion(req.params.formId, req.body, "APPROVED");
      res.json({ ok: true, status: "APPROVED", ...r });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Could not approve form" });
    }
  },
);
app.get("/api/form-config/public/:formId", async (req, res) => {
  if (!pool)
    return res
      .status(404)
      .json({ error: "Public server form requires PostgreSQL persistence." });
  try {
    const rows = await db(
      `select fv.form_key,fv.version,fv.title,fv.instructions,fv.responsible_name,fv.responsible_email,fv.responsible_phone,fv.delivery_channels,coalesce(json_agg(json_build_object('key',fq.question_key,'name',fq.label,'type',fq.field_type,'required',fq.required,'system',fq.system_locked,'options',fq.options_json,'help',fq.help_text) order by fq.position) filter(where fq.id is not null),'[]') fields from form_versions fv left join form_questions fq on fq.form_version_id=fv.id where fv.form_key=$1 and fv.status='APPROVED' group by fv.id order by fv.version desc limit 1`,
      [req.params.formId],
    );
    if (!rows[0])
      return res.status(404).json({ error: "Approved live form not found" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Could not load form" });
  }
});

app.post(
  "/api/fms/:fmsId/stages",
  requirePermission("FMS_EDIT"),
  async (req, res) => {
    if (!pool)
      return res
        .status(503)
        .json({ error: "PostgreSQL is required to add stages." });
    const st = req.body || {};
    const name = String(st.name || "").trim();
    if (!name)
      return res.status(400).json({ error: "Stage name is required." });
    const link = String(st.googleFormUrl || "").trim();
    if (link && !FORM_URL_RE.test(link))
      return res.status(400).json({
        error:
          "Google Form URL must start with https://docs.google.com/forms/ or https://forms.gle/",
      });
    const doerEmail = String(st.contact?.email || "")
      .trim()
      .toLowerCase();
    if (doerEmail && !DOER_EMAIL_RE.test(doerEmail))
      return res
        .status(400)
        .json({ error: "Doer email must end with @dinerofoodworks.com." });
    const c = await pool.connect();
    try {
      await c.query("begin");
      const f = (
        await c.query("select id,code from fms where id::text=$1 for update", [
          req.params.fmsId,
        ])
      ).rows[0];
      if (!f) {
        await c.query("rollback");
        return res.status(404).json({ error: "FMS not found." });
      }
      const last = (
        await c.query(
          "select step_no,execution_status from workflow_steps where fms_id=$1 order by step_no desc limit 1",
          [f.id],
        )
      ).rows[0];
      const stepNo = (last ? Number(last.step_no) : 0) + 1;
      if (last && last.execution_status !== "DONE") {
        await c.query("rollback");
        return res.status(409).json({
          error:
            "Add the next stage only after the previous stage is marked DONE by PC.",
        });
      }
      const unlockNow = !last || last.execution_status === "DONE";
      const hrs = Number(st.plannedHours);
      const tatMin =
        Number.isFinite(hrs) && hrs > 0 ? Math.round(hrs * 60) : null;
      const nowTs = unlockNow ? new Date() : null;
      const step = (
        await c.query(
          `insert into workflow_steps(fms_id,step_no,code,name,what_text,how_text,who_role,when_text,planned_at,started_at,google_form_url,form_status,execution_status,planned_tat_minutes,response_sheet_url,pc_email) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'NOT_SENT',$12,$13,$14,$15) returning id`,
          [
            f.id,
            stepNo,
            `${f.code}-S${String(stepNo).padStart(2, "0")}`,
            name,
            st.what || null,
            st.how || null,
            st.who || null,
            st.when || null,
            nowTs,
            nowTs,
            link || null,
            unlockNow ? "READY" : "LOCKED",
            tatMin,
            String(st.responseSheetUrl || "").trim() || null,
            String(st.pcEmail || "").trim() || null,
          ],
        )
      ).rows[0];
      await c.query(
        `insert into form_versions(fms_id,step_id,form_key,version,title,instructions,status,responsible_name,responsible_email,responsible_phone,delivery_channels) values($1,$2,$3,1,$4,$5,'DRAFT',$6,$7,'',$8)`,
        [
          f.id,
          step.id,
          `${f.code}-S${String(stepNo).padStart(2, "0")}`,
          name,
          "Complete the approved stage form and submit it to the PC.",
          String(st.contact?.name || ""),
          doerEmail,
          JSON.stringify(["email"]),
        ],
      );
      await c.query(
        "insert into audit_logs(entity_type,action,metadata) values($1,$2,$3)",
        [
          "WORKFLOW_STAGE",
          "STAGE_ADDED",
          JSON.stringify({ fms_id: f.id, step_no: stepNo, name }),
        ],
      );
      await c.query("commit");
      let emailSent = false;
      let message = unlockNow
        ? "Stage added and READY."
        : "Stage added. It stays LOCKED until the previous stage is DONE.";
      if (unlockNow && link && doerEmail) {
        const r = await sendStageFormEmail({
          fmsId: f.id,
          stepNo,
          stageName: name,
          fmsCode: f.code,
          formUrl: link,
          email: doerEmail,
          pcEmail: String(st.pcEmail || ""),
        });
        emailSent = !!r.sent;
        message += " " + (r.message || "Form emailed to doer.");
      }
      res.json({ ok: true, stepNo, emailSent, message });
    } catch (e: any) {
      await c.query("rollback").catch(() => {});
      res.status(500).json({ error: e.message || "Could not add stage." });
    } finally {
      c.release();
    }
  },
);
app.post(
  "/api/fms/:fmsId/stages/:stageId/decision",
  requirePermission("PC_DECISION"),
  async (req, res) => {
    if (!pool)
      return res.status(503).json({
        error: "PostgreSQL is required to persist PC stage decisions.",
      });
    const action = String(req.body?.action || "").toUpperCase();
    if (!["DONE", "RETURN_TO_DOER"].includes(action))
      return res.status(400).json({ error: "Choose DONE or RETURN_TO_DOER." });
    const feedback = String(req.body?.feedback || "").trim();
    if (action === "RETURN_TO_DOER" && !feedback)
      return res.status(400).json({
        error: "Feedback is required when returning a stage to the doer.",
      });
    const c = await pool.connect();
    let mailTarget = "";
    let mailName = "";
    let mailUrl = "";
    let stageName = "";
    let fmsCode = "";
    let createdAt: any = null;
    try {
      await c.query("begin");
      const rows = (
        await c.query(
          `select ws.id,ws.fms_id,ws.step_no,ws.name,ws.planned_at,ws.planned_tat_minutes,ws.started_at,ws.google_form_url,ws.execution_status,ws.pc_feedback,ws.pc_email,
    fv.responsible_email,fv.responsible_name,f.code fms_code,f.name fms_name,f.created_at fms_created_at
    from workflow_steps ws join fms f on f.id=ws.fms_id
    left join lateral (select responsible_email,responsible_name from form_versions where step_id=ws.id order by version desc limit 1) fv on true
    where ws.id::text=$1 and ws.fms_id::text=$2 for update of ws`,
          [req.params.stageId, req.params.fmsId],
        )
      ).rows;
      const stage = rows[0];
      if (!stage) {
        await c.query("rollback");
        return res.status(404).json({ error: "Stage not found in this FMS." });
      }
      if (stage.execution_status === "LOCKED") {
        await c.query("rollback");
        return res.status(409).json({
          error:
            "This stage is locked until the previous stage is approved by PC.",
        });
      }
      if (stage.execution_status === "DONE") {
        await c.query("rollback");
        return res
          .status(409)
          .json({ error: "This stage is already complete." });
      }
      if (action === "DONE" && !stage.google_form_url) {
        await c.query("rollback");
        return res.status(400).json({
          error:
            "Configure and review the existing Google Form response before marking this stage DONE.",
        });
      }
      if (action === "RETURN_TO_DOER" && !stage.responsible_email) {
        await c.query("rollback");
        return res.status(400).json({
          error:
            "Configure the responsible person’s Workspace email before returning this stage.",
        });
      }
      const updated = (
        await c.query(
          `update workflow_steps set
    execution_status=$1,pc_review_status=$1,pc_feedback=case when $1='CORRECTION' then $2 when $1='DONE' then null else pc_feedback end,
    correction_requested_at=case when $1='CORRECTION' then now() else correction_requested_at end,
    actual_completed_at=case when $1='DONE' then now() else actual_completed_at end,
    actual_tat_minutes=case when $1='DONE' then greatest(0,floor(extract(epoch from (now()-coalesce(started_at,planned_at,(select created_at from fms where id=workflow_steps.fms_id))))/60)::int) else actual_tat_minutes end,
    delay_minutes=case when $1='DONE' then case when planned_tat_minutes is null then null else floor(extract(epoch from (now()-(coalesce(planned_at,started_at,(select created_at from fms where id=workflow_steps.fms_id))+make_interval(mins=>planned_tat_minutes))))/60)::int end else delay_minutes end
    where id=$3 returning execution_status,actual_completed_at,actual_tat_minutes,delay_minutes`,
          [
            action === "RETURN_TO_DOER" ? "CORRECTION" : action,
            feedback,
            stage.id,
          ],
        )
      ).rows[0];
      let nextUnlocked = false;
      let nextInfo: any = null;
      if (action === "DONE") {
        const next = await c.query(
          `update workflow_steps set execution_status='READY',planned_at=coalesce(planned_at,now()),started_at=now(),actual_completed_at=null,actual_tat_minutes=null,delay_minutes=null,pc_review_status='PENDING',pc_feedback=null where fms_id=$1 and step_no=$2 and execution_status='LOCKED' returning id`,
          [stage.fms_id, Number(stage.step_no) + 1],
        );
        nextUnlocked = (next.rowCount || 0) > 0;
        if (nextUnlocked) {
          nextInfo = (
            await c.query(
              `select ws.name,ws.step_no,ws.google_form_url,ws.pc_email,fv.responsible_email,f.code fms_code from workflow_steps ws join fms f on f.id=ws.fms_id left join lateral (select responsible_email from form_versions where step_id=ws.id order by version desc limit 1) fv on true where ws.fms_id=$1 and ws.step_no=$2`,
              [stage.fms_id, Number(stage.step_no) + 1],
            )
          ).rows[0];
        }
      }
      await c.query(
        `insert into audit_logs(entity_type,action,metadata) values($1,$2,$3)`,
        [
          "WORKFLOW_STAGE",
          action === "RETURN_TO_DOER" ? "PC_RETURN_TO_DOER" : "PC_DONE",
          JSON.stringify({
            fms_id: stage.fms_id,
            stage_id: stage.id,
            step_no: stage.step_no,
            next_stage_unlocked: nextUnlocked,
            feedback: action === "RETURN_TO_DOER" ? feedback : undefined,
            actual_tat_minutes: updated.actual_tat_minutes,
          }),
        ],
      );
      mailTarget = String(stage.responsible_email || "");
      mailName = String(stage.responsible_name || "Doer");
      mailUrl = String(stage.google_form_url || "");
      stageName = String(stage.name || "Stage " + stage.step_no);
      fmsCode = String(stage.fms_code || stage.fms_name || "FMS");
      createdAt = stage.fms_created_at;
      await c.query("commit");
      if (stage.pc_email)
        await sendPcNotice(
          String(stage.pc_email),
          action === "DONE"
            ? `Stage DONE: ${stageName} (${fmsCode})`
            : `Stage returned to doer: ${stageName} (${fmsCode})`,
          action === "DONE"
            ? `PC marked ${stageName} of ${fmsCode} as DONE.`
            : `PC returned ${stageName} of ${fmsCode} to the doer.\nFeedback: ${feedback}`,
        );
      if (nextInfo && nextInfo.google_form_url && nextInfo.responsible_email)
        await sendStageFormEmail({
          fmsId: stage.fms_id,
          stepNo: Number(nextInfo.step_no),
          stageName: String(nextInfo.name),
          fmsCode: String(nextInfo.fms_code),
          formUrl: String(nextInfo.google_form_url),
          email: String(nextInfo.responsible_email),
          pcEmail: String(nextInfo.pc_email || ""),
        }).catch(() => {});
      let emailSent = false;
      let emailWarning = "";
      if (action === "RETURN_TO_DOER") {
        try {
          const transporter = await smtpTransport();
          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: mailTarget,
            subject: `Action required: ${stageName} returned for correction (${fmsCode})`,
            text: `Hello ${mailName},\n\nThe Process Coordinator reviewed your submitted Google Form and returned it for correction.\n\nFMS: ${fmsCode}\nStage: ${stageName}\nPC feedback: ${feedback}\n\nPlease correct the response and submit the Google Form again: ${mailUrl}\n\nThis stage remains active. It will only be completed when PC reviews the corrected response and marks DONE.`,
            html: `<div style="font-family:Arial,sans-serif;color:#231f20;max-width:640px"><h2 style="color:#fe5e41">FMS stage returned for correction</h2><p>Hello ${String(mailName).replace(/[&<>"']/g, "")} ,</p><p>The Process Coordinator reviewed your submission and requested a correction.</p><p><b>FMS:</b> ${String(fmsCode).replace(/[&<>"']/g, "")}<br><b>Stage:</b> ${String(stageName).replace(/[&<>"']/g, "")}</p><div style="padding:16px;background:#fff0ee;border-left:4px solid #fe5e41"><b>PC feedback</b><p>${feedback.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p></div><p><a href="${mailUrl}" style="display:inline-block;padding:12px 18px;background:#fe5e41;color:#231f20;text-decoration:none;border-radius:8px;font-weight:bold">Open Google Form and resubmit</a></p><p>The stage will only complete after PC reviews the corrected response and marks DONE.</p></div>`,
          });
          emailSent = true;
        } catch (mailErr: any) {
          emailWarning = ` Stage was returned in FMS, but email could not be sent: ${mailErr.message || "SMTP error"}.`;
        }
      }
      res.json({
        ok: true,
        status: updated.execution_status,
        actual_completed_at: updated.actual_completed_at,
        actual_tat_minutes: updated.actual_tat_minutes,
        delay_minutes: updated.delay_minutes,
        next_stage_unlocked: nextUnlocked,
        email_sent: emailSent,
        message:
          action === "DONE"
            ? nextUnlocked
              ? "Stage marked DONE. Actual completion time and elapsed time were recorded; the next stage is READY."
              : "Final stage marked DONE. Actual completion time and elapsed time were recorded."
            : `Stage returned to the doer for correction.${emailWarning}`,
      });
    } catch (e: any) {
      await c.query("rollback");
      res
        .status(500)
        .json({ error: e.message || "Could not record PC decision." });
    } finally {
      c.release();
    }
  },
);

async function smtpTransport() {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  )
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in server/.env.",
    );
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

app.post(
  "/api/email/test",
  requirePermission("SYSTEM_CONFIG"),
  async (req, res) => {
    try {
      const user = (req as any).user;
      const transporter = await smtpTransport();
      const to = String(req.body?.to || user?.email || "").trim();
      if (!to)
        return res
          .status(400)
          .json({ error: "A test recipient email is required." });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: "FMS Engine SMTP test",
        text: "SMTP is configured correctly for the FMS Engine. This is a test notification.",
      });
      res.json({ ok: true, message: `SMTP test sent to ${to}.` });
    } catch (e: any) {
      res.status(503).json({ error: e.message || "SMTP test failed." });
    }
  },
);

app.post(
  "/api/form-config/:formId/dispatch",
  requirePermission("WORKFLOW_CONTROL"),
  async (req, res) => {
    const body = req.body || {};
    const stage = body.stage || {};
    const target = stage.contact || body.responsible_contact || {};
    const email = String(target.email || "")
      .trim()
      .toLowerCase();
    const formUrl = String(
      stage.googleFormUrl || body.googleFormUrl || "",
    ).trim();
    const htmlEscape = (v: string) =>
      v
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    if (!/^[^\s@]+@dinerofoodworks\.com$/.test(email))
      return res.status(400).json({
        error:
          "Enter a valid @dinerofoodworks.com Workspace email for the responsible person.",
      });
    if (!/^https?:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/i.test(formUrl))
      return res.status(400).json({
        error:
          "Paste the existing Google Form URL. The FMS Engine does not build Google Form questions.",
      });
    try {
      if (
        !process.env.SMTP_HOST ||
        !process.env.SMTP_USER ||
        !process.env.SMTP_PASS
      )
        return res.status(503).json({
          error:
            "Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in server/.env.",
        });
      const transporter = await smtpTransport();
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: `FMS stage form: ${stage.name || body.formId}`,
        text: `You have been assigned an FMS stage.\n\nStage: ${stage.name || body.formId}\nFMS: ${body.fmsCode || ""}\nOpen the existing Google Form: ${formUrl}\n\nAfter submitting, PC reviews the response in the Google Form's linked response Sheet. Submission alone does not complete the stage.`,
        html: `<div style="font-family:Arial,sans-serif;color:#231F20;max-width:620px;margin:auto;padding:24px;background:#FFF0EE;border-radius:16px"><div style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#FE5E41">DINERO FOODWORKS · FMS ENGINE</div><h2 style="margin:12px 0">Stage form assigned</h2><p>You have been assigned an FMS stage.</p><p><b>Stage:</b> ${String(stage.name || body.formId).replace(/[<>]/g, "")}<br/><b>FMS:</b> ${String(body.fmsCode || "").replace(/[<>]/g, "")}</p><p><a href="${htmlEscape(formUrl)}" style="display:inline-block;background:#FE5E41;color:#231F20;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">Open Google Form ↗</a></p><p>After submitting, PC reviews the response in the Google Form's linked Google Sheet. Submission alone does not complete the stage.</p></div>`,
      });
      if (pool) {
        await db(
          `update workflow_steps set form_status='SENT',form_sent_at=now() where id::text=$1`,
          [String(body.formId || "")],
        );
      }
      res.json({
        ok: true,
        results: { email: true },
        link: formUrl,
        message: `Google Form link sent to ${email}.`,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Email dispatch failed." });
    }
  },
);
app.post("/api/form-submission", async (req, res) => {
  const b = req.body || {};
  const secret = process.env.FORM_WEBHOOK_SECRET || "";
  if (
    secret &&
    String(req.headers["x-form-secret"] || b.secret || "") !== secret
  )
    return res.status(401).json({ error: "Invalid form webhook secret." });
  const fmsCode = String(b.fmsCode || "")
    .trim()
    .toUpperCase();
  const stageNo = Number(b.stageNo || 0);
  if (!fmsCode || !stageNo)
    return res.status(400).json({ error: "fmsCode and stageNo are required." });
  const stageCode = `${fmsCode}-S${String(stageNo).padStart(2, "0")}`;
  if (!pool)
    return res.json({
      ok: true,
      status: "SUBMITTED",
      stageCode,
      message: "Submission received (no database configured, not stored).",
    });
  try {
    const rows = await db<any>(
      `update workflow_steps ws set form_status='SUBMITTED',form_submitted_at=now() from fms f where f.id=ws.fms_id and upper(f.code)=$1 and ws.step_no=$2 returning ws.id,ws.name,ws.pc_email,f.code fms_code`,
      [fmsCode, stageNo],
    );
    if (!rows[0])
      return res.status(404).json({ error: `No stage ${stageCode} found.` });
    await db(
      "insert into audit_logs(entity_type,action,metadata) values($1,$2,$3)",
      [
        "FORM_SUBMISSION",
        "SUBMITTED",
        JSON.stringify({
          stageCode,
          respondent: b.respondent || "",
          submittedAt: b.submittedAt || "",
        }),
      ],
    ).catch(() => {});
    if (rows[0].pc_email)
      await sendPcNotice(
        rows[0].pc_email,
        `Doer submitted: ${rows[0].name} (${rows[0].fms_code})`,
        `The doer submitted the Google Form for ${rows[0].name} (${rows[0].fms_code}, ${stageCode}).\n\nOpen the linked response Sheet, check it, then mark DONE in FMS.`,
      );
    res.json({
      ok: true,
      status: "SUBMITTED",
      stageCode,
      message:
        "Submission recorded on the stage. PC still reviews the Sheet and marks DONE.",
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Could not record submission" });
  }
});

const clientDist = path.resolve(process.cwd(), "../client/dist");
app.use(express.static(clientDist));
app.get(/^\/(?!api\/).*/, (_req, res) =>
  res.sendFile(path.join(clientDist, "index.html")),
);

const port = Number(process.env.PORT || 4000);
app.listen(port, () =>
  console.log(`FMS API listening on http://localhost:${port}`),
);
