export type Kind = "reminder" | "date" | "event" | "promise" | "idea";
export type Whose = "partner" | "me" | "us";
export type DateType = "partner-birthday" | "my-birthday" | "anniversary" | "wedding" | "other";

export interface Item {
  id: string;
  kind: Kind;
  title: string;
  date: string; // YYYY-MM-DD (local). For recurring dates, the original date.
  time?: string; // HH:MM (local)
  notes?: string;
  whose?: Whose;
  dateType?: DateType;
  yearly?: boolean;
  leadDays: number[]; // advance notices, in days before. 0 = at the time itself
  done?: boolean;
  doneAt?: number;
  createdAt: number;
}

export interface Settings {
  partnerName: string;
  onboarded: boolean;
  hidePreviews: boolean; // keep notification text generic
  defaultTime: string; // time used for all-day items' notifications
}

export const KIND_META: Record<Kind, { label: string; emoji: string; hint: string }> = {
  reminder: { label: "Reminder", emoji: "🔔", hint: "Buy concert tickets…" },
  date: { label: "Important date", emoji: "💞", hint: "Our anniversary" },
  event: { label: "Their event", emoji: "🗓️", hint: "Her job interview" },
  promise: { label: "Promise", emoji: "🤝", hint: "Take her out for dinner" },
  idea: { label: "Idea", emoji: "🎁", hint: "Concert she wants to see" },
};

export const DATE_TYPES: { id: DateType; label: string; whose: Whose }[] = [
  { id: "partner-birthday", label: "Their birthday", whose: "partner" },
  { id: "my-birthday", label: "My birthday", whose: "me" },
  { id: "anniversary", label: "Anniversary", whose: "us" },
  { id: "wedding", label: "Wedding anniversary", whose: "us" },
  { id: "other", label: "Other", whose: "us" },
];

export const LEAD_OPTIONS: { days: number; label: string }[] = [
  { days: 0, label: "On the day" },
  { days: 1, label: "1 day before" },
  { days: 3, label: "3 days before" },
  { days: 7, label: "1 week before" },
  { days: 14, label: "2 weeks before" },
  { days: 30, label: "1 month before" },
];
