"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/app/ui";
import { errorMessage } from "@/lib/client-api";
import { PROJECT_STAGES, STAGE_LABEL } from "@/lib/projects-shared";
import { projectQuery, useProjectStage } from "@/lib/queries/projects";

/** Where the project is, from first idea to release; any member moves it along. */
export default function StageStepper({ userId, projectId }: { userId: string; projectId: string }) {
  const p = useQuery(projectQuery(userId, projectId)).data;
  const change = useProjectStage(userId, projectId);
  if (!p) return null;
  const at = PROJECT_STAGES.indexOf(p.stage);
  return (
    <div className="space-y-2">
      <ol className="flex flex-wrap items-center gap-1" aria-label="Project progress">
        {PROJECT_STAGES.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <button
              type="button"
              aria-current={s === p.stage ? "step" : undefined}
              onClick={() => change.mutate({ stage: s })}
              className={`focus-ring h-8 rounded-full border px-3 font-body text-xs ${i < at ? "border-signal/40 bg-signal/10 text-signal" : s === p.stage ? "border-copper/60 bg-copper/15 text-ink" : "border-line text-muted hover:text-ink"}`}
            >
              {i < at ? "✓ " : ""}{STAGE_LABEL[s]}
            </button>
            {i < PROJECT_STAGES.length - 1 && <span aria-hidden className={`h-px w-3 ${i < at ? "bg-signal/60" : "bg-line-strong"}`} />}
          </li>
        ))}
        <li className="ml-auto">
          {p.completedAt ? (
            <span className="flex items-center gap-2 font-body text-xs text-signal">Finished <Button size="sm" variant="ghost" onClick={() => change.mutate({ finished: false })}>Reopen</Button></span>
          ) : <Button size="sm" variant="ghost" onClick={() => change.mutate({ stage: "RELEASED", finished: true })}>Mark finished</Button>}
        </li>
      </ol>
      {!p.stageSet && <p className="font-body text-[11px] text-muted">Suggested from what&apos;s in the project; pick the stage that fits.</p>}
      {change.error && <p role="alert" className="font-body text-sm text-danger">{errorMessage(change.error)}</p>}
    </div>
  );
}
