# Sati — Corporate Identity (CI) Reference

> **Canonical brand reference for Sati Co., Ltd.** Push this file to repos, Notion, design systems, and onboarding docs as the single source of truth for brand, color, type, and design tokens.

| | |
|---|---|
| **Company** | Sati Co., Ltd. |
| **Tagline** | AI Revolutionizing Healthcare for Smarter Life |
| **Vision** | Dream Beyond Limits |
| **Source** | Sati Brand Guidelines V01 (Version 2025) |
| **CI doc version** | 1.0 |
| **Maintainer** | Brand / Design — Sati |

---

## 1. Brand Essence

**Who we are.** Sati is Thailand's leading force in revolutionizing AI-driven healthcare solutions — founded by doctors, built for medical professionals.

**Brand equity.** Empowers medical professionals to focus on what truly matters — saving lives.

**Positioning ("Real Life Heroes").** Sati doesn't replace the heroes in healthcare; we stand beside them, empowering them to be stronger, work more efficiently, and create greater impact than ever before.

**Personality (4 pillars).**

| Pillar | Meaning |
|---|---|
| **Pioneer** | We are pioneers in transforming the medical field with AI. |
| **Passionate** | We build technology that makes work easier and saves more lives. |
| **Creative** | We reduce complexity, improve accuracy, and enhance the healthcare system. |
| **Practical** | Sati's technology is not just an idea — it's truly usable. |

**Voice.** Confident, practical, and human. We stand *beside* healthcare heroes, not above them. Write with clarity and real-world impact; avoid generic tech jargon. Tone adapts by audience — data-led for investors, empathetic and outcome-focused for hospitals, clear and brief for UI — but the personality stays constant: **Pioneer · Passionate · Creative · Practical.**

---

## 2. Logo

**Configurations.**
- **Full Logotype** — symbol + wordmark. Use for internal comms and co-branded environments.
- **The S.** — monogram only. Use in informal or space-constrained contexts.

**Symbol meaning.** Two overlapping chat bubbles form an abstract "S"; the central intersection represents data integration and collaborative innovation.

**Clear space.** Minimum clear space all around = the height of the "U" in The S.

**Minimum sizing.**

| Asset | Print | Digital |
|---|---|---|
| Wordmark | 25 mm | 70 px |
| The S. | 12 mm | 34 px |

**Color treatments.** Full color · One color · Negative color · Black & white · Negative black & white.
- Full-color logo → white / light clear backgrounds only.
- Negative logo → approved corporate-color backgrounds only.

**Do not:** resize/reposition parts · use unapproved colors · change the typeface · skew/stretch/rotate · add drop shadow · add stroke · place on low-contrast or busy backgrounds · combine The S. with the wordmark · use The S. without its dot · set the logo as running text.

---

## 3. Color System

> **Scope of this section.** §3.1–3.2 restate the *existing* approved core/neutral colors (with two corrections, flagged). §3.3–3.5 are the **new extended palette** (semantic + warm + cool) requested to round out the CI for product, data, and marketing use.

### 3.1 Core / Primary (existing — approved)

| Token | Name | HEX | RGB | Print (as specified) | Role |
|---|---|---|---|---|---|
| `--sati-space` | **Sati Space** | `#0F3575` | 15, 53, 117 | PANTONE 3584 C · `#203672` · C100 M90 Y20 K5 | Trust & security. Intense base / depth. Dominant brand color. |
| `--sati-azure` | **Sati Azure** | `#266BFF` | 38, 107, 255 | PANTONE 2727 C · `#0072D9` · C77 M49 Y0 K0 | Pioneer & creativity. Highlights, links, CTAs. |
| `--sati-aqua` | **Sati Aqua** | `#8BFFFF` | 139, 255, 255 | PANTONE 318 C · `#60D3D9` · C46 M0 Y15 K0 | Passion / relaxed atmosphere. Sparing accent + highlight text. |

> ⚠️ **Correction:** the original guideline lists Sati Space as `R156 G53 B117`. That is wrong (it renders magenta). The correct values for `#0F3575` are **`R15 G53 B117`**.

### 3.2 Neutrals

