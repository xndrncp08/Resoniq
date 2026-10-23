"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/client-api";

type Field = { name: string; label: string; type?: "text" | "number" | "textarea" | "select" | "checkbox" | "hidden"; options?: [string, string][]; placeholder?: string; defaultValue?: string; required?: boolean; checked?: boolean };

/** A small JSON form for console create/edit actions. */
export function JsonForm({ url, method = "POST", fields, submit, transform }: { url: string; method?: string; fields: Field[]; submit: string; transform?: (v: Record<string, unknown>) => Record<string, unknown> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values: Record<string, unknown> = {};
    for (const f of fields) values[f.name] = f.type === "checkbox" ? fd.get(f.name) === "on" : fd.get(f.name);
    setBusy(true);
    setError(null);
    try {
      await api(url, { method, body: transform ? transform(values) : values });
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const cls = "panel-inset mt-1.5 w-full rounded-xl px-3 font-body text-sm outline-none focus:border-copper/60";
  return (
    <form onSubmit={onSubmit} className="panel grid gap-3 p-4 sm:grid-cols-2">
      {fields.map((f) => f.type === "hidden" ? <input key={f.name} type="hidden" name={f.name} value={f.defaultValue} /> : (
        <label key={f.name} className={`block ${f.type === "textarea" ? "sm:col-span-2" : ""} ${f.type === "checkbox" ? "flex items-center gap-2 self-end" : ""}`}>
          {f.type !== "checkbox" && <span className="label-engraved">{f.label}</span>}
          {f.type === "textarea" ? (
            <textarea name={f.name} defaultValue={f.defaultValue} placeholder={f.placeholder} rows={4} required={f.required} className={`${cls} py-2`} />
          ) : f.type === "select" ? (
            <select name={f.name} defaultValue={f.defaultValue} className={`${cls} h-10`}>{f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          ) : f.type === "checkbox" ? (
            <><input type="checkbox" name={f.name} defaultChecked={f.checked} className="accent-[var(--color-copper)]" /><span className="font-body text-sm">{f.label}</span></>
          ) : (
            <input name={f.name} type={f.type ?? "text"} defaultValue={f.defaultValue} placeholder={f.placeholder} required={f.required} className={`${cls} h-10`} />
          )}
        </label>
      ))}
      <div className="flex items-end gap-3 sm:col-span-2">
        <Button type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Saving…" : submit}</Button>
        {error && <p role="alert" className="font-body text-sm text-danger">{error}</p>}
      </div>
    </form>
  );
}

export function FlagSwitch({ flag, enabled }: { flag: string; enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={flag}
      onClick={async () => {
        setOn(!on);
        try {
          await api("/api/admin/flags", { method: "PUT", body: { key: flag, enabled: !on } });
          router.refresh();
        } catch {
          setOn(on);
        }
      }}
      className={`focus-ring relative h-7 w-12 rounded-full transition-colors ${on ? "bg-signal" : "bg-surface-3"}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-ink transition-[left] ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

export function RuleEditor({ id, kind, config, enabled }: { id: string; kind: string; config: Record<string, unknown>; enabled: boolean }) {
  const router = useRouter();
  const key = kind === "BLOCKED_TERM" ? "terms" : kind === "LINK_HOLD_NEW_ACCOUNTS" ? "hours" : kind === "MAX_MENTIONS" ? "max" : "reports";
  const initial = kind === "BLOCKED_TERM" ? ((config.terms as string[]) ?? []).join("\n") : String(config[key] ?? "");
  const [value, setValue] = useState(initial);
  const [on, setOn] = useState(enabled);
  const [msg, setMsg] = useState<string | null>(null);
  async function save(patch: Record<string, unknown>) {
    setMsg(null);
    try {
      await api(`/api/admin/rules/${id}`, { method: "PATCH", body: patch });
      setMsg("Saved");
      router.refresh();
    } catch (err) {
      setMsg(errorMessage(err));
    }
  }
  return (
    <div className="flex flex-wrap items-start gap-3">
      {kind === "BLOCKED_TERM" ? (
        <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder="One term per line" aria-label="Blocked terms" className="panel-inset w-72 rounded-xl px-3 py-2 font-mono text-xs" />
      ) : (
        <input value={value} onChange={(e) => setValue(e.target.value)} type="number" aria-label={key} className="panel-inset h-9 w-24 rounded-xl px-3 font-mono text-sm" />
      )}
      <Button size="sm" onClick={() => save({ config: { [key]: kind === "BLOCKED_TERM" ? value : Number(value) } })}>Save</Button>
      <label className="flex items-center gap-2 font-body text-sm"><input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); void save({ enabled: e.target.checked }); }} className="accent-[var(--color-copper)]" /> Enabled</label>
      {msg && <span className="font-body text-xs text-muted">{msg}</span>}
    </div>
  );
}
