# Chike’s Creative Space: PWA and Native Mobile Experience

## Objective

Make Chike’s Creative Space a polished, installable Progressive Web App with a mobile-first experience that feels intentional and app-like on phones and tablets.

## PWA requirements

- Add a valid `manifest.webmanifest` file with:
  - App name: `Chike’s Creative Space`
  - Short name: `Chike’s`
  - Theme color and background color that match the existing brand palette
  - `display: "standalone"` so the installed experience opens without browser chrome
  - Portrait-first orientation, unless existing game experiences require landscape
  - App icons in the required sizes, including at least 192×192 and 512×512
  - Maskable icon support where possible

- Add and register a service worker in production.
- Cache the app shell and essential static assets so key pages load reliably after the first visit, including the homepage, navigation assets, core CSS, logo, primary icons, and locally hosted fonts where appropriate.
- Use a sensible caching strategy:
  - Cache-first for versioned images, icons, fonts, and static assets.
  - Network-first with an offline fallback for pages and frequently updated content.
  - Do not aggressively cache API responses, forms, analytics, or user-submitted content.
- Provide a branded offline fallback page with this message:

  > You’re offline, but your next creative adventure is still waiting. Check your connection and try again!

- Ensure the application updates safely after a new deployment. Do not leave visitors stuck on an outdated service-worker version.
- Confirm the PWA installs on Android Chrome and behaves appropriately in iOS Safari. Note that iOS installation prompts and service-worker behavior differ from Android.

## Native mobile experience

At mobile breakpoints, redesign interactions so they feel like a native children’s learning app, not a desktop website compressed into a narrow screen.

### Navigation

- Use a mobile-only bottom navigation bar for the primary destinations:
  - Home
  - Watch or Stories
  - Play
  - Create
  - More
- Keep the desktop navigation for tablet and desktop layouts. Do not simply stack the desktop navigation on mobile.
- The mobile bottom navigation must:
  - Remain fixed and thumb-friendly
  - Respect `env(safe-area-inset-bottom)`
  - Include enough bottom page padding so page content is never hidden behind it
  - Show a clear active state for the current section
  - Use icons and concise labels
  - Provide tap targets of at least 44×44 CSS pixels

### Touch and motion

- Add subtle pressed states, scale feedback, and smooth transitions for buttons, cards, game tiles, and navigation items.
- Keep interaction motion quick and gentle, generally 150–250ms.
- Respect `prefers-reduced-motion` and reduce or remove nonessential animation when it is enabled.
- Avoid distracting auto-play motion, large bounce effects, and hover-only interactions.
- Ensure all interactions work with tap, keyboard navigation, and visible focus states.

### Layout and browsing patterns

- Make primary buttons full-width or comfortably sized on smaller screens.
- Keep key calls to action within easy one-handed reach when practical, particularly near the lower half of mobile screens.
- Use plain, child-friendly labels such as:
  - Watch an Adventure
  - Play a Game
  - Try an Activity
  - Read a Story
- Use horizontal swipeable card rows only where they add genuine value, including Featured Stories, New Games, or Creative Activities.
- Add clear visual affordances so visitors know more cards are available to scroll.
- Use CSS scroll snapping for touch card rows and provide accessible controls where needed.
- Add lightweight route-level loading feedback and skeleton loading states for image-heavy cards and game tiles.
- Preserve scroll position when a visitor returns to a listing page from a story, game, or activity detail page.

## Child-friendly usability

- Keep the interface calm, visually clear, and easy to understand.
- Do not add ads, dark patterns, deceptive countdowns, or aggressive notification prompts.
- Do not ask children for personal information.
- Make contact forms, newsletter signups, donations, account features, and external links clearly adult-facing and appropriately safeguarded.
- Maintain readable type sizes, strong contrast, plain language, and consistent hierarchy.
- Include captions, transcript links, alt text, keyboard navigation, and visible focus states wherever applicable.

## Technical requirements

- Reuse the existing Chike’s Creative Space components, design tokens, typography, color palette, spacing, illustrations, and card patterns.
- Do not introduce a disconnected design system or replace the existing visual identity.
- Preserve desktop functionality unless a shared component requires an improvement for consistency.
- Ensure new service-worker logic does not cache stale HTML after deployments.
- Keep the implementation production-ready and avoid dummy data, placeholder behaviors, or nonfunctional controls.

## Required testing

Test at least these viewport widths:

- 320px
- 375px
- 390px
- 414px
- 768px
- Desktop width

Test all of the following:

- PWA manifest validity and app installability
- Android install behavior and iOS Safari behavior
- Offline fallback page
- Service-worker update flow after a new deployment
- Bottom-navigation overlap and safe-area spacing
- Tap-target sizes
- Reduced-motion behavior
- Keyboard navigation and focus states
- Mobile card scrolling and controls
- Build, type-check, lint, and existing automated tests

Fix all implementation errors introduced by this work.

## Required final response

After implementation, provide a concise summary containing:

1. Files added or changed
2. PWA features implemented
3. Mobile interaction improvements implemented
4. Caching strategy and offline behavior
5. Test commands run and results
6. Platform limitations or follow-up items, if any
