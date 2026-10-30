---
name: "Equities"
description: "A precise, browser-local statement for Mongolian stock holdings."
colors:
  accent: "#285b4c"
  accent-hover: "#1f493d"
  positive: "#287255"
  positive-bg: "#e8f3ed"
  negative: "#aa3f3f"
  negative-bg: "#f8eaea"
  canvas: "#f8f9fb"
  surface: "#fff"
  ink: "#232a30"
  muted: "#69737e"
  line: "#e5e9ed"
  focus: "#427e6c"
  footer-link: "#52675d"
  warning-bg: "#faf0df"
  warning-text: "#725021"
  example-bg: "#edf3f7"
  example-text: "#4b657a"
  allocation-forest: "#316c5b"
  allocation-blue: "#7b94b8"
  allocation-sage: "#a5b9ae"
  allocation-lilac: "#a8a0bd"
  allocation-sand: "#d4b786"
  allocation-teal: "#7ba9ab"
typography:
  display:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "34px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-1.2px"
  headline:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "22px"
    fontWeight: 650
    letterSpacing: "-0.6px"
  title:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "12px"
    fontWeight: 650
    letterSpacing: "-0.2px"
  body:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "14px"
    fontWeight: 400
  body-copy:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.9
  label:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "11px"
    fontWeight: 600
  metric:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "29px"
    fontWeight: 550
    lineHeight: 1.4
    letterSpacing: "-1px"
  badge:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "10px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "0"
rounded:
  badge: "5px"
  icon: "6px"
  control: "7px"
  mark: "8px"
  ledger: "10px"
spacing:
  control-block: "10px"
  control-inline: "14px"
  drawer: "30px"
  desktop-gutter: "48px"
  compact-gutter: "28px"
  mobile-gutter: "17px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.negative}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-icon:
    textColor: "{colors.muted}"
    rounded: "{rounded.icon}"
    height: "30px"
    width: "30px"
  holding-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
  ledger-navigation:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    height: "57px"
    padding: "0 22px"
  filter-chip:
    textColor: "{colors.muted}"
    rounded: "{rounded.badge}"
    padding: "6px 10px"
  return-badge-positive:
    backgroundColor: "{colors.positive-bg}"
    textColor: "{colors.positive}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "4px 6px"
  return-badge-negative:
    backgroundColor: "{colors.negative-bg}"
    textColor: "{colors.negative}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "4px 6px"
  ledger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ledger}"
  summary-metric:
    textColor: "{colors.ink}"
    typography: "{typography.metric}"
---

# Design System: Equities

## Overview

**Creative North Star: "The portfolio statement"**

Equities follows the user-pinned Tax UI reference: an open financial summary above a compact white ledger. Pale cool paper, ink text, forest actions, fine dividers, and small stroke icons support close inspection of holdings.

The interface is restrained and information-dense. Manrope provides both headings and compact labels; aligned tabular numerals give money and quantities a consistent rhythm. Company initials are text badges, not invented logos. This record describes the implemented interface in src/styles.css, src/App.tsx, and src/components/PortfolioPanels.tsx; the reviewed desktop and mobile captures agree with that source.

**Key Characteristics:**

- Open totals and a bordered ledger.
- Forest actions with restrained green/red financial states.
- Compact labels, tabular figures, and dated prices.
- Flat resting surfaces; overlays carry the shadows.

## Colors

A cool neutral canvas carries a forest accent, quiet categorical colors, and explicit financial states. The frontmatter records the source values; the CSS variables with matching names remain the implementation authority. The sidecar supplies synthesized tonal ramps for previews.

### Primary

- **Forest** (`accent`): primary actions, active navigation, links, and the stock-price line. `accent-hover` darkens primary buttons on hover.
- **Focus green** (`focus`): visible keyboard outlines for controls and links.

### Secondary

- **Gain green / loss red** (`positive`, `negative`): signed gains and losses. Their pale companion backgrounds appear on return badges.
- **Allocation forest, blue, sage, lilac, sand, and teal**: the ordered six-color array shared by allocation segments, legend markers, and company initial badges. These distinguish positions rather than performance.
- **Warm warning** (`warning-bg`, `warning-text`): storage, import, and market error notices.
- **Example blue** (`example-bg`, `example-text`): the explicitly labeled example-portfolio banner.

### Neutral

- **Cool paper** (`canvas`) surrounds the white (`surface`) header, ledger, controls, and drawers.
- **Ink** (`ink`) carries the main text; **slate** (`muted`) carries supporting text. The stylesheet also uses closely related local grays for table annotations.
- **Hairline gray** (`line`) divides content. **Muted forest** (`footer-link`) identifies the source link in the footer.

## Typography

**Display, body, and label font:** self-hosted Manrope Variable, falling back to sans-serif. There is no separate display or mono family.

The page title uses the frontmatter display role; drawer titles use headline. Body is the inherited root default, while help and drawer prose use body-copy. Compact table labels range from (8–11px) across breakpoints; form fields use (13px). Section headings use title. Financial totals use metric and tabular numerals; tables and detail figures also use tabular numerals.

