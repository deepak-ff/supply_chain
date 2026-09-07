import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Loader, Lock, ShieldCheck } from 'lucide-react';
import { login } from '../lib/api';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface AuthPanelProps {
  onLoggedIn: () => void;
}

/**
 * Compact sign-in card.
 *
 * Deliberately *not* a full-viewport split screen: on the landing page auth is
 * an optional door at the side, reached from the "Sign in" link in the top
 * bar — never a form competing with the hero. Local/dev installs run with auth
 * disabled and never see this at all.
 */
export function AuthPanel({ onLoggedIn }: AuthPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: () => onLoggedIn(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || loginMutation.isPending) return;
    loginMutation.mutate();
  };

  return (
    <div className="w-full">
      <div className="mb-5 flex items-center gap-2">
        <Lock size={15} className="text-primary" aria-hidden="true" />
        <Dialog.Title className="m-0 text-[0.95rem] font-semibold text-text-primary">
          Sign in
        </Dialog.Title>
      </div>
      <Dialog.Description className="m-0 mb-5 text-[0.78rem] leading-relaxed text-text-secondary">
        Administrator access to this ChainWarden instance.
      </Dialog.Description>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label className="mb-1 block font-mono text-[0.65rem] uppercase tracking-wide text-text-muted" htmlFor="signin-email">
            Email
          </label>
          <Input
            id="signin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[0.65rem] uppercase tracking-wide text-text-muted" htmlFor="signin-password">
            Password
          </label>
          <Input
            id="signin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        {loginMutation.isError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded border border-[color-mix(in_srgb,var(--critical)_25%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-3 py-2 text-[0.74rem] text-critical"
          >
            <AlertCircle size={13} className="mt-px shrink-0" />
            {(loginMutation.error as Error).message}
          </div>
        )}

        <Button type="submit" disabled={!email || !password || loginMutation.isPending} className="mt-1">
          {loginMutation.isPending ? <Loader size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-5 rounded border border-border-color bg-bg-base px-3 py-2.5">
        <p className="m-0 font-mono text-[0.68rem] text-text-secondary">First time? Set credentials with:</p>
        <pre className="m-0 mt-1 select-all font-mono text-[0.65rem] leading-relaxed text-text-muted">
{`cwctl setup        # interactive
# or set env vars:
CW_ADMIN_EMAIL=you@example.com
CW_ADMIN_PASSWORD=your-password
CW_SESSION_SECRET=$(openssl rand -hex 32)`}
        </pre>
      </div>
    </div>
  );
}

/** Modal wrapper used by the landing page's top-bar "Sign in" link. */
export function SignInDialog({
  open,
  onOpenChange,
  onLoggedIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoggedIn: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded border border-border-color bg-surface p-6 shadow-card"
        >
          <AuthPanel onLoggedIn={onLoggedIn} />
          <Dialog.Close
            aria-label="Close"
            className="wd-hover absolute right-3 top-3 rounded border border-transparent bg-transparent p-1 text-text-muted hover:bg-surface-muted hover:text-text-primary"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
