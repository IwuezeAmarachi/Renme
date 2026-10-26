import { createClient } from "@supabase/supabase-js";
import type { Item, Settings } from "./model";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null when env vars are missing — the app then runs local-only, as before. */
export const supabase = url && key ? createClient(url, key) : null;

interface ItemRow {
  id: string; kind: Item["kind"]; title: string; date: string; time: string | null; notes: string | null;
  whose: Item["whose"] | null; date_type: Item["dateType"] | null; yearly: boolean; lead_days: number[];
  done: boolean; done_at: string | null; created_at: string;
}

export const toRow = (i: Item) => ({
  id: i.id, kind: i.kind, title: i.title, date: i.date, time: i.time || null, notes: i.notes ?? null,
  whose: i.whose ?? null, date_type: i.dateType ?? null, yearly: !!i.yearly, lead_days: i.leadDays,
  done: !!i.done, done_at: i.doneAt ? new Date(i.doneAt).toISOString() : null,
  created_at: new Date(i.createdAt).toISOString(),
});

export const fromRow = (r: ItemRow): Item => ({
  id: r.id, kind: r.kind, title: r.title, date: r.date, time: r.time ? r.time.slice(0, 5) : undefined,
  notes: r.notes ?? undefined, whose: r.whose ?? undefined, dateType: r.date_type ?? undefined,
  yearly: r.yearly, leadDays: r.lead_days, done: r.done, doneAt: r.done_at ? +new Date(r.done_at) : undefined,
  createdAt: +new Date(r.created_at),
});

export async function pullItems(): Promise<Item[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("items").select("*");
  return error ? null : (data as ItemRow[]).map(fromRow);
}
export const pushItems = (items: Item[]) =>
  supabase && items.length ? supabase.from("items").upsert(items.map(toRow)) : Promise.resolve(null);
export const deleteItem = (id: string) => (supabase ? supabase.from("items").delete().eq("id", id) : Promise.resolve(null));

export async function pullSettings(): Promise<Partial<Settings> | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("settings").select("*").maybeSingle();
  return data
    ? { partnerName: data.partner_name, hidePreviews: data.hide_previews, defaultTime: String(data.default_time).slice(0, 5) }
    : null;
}
export const pushSettings = (s: Settings) =>
  supabase
    ? supabase.from("settings").upsert({
        partner_name: s.partnerName, hide_previews: s.hidePreviews, default_time: s.defaultTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
    : Promise.resolve(null);