| Token | Name | HEX | RGB | ≈ Pantone | Role |
|---|---|---|---|---|---|
| `--white` | White | `#FFFFFF` | 255, 255, 255 | — | Body text on dark; clean space. |
| `--platinum` | **Platinum** *(newly defined)* | `#E7EBF0` | 231, 235, 240 | ≈ Cool Gray 1 C | Primary neutral / surfaces. Drives ~60% of layouts. |
| `--sati-mist` | Sati Mist *(new)* | `#C3CCD9` | 195, 204, 217 | ≈ Cool Gray 4 C | Borders, dividers, disabled states. |
| `--sati-slate` | Sati Slate *(new)* | `#5B7290` | 91, 114, 144 | ≈ 5415 C | Secondary text, UI chrome, captions. |
| `--charcoal` | Charcoal | `#36454F` | 54, 69, 79 | PANTONE 7540 C | Body text on light backgrounds. |
| `--sati-ink` | Sati Ink *(new)* | `#1A2230` | 26, 34, 48 | ≈ 5255 C | Highest-contrast text / headings. |

> ⚠️ **Gap closed:** "Platinum" was named as a primary neutral in the original guideline but never given a value. `#E7EBF0` is a cool, on-brand light grey that sits naturally with Sati Space/Azure. Adjust if a warmer platinum is preferred.

### 3.3 System / Semantic — *NEW*

Status colors for product UI, dashboards, claim/audit states, and data viz. Each has a **cool** (blue-harmonized) and a **warm** (high-alert) option — pick one per product and stay consistent.

| Token | Name | HEX | RGB | ≈ Pantone | Use |
|---|---|---|---|---|---|
| `--success` | **Sati Vital** (cool green) | `#00B894` | 0, 184, 148 | ≈ 3275 C / 326 C | Success / approved / passed. Bridges to Sati Aqua. **Recommended default.** |
| `--success-warm` | Sati Verdant (warm green) | `#22A94E` | 34, 169, 78 | ≈ 7739 C / 354 C | Alt success where a classic "medical green" is wanted. |
| `--warning` | **Sati Amber** (warm orange) | `#F59E0B` | 245, 158, 11 | ≈ 1375 C / 137 C | Needs review / pre-audit flag / pending. |
| `--warning-deep` | Sati Ember (deep orange) | `#F97316` | 249, 115, 22 | ≈ 1505 C / 165 C | Stronger caution / SLA breach. |
| `--error` | **Sati Signal** (warm red) | `#E5484D` | 229, 72, 77 | ≈ 485 C / 186 C | Error / rejected / critical. **Recommended default.** |
| `--error-cool` | Sati Crimson (cool red) | `#E5326E` | 229, 50, 110 | ≈ 1925 C / 199 C | Alt error that pairs more cleanly with blue UIs. |
| `--info` | Info = Sati Azure | `#266BFF` | 38, 107, 255 | PANTONE 2727 C | Informational / in-progress. |

**In-product semantic mapping (RCM context) — suggested:**

| State | Color | Example in Sati products |
|---|---|---|
| Approved / coded / passed | `--success` | ChartSum code accepted · claim approved |
| Needs review / flagged | `--warning` | Pre-Audit DRG mismatch · low-confidence suggestion |
| Rejected / denied / error | `--error` | Claim denial · validation failure |
| Informational / processing | `--info` | Job running · "AI suggests…" non-blocking note |

### 3.4 Warm-tone accents — *NEW*

Human warmth and "by doctors, for people" empathy. Use sparingly — campaigns, illustration, gold for premium/award contexts.

| Token | Name | HEX | RGB | ≈ Pantone | Use |
|---|---|---|---|---|---|
| `--sati-sand` | Sati Sand | `#EFE7D6` | 239, 231, 214 | ≈ 7527 C | Warm neutral surface / cream backgrounds. |
| `--sati-apricot` | Sati Apricot | `#FBC99D` | 251, 201, 157 | ≈ 156 C | Soft warm accent, illustration. |
| `--sati-sun` | Sati Sun | `#FACC15` | 250, 204, 21 | ≈ 116 C / 7548 C | High-energy highlight (use very sparingly). |
| `--sati-gold` | Sati Gold | `#C9A227` | 201, 162, 39 | ≈ 7551 C (or 871 metallic) | Premium / awards / certificates. |
| `--sati-clay` | Sati Clay | `#C2674B` | 194, 103, 75 | ≈ 7522 C | Deep warm grounding tone (optional). |

