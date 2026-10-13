# Vault — Design Brief

A monochrome fintech homepage in the spirit of operating-account banking
products: serious, quiet, technical. Three colors total — black, off-white,
one shade of grey. No gradients, no shadows, no brand accent.

---

## 1. Design principles

1. **Three colors, no exceptions.** Ink (\`#0a0a0a\`), paper (\`#ffffff\`), and
   one neutral grey for hairlines. Status, hover, focus — everything is
   resolved by *opacity* of the ink, not by hue.
2. **Page rails over panels.** Two faint vertical hairlines mark where the
   centered column begins and ends. They run the full height of the page and
   give the eye something to anchor on without ever asking for attention.
3. **Bento, but quiet.** The feature grid uses asymmetric tile sizes (the
   bento pattern) but every tile has the same paper background and the same
   1px hairline border. Visual weight comes from typography, not chrome.
4. **Editorial serif emphasis only.** Fraunces 300 carries every italic word
   inside an otherwise sans (Geist) headline. That italic is the most
   decorative thing on the page.
5. **Mono carries metadata.** Numbers, status, eyebrows, code, account IDs —
   everything tabular is set in Geist Mono so the prose can stay calm.

---

## 2. Color tokens

\`\`\`css
--ink:         #0a0a0a;
--ink-2:       #1a1a1a;            /* near-black, used sparingly */
--muted:       #6b6b6b;            /* secondary text */
--hairline:    rgba(10,10,10,0.08);
--hairline-2:  rgba(10,10,10,0.16);
--surface:     #fafafa;            /* page background */
--surface-2:   #f3f3f3;            /* recessed cards */
--paper:       #ffffff;            /* raised cards */
\`\`\`

If you need depth, step \`surface → surface-2 → paper\`. Never reach for color.

---

## 3. Type system

| Role        | Family       | Notes                                      |
| ----------- | ------------ | ------------------------------------------ |
| Display     | **Fraunces** 300 italic | Only on \`<em>\` inside H1/H2.   |
| UI / body   | **Geist**    | 400 / 500 / 600.                          |
| Numbers, eyebrows, status, code | **Geist Mono** | +0.16em tracking on uppercase. |

---

## 4. Layout primitives

### 4.1 Page rails
Two 1px vertical lines that travel the full page, marking the content column.
This is the visual signature of the template.

\`\`\`css
.rails::before, .rails::after {
  content: ""; position: absolute; top: 0; bottom: 0; width: 1px;
  background: var(--hairline-2);
}
\`\`\`

### 4.2 Bento feature grid
Asymmetric grid (a wide tile + 2 narrow + 3 small). Each tile is the same
paper card with hairline border and quiet eyebrow + serif title.

### 4.3 Horizontal-scroll capability rail
A row of 360px-wide cards that overflow horizontally. Background is
transparent so the page rails read through; cards keep a right hairline as
the only divider.

### 4.4 Marquee compliance strip
A slow-scrolling line of mono labels (SOC2 · ISO27001 · …) sitting on a
surface-2 band — the only horizontal rhythm in the entire page.

### 4.5 Segmented pricing control
The same pill primitive used everywhere else, here switching billing cadence.

---

## 5. How to rebuild this from scratch

1. **Set the page rails first.** Get the centered column geometry right; every
   other section will inherit it.
2. **Build the bento grid as a CSS Grid template.** Avoid nested flexboxes
   for the headline tiles — declare the spans explicitly so the rhythm is
   predictable.
3. **Stay in three colors.** Resist adding a "brand blue" for links. Underline
   on hover instead.
4. **Italicize one word per headline.** Pick the verb. That italic is your
   only display flourish — use it deliberately.
5. **Treat mono as data.** Anything tabular, identifying, or technical goes
   mono. Anything narrative stays sans.
6. **Compress mobile aggressively.** The bento collapses to a single column;
   the horizontal-scroll rail keeps overflowing (that's the point); the
   marquee shrinks but never wraps. Test at 375px and 320px.

---

## 6. Common pitfalls

- ❌ Filling a tile with a tinted background. Once one card has a fill, the
  rest of the grid looks broken.
- ❌ Adding a shadow to the "featured" pricing tier. Use a 1px darker border
  (\`--hairline-2\`) instead.
- ❌ Letting the marquee animate too fast. 40s+ feels institutional; faster
  feels like an ad.
- ❌ Mixing mono and sans in the same headline. Pick one register per element.
