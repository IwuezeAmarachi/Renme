import { useState } from "react";
import { DATE_TYPES, KIND_META, LEAD_OPTIONS, type DateType, type Item, type Kind, type Whose } from "./model";
import { toISO } from "./dates";
import { uid } from "./store";

interface Props {
  initial?: Item;
  defaultKind?: Kind;
  partnerName: string;
  onSave: (items: Item[]) => void;
  onClose: () => void;
}

export default function Form({ initial, defaultKind = "reminder", partnerName, onSave, onClose }: Props) {
  const [kind, setKind] = useState<Kind>(initial?.kind ?? defaultKind);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? toISO(new Date()));
  const [time, setTime] = useState(initial?.time ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [whose, setWhose] = useState<Whose>(initial?.whose ?? "us");
  const [dateType, setDateType] = useState<DateType>(initial?.dateType ?? "anniversary");
  const [yearly, setYearly] = useState(initial?.yearly ?? defaultKind === "date");
  const [leadDays, setLeadDays] = useState<number[]>(initial?.leadDays ?? (defaultKind === "date" ? [7, 0] : [0]));
  const [followUp, setFollowUp] = useState(false);
  const [error, setError] = useState("");
  const them = partnerName || "them";
  const isDate = kind === "date";

  const pickKind = (k: Kind) => {
    setKind(k);
    if (!initial) {
      setYearly(k === "date");
      setLeadDays(k === "date" ? [7, 0] : [0]);
    }
  };
  const pickDateType = (id: DateType) => {
    setDateType(id);
    const dt = DATE_TYPES.find((d) => d.id === id)!;
    setWhose(dt.whose);
    if (!title.trim() || DATE_TYPES.some((d) => labelFor(d.id, them) === title)) setTitle(labelFor(id, them));
  };
  const toggleLead = (d: number) =>
    setLeadDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => b - a)));

  const submit = () => {
    if (!title.trim()) return setError("Give it a title so you know what it's for.");
    if (!date) return setError("Pick a date.");
    const base: Item = {
      id: initial?.id ?? uid(),
      kind,
      title: title.trim(),
      date,
      time: time || undefined,
      notes: notes.trim() || undefined,
      whose: isDate ? whose : undefined,
      dateType: isDate ? dateType : undefined,
      yearly: isDate ? yearly : false,
      leadDays: leadDays.length ? leadDays : [0],
      done: initial?.done,
      doneAt: initial?.doneAt,
      createdAt: initial?.createdAt ?? Date.now(),
    };
    const out = [base];
    if (kind === "event" && followUp && !initial) {
      out.push({
        id: uid(), kind: "reminder", title: `Ask ${them} how "${base.title}" went`,
        date, time: time ? addHours(time, 2) : "18:00", leadDays: [0], createdAt: Date.now(),
      });
    }
    onSave(out);
  };

  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={initial ? "Edit" : "New"} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
          <h2>{initial ? "Edit" : "New"} {KIND_META[kind].label.toLowerCase()}</h2>
          <button className="pill primary" onClick={submit}>Save</button>
        </div>

        {!initial && (
          <div className="chips" role="tablist">
            {(Object.keys(KIND_META) as Kind[]).map((k) => (
              <button key={k} className={"chip" + (k === kind ? " on" : "")} onClick={() => pickKind(k)}>
                <span>{KIND_META[k].emoji}</span> {KIND_META[k].label}
              </button>
            ))}
          </div>
        )}

        {isDate && (
          <div className="chips small">
            {DATE_TYPES.map((d) => (
              <button key={d.id} className={"chip" + (d.id === dateType ? " on" : "")} onClick={() => pickDateType(d.id)}>
                {labelFor(d.id, them)}
              </button>
            ))}
          </div>
        )}

        <input
          className="title-input" autoFocus placeholder={KIND_META[kind].hint}
          value={title} onChange={(e) => { setTitle(e.target.value); setError(""); }}
        />

        <div className="card-group">
          <label className="row"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="row">
            <span>Time <em>optional</em></span>
            <span className="inline">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              {time && <button className="link" onClick={() => setTime("")}>Clear</button>}
            </span>
          </label>
          {isDate && (
            <>
              <label className="row">
                <span>Whose</span>
                <select value={whose} onChange={(e) => setWhose(e.target.value as Whose)}>
                  <option value="partner">{partnerName ? `${partnerName}'s` : "Their"}</option>
                  <option value="me">Mine</option>
                  <option value="us">Ours</option>
                </select>
              </label>
              <label className="row"><span>Repeats every year</span><Toggle on={yearly} set={setYearly} /></label>
            </>
          )}
        </div>

        <p className="label">Remind me</p>
        <div className="chips small">
          {LEAD_OPTIONS.map((o) => (
            <button key={o.days} className={"chip" + (leadDays.includes(o.days) ? " on" : "")} onClick={() => toggleLead(o.days)}>{o.label}</button>
          ))}
        </div>

        <textarea className="notes" placeholder="Notes (optional) — what she mentioned, ideas, details…" value={notes} onChange={(e) => setNotes(e.target.value)} />

        {kind === "event" && !initial && (
          <div className="card-group">
            <label className="row"><span>Also remind me to check in afterwards</span><Toggle on={followUp} set={setFollowUp} /></label>
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

export const labelFor = (id: DateType, them: string) =>
  ({
    "partner-birthday": them === "them" ? "Their birthday" : `${them}'s birthday`,
    "my-birthday": "My birthday",
    anniversary: "Our anniversary",
    wedding: "Wedding anniversary",
    other: "Special day",
  })[id];

function addHours(t: string, h: number) {
  const [hh, mm] = t.split(":").map(Number);
  return `${String(Math.min(23, hh + h)).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return <button role="switch" aria-checked={on} className={"toggle" + (on ? " on" : "")} onClick={() => set(!on)}><i /></button>;
}
