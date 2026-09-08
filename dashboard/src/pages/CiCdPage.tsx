import { GitMerge } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { CyberKicker } from '../components/cyber/CyberViz';

const GH_ACTIONS = `name: Security Scan
on: [push, pull_request]
jobs:
  chainwarden:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install ChainWarden
        run: curl -sSfL https://raw.githubusercontent.com/deepak-ff/supply_chain/main/install.sh | bash
      - name: Scan dependencies
        run: cwctl scan . --ci --fail-on=high --format sarif > fg-results.sarif
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: fg-results.sarif`;

const GITLAB_CI = `chainwarden:
  image: alpine:latest
  script:
    - curl -sSfL https://raw.githubusercontent.com/deepak-ff/supply_chain/main/install.sh | bash
    - cwctl scan . --ci --fail-on=high
  artifacts:
    reports:
      sast: fg-results.json`;

const MAKEFILE = `# In your Makefile:
security:
\\tcwctl scan . --ci --fail-on=critical

security-full:
\\tcwctl scan . --verbose --format sarif > results.sarif`;

const FLAGS = [
  '--ci              # Quiet mode + SARIF output + fail-on=high',
  '--fail-on=critical # Only fail pipeline on critical findings',
  '--format sarif    # SARIF 2.1.0 for GitHub/GitLab code scanning',
  '--prod-only       # Skip dev/test dependencies',
];

export function CiCdPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="U-04" label="uplinks // pipeline sentry" />
        <div className="flex items-center gap-2.5">
          <GitMerge size={20} className="text-magenta drop-shadow-[0_0_8px_var(--magenta)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Pipeline Sentry</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              Post a sentry on every merge — break the build before the breach breaks you.
            </p>
          </div>
        </div>
      </div>

      {[
        { title: 'GitHub Actions', lang: 'yaml', code: GH_ACTIONS },
        { title: 'GitLab CI',      lang: 'yaml', code: GITLAB_CI },
        { title: 'Makefile',       lang: 'make', code: MAKEFILE },
      ].map(s => (
        <Card key={s.title} className="cyber-lift overflow-hidden">
          <CardHeader
            title={s.title}
            description="Drop-in sentry post"
            action={
              <span className="rounded border border-border-color bg-bg-base px-2 py-0.5 font-mono text-[0.64rem] font-bold uppercase tracking-widest text-magenta">
                {s.lang}
              </span>
            }
          />
          <CardBody className="p-0">
            <pre className="m-0 overflow-x-auto p-3.5 font-mono text-[0.72rem] leading-relaxed text-neon">
              {s.code}
            </pre>
          </CardBody>
        </Card>
      ))}

      <Card className="cyber-lift">
        <CardHeader title="Sentry field orders" description="Flags tuned for the pipeline" />
        <CardBody className="flex flex-col gap-2">
          {FLAGS.map(f => (
            <code key={f} className="overflow-x-auto whitespace-pre rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.74rem] text-neon">
              {f}
            </code>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
