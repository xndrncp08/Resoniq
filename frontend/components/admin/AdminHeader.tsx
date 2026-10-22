import type { ReactNode } from "react";

export default function AdminHeader({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b hairline pb-5">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {children && <p className="mt-1 max-w-2xl font-body text-sm text-muted">{children}</p>}
      </div>
      {actions}
    </header>
  );
}
