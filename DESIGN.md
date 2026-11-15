# Rowville Eagles website — design guide

How the site looks and reads, taken from the live code. Use it when adding pages or components so new work matches what's already there.

- Tokens and global styles live in `src/app/(frontend)/styles.css`. Change colours there only: every component reads from the tokens.
- Styling is Tailwind CSS v4 utility classes, with the tokens exposed as Tailwind colours (`bg-brand`, `text-muted`, `border-line`…).
- Shared components are in `src/components/`.

## Three brands, one site

| Brand | Where | Feel | How it's switched on |
|---|---|---|---|
| **Rowville Eagles FC** (the club) | Default everywhere | Royal blue and gold from the crest, condensed sporty headings, rounded and friendly | Default `:root` tokens |
| **Rowville Foundation Academy (RFA)** | Academy pages, academy programs | Monochrome: black, grey, white and "gloss black"; sharp square corners; spaced-out uppercase labels | `data-brand="academy"` on a wrapper restyles everything inside it. `data-page-brand="academy"` anywhere on the page also turns the shared header and footer black and swaps the club wordmark for the RFA logo |
| **Foundation+** (player development app) | `/foundation-plus` and its pages | Monochrome ink `#0B0B0C` and white, italic Chakra Petch headings | `data-page-brand="fplus"` on the page; `.fp-*` classes for type and surfaces |

The home page has a toggle ("One club, two pathways") that previews both club and academy looks.

## Colour

### Club tokens (`:root`)

| Token | Hex | Tailwind | Use |
|---|---|---|---|
| `--brand` | `#1d4888` | `bg-brand`, `text-brand` | Eagles royal blue: secondary buttons, toggles, links on hover |
| `--brand-deep` | `#0f2a55` | `bg-brand-deep` | Header, hero and footer backgrounds |
| `--accent` | `#f1cb22` | `bg-accent`, `text-accent` | Eagles gold: main call-to-action buttons, eyebrows, focus rings, card hover borders |
| `--accent-ink` | `#141000` | `text-accent-ink` | Text on gold |
| `--red` | `#ca272c` | — | Crest red. Use sparingly |
| `--surface` | `#ffffff` | `bg-surface` | Page and card background |
| `--surface-2` | `#f3f5f9` | `bg-surface-2` | Fieldsets, quiet panels, chips |
| `--ink` | `#0d1424` | `text-ink` | Body text |
| `--muted` | `#5b6577` | `text-muted` | Secondary text, hints, labels |
| `--line` | `#e1e5ed` | `border-line` | Borders and dividers |

### Academy tokens (`[data-brand='academy']`)

The same token names are remapped, so components need no special colours:

- brand and brand-deep `#000000`;
- accent `#ffffff` with accent-ink `#000000`, so gold buttons become white buttons with black text;
- surface `#000000`, surface-2 `#0c0c0d`, ink `#ffffff`, muted `#8e9096`, line `#222225`.

### Rules

- Gold is for the **one main action** on a screen and for small highlights (eyebrows, the "Join" nav link). Don't use it for large areas of text.
- On blue backgrounds, use white text with opacity for hierarchy: `text-white/75` for intros, `/60` for small print, `border-white/10–30`.
- Attention badges use Tailwind `bg-red-600` with white text.
- Never hard-code a colour that a token already covers. The exceptions already in the code are the header and hero blues (`#0f2a55`, `#1d4888`), which match `--brand-deep` and `--brand`.

## Typography

Fonts load with `next/font/google` in `src/app/(frontend)/layout.tsx`. Chakra Petch is in `src/lib/fonts.ts` and loads only where it's used.

| Font | Variable | Used for |
|---|---|---|
| **Inter** | `--font-inter` → `font-sans` | All body text, forms and tables |
| **Barlow Condensed** (600/700/800) | `--font-barlow` → `font-display` (club) | Club headings, hero, stats, card titles, panel titles |
| **Space Grotesk** (400–700) | `--font-grotesk` → `font-display` (academy) | Academy headings; it replaces Barlow inside `data-brand="academy"` automatically |
| **Chakra Petch** (600/700, italic) | `--font-chakra` | Foundation+ only: `.fp-heading` (bold italic) and `.fp-label` (uppercase, 0.22em tracking) |

Always use `font-display` for headings rather than naming a font. It then follows the brand.

### Patterns