At narrow widths the page title becomes (31px); summary figures become (25px), with gain/loss at (28px). At wide widths summary figures become (34px). These are implemented responsive variants, not a new type scale.

## Layout

Header and content share a centered maximum width of (1280px), including the side padding. Desktop gutters use desktop-gutter; at (1100px) and below they use compact-gutter. At (720px) and below the page uses mobile-gutter and the header uses (20px). The header is (77px) high on desktop and (66px) on mobile.

The summary uses three columns in a (1 : 1 : 1.35) ratio, separated by fine vertical rules. Below (720px), cost and value share the first row; gain/loss spans a second row above its own horizontal divider. The heading actions move below the title. The context below the ledger changes from two columns to one.

The holdings ledger hides shares and average purchase price at (1100px), then the separate closing-price column at (720px). Mobile retains company, market value, gain/loss, actions, and the price date beneath value; details remain available in the drawer. Company initials disappear at the mobile breakpoint. The market directory keeps its own horizontal scrolling region, with a mobile minimum table width of (480px). Preserve the page's fit within the viewport.

At (1450px) and above, top spacing and summary spacing increase. The spacing frontmatter records recurring control padding and container gutters, not a universal spacing grid.

## Elevation & Depth

Resting content is flat: white surfaces, subtle tonal changes, borders, and dividers establish grouping. Shadows are reserved for the export dropdown, right-side drawer, and toast. The drawer also dims the background with a translucent green-black backdrop. Exact shadows, backdrop treatment, entry motion, and breakpoints live in the sidecar extensions.

## Shapes

Controls use modest rounded corners; the ledger is slightly rounder. The mobile ledger uses the same radius as the company marks. Return badges and filter chips use the badge radius. Thin one-pixel borders organize the ledger and fields. Status indicators are small circles; allocation markers are small rounded squares. Lucide stroke icons accompany actions and status; no raster assets are shipped.

## Components

### Buttons

Primary buttons use forest with white text; secondary buttons use white, an understated gray border, and ink text. Danger buttons keep the secondary shape while using loss red. Standard padding is in the frontmatter, with a minimum height of (37px). Primary hover darkens the fill; secondary hover changes fill and border; danger hover uses a pale red fill. Disabled controls retain the same design at (0.45) opacity. Keyboard focus uses a (3px) outline with a (4px) offset. Full-width form actions use larger (13px) labels and (12px) padding. Icon buttons use the small square shape and gray hover fill.

### Chips

Return badges pair a signed percentage and directional icon with a semantic pale fill. Filters are quieter text controls: the selected filter has a pale gray-green fill and stronger green text. Selection remains exposed with `aria-pressed`; color is accompanied by text or state semantics.

### Cards / Containers

The white ledger has a fine border, clipped corners, no shadow, tab navigation, search/filter toolbar, table, total row, and a small explanatory footer. Summary totals remain on the page canvas. The labeled example banner uses a cool blue tint and an explicit return action.

### Inputs / Fields

Holding fields use white, a thin gray border, control-radius corners, and (11px 12px) internal padding, with a minimum height of (43px). Their focus outline is (2px) with a (2px) offset. Search is a borderless field in the ledger toolbar, with a slash-key hint on desktop. Form validation is visible red text. Labels and help remain separate from placeholders.

### Navigation

Ledger view buttons use compact text and count badges. The active view is forest, heavier, and underlined with a (2px) rule at the bottom edge. The bar is (57px) high, becoming (52px) on mobile. The mobile version retains both views and the compact currency note.

### Detail drawer and stock history

Add/edit, import review, help, and holding details use a native dialog placed against the right edge. Its width is the lesser of the viewport and (465px), with full dynamic viewport height. Escape and backdrop clicks dismiss it. A stock's dated closing-price chart uses a forest line, a very faint area fill, and an optional dashed average-cost line. The chart's range controls are compact segmented buttons.

Drawer entry lasts (0.25s) with `cubic-bezier(0.16, 1, 0.3, 1)`; toast entry lasts (0.25s) with `ease-out`. Control and allocation hover transitions last (0.15s); an actively loading reload icon rotates over (1s). Reduced-motion preferences disable animations and transitions.

## Do's and Don'ts

### Do:

- **Do** use the existing forest action color and Manrope family.
- **Do** align financial columns with tabular numerals and keep signs, percentages, and labels alongside color.
- **Do** retain visible price dates, unpriced states, and the labeled example banner.
- **Do** preserve keyboard focus outlines and the reduced-motion behavior.
- **Do** keep wide directory content inside its scrolling container on narrow screens.

### Don't:

- **Don't** turn the current open summary into a stack of nested cards.
- **Don't** replace the text company badges with invented company logos.
- **Don't** present an individual-stock price history as a portfolio performance chart.
- **Don't** remove the example label or imply the illustrative holdings are the visitor's saved holdings.
