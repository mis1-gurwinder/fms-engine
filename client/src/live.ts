/* Live refresh + alert helpers (sound and browser notifications) */

export const LIVE_MS = 5000;

let audioCtx: AudioContext | null = null;

function unlockAudio() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    audioCtx?.resume();
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
  } catch {
    /* sound not available in this browser */
  }
}

if (typeof window !== "undefined") {
  // Browsers only allow sound after the first click or key press on the page.
  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio);
}

export function playAlert() {
  try {
    const ctx = audioCtx;
    if (!ctx || ctx.state !== "running") return;
    const t = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const start = t + i * 0.18;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(start);
      o.stop(start + 0.18);
    });
  } catch {
    /* ignore */
  }
}

export function notifyBrowser(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    /* ignore */
  }
}

export function fireAlert(title: string, body: string) {
  playAlert();
  notifyBrowser(title, body);
}

type AlertStage = { id: string; name: string; status?: string; formStatus?: string };

/* Compares the previous snapshot with fresh stages and fires alerts for changes.
   The first call only records the baseline, so opening a page never beeps. */
export function formAlerts(prev: Record<string, string>, stages: AlertStage[], code: string) {
  const next: Record<string, string> = {};
  stages.forEach((st) => {
    next[st.id] = `${st.formStatus || ""}|${String(st.status || "").toUpperCase()}`;
  });
  if (Object.keys(prev).length === 0) return next;
  stages.forEach((st) => {
    const before = prev[st.id];
    const now = next[st.id];
    if (before === undefined || before === now) return;
    const [beforeForm, beforeStatus] = before.split("|");
    const label = `${code} · ${st.name}`;
    if (st.formStatus === "SUBMITTED" && beforeForm !== "SUBMITTED") {
      fireAlert("Doer submitted the form", label);
    } else if (st.formStatus === "SENT" && beforeForm !== "SENT" && beforeForm !== "SUBMITTED") {
      fireAlert("Form sent to doer", label);
    } else if (String(st.status || "").toUpperCase() === "DONE" && beforeStatus !== "DONE") {
      fireAlert("PC marked stage DONE", `${label} · create the next stage`);
    } else if (beforeStatus === "LOCKED" && String(st.status || "").toUpperCase() !== "LOCKED") {
      fireAlert("Stage unlocked", label);
    }
  });
  return next;
}