- **Hero heading:** `font-display text-5xl sm:text-7xl lg:text-8xl font-extrabold uppercase leading-[0.92] tracking-tight`, with the key phrase in `text-accent`.
- **Section and panel headings:** `font-display text-lg–2xl font-semibold/bold`, often `uppercase tracking-wide`.
- **Eyebrow:** the `.eyebrow` class above a heading: 0.75rem, 600 weight, 0.18em tracking, uppercase, in accent colour (e.g. "Rowville · Victoria · Est. 1985", or a program type).
- **Body:** default size. Intros are `text-lg text-muted` (or `text-white/75` on blue). Hints are `text-xs text-muted`.
- **Prices:** `PriceTag` shows a small uppercase "from", a large semibold amount and a small unit ("/ session").

## Layout

- **Container:** `.container-x` is max width 80rem (1280px), centred, with 1rem side padding (2rem from 768px).
- **Section rhythm:** heroes `py-24 md:py-32`; regular sections around `py-16`; cards `p-5`–`p-6`; form fieldsets `p-6` with `gap-4`.
- **Grids:**
  - forms are two columns from `sm` (`sm:grid-cols-2`);
  - heroes are `lg:grid-cols-[1.4fr_1fr]`;
  - card lists are 1, 2 or 3 columns by breakpoint.
- **Mobile first, and phones matter most:**
  - no sideways scrolling at phone width; the end-to-end tests check this at iPhone 13 size;
  - the main nav collapses into a ☰ menu below `lg`;
  - header extras marked `.sm-up` move into that menu on phones.
- **Header:** sticky, `h-16`, deep blue at 95% opacity with `backdrop-blur` and a `border-white/10` bottom border. It holds the crest and the "Rowville Eagles / Football Club · Est. 1985" wordmark. The nav text is 13–14px and inactive links sit at 75% opacity.

## Surfaces and decoration

- **Cards:** `rounded-2xl border border-line bg-surface p-6`. On hover they lift (`-translate-y-0.5`), the border turns accent and a soft shadow appears (`shadow-xl shadow-black/5`). See `ProgramCard`.
- **Panels:** add the `.panel` class to cards, fieldsets and summaries so they turn gloss black inside academy sections.
- **Hero glass stats:** `rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5`.
- **Textures:**
  - `.pitch-lines` is a faint centre circle and halfway line for club heroes;
  - `.slant-lines` is 60° hairlines that echo the RFA letterforms (academy);
  - `.gloss` and `.gloss-sheen` are glossy black panels with a light sweep on hover (academy).
- **Corners:** the club is rounded (`rounded-2xl` cards, `rounded-full` buttons, `rounded-lg` inputs). The academy is square: use the `[[data-brand=academy]_&]:rounded-none` or `:rounded-sm` variants on shared components.

## Components

### Buttons

| Kind | Classes (club) | Academy variant |
|---|---|---|
| Primary (one per screen) | `rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60` | `rounded-none uppercase tracking-[0.18em]` (white on black via the tokens) |
| Secondary (solid) | `rounded-full bg-brand px-6 py-3.5 font-semibold text-white hover:brightness-110` | `rounded-none bg-white text-black uppercase tracking-[0.18em]` |
| Outline on blue | `rounded-full border border-white/30 px-6 py-3 font-semibold hover:border-white hover:bg-white/10` | — |
| Outline / chip | `rounded-full border border-line px-4 py-2 font-semibold hover:border-brand` (small: `px-3 py-1`) | — |
| Text link action | `text-sm font-semibold`, often ending "→" (e.g. "View details →") | — |

- Full-width primary buttons (`w-full py-4`) end checkout and booking forms.
- Anything that can't be undone uses `ConfirmButton`.

### Forms (`src/components/forms/Field.tsx`)

- **Inputs:** `inputCls` is `w-full rounded-lg border border-line bg-surface px-3.5 py-2.5`, with placeholders in `text-muted/70` and the border turning ink on focus.
- **Labels and hints:** labels sit above the input (`text-sm font-medium`); an optional hint goes below (`text-xs text-muted`).
- **Grouping:** related fields go in a `Fieldset` (`panel rounded-2xl bg-surface-2 p-6`) with a `font-display` uppercase legend and a two-column grid.
- **Toggles:** a pill switch (`h-6 w-11 rounded-full`) that turns brand blue when on.
- **Reused pieces:** `PlayerFields`, `KidQuickFill` (fills a remembered child) and `PasswordInput` (show/hide).
- **Required details:** mark required fields clearly, and phrase questions so "None" is a valid answer (e.g. "Any medical conditions or allergies?").

### Status chips and badges

