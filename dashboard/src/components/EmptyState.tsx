import type { ElementType } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from './ui/utils'
import { CopyButton } from './CopyButton'

/**
 * EmptyState — icon, one line of explanation, and the exact CLI command that
 * fills the view. An empty screen that does not say how to un-empty it is a
 * dead end, so `command` is part of the primitive rather than an afterthought.
 */
interface EmptyStateProps {
  icon?: ElementType
  title: string
  description?: string
  /** The exact command that produces data here, e.g. `cwctl scan .`. */
  command?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  command,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex w-full flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <Icon size={28} className="text-text-muted" aria-hidden="true" />
      <div>
        <p className="m-0 text-[0.82rem] font-semibold text-text-primary">{title}</p>
        {description && (
          <p className="m-0 mt-1 text-[0.74rem] leading-relaxed text-text-muted">{description}</p>
        )}
      </div>
      {command && (
        <div className="flex max-w-full items-center gap-2 rounded border border-border-color bg-bg-base px-2.5 py-1.5">
          <code className="overflow-x-auto whitespace-nowrap font-mono text-[0.72rem] text-text-primary">
            {command}
          </code>
          <CopyButton text={command} label="" className="shrink-0 border-0 bg-transparent px-1 py-0.5" />
        </div>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="wd-hover rounded bg-primary px-3.5 py-1.5 text-[0.78rem] font-medium text-white hover:opacity-90" >
          {action.label}
        </button>
      )}
    </div>
  )
}
