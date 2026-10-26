import { useCallback, useEffect, useState } from "react";
import type { Item, Settings } from "./model";

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

export function useStore() {
  const [items, setItems] = useState<Item[]>(() => load<Item[]>(ITEMS_KEY, []));
  const [settings, setSettings] = useState<Settings>(() =>
    load<Settings>(SETTINGS_KEY, { partnerName: "", onboarded: false, hidePreviews: false, defaultTime: "09:00" }),
  );

  useEffect(() => save(ITEMS_KEY, items), [items]);
  useEffect(() => save(SETTINGS_KEY, settings), [settings]);

  const upsert = useCallback((item: Item) => {
    setItems((prev) => (prev.some((p) => p.id === item.id) ? prev.map((p) => (p.id === item.id ? item : p)) : [...prev, item]));
  }, []);
  const remove = useCallback((id: string) => setItems((prev) => prev.filter((p) => p.id !== id)), []);
  const toggleDone = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, done: !p.done, doneAt: p.done ? undefined : Date.now() } : p)),
    );
  }, []);

  return { items, settings, setSettings, upsert, remove, toggleDone };
}
