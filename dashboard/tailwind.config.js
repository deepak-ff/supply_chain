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
        safe: 'var(--success)',
        warn: 'var(--warning)',
        critical: 'var(--critical)',
        surface: 'var(--surface)',
        elevated: 'var(--surface-muted)',
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
        amber: 'var(--amber)',
        'accent-soft': 'var(--accent-soft)',
        teal: 'var(--teal)',
        'ring-soft': 'var(--ring-soft)',
        skeleton: 'var(--skeleton)',
        'row-hover': 'var(--row-hover)',
        'chart-1': 'var(--chart-1)',
        'chart-2': 'var(--chart-2)',
        'chart-3': 'var(--chart-3)',
        // ── NEON SENTRY cyber tokens ──
        neon: 'var(--neon)',
        magenta: 'var(--magenta)',
        lime: 'var(--lime)',
        void: 'var(--bg-base)',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // NOTE: `primary` reads the hex `--primary` token directly (not an
        // `hsl(var(--…))` triplet) so plain-CSS `var(--primary)` uses and
        // Tailwind utilities resolve to the same value. Opacity modifiers
        // (e.g. `bg-primary/10`) do NOT work on var() colors in Tailwind v3
        // — use `bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]`.
        primary: {
          DEFAULT: 'var(--primary)',
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
        card: 'var(--shadow-card)',
        glow: 'var(--shadow-glow)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius)',
        md: 'var(--radius)',
        sm: 'calc(var(--radius) - 2px)',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SF Mono', 'Cascadia Mono', 'Roboto Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
