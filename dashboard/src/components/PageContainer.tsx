import { cn } from './ui/utils'

/**
 * PageContainer — the shared page frame.
 *
 *   max-width 1400px · 24px gutters · 20px vertical rhythm
 *
 * Every routed page renders inside exactly one of these, so page-to-page
 * spacing is a property of the shell rather than something each page has to
 * remember to get right.
 */
export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[var(--page-max-w)] px-[var(--page-gutter)] py-[var(--page-rhythm)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
