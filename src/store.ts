import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Item, Settings } from "./model";
import { deleteItem, pullItems, pullSettings, pushItems, pushSettings, supabase } from "./supabase";

const ITEMS_KEY = "remember.items.v1";
const SETTINGS_KEY = "remember.settings.v1";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — app still works for the session */
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export type SyncState = "local" | "syncing" | "synced" | "error";

/** Local-first: localStorage is always the working copy; Supabase mirrors it when signed in. */
export function useStore() {
  const [items, setItems] = useState<Item[]>(() => load<Item[]>(ITEMS_KEY, []));
  const [settings, setSettings] = useState<Settings>(() =>
    load<Settings>(SETTINGS_KEY, { partnerName: "", onboarded: false, hidePreviews: false, defaultTime: "09:00" }),
  );
  const [session, setSession] = useState<Session | null>(null);
  const [sync, setSync] = useState<SyncState>("local");
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const hydrated = useRef(false);

  useEffect(() => save(ITEMS_KEY, items), [items]);
  useEffect(() => save(SETTINGS_KEY, settings), [settings]);

  // auth session
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // on sign-in: pull remote, merge by id (remote wins), push local-only items up
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) {
      hydrated.current = false;
      setSync("local");
      return;
    }
    let cancelled = false;
    (async () => {
      setSync("syncing");
      const [remote, remoteSettings] = await Promise.all([pullItems(), pullSettings()]);
      if (cancelled) return;
      if (!remote) return setSync("error");
      const remoteIds = new Set(remote.map((r) => r.id));
      const localOnly = itemsRef.current.filter((i) => !remoteIds.has(i.id));
      const res = await pushItems(localOnly);
      if (cancelled) return;
      if (res?.error) return setSync("error");
      setItems([...remote, ...localOnly]);
      if (remoteSettings) setSettings((s) => ({ ...s, ...remoteSettings, onboarded: true }));
      else await pushSettings(settingsRef.current);
      hydrated.current = true;
      setSync("synced");
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const track = useCallback(async (p: PromiseLike<{ error: unknown } | null>) => {
    if (!hydrated.current) return;
    setSync("syncing");
    const r = await p;
    setSync(r?.error ? "error" : "synced");
  }, []);

  const upsert = useCallback(
    (item: Item) => {
      setItems((prev) => (prev.some((p) => p.id === item.id) ? prev.map((p) => (p.id === item.id ? item : p)) : [...prev, item]));
      void track(pushItems([item]));
    },
    [track],
  );
  const remove = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((p) => p.id !== id));
      void track(deleteItem(id));
    },
    [track],
  );
  const toggleDone = useCallback(
    (id: string) => {
      const cur = itemsRef.current.find((p) => p.id === id);
      if (!cur) return;
      const next = { ...cur, done: !cur.done, doneAt: cur.done ? undefined : Date.now() };
      setItems((prev) => prev.map((p) => (p.id === id ? next : p)));
      void track(pushItems([next]));
    },
    [track],
  );
  const updateSettings = useCallback(
    (s: Settings) => {
      setSettings(s);
      void track(pushSettings(s));
    },
    [track],
  );

  return { items, settings, setSettings: updateSettings, upsert, remove, toggleDone, session, sync };
}