### 3.5 Cool-tone accents — *NEW*

Extends the blue spine and bridges to the violet/indigo seen in Sati photography.

| Token | Name | HEX | RGB | ≈ Pantone | Use |
|---|---|---|---|---|---|
| `--sati-sky` | Sati Sky | `#6FA8FF` | 111, 168, 255 | ≈ 2716 C | Light Azure tint — backgrounds, charts. |
| `--sati-indigo` | Sati Indigo | `#4F46E5` | 79, 70, 229 | ≈ 2368 C | Bridges to photography purples; data series. |
| `--sati-violet` | Sati Violet | `#7C5CFF` | 124, 92, 255 | ≈ 2725 C | Secondary accent / gradients. |
| `--sati-teal` | Sati Teal | `#14B8A6` | 20, 184, 166 | ≈ 3275 C | Cool secondary; pairs with Aqua. |
| `--sati-deep` | Sati Deep | `#0A2350` | 10, 35, 80 | ≈ 2965 C / 282 C | Darker-than-Space depth, hero backgrounds. |

### 3.6 Usage ratio

- **~60%** neutral-led — Platinum / photography; Charcoal for body; White for text on dark.
- **~25%** primary — Sati Space and Sati Azure (use Space ~7× more than Azure, i.e. Azure ≈ 1/8 of the 25%).
- **~10%** secondary — Sati Aqua, for balance and highlight text.
- **~5%** remaining — reserved for **semantic colors** (§3.3) and small warm/cool accents. Semantic colors are *functional*, not decorative — never use them as brand fill.

### 3.7 Accessibility (WCAG)

Healthcare = "Hygiene Factor: full compliance." Bake contrast in.

| Foreground / Background | ≈ Ratio | Verdict |
|---|---|---|
| Sati Space `#0F3575` on White | ~12:1 | ✅ AAA — ideal for text. |
| Charcoal `#36454F` on White | ~9:1 | ✅ AAA — body text. |
| Sati Azure `#266BFF` on White | ~3.9:1 | ⚠️ Large text / UI only — **fails AA for small body text** (needs 4.5:1). For body links, darken to ~`#1E54CC`. |
| Sati Aqua `#8BFFFF` on White | ~1.2:1 | ❌ Never use for text. Use **dark text on Aqua** instead. |
| White on Sati Space | ~12:1 | ✅ AAA. |
| White on Sati Azure | ~3.9:1 | ⚠️ Large/bold only. |

Rule of thumb: **dark navy/charcoal on light, white on Space.** Aqua and Sky are *surfaces/accents*, not text colors.

### 3.8 Pantone disclaimer

Pantone values marked **≈** are visual approximations chosen by color family, intended as *starting candidates* for your printer. Pantone does not publish exact HEX/CMYK equivalents, and values shift between **Coated (C)** and **Uncoated (U)** stock — your guideline prints CMYK on uncoated, so request the **Uncoated** chip equivalents and confirm against a physical Pantone guide or Pantone Connect before sign-off. The existing core Pantones (3584 C, 2727 C, 318 C, 7540 C) are carried over from the original guideline as-is.

---

## 4. Typography

| Use | Typeface | Weights |
|---|---|---|
| **English (primary)** | **Neulis Sans** | Semi Bold · Regular · Light |
| **Thai (primary)** | **Aktiv Grotesk** | Bold · Regular · Light |
| **English display (alt, informal)** | **Neulis Neue** | Semi Bold · Regular · Light |

