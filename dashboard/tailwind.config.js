/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './src/components/ui/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Legacy dark-theme aliases — now point at the new CSS vars so any
        // remaining `bg-safe`/`bg-critical` utility usages stay coherent.
        safe: 'var(--success)',
        warn: 'var(--warning)',
        critical: 'var(--critical)',
        surface: 'var(--surface)',
        elevated: 'var(--surface-muted)',
        // New semantic tokens for the "Technical Security OS" design system —
        // use these Tailwind utilities (bg-primary-blue, text-text-secondary,
        // border-border-color, etc.) in new components going forward instead
        // of inline style={{}} objects.
        'bg-base': 'var(--bg-base)',
        'surface-muted': 'var(--surface-muted)',
        'border-color': 'var(--border-color)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'primary-blue': 'var(--primary-blue)',
        'blue-light': 'var(--blue-light)',
        cyan: 'var(--cyan)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        // Component-layer tokens (see src/index.css). Prefer these over
        // inline style={{}} objects — they are dark-mode aware by construction.
        // NOTE: `primary` is intentionally not redefined here; the shadcn
        // `primary` entry below already resolves to hsl(var(--primary)) = the
        // Warden violet in both themes.
        amber: 'var(--amber)',
        'accent-soft': 'var(--accent-soft)',
        teal: 'var(--teal)',
        'ring-soft': 'var(--ring-soft)',
        skeleton: 'var(--skeleton)',
        'row-hover': 'var(--row-hover)',
        'chart-1': 'var(--chart-1)',
        'chart-2': 'var(--chart-2)',
        'chart-3': 'var(--chart-3)',
        // shadcn/ui semantic colors (reference CSS variables)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      boxShadow: {
        // The one and only card shadow — themed per mode in index.css.
        card: 'var(--shadow-card)',
      },
      borderRadius: {
        // VIGIL "panel" corners — one soft 6px radius everywhere.
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius)',
        md: 'var(--radius)',
        sm: 'calc(var(--radius) - 2px)',
      },
      fontFamily: {
        // Local system stacks — no webfont CDN dependency (offline / airgap).
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'JetBrains Mono', 'Cascadia Mono', 'Roboto Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
