---
name: Serene Logic (Pastel Refresh)
colors:
  surface: '#f8f9fc'
  surface-dim: '#d9dadd'
  surface-bright: '#f8f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3f6'
  surface-container: '#edeef1'
  surface-container-high: '#e7e8eb'
  surface-container-highest: '#e1e2e5'
  on-surface: '#191c1e'
  on-surface-variant: '#474552'
  inverse-surface: '#2e3133'
  inverse-on-surface: '#f0f1f4'
  outline: '#787583'
  outline-variant: '#c8c4d4'
  surface-tint: '#5950b6'
  primary: '#5950b6'
  on-primary: '#ffffff'
  primary-container: '#9d94ff'
  on-primary-container: '#32258d'
  inverse-primary: '#c6c0ff'
  secondary: '#006b55'
  on-secondary: '#ffffff'
  secondary-container: '#9bf0d3'
  on-secondary-container: '#0b7059'
  tertiary: '#79573f'
  on-tertiary: '#ffffff'
  tertiary-container: '#c2997e'
  on-tertiary-container: '#4e311c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e4dfff'
  primary-fixed-dim: '#c6c0ff'
  on-primary-fixed: '#150066'
  on-primary-fixed-variant: '#41369d'
  secondary-fixed: '#9ef3d6'
  secondary-fixed-dim: '#82d7ba'
  on-secondary-fixed: '#002118'
  on-secondary-fixed-variant: '#00513f'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#eabea0'
  on-tertiary-fixed: '#2d1604'
  on-tertiary-fixed-variant: '#5f402a'
  background: '#f8f9fc'
  on-background: '#191c1e'
  surface-variant: '#e1e2e5'
typography:
  headline-xl:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

This design system shifts away from heavy corporate saturation toward a high-clarity, ethereal aesthetic. The brand personality is calm, precise, and intellectually inviting, targeting sophisticated SaaS users who value focus and reduced cognitive load. 

The style is a hybrid of **Minimalism** and **Soft-Glassmorphism**. It utilizes heavy whitespace and a restricted use of color to highlight intentional actions. Interfaces should feel "light as air" yet structurally grounded through crisp typography and subtle surface-on-surface layering. The emotional response is one of clarity and composure—turning complex logical workflows into a serene, frictionless experience.

## Colors

The palette is composed of high-luminance, low-saturation "airy" pastels. While the colors are soft, readability is maintained by pairing them with deep-ink neutrals for typography.

- **Primary (Soft Lavender):** Used for primary actions, active states, and brand-defining moments.
- **Secondary (Mint Green):** Used for success states, growth indicators, and secondary accents.
- **Tertiary (Pale Peach):** Used for warnings or highlights requiring a warm but non-aggressive touch.
- **Quaternary (Sky Blue):** Used for informational badges, links, and background washes.
- **Neutral:** A cool-toned white-smoke base ensures the pastels appear crisp rather than muddy.

Backgrounds should primarily use the neutral base, with pastel tints reserved for container fills at very low (5-10%) opacity to maintain a professional SaaS environment.

## Typography

The typography strategy balances modern approachability with technical precision. 

**Manrope** is used for headlines to provide a warm, geometric feel that softens the logic-driven nature of the product. **Inter** serves as the workhorse for body text, ensuring maximum legibility across dense data. **JetBrains Mono** is introduced for labels, metadata, and code snippets, grounding the soft aesthetic with a "logic-first" technical secondary voice.

Maintain generous line heights to preserve the airy feel. For mobile, headline scales are aggressively reduced to ensure they fit within tight viewports without sacrificing the character of the typeface.

## Layout & Spacing

The design system utilizes a **Fluid Grid** with a 4px base unit. 

- **Desktop:** 12-column grid with 24px gutters and wide 64px outer margins to create a focused "center-stage" feel.
- **Tablet:** 8-column grid with 16px gutters and 32px margins.
- **Mobile:** 4-column grid with 16px gutters and 16px margins.

Spacing should favor "padding-out" over "padding-in"—meaning elements should be given more room than technically necessary to reinforce the serene brand narrative. Use the `xl` (40px) spacing for section vertical separation to maintain a rhythmic, breathable flow.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Ambient Shadows**. This design system avoids harsh black shadows in favor of tinted shadows that use a fraction of the primary or neutral-dark color.

- **Level 0 (Base):** Flat neutral background.
- **Level 1 (Cards):** 1px solid border (color: Neutral - 10% darkness) with no shadow.
- **Level 2 (Dropdowns/Popovers):** Soft, diffused shadow (Blur: 12px, Y: 4px) tinted with the Primary Lavender at 8% opacity.
- **Level 3 (Modals):** High-diffusion shadow (Blur: 32px, Y: 16px) with a subtle backdrop blur (12px) to create a frosted glass effect on the layer beneath.

Depth is used sparingly to keep the interface feeling lightweight and fast.

## Shapes

The shape language is consistently **Rounded** (0.5rem base). 

Large containers and cards utilize `rounded-lg` (1rem) to soften the edges of the UI, making it feel more organic and approachable. Interactive components like buttons and inputs use the standard 0.5rem radius. This avoids the "industrial" feel of sharp corners while remaining more structured and professional than a full pill-shaped system.

## Components

- **Buttons:** Primary buttons use a solid Soft Lavender fill with white text. Secondary buttons use a transparent fill with a 1px Soft Lavender border. Hover states should increase the saturation slightly rather than darkening.
- **Chips:** Used for categorization. Each category should be mapped to one of the four pastel colors (e.g., "Draft" in Sky Blue, "Live" in Mint Green) with a fill opacity of 15% and text in the same color but at 100% saturation for contrast.
- **Input Fields:** Use a 1px neutral border that turns Soft Lavender on focus. Backgrounds should be pure white to pop against the neutral page background.
- **Lists:** Use generous vertical padding (12px - 16px per row) and subtle dividers.
- **Cards:** White backgrounds with the Level 1 elevation (1px border). Use a Sky Blue or Soft Lavender "accent bar" (2px thick) at the top of featured cards for visual distinction.
- **Checkboxes & Radios:** Should use the Primary Soft Lavender for the checked state to maintain brand consistency.