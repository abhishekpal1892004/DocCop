# MediBook – Editorial Design System

## 1. Design Tokens (`frontend/src/index.css`)
- `--bg-ivory: #faf7f2`
- `--bg-beige: #f3efe6`
- `--bg-surface: #ffffff`
- `--bg-charcoal: #1c1917`
- `--text-ink: #1c1917`
- `--text-muted: #57534e`
- `--accent-forest: #1b4332`
- `--accent-forest-hover: #143326`
- `--border-stone: #e6e0d4`

## 2. Typography Scale
- `.font-editorial`: `Cormorant Garamond`, Georgia, serif — used for `h1` hero/page titles and section statements.
- Body & UI: `Inter`, system sans-serif — used for navigation, tables, forms, and clinical data.

## 3. Component Standards (`frontend/src/components/ui/`)
- **Buttons:** Refined rectangular geometry (`rounded-md`), crisp `1px` borders, clear forest-green primary (`#1B4332`) and charcoal outline variants.
- **Cards & Tables:** Flat architectural surfaces (`border-stone-200`, `rounded-lg`, minimal shadow), clean `1px` dividers.
- **Status Badges:** Muted natural tones paired with icons and explicit text labels (never color-only).
- **Accessibility:** WCAG 2.2 AA contrast, `focus-visible` forest-green outline, skip-to-content link, `prefers-reduced-motion` support.
