import { memo } from "react";
import { SHORTCUTS } from "@/lib/studio/shortcuts";
import type { AppComponentProps } from "@/components/studio/apps";

function ShortcutsApp(_: AppComponentProps) {
  return (
    <dl className="divide-y divide-white/[0.05] p-4">
      {SHORTCUTS.map((s) => (
        <div key={s.label} className="flex items-center justify-between gap-4 py-2.5">
          <dt className="font-body text-sm text-ink/90">{s.label}</dt>
          <dd className="flex gap-1">
            {s.keys.map((k) => (
              <kbd key={k} className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-muted">
                {k}
              </kbd>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default memo(ShortcutsApp);