- **Status chip:** `rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted` (e.g. "Waitlist").
- **Attention badge** on dashboard tiles:
  - a red circle (`bg-red-600`, `h-7 min-w-7`, bold white text) at the top-right corner;
  - hidden at 0, and shows "99+" above 99;
  - each badge has a spoken meaning, e.g. "Bookings, 3 to action". The wording comes from `BADGE_UNITS` in `src/components/dashboard/badge.ts`.
- **Payee chip:** `PayeeChip` shows whether a payment goes to the club or to the academy.

### Data display

- **Key–value panels:** `Panel` + `Rows` (`src/components/management/Panel.tsx`) give a titled box with a 9rem label column and `divide-y divide-line` rows. They show an "empty" message instead of a blank box.
- **Tables:** `text-sm`, `p-3` cells and `border-line` rows. On phones, wide tables become stacked rows or scroll inside their own box, never the page.

## Portals

- **Public site:** shared header and footer.
- **Coach portal** (`data-portal="coach"`): on phones it behaves like an app. It hides the public header and footer and has its own tab bar.
- **Management** (`data-portal="management"`):
  - has its own sidebar or phone menu instead of the public header and footer;
  - pages start with a breadcrumb (with "← Back" on phones) and a search box;
  - the content sits flush with no container padding;
  - dashboards are grids of tiles with attention badges.
- **Admin** (`/admin`): the Payload CMS admin, used for content editing. It is styled by Payload, not this guide.

## Print

- `@media print` hides the header, footer and anything marked `.no-print`, uses a white background and sets 14 mm page margins.
- Printable pages (player reports, camp attendance and emergency sheets) are laid out for A4. They show the title, dates and the date printed, and offer a "Print / Save as PDF" button.

## Logos and imagery

- **Logos** in `public/brand/`:
  - club crest: `rowville-eagles-crest.png` (and `-sm`);
  - RFA logo in black and white versions;
  - Foundation mark;
  - Foundation+ artwork in `foundation-plus/`.
- **Logo components:** `Crest`, `RfaLogo` and `FoundationPlusLogo` in `src/components/Logos.tsx` and `FoundationPlusLogo.tsx`. `RfaLogo` takes `ink` and `paper` colours.
- **Photos:** upload through Admin → Images, with alt text required. Use real club photos, and **only children whose families gave photo consent**.
- **App icons:** in `public/icons/`. The home-screen title is "RFA".

## Accessibility

- A "Skip to content" link is the first focusable item.
- The focus ring is `outline: 2px solid var(--accent)` with a 3px offset. Never remove it.
- Every region and panel has an accessible name (`aria-label` or a heading). The tests find things by role and name, so keep labels meaningful.
- Badges and icon-only buttons have spoken labels; decorative elements are `aria-hidden`.
- Colour is never the only signal: status always has words too ("Waitlist", "3 to fulfil").
- Keep text contrast at WCAG AA. Muted grey on white and white at 60% or more on deep blue meet it; don't go lighter.
- Anything you can do by drag-and-drop also has a menu ("Move to…") for keyboard and phone users.

## Writing style

- **Plain Australian English:** "enrol", "organise", "colour"; dates like "Tue 19 Jan"; prices like "$25 a session" and "$400 for the term".
- **Who's speaking:** talk to families as "you" and say "we" for the club. Be short, warm and practical. Tell people what happens next.
- **Typography:** use proper characters: curly apostrophes (’), en dashes for ranges (2–35+, Mon–Fri) and "·" as a separator in meta lines.
- **Buttons:** say what the button does ("Approve & send now", "Work out the holidays", "Register now"), not "Submit".
- **Errors:** say what went wrong and what to do ("Card payments must be at least $0.50…").
- **Academy fees note:** wherever academy prices appear, include "Academy fees do not include the $950 Rowville Eagles player registration" (`ClubFeeNote`).
- **Marketing texts:** start with the sender's name and end with "Reply STOP to opt out".
- **Times:** all dates and times are Australia/Sydney.

## Adding something new: checklist

1. Use tokens (`bg-surface`, `text-muted`, `border-line`, `bg-accent`…), never raw hex.
2. Use `font-display` for headings and `.eyebrow` for kickers.
3. If it can appear in the academy, add `.panel` to boxes and the `[[data-brand=academy]_&]:` variants for corners and button text.
4. Check it at phone width (no sideways scroll), with the keyboard (visible focus) and in print if it's a sheet.
5. Give regions and buttons clear accessible names.
6. One gold button per screen.
