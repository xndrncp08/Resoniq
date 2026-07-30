import Image from "next/image";

export default function Footer() {
  return (
    <footer className="relative mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-col items-start justify-between gap-8 border-t border-white/5 pt-12 sm:flex-row">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Resoniq" width={28} height={28} className="rounded-lg" />
            <span className="font-display text-base font-semibold">Resoniq</span>
          </div>
          <p className="mt-3 max-w-xs font-body text-sm text-muted">
            Upload a song. Get the tone recipe behind it.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-12 font-body text-sm text-muted sm:grid-cols-3">
          <div className="space-y-2">
            <div className="font-medium text-ink">Product</div>
            <div>How it works</div>
            <div>Pricing</div>
            <div>Tone library</div>
          </div>
          <div className="space-y-2">
            <div className="font-medium text-ink">Company</div>
            <div>About</div>
            <div>Contact</div>
          </div>
          <div className="space-y-2">
            <div className="font-medium text-ink">Legal</div>
            <div>Terms</div>
            <div>Privacy</div>
          </div>
        </div>
      </div>
      <p className="mt-12 font-mono text-xs text-muted/60">
        © {new Date().getFullYear()} Resoniq. Not affiliated with any amp or pedal manufacturer named in tone results.
      </p>
    </footer>
  );
}
