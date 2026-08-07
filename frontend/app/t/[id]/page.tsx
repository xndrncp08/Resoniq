import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Public by design — anyone with the link can view. There's no
// per-tone visibility toggle in this build, so treat the link itself
// as the access control (same model as most "anyone with the link"
// sharing features). Don't build a tone browser/index off this route.
export default async function SharedTonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tone = await prisma.tone.findUnique({ where: { id } });
  if (!tone) notFound();

  const data = tone.data as {
    profile?: {
      amp_family?: string;
      cabinet?: string;
      pickup_position?: string;
      gain_percent?: number;
      eq?: { bass: number; mid: number; treble: number };
      effects_chain?: { name: string; confidence: number }[];
    };
  };
  const profile = data?.profile;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-20">
      <div className="glass w-full max-w-lg rounded-panel p-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
          shared tone
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold">
          {tone.name}
        </h1>

        {profile ? (
          <>
            <dl className="mt-6 space-y-3 font-body text-sm">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <dt className="text-muted">Amp</dt>
                <dd className="text-right">{profile.amp_family}</dd>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <dt className="text-muted">Cabinet</dt>
                <dd>{profile.cabinet}</dd>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <dt className="text-muted">Pickup</dt>
                <dd>{profile.pickup_position}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Gain</dt>
                <dd>{profile.gain_percent}%</dd>
              </div>
            </dl>

            {profile.effects_chain && profile.effects_chain.length > 0 && (
              <div className="mt-6">
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                  effects
                </div>
                <ul className="mt-2 space-y-1">
                  {profile.effects_chain.map((fx) => (
                    <li key={fx.name} className="font-body text-sm">
                      {fx.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="mt-4 font-body text-sm text-muted">
            No tone data available.
          </p>
        )}

        <div>
          <a
            href="/"
            className="focus-ring mt-8 block rounded-full bg-copper py-3 text-center font-body text-sm font-semibold text-bg transition hover:bg-copper/90"
          >
            Analyze your own song — free
          </a>
        </div>
      </div>
    </main>
  );
}
