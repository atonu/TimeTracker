# Tickwell UX audit

Date: 2026-11-19. Method: the app was run in development with demo data and measured with scripts and screenshots at
320x568, 360x740, 390x844, 768x1024, 1024x768, 1366x768, 1920x1080 and 740x360 (phone landscape). The three scroll
phases (top, compact, tiny) were checked on phones, and every dialog and menu at 360 and 320 wide. Code was also read
for accessibility. Nothing here has been fixed yet.

Severity: **High** blocks or breaks something, **Medium** hurts usability or looks wrong, **Low** polish.

Not checked: real touch devices, real screen readers, themes other than the default white, and dark appearances.

## High

1. **Header overflows at 320px.** The "+ Create" button ends at 332px, 12px past the screen edge, so it is cut off.
   The seven header buttons (themes, share, notifications, help, columns, archives, create) need about 230px but the
   brand takes 104px. Seen at 320px; 360px fits only because of the tweak made for it.
2. **Archives button has no accessible name on phones.** The label is hidden with `display: none` and the button has
   no `aria-label`, so screen readers announce an unnamed button. The same applies to the "+ Create" button, which
   shows only "+" on phones. (`.btn-label` rule in `themes.css`, buttons in `Tickwell.tsx`.)
3. **"Replay the welcome tour" button collapses to 19px tall** when the Help dialog scrolls. The button is a flex
   child of a scrolling column and shrinks, so its text overflows the border. Same cause may affect any button
   placed directly in `.dialog.help`.
4. **Primary actions are tiny on phones.**
   - Card Edit, Archive and "Create topic" buttons are 19x19 to 20x20px (24 to 25px on tablets and desktops).
   - The topic dialog's submit is a 29px grey tick with no text, and the colour swatches are 27px.
   - Column-visibility checkboxes are 18px. Recommended minimum is 44px, absolute minimum about 32px.
5. **Notification permissions are easy to get stuck on desktop.** On Brave, push is off unless "Use Google services
   for push messaging" is enabled, and the old error text did not say so. (Improved in `usePush.ts`, not yet
   deployed.) Chrome and Windows can also hide notifications through Windows notification settings or Focus assist,
   and the app cannot tell the user that the message was shown but hidden by the system.

## Medium

6. **Date wraps to three lines at tablet and landscape widths** (about 641 to 900px): "Thursday / 19 / November".
   It is hidden entirely on phones, so the app never shows the date there.
7. **Wasted space on phones and tablets in the top scroll phase.** A card is about 220px tall on a 740px screen,
   with large empty bands above and below it. Phase 1 reserves 85% of the height but the card is not scaled up.
8. **Text contrast is low.** Secondary text uses `--muted` (`#8b8b92` on white, about 3.4:1). It is used at 11 to
   13px (history sub-labels, "of 4h · 0%", dialog hints). WCAG AA needs 4.5:1. Other themes have the same ratio
   (about 3.4 to 3.7:1).
9. **Long titles are cut with no hint on touch.** A 50-character title shows as "WWWWW…" in about 70px on a phone
   card. The full title only appears through the hover or tap ticker, and the table header shows the same cut text.
   Nothing says the ticker exists.
10. **Card tools exist only on hover or after a tap.** On desktop, keyboard users can reach them via focus, but
    the buttons are invisible until then. On touch, the first tap opens the tools and a second tap is needed.
11. **Submit action is a bare tick on phones.** The topic dialog's "Create" and "Save" are icon-only on phones, grey
    while disabled, with no text saying why they are disabled (title is empty).
12. **Landscape phones (740x360):** the top bar is 76px and the card nearly fills the height. The history table
    is reached only after scrolling, and there is little room left for the card controls.
13. **Share dialog at 320px** has a horizontally clipped element (246px content in 212px). The link field scrolls
    inside, which is acceptable, but the QR block can crowd the copy button.
14. **Page controller replaces native scrolling.** Wheel, touch and keys are intercepted. Scroll position cannot be
    restored by the browser (back, reload), there is no browser scroll anchoring and no momentum on some devices.
    Screen-reader and keyboard users depend on custom key handling (Space, arrows, page keys).

## Low

15. **Theme colour is static.** `viewport.themeColor` is always `#ffffff`, so the phone status bar does not follow
    the chosen theme.
16. **Keyboard focus styles are thin.** Only three `:focus-visible` rules exist (inputs, label edit, create menu).
    Buttons fall back to the browser outline, which is hard to see on the dotted background and on dark buttons.
17. **Animations ignore reduced motion in most places.** `prefers-reduced-motion` is handled once; the ticker,
    card transitions and phase animations are not covered.
