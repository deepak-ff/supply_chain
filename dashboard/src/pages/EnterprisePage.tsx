import { ArrowRight, Github, Wrench, LifeBuoy, Blocks } from 'lucide-react';
import { TopoBackground } from '../components/TopoBackground';

const GITHUB_URL = 'https://github.com/deepak-ff/supply_chain';

const OFFERS = [
  {
    icon: Wrench,
    title: 'Breach & install',
    desc: 'Deploy the Warden into your environment, wire it into existing auth and CI, and forge policy-as-code for your ecosystems.',
  },
  {
    icon: LifeBuoy,
    title: 'Hold the perimeter',
    desc: 'Ongoing watch over self-hosted deployments — upgrades, monitoring and breach response, while your crew keeps shipping.',
  },
  {
    icon: Blocks,
    title: 'Forge custom arms',
    desc: 'Custom uplinks, workflow automation and architecture support built on the open-core engine.',
  },
];

const ENGAGEMENT_STEPS = [
  { step: '1', title: 'Open a channel',   desc: 'Tell us about your terrain, your ecosystems, and what you need the Warden to do that it doesn’t out of the box.' },
  { step: '2', title: 'Scope the breach', desc: 'We map your ask onto the engine’s real capabilities — what’s a config flip, what’s custom forge-work.' },
  { step: '3', title: 'Breach & hold',    desc: 'We implement, deploy and hand over the keys — or keep holding the perimeter, your call.' },
];

interface EnterprisePageProps {
  onNavigateHome: () => void;
}

export function EnterprisePage({ onNavigateHome }: EnterprisePageProps) {
  return (
    <div className="min-h-screen text-text-primary">
      <nav className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border-color bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-4 py-3.5 backdrop-blur-md sm:px-6">
        <button type="button" onClick={onNavigateHome} className="wd-hover flex min-w-0 shrink items-center gap-2.5 border-none bg-transparent">
          <img src="/logo-icon.png" alt="ChainWarden" className="shrink-0" style={{ height: 36, objectFit: 'contain' }} />
          <span className="whitespace-nowrap text-[1.05rem] font-semibold tracking-tight text-text-primary">ChainWarden</span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="wd-hover flex items-center gap-1.5 rounded border border-border-color px-2.5 py-1.5 text-sm font-medium text-text-primary hover:border-neon hover:text-neon sm:px-3.5"
          >
            <Github size={14} /> <span className="hidden sm:inline">GitHub</span>
          </a>
          <button
            type="button"
            onClick={onNavigateHome}
            className="wd-hover whitespace-nowrap rounded border border-border-color bg-surface px-3 py-1.5 text-sm font-medium text-text-primary hover:border-neon hover:text-neon sm:px-4"
          >
            <span className="sm:hidden">Home</span>
            <span className="hidden sm:inline">Back to home</span>
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-16 pt-20 text-center">
        <TopoBackground className="text-text-primary" opacity={0.05} lines={10} />
        <div className="relative z-10 mx-auto max-w-3xl">
          <p className="mb-4 font-mono text-[0.7rem] font-bold uppercase tracking-[0.22em] text-text-muted">
            <span className="text-neon drop-shadow-[0_0_6px_var(--neon)]">X-02</span>
            <span className="mx-2 text-border-color">/</span>
            archives // command tier
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-text-primary sm:text-5xl">
            Work with us <span className="text-neon drop-shadow-[0_0_12px_var(--neon)]">directly.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-text-secondary">
            Beyond the open-source blade and the Pro tier, we deploy, run and extend
            the Warden inside your own perimeter — breach, hold, and forge custom arms
            on the open-core engine.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`${GITHUB_URL}/issues/new?title=Enterprise%20inquiry&labels=enterprise`}
              target="_blank"
              rel="noreferrer"
              className="wd-hover flex items-center gap-2 rounded bg-neon px-6 py-2.5 font-mono text-sm font-bold uppercase tracking-widest text-void hover:shadow-glow"
            >
              Open a channel <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* Offers */}
      <section className="border-t border-border-color bg-surface px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-text-primary">What we hold for you</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {OFFERS.map(o => (
              <div key={o.title} className="cw-brackets cyber-panel rounded border border-border-color p-6">
                <o.icon size={20} className="text-neon drop-shadow-[0_0_8px_var(--neon)]" />
                <h3 className="mt-3 font-mono text-sm font-bold uppercase tracking-widest text-text-primary">{o.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{o.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How engagement works */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-text-primary">The breach protocol</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {ENGAGEMENT_STEPS.map(s => (
              <div key={s.step} className="text-center">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-neon font-mono text-sm font-bold text-void shadow-glow">
                  {s.step}
                </div>
                <h3 className="mt-3 font-mono text-sm font-bold uppercase tracking-widest text-text-primary">{s.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-xl text-center font-mono text-xs text-text-muted">
            {'// direct engagement, not self-serve — no signup form. Open an issue and we scope it with you.'}
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border-color bg-bg-base px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-text-primary">Let's talk about your perimeter.</h2>
        <a
          href={`${GITHUB_URL}/issues/new?title=Enterprise%20inquiry&labels=enterprise`}
          target="_blank"
          rel="noreferrer"
          className="wd-hover mt-6 inline-flex items-center gap-2 rounded bg-magenta px-6 py-2.5 font-mono text-sm font-bold uppercase tracking-widest text-void hover:shadow-glow"
        >
          Open a channel <ArrowRight size={14} />
        </a>
      </section>

      <footer className="border-t border-border-color px-6 py-8 text-center text-xs text-text-muted">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} ChainWarden — Apache 2.0 Licensed</span>
          <div className="flex gap-4">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-neon">GitHub</a>
            <button type="button" onClick={onNavigateHome} className="cursor-pointer border-none bg-transparent hover:text-neon">Home</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
