# Brand Usage

Official mark assets for `logline.world` ecosystem live in:

- `/public/brand/logline-mark-dark.svg`
- `/public/brand/logline-mark-light.svg`

Generated app icons use the reusable component:

- `/components/brand/LoglineMark.tsx`
- `/app/icon.tsx`
- `/app/apple-icon.tsx`

## Variants

- `logline-mark-dark.svg`:
  - dark disk with light cut lines
  - use on light backgrounds

- `logline-mark-light.svg`:
  - light disk with dark cut lines
  - use on dark backgrounds

## Rules

1. Keep aspect ratio 1:1.
2. Keep clear space of at least 12% around the disk.
3. Do not add outlines, glows, or gradients to the mark itself.
4. Prefer mono usage (black/white family) for consistency.
5. For app icons, keep dark shell background and centered light mark.

## Minimum Sizes

- UI small icon: 20px
- Toolbar/app shell: 24px+
- PWA/app icon source: 512px+

## Replacement Workflow

If you export final polished vectors/PNGs:

1. Replace files under `/public/brand/`.
2. Keep filenames stable to avoid manifest/cache churn.
3. Rebuild app and verify:
   - `/icon?size=512`
   - `/apple-icon`
   - PWA install icon on iPhone/macOS.