**Digital/web fallbacks** (for code where licensed fonts aren't loaded):
- Latin: `Neulis Sans, Inter, "Helvetica Neue", Arial, sans-serif`
- Thai: `"Aktiv Grotesk Thai", "Noto Sans Thai", "Sukhumvit Set", sans-serif`

Use Semi Bold for headlines, Regular for body, Light for large/quiet display text. Reserve Neulis Cursive for expressive marketing moments only.

---

## 5. Graphic Elements

**Supergraphic "U"** (⊃) — derived from the logo symbol; expresses "Dream Beyond Limits." Signals openness, movement, and data flow / structured systems.
- Can hold an image or text inside it.
- May be rotated **only** to approved orientations (⊃ ⊂ ∪ ∩).

**Pattern "S"** — geometric pattern derived from the S symbol. Bold, distinctive, creates movement. **Approved colors only.**

---

## 6. Photography

Direction maps to the personality pillars:
- **Pioneer** — AI / future tech, abstract data, VR.
- **Passionate** — real teams, human faces, warmth.
- **Creative** — interfaces, holographic UI, problem-solving.
- **Practical** — clinical reality: clinicians, devices, hospital settings.

Keep a cool, blue-graded, modern, clean aesthetic. Real medical contexts over generic stock.

---

## 7. Design Tokens (developer-ready)

### CSS custom properties

```css
:root {
  /* Core */
  --sati-space:      #0F3575;
  --sati-azure:      #266BFF;
  --sati-aqua:       #8BFFFF;

  /* Neutrals */
  --white:           #FFFFFF;
  --platinum:        #E7EBF0;
  --sati-mist:       #C3CCD9;
  --sati-slate:      #5B7290;
  --charcoal:        #36454F;
  --sati-ink:        #1A2230;

  /* Semantic */
  --success:         #00B894;
  --success-warm:    #22A94E;
  --warning:         #F59E0B;
  --warning-deep:    #F97316;
  --error:           #E5484D;
  --error-cool:      #E5326E;
  --info:            #266BFF;

  /* Warm accents */
  --sati-sand:       #EFE7D6;
  --sati-apricot:    #FBC99D;
  --sati-sun:        #FACC15;
  --sati-gold:       #C9A227;
  --sati-clay:       #C2674B;

  /* Cool accents */
  --sati-sky:        #6FA8FF;
  --sati-indigo:     #4F46E5;
  --sati-violet:     #7C5CFF;
  --sati-teal:       #14B8A6;
  --sati-deep:       #0A2350;

  /* Type */
  --font-en: "Neulis Sans", Inter, "Helvetica Neue", Arial, sans-serif;
  --font-th: "Aktiv Grotesk Thai", "Noto Sans Thai", sans-serif;
  --font-display: "Neulis Cursive", var(--font-en);
}
```

### JSON tokens

```json
{
  "color": {
    "core":     { "space": "#0F3575", "azure": "#266BFF", "aqua": "#8BFFFF" },
    "neutral":  { "white": "#FFFFFF", "platinum": "#E7EBF0", "mist": "#C3CCD9", "slate": "#5B7290", "charcoal": "#36454F", "ink": "#1A2230" },
    "semantic": { "success": "#00B894", "successWarm": "#22A94E", "warning": "#F59E0B", "warningDeep": "#F97316", "error": "#E5484D", "errorCool": "#E5326E", "info": "#266BFF" },
    "warm":     { "sand": "#EFE7D6", "apricot": "#FBC99D", "sun": "#FACC15", "gold": "#C9A227", "clay": "#C2674B" },
    "cool":     { "sky": "#6FA8FF", "indigo": "#4F46E5", "violet": "#7C5CFF", "teal": "#14B8A6", "deep": "#0A2350" }
  }
}
```

### Tailwind snippet

```js
// tailwind.config.js → theme.extend.colors
colors: {
  space: "#0F3575", azure: "#266BFF", aqua: "#8BFFFF",
  platinum: "#E7EBF0", mist: "#C3CCD9", slate: "#5B7290",
  charcoal: "#36454F", ink: "#1A2230",
  success: "#00B894", warning: "#F59E0B", error: "#E5484D", info: "#266BFF",
  sand: "#EFE7D6", apricot: "#FBC99D", sun: "#FACC15", gold: "#C9A227", clay: "#C2674B",
  sky: "#6FA8FF", indigo: "#4F46E5", violet: "#7C5CFF", teal: "#14B8A6", deep: "#0A2350"
}
```

---

## 8. Contact

Sati Co., Ltd.
125/3 Chonprathan Rd., Su Thep, Mueang, Chiang Mai, 50200
+66 65 508 8850 · contact@sati.co.th · sati.co.th

---

*Changes to this document should be reviewed by Brand/Design before merge. Treat color tokens as API: rename with care.*