18. **Dense toggle is hidden on phones** with no equivalent, and the button's icon alone does not say what it
    does (tooltip only).
19. **Development badge overlaps the history on phones.** The Next.js "N" badge covers the left column. It only
    shows in development, so it is not a production issue.
20. **Key handler assumes `event.target` is an element** (`Tickwell.tsx` around line 192). Real key events always
    target elements; synthetic events on `window` throw `t.closest is not a function`. Harmless, but easy to harden.
21. **"Reset" and "Turn off" wording is close.** Both live in the Notifications dialog; Turn off affects this room,
    Reset affects the whole device. A short note under each would avoid mix-ups.

## Checked and fine

- No horizontal page scroll at any size tested.
- No overlapping header buttons at 360px and up.
- Dialogs stay inside the screen at 320 and 360px and scroll when taller than the screen.
- Notification dialog buttons wrap instead of overflowing (fixed earlier this session).
- Onboarding Skip button is fully clickable (fixed earlier this session).
- Form inputs use 16px text, so iOS does not zoom when they are focused.

## Suggested order

1. Fix 1, 2, 3 (small CSS and label changes).
2. Raise tap targets (4) and add visible labels to submit buttons (11).
3. Improve contrast (8) and title cut-offs (9).
4. Rework phase 1 sizing on phones and tablets (7, 6, 12).
5. Add focus and reduced-motion polish (16, 17).

## Added after review (2026-11-19)

22. **Notification options were not left-aligned.** Checkboxes rendered oversized and centred, with the label text
    pushed right. Fixed in `themes.css` (`.notify-opt`).
23. **Reminder cross sat over the content in scroll phases 2 and 3.** It now goes in the card's top-right corner,
    and in phase 3 the card widens by 24px while the prompt shows so the cross has its own room. Fixed in
    `themes.css` (`.rem-close`, `.card.asking`).

## Fix status (2026-11-19)

Fixed in `themes.css`, `Tickwell.tsx`, `useAppearance.ts`, `NotificationsDialog.tsx` unless noted:

| # | Status | What changed |
|---|--------|--------------|
| 1 | Fixed | At 340px and below the header buttons, gap and brand shrink; last button now ends at 314 of 320px. |
| 2 | Fixed | Archives button has `aria-label` and tooltip. Create already had a label (the audit was wrong on that one). |
| 3 | Fixed | Help dialog children no longer shrink; the tour button stays 39px tall when the dialog scrolls. |
| 4 | Fixed | Invisible 3px hit area around card tools; on phones swatches 32px, duration chips 36px, column rows 44px, footer links 40px. |
| 5 | Fixed | The dialog now explains system and Brave settings; Brave gets a specific error message (`usePush.ts`). |
| 6 | Fixed | Date never wraps: short form 821 to 1100px, hidden 641 to 820px. |
| 7 | Fixed | Phone card height cap raised from 200px to 270px and the countdown text grows with it. |
| 8 | Fixed | Muted text darkened in all light themes (4.8 to 5.3:1) and two dark themes (about 4.5 to 4.9:1). |
| 9 | Already handled | Card and column titles already carry a `title` tooltip, and tapping a card title runs the ticker. |
| 10 | Fixed | On devices with hover, card tools show at 45% opacity instead of being invisible (not in the smallest phase). |
| 11 | Fixed | On phones the submit button shows "Create" or "Save" with the tick. |
| 12 | Fixed | On screens under 500px tall the header is 48px and the card is smaller. |
| 13 | Fixed | Share link field can shrink in narrow dialogs. |
| 14 | Not changed | Custom page scrolling is a core design choice. Keyboard keys (Space, arrows, page keys) are supported. |
| 15 | Fixed | The phone status bar colour follows the theme (`useAppearance.ts`). |
| 16 | Fixed | Every button and link has a 2px focus outline. |
| 17 | Fixed | Reduced-motion users get no slide, fade or ticker animation. |
| 18 | Not changed | Compact size stays PC-only by design; the button already has a label and tooltip. |
| 19 | Not an issue | Development-only badge. |
| 20 | Fixed | Key handler no longer assumes the target is an element. |
| 21 | Fixed | Short explanation of Turn off versus Reset added to the dialog. |

## Goals, Signal/Noise and the wrapped first phase

- Topics have a category, Signal (default) or Noise; signal cards have a green shadow.
- Goals notepad (button under the logo, or the first card in the scrolled phases): one bullet per line, Enter adds a line, "Add as topics" creates 1h Signal topics and skips titles that already exist. Notes are kept per room in this browser only.
- First scroll phase wraps the cards (4 per row on PC, 2 on phones); scrolling on glides them into the single row.
