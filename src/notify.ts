import { useEffect, useState } from "react";
import type { Item, Settings } from "./model";
import { fireTimes } from "./dates";

const FIRED_KEY = "remember.fired.v1";
// A missed alert is still worth showing if the app opens within this window.
const GRACE_MS = 36 * 3_600_000;

export type Permission = NotificationPermission | "unsupported";
export const getPermission = (): Permission => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);

export async function requestPermission(): Promise<Permission> {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.requestPermission();
}

export async function registerSW() {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/sw.js");
    } catch {
      /* fall back to in-page Notification */
    }
  }
}

function loadFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}");
  } catch {
    return {};
  }
}

async function show(title: string, body: string, tag: string) {
  const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (reg) return reg.showNotification(title, { body, tag, icon: "/icon.svg" });
  new Notification(title, { body, tag, icon: "/icon.svg" });
}

/** Fire every due, not-yet-fired notification. `tag` + the fired ledger prevent duplicates. */
export async function checkDue(items: Item[], settings: Settings, now = new Date()) {
  if (getPermission() !== "granted") return;
  const fired = loadFired();
  let changed = false;
  for (const item of items) {
    for (const f of fireTimes(item, settings.defaultTime, now)) {
      const late = now.getTime() - f.at.getTime();
      if (late < 0 || late > GRACE_MS || fired[f.key]) continue;
      fired[f.key] = Date.now();
      changed = true;
      const when = f.lead === 0 ? "today" : f.lead === 1 ? "tomorrow" : `in ${f.lead} days`;
      const title = settings.hidePreviews ? "Remember" : item.title;
      const body = settings.hidePreviews ? "You have something to remember." : f.lead === 0 ? "It's time." : `Coming up ${when}.`;
      await show(title, body, f.key);
    }
  }
  if (changed) {
    // prune old ledger entries
    const cutoff = Date.now() - 400 * 86_400_000;
    for (const k of Object.keys(fired)) if (fired[k] < cutoff) delete fired[k];
    try {
      localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
    } catch {
      /* ignore */
    }
  }
}

/** Re-checks on a timer, when the tab becomes visible, and whenever items change (edits/deletes re-derive fire times). */
export function useNotifier(items: Item[], settings: Settings) {
  const [permission, setPermission] = useState<Permission>(getPermission());
  useEffect(() => {
    registerSW();
  }, []);
  useEffect(() => {
    const run = () => {
      setPermission(getPermission());
      void checkDue(items, settings);
    };
    run();
    const t = setInterval(run, 30_000);
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", run);
    };
  }, [items, settings]);
  return { permission, setPermission };
}
