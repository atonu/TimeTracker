# Push notifications

Tickwell sends notifications when a goal is reached, when a break ends, and (optionally) when a timer is
started or paused on another device. They arrive even when the app is closed.

## How it works

- The browser subscribes through the **Web Push standard (VAPID)**. No Firebase or FCM project is needed. Chrome,
  Edge, Firefox, Safari and Android route the message through their own push service.
- A subscription belongs to one device in one room and is stored on the room record (never sent to browsers).
- The server keeps a timer for each upcoming alert (`goal reached`, `break over`). Alerts are saved on the room,
  and `src/instrumentation.ts` restores them when the server starts, so a restart loses nothing.
- Starting or pausing a topic reschedules that room's alerts.
- `public/sw.js` shows the notification and opens the room when it is tapped.

## One-time setup

1. Generate keys: `npx web-push generate-vapid-keys`
2. GitHub, Settings, Secrets and variables, Actions:
   - Secret `VAPID_PRIVATE_KEY` = the private key
   - Variable `VAPID_PUBLIC_KEY` = the public key
   - Variable `VAPID_SUBJECT` (optional) = `mailto:you@example.com`
3. Push to `main`. The deploy passes them to the container.

Locally, put the same three values in `.env.local`.

## Devices

- **iPhone and iPad (iOS 16.4+):** the app must be added to the Home Screen first (Safari, Share, Add to Home
  Screen). Notifications do not work from a normal Safari tab.
- **Android, Windows, Mac, Linux:** works in the browser; installing the app is optional.
- HTTPS is required (the Cloudflare Tunnel provides it). `localhost` also works.

## Resetting

The bell dialog has **Turn off** (this room) and **Reset** (unsubscribes the device and clears settings). A
browser's "blocked" choice can only be undone in the browser's site settings.

## Limits

At most 12 devices per room. Subscriptions the push service reports as gone are removed automatically.
