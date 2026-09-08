import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '../components/ui/skeleton';
import { getActiveRisks } from '../lib/api';
import { Rocket, Crosshair } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { EmptyState } from '../components/EmptyState';
import { CyberKicker } from '../components/cyber/CyberViz';

const GRADE_TONE: Record<string, string> = {
  A: 'text-success drop-shadow-[0_0_6px_var(--success)]',
  B: 'text-neon drop-shadow-[0_0_6px_var(--neon)]',
  C: 'text-warning',
  D: 'text-amber',
  F: 'text-critical drop-shadow-[0_0_6px_var(--critical)]',
};

export function ProjectsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['active-risks'],
    queryFn: getActiveRisks,
    refetchInterval: 60_000,
  });

  // Group by package_name as proxy for project
  const projectMap = new Map<string, { grade: string; critical: number; total: number; ecosystem: string }>();
  for (const r of data?.risks ?? []) {
    const existing = projectMap.get(r.package_name);
    if (!existing) {
      projectMap.set(r.package_name, {
        grade: r.risk_grade,
        critical: r.top_severity === 'CRITICAL' ? r.finding_count : 0,
        total: r.finding_count,
        ecosystem: r.ecosystem,
      });
    } else {
      existing.total += r.finding_count;
      if (r.top_severity === 'CRITICAL') existing.critical += r.finding_count;
    }
  }
  const projects = Array.from(projectMap.entries())
    .sort(([, a], [, b]) => b.total - a.total);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="A-01" label="arsenal // missions" />
        <div className="flex items-center gap-2.5">
          <Rocket size={20} className="text-neon drop-shadow-[0_0_8px_var(--neon)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Missions</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              Every scanned target and its threat posture, ranked by blast size.
            </p>
          </div>
        </div>
      </div>

      <Card className="cyber-lift overflow-hidden">
        <CardHeader title="Mission roster" description={`${projects.length} target${projects.length === 1 ? '' : 's'} on the board`} />
        {isLoading ? (
          <CardBody className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardBody>
        ) : projects.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={Crosshair}
              title="No missions on the board"
              description="Probe a target and its threat posture will line up here."
              command="cwctl scan ."
            />
          </CardBody>
        ) : (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-border-color bg-bg-base">
                {['Mission', 'Ecosystem', 'Risk grade', 'Critical', 'Findings'].map(h => (
                  <th key={h} className="px-3.5 py-2.5 text-left font-mono text-[0.64rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map(([name, p], i) => (
                <tr key={name} className={i < projects.length - 1 ? 'border-b border-border-color' : undefined}>
                  <td className="px-3.5 py-2.5 font-mono text-[0.8rem] font-bold text-neon">{name}</td>
                  <td className="px-3.5 py-2.5 text-[0.74rem] text-text-muted">{p.ecosystem}</td>
                  <td className="px-3.5 py-2.5">
                    <span className={`font-mono text-[0.85rem] font-bold ${GRADE_TONE[p.grade] ?? 'text-text-primary'}`}>{p.grade}</span>
                  </td>
                  <td className={`px-3.5 py-2.5 font-mono text-[0.8rem] tabular-nums ${p.critical > 0 ? 'font-bold text-critical' : 'text-text-muted'}`}>
                    {p.critical}
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-[0.8rem] tabular-nums text-text-primary">{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
