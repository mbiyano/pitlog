# PitLog UX system

This document is the source of truth for new UI work in `browser-app/`. It complements the product and engineering context; when a pattern here conflicts with an implemented domain invariant, the domain invariant wins.

## Product principles

1. **Fast in a workshop.** The primary action and current status must be obvious at a glance, including on a phone and with dirty hands. Prefer large targets, short labels, and progressive disclosure.
2. **Truth before reassurance.** Never show success before the operation is confirmed. Keep loading, success, partial, empty, and error states visually distinct.
3. **Recognize, do not recall.** Surface vehicle plate, customer, date, and mileage near the action that uses them. Use familiar labels instead of unexplained icons.
4. **Safe defaults.** Destructive actions are visually separated and require confirmation. A missing selection should explain what to do next.
5. **Calm density.** Workshop data can be dense, but hierarchy comes from spacing, typography, and grouping—not from many competing colors.

## Design tokens

All color usage must go through semantic CSS variables in `src/app/globals.css` and Tailwind aliases in `tailwind.config.ts`. Do not add raw `blue-*`, `green-*`, `yellow-*`, or hex values to product components.

| Token | Purpose |
| --- | --- |
| `background` / `foreground` | App canvas and primary text |
| `card` / `popover` | Elevated surfaces and menus |
| `primary` | Main action, current navigation, interactive emphasis |
| `secondary` / `muted` | Low-emphasis controls and supporting surfaces |
| `accent` | Hover/selected surface, never a status by itself |
| `success` | Persisted/completed/connected |
| `warning` | Due soon, attention required, connecting |
| `destructive` | Failure, overdue, irreversible action |
| `info` | Neutral in-progress or explanatory feedback |

PitLog currently defaults to dark mode, but both light and dark token sets must remain usable. The blue primary represents action and navigation; semantic status colors are reserved for state.

## Type, spacing, and shape

- Use the system sans stack. Plates, VINs, event IDs, and machine values use `font-mono`.
- Page title: `text-2xl sm:text-3xl`, bold, tight tracking.
- Section title: `text-lg`, semibold. Card title: usually `text-base` or `text-lg`.
- Body copy: `text-sm` with `leading-relaxed`; use `text-base` for mobile form inputs.
- Base spacing unit is 4 px. Prefer gaps of 8, 12, 16, 24, and 32 px.
- Interactive controls are at least 44 px high (`h-11`) unless they are clearly secondary dense controls.
- Cards and dialogs use `rounded-xl`; form controls and buttons use `rounded-lg`.

## Component rules

### Buttons

- One primary action per section. Supporting actions use `outline` or `ghost`.
- Icon-only buttons require an `aria-label` and a tooltip when the meaning is not universal.
- Loading actions keep their label, add a spinner, use `aria-busy`, and remain disabled until completion.
- Mobile header actions should fill the available width when that improves tap accuracy.

### Forms

- Compose each control with `Field`, `Label`, optional `FieldHint`, and `FieldError`.
- Labels are always visible; placeholders are examples, never replacements for labels.
- Connect errors with `aria-invalid` and `aria-describedby`. Errors use `role="alert"`.
- Group related fields in a responsive grid. Required fields use `*`; explain optional or unfamiliar data.
- Preserve entered data after recoverable failures.

### Cards and lists

- Use cards for grouped information, not every line of content.
- Navigable rows use the global `interactive-row` class so hover, keyboard focus, border, and motion remain consistent.
- Empty states use `EmptyState` and explain both what happened and the next useful action.
- Use `StatCard` tones sparingly: primary for neutral counts, success for healthy state, warning for attention.

### Feedback

- Inline `Alert` is for feedback needed to finish the current task.
- Toasts confirm background or completed actions and must include a useful description on errors.
- Status badges use singular labels for individual records and semantic tokens.
- Search must expose loading, error, empty, and results states. Debounce remote search by roughly 250–350 ms and ignore stale responses.

### Navigation and responsive behavior

- Every page uses `PageHeader`; `eyebrow` communicates the parent area, while the title names the current object or task.
- The main navigation uses `aria-current="page"`. Mobile drawers support Escape, an overlay close target, and explicit expanded state.
- Data-backed route segments must provide a `loading.tsx` fallback built from `Skeleton`. Navigation feedback appears immediately while the previous screen remains interactive, and skeleton geometry should approximate the incoming page without inventing data.
- Test at 320, 375, 768, 1024, and 1440 px. No primary action may require horizontal scrolling.
- Technical/debug information uses progressive disclosure and must not compete with the main workflow.

## Accessibility baseline

- Meet WCAG 2.2 AA contrast for text and controls.
- Keyboard focus must always be visible. Never remove focus styles without an equivalent replacement.
- Decorative icons use `aria-hidden="true"`; icon-only controls have an accessible name.
- Respect `prefers-reduced-motion` and never communicate status through color alone.
- Use native elements first (`button`, `a`, `label`, `details`, headings) and preserve a logical heading order.
- Dates shown without time use local parsing (`parseISO` for database `YYYY-MM-DD`) to avoid timezone drift.

## New-component checklist

- Does it use semantic tokens rather than raw colors?
- Is the primary action unambiguous and at least 44 px high?
- Are loading, error, empty, disabled, and success states handled?
- Does it work with keyboard only and expose names/states to assistive technology?
- Does it fit at 320 px without truncating the only copy of important data?
- Are dates, plates, mileage, and destructive actions formatted consistently?
- Can an existing primitive or shared component solve the problem first?
- If the component introduces a new reusable pattern, is this document updated?

## Reference implementations

- Navigation shell: `src/components/layout/sidebar.tsx`
- Page hierarchy: `src/components/layout/page-header.tsx`
- Form composition: `src/components/forms/customer-form.tsx`
- Search behavior: `src/app/(app)/dashboard/quick-search.tsx`
- Long workflow: `src/app/(app)/servicio/nuevo/page.tsx`
- Progressive disclosure and voice state: `src/features/voice/components/voice-console.tsx`
- Route transition feedback: `src/app/(app)/loading.tsx`
