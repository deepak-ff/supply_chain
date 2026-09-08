import * as React from 'react'
import { cn } from './utils'

/**
 * Card — the one surface primitive.
 *
 * One border (1px var(--border-color)), one shadow (var(--shadow-card)),
 * one radius (4px via Tailwind's `rounded`), in both themes. Nothing else in
 * the app should hand-roll `rounded-xl border ... bg-surface shadow-sm`.
 *
 *   <Card>
 *     <CardHeader title="Ledger" description="…" action={<button/>} />
 *     <CardBody>…</CardBody>
 *     <CardFooter>…</CardFooter>
 *   </Card>
 */

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('cw-brackets cyber-panel rounded border border-border-color shadow-card', className)}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  icon?: React.ElementType
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, description, action, icon: Icon, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-start justify-between gap-3 border-b border-border-color px-4 py-3', className)}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-2">
        {Icon && <Icon size={16} className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true" />}
        <div className="min-w-0">
          {title && (
            <h3 className="m-0 truncate font-mono text-[0.72rem] font-semibold uppercase tracking-wide text-text-primary">{title}</h3>
          )}
          {description && (
            <p className="m-0 mt-0.5 text-[0.72rem] leading-snug text-text-muted">{description}</p>
          )}
          {children}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  ),
)
CardHeader.displayName = 'CardHeader'

const CardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-4 py-3', className)} {...props} />
  ),
)
CardBody.displayName = 'CardBody'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-between gap-3 border-t border-border-color px-4 py-3 text-[0.72rem] text-text-muted',
        className,
      )}
      {...props}
    />
  ),
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardBody, CardFooter }
