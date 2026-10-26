import { useMemo, useState } from "react";
import Form, { Toggle, labelFor } from "./Form";
import { KIND_META, LEAD_OPTIONS, type Item, type Kind } from "./model";
import { BUCKETS, bucketOf, daysBetween, fmtDate, fmtTime, occurrence, relative, yearsSince } from "./dates";
import { useStore } from "./store";
import { requestPermission, useNotifier } from "./notify";

type Tab = "upcoming" | "dates" | "settings";
type Filter = "all" | Kind;

export default function App() {
  const { items, settings, setSettings, upsert, remove, toggleDone } = useStore();
  const { permission, setPermission } = useNotifier(items, settings);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [editing, setEditing] = useState<{ item?: Item; kind?: Kind } | null>(null);
  const [open, setOpen] = useState<Item | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [toast, setToast] = useState("");

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  };

  if (!settings.onboarded)
    return (
      <Onboarding
        permission={permission}
        onDone={async (name, ask) => {
          if (ask) setPermission(await requestPermission());
          setSettings({ ...settings, partnerName: name.trim(), onboarded: true });
        }}
      />
    );

  const save = (list: Item[]) => {
    const wasEdit = !!editing?.item;
    list.forEach(upsert);
    setEditing(null);
    setOpen(null);
    flash(wasEdit ? "Changes saved" : list.length > 1 ? "Saved, with a check-in reminder" : "Reminder saved");
  };

  return (
    <div className="app">
      <main>
        {tab === "upcoming" && (
          <Upcoming items={items} filter={filter} setFilter={setFilter} onOpen={setOpen} onDone={toggleDone} permission={permission} goSettings={() => setTab("settings")} onAdd={() => setEditing({})} />
        )}
        {tab === "dates" && <Dates items={items} name={settings.partnerName} onOpen={setOpen} onAdd={() => setEditing({ kind: "date" })} />}
        {tab === "settings" && (
          <Settings
            settings={settings} setSettings={setSettings} permission={permission}
            ask={async () => setPermission(await requestPermission())}
            clearAll={() => { if (confirm("Delete everything saved on this device?")) { items.forEach((i) => remove(i.id)); flash("All cleared"); } }}
          />
        )}
      </main>

      <button className="fab" aria-label="Add" onClick={() => setEditing({ kind: tab === "dates" ? "date" : undefined })}>＋</button>

      <nav className="tabbar">
        {([["upcoming", "Upcoming", "🗓️"], ["dates", "Dates", "💞"], ["settings", "Settings", "⚙️"]] as const).map(([id, label, e]) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}><span>{e}</span>{label}</button>
        ))}
      </nav>

      {open && !editing && (
        <Detail
          item={open} name={settings.partnerName} onClose={() => setOpen(null)}
          onEdit={() => setEditing({ item: open })}
          onDone={() => { toggleDone(open.id); setOpen(null); }}
          onDelete={() => { remove(open.id); setOpen(null); flash("Deleted"); }}
        />
      )}
      {editing && (
        <Form initial={editing.item} defaultKind={editing.kind} partnerName={settings.partnerName} onSave={save} onClose={() => setEditing(null)} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

/* ---------- Onboarding (notification pre-prompt pattern: explain value before the system dialog) ---------- */
function Onboarding({ permission, onDone }: { permission: string; onDone: (name: string, ask: boolean) => void }) {
  const [name, setName] = useState("");
  const canAsk = permission === "default";
  return (
    <div className="onboard">
      <div className="hero-mark">♥</div>
      <h1>Remember what matters.</h1>
      <p>Save the dates, promises and little things your partner mentions. We'll nudge you at the right time, so you can show up.</p>
      <label className="field">
        <span>Who are you remembering for? <em>optional</em></span>
        <input placeholder="Their name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <ul className="perks">
        <li>🎂 Birthdays &amp; anniversaries, repeated every year</li>
        <li>⏰ Early heads-up to plan gifts and surprises</li>
        <li>🔒 Stays on your device. No account needed</li>
      </ul>
      <button className="pill primary big" onClick={() => onDone(name, canAsk)}>{canAsk ? "Turn on reminders" : "Get started"}</button>
      {canAsk && <button className="link" onClick={() => onDone(name, false)}>Not now</button>}
    </div>
  );
}

/* ---------- Upcoming ---------- */
function Upcoming(p: {
  items: Item[]; filter: Filter; setFilter: (f: Filter) => void; onOpen: (i: Item) => void; onDone: (id: string) => void;
  permission: string; goSettings: () => void; onAdd: () => void;
}) {
  const now = new Date();
  const visible = p.items.filter((i) => p.filter === "all" || i.kind === p.filter);
  const pending = visible.filter((i) => !i.done).sort((a, b) => +occurrence(a) - +occurrence(b));
  const done = visible.filter((i) => i.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  const next = p.items.filter((i) => !i.done).sort((a, b) => +occurrence(a) - +occurrence(b)).find((i) => daysBetween(now, occurrence(i)) >= 0);
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => {
    const g = new Map<string, Item[]>();
    BUCKETS.forEach((b) => g.set(b, []));
    pending.forEach((i) => g.get(bucketOf(i))!.push(i));
    return g;
  }, [pending]);

  return (
    <>
      <header className="top"><h1>Upcoming</h1></header>

      {p.permission !== "granted" && p.permission !== "unsupported" && (
        <button className="banner" onClick={p.goSettings}>
          🔕 {p.permission === "denied" ? "Notifications are blocked. Tap to see how to fix it" : "Notifications are off. Tap to turn them on"}
        </button>
      )}
      {p.permission === "unsupported" && <div className="banner static">This browser can't show notifications. Add the app to your Home Screen on iPhone (iOS 16.4+).</div>}

      {next && p.filter === "all" && (
        <button className="next-card" onClick={() => p.onOpen(next)}>
          <small>Next up</small>
          <strong>{next.title}</strong>
          <span>{relative(next)} · {fmtDate(occurrence(next))}{next.time ? ` · ${fmtTime(next.time)}` : ""}</span>
        </button>
      )}

      <div className="chips scroll">
        {(["all", ...Object.keys(KIND_META)] as Filter[]).map((f) => (
          <button key={f} className={"chip" + (p.filter === f ? " on" : "")} onClick={() => p.setFilter(f)}>
            {f === "all" ? "All" : `${KIND_META[f].emoji} ${KIND_META[f].label}`}
          </button>
        ))}
      </div>

      {p.items.length === 0 ? (
        <div className="empty">
          <div>🌷</div><h3>Nothing to remember yet</h3>
          <p>Start with a date that matters. An anniversary or birthday.</p>
          <button className="pill primary" onClick={p.onAdd}>Add a reminder</button>
        </div>
      ) : pending.length === 0 ? (
        <div className="empty"><div>✨</div><h3>You're all caught up</h3></div>
      ) : (
        BUCKETS.map((b) => groups.get(b)!.length > 0 && (
          <section key={b}>
            <h2 className={"group" + (b === "Overdue" ? " overdue" : "")}>{b}</h2>
            <ul className="list">{groups.get(b)!.map((i) => <Row key={i.id} item={i} onOpen={p.onOpen} onDone={p.onDone} overdue={b === "Overdue"} />)}</ul>
          </section>
        ))
      )}

      {done.length > 0 && (
        <section>
          <button className="group toggle-group" onClick={() => setShowDone(!showDone)}>Completed ({done.length}) {showDone ? "▾" : "▸"}</button>
          {showDone && <ul className="list">{done.map((i) => <Row key={i.id} item={i} onOpen={p.onOpen} onDone={p.onDone} />)}</ul>}
        </section>
      )}
      <div className="spacer" />
    </>
  );
}

function Row({ item, onOpen, onDone, overdue }: { item: Item; onOpen: (i: Item) => void; onDone: (id: string) => void; overdue?: boolean }) {
  const occ = occurrence(item);
  return (
    <li className={"row-item" + (item.done ? " done" : "")}>
      <button className={"check" + (item.done ? " on" : "")} aria-label={item.done ? "Mark as not done" : "Mark as done"} onClick={() => onDone(item.id)}>{item.done ? "✓" : ""}</button>
      <button className="row-main" onClick={() => onOpen(item)}>
        <strong>{item.title}</strong>
        <span className={overdue ? "overdue" : ""}>
          {KIND_META[item.kind].emoji} {fmtDate(occ)}{item.time ? ` · ${fmtTime(item.time)}` : ""}{item.yearly ? " · yearly" : ""}
        </span>
      </button>
    </li>
  );
}

/* ---------- Dates ---------- */
function Dates({ items, name, onOpen, onAdd }: { items: Item[]; name: string; onOpen: (i: Item) => void; onAdd: () => void }) {
  const now = new Date();
  const dates = items.filter((i) => i.kind === "date").sort((a, b) => +occurrence(a) - +occurrence(b));
  return (
    <>
      <header className="top"><h1>Important dates</h1><p>{name ? `Everything that matters for you and ${name}.` : "Everything that matters to you both."}</p></header>
      {dates.length === 0 && (
        <div className="empty"><div>💞</div><h3>No dates saved</h3><p>Birthdays and anniversaries repeat automatically every year.</p></div>
      )}
      <div className="date-cards">
        {dates.map((d) => {
          const occ = occurrence(d);
          const n = daysBetween(now, occ);
          const yrs = yearsSince(d, occ);
          return (
            <button key={d.id} className="date-card" onClick={() => onOpen(d)}>
              <div className="cal"><small>{occ.toLocaleDateString(undefined, { month: "short" })}</small><b>{occ.getDate()}</b></div>
              <div className="meta">
                <strong>{d.title}</strong>
                <span>{n === 0 ? "Today 🎉" : n === 1 ? "Tomorrow" : `In ${n} days`}{yrs > 0 && d.yearly ? ` · year ${yrs}` : ""}</span>
              </div>
            </button>
          );
        })}
      </div>
      <button className="pill primary wide" onClick={onAdd}>＋ Add an important date</button>
      <div className="spacer" />
    </>
  );
}

/* ---------- Detail (countdown + edit/delete) ---------- */
function Detail(p: { item: Item; name: string; onClose: () => void; onEdit: () => void; onDone: () => void; onDelete: () => void }) {
  const occ = occurrence(p.item);
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <div className="sheet-wrap" onClick={p.onClose}>
      <div className="sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <small className="muted">{KIND_META[p.item.kind].emoji} {KIND_META[p.item.kind].label}{p.item.dateType ? ` · ${labelFor(p.item.dateType, p.name || "them")}` : ""}</small>
        <h2 className="detail-title">{p.item.title}</h2>
        <p className="muted">{fmtDate(occ)}{p.item.time ? ` · ${fmtTime(p.item.time)}` : ""}{p.item.yearly ? " · repeats yearly" : ""}</p>
        <div className="countdown">{p.item.done ? "Completed ✓" : relative(p.item)}</div>
        {p.item.notes && <p className="notes-read">{p.item.notes}</p>}
        <p className="muted small">Notifies: {p.item.leadDays.map((d) => LEAD_OPTIONS.find((o) => o.days === d)?.label ?? `${d}d before`).join(", ")}</p>
        <div className="actions">
          <button className="pill" onClick={p.onDone}>{p.item.done ? "Mark as not done" : "Mark done"}</button>
          <button className="pill" onClick={p.onEdit}>Edit</button>
        </div>
        {confirmDel ? (
          <div className="actions"><button className="pill danger" onClick={p.onDelete}>Yes, delete</button><button className="pill" onClick={() => setConfirmDel(false)}>Keep it</button></div>
        ) : (
          <button className="link danger" onClick={() => setConfirmDel(true)}>Delete</button>
        )}
      </div>
    </div>
  );
}

/* ---------- Settings ---------- */
function Settings(p: {
  settings: ReturnType<typeof useStore>["settings"]; setSettings: (s: ReturnType<typeof useStore>["settings"]) => void;
  permission: string; ask: () => void; clearAll: () => void;
}) {
  const s = p.settings;
  return (
    <>
      <header className="top"><h1>Settings</h1></header>
      <p className="label">Notifications</p>
      <div className="card-group">
        <div className="row">
          <span>Status</span>
          <b>{p.permission === "granted" ? "On" : p.permission === "denied" ? "Blocked" : p.permission === "unsupported" ? "Unsupported" : "Off"}</b>
        </div>
        {p.permission === "default" && <button className="row action" onClick={p.ask}>Turn on notifications</button>}
        {p.permission === "denied" && <p className="hint">Notifications are blocked for this site. Re-enable them in your browser or phone settings, then reopen the app.</p>}
        <label className="row"><span>All-day alerts at</span><input type="time" value={s.defaultTime} onChange={(e) => p.setSettings({ ...s, defaultTime: e.target.value || "09:00" })} /></label>
        <label className="row"><span>Hide details in notifications</span><Toggle on={s.hidePreviews} set={(v) => p.setSettings({ ...s, hidePreviews: v })} /></label>
      </div>
      <p className="hint">Alerts fire while the app is open or installed to your Home Screen and reopened. True background push needs a server (planned).</p>
      <p className="label">You</p>
      <div className="card-group">
        <label className="row"><span>Partner's name</span><input className="right" value={s.partnerName} placeholder="Optional" onChange={(e) => p.setSettings({ ...s, partnerName: e.target.value })} /></label>
      </div>
      <p className="label">Privacy</p>
      <div className="card-group"><button className="row action danger" onClick={p.clearAll}>Delete all my data</button></div>
      <p className="hint">Everything is stored only on this device. No account, no tracking.</p>
      <div className="spacer" />
    </>
  );
}
