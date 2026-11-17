# Tickwell: accounts, sync, history and export

## Decisions to lock in first
- **Stack:** Next.js app, Auth.js for Google and Facebook sign-in, Supabase Postgres as the database, Caddy for HTTPS on the Oracle VM.
- **Anonymous use:** everything still works without an account, saved in the browser as it is today.
- **Account data:** signed-in users get their data stored in the database and synced across devices.
- **Scroll layout:** read "when user scrolls up from default page" as: the default view shows the cards and table, and scrolling up from the table brings the cards row to fill 80% of the window, leaving the table under 20%. To confirm.

## Phase 1: Foundation (domain, HTTPS, database)
- Point a domain at the Oracle VM and set up Caddy with HTTPS.
- Create the Supabase project and the database tables.
- Make sure the deploy keeps the same data across redeploys.

**Done when:** the site loads over HTTPS and connects to the database.

## Phase 2: Accounts
- Set up Google and Facebook sign-in with Auth.js.
- Add a sign-in and sign-out control to the header.
- Create a user record on first sign-in.

**Done when:** a user can sign in with Google or Facebook and sign out.

## Phase 3: Saved data and sync
- Store each signed-in user's topics and daily time in the database.
- Send each change to the server as a small event. Push it to the user's other open devices using Server-Sent Events.
- On reconnect, each device fetches anything newer than the last event it saw.
- Keep the countdown on the device, computed from the stored start time.

**Done when:** starting a timer on a phone shows it running on a laptop within a few seconds.

## Phase 4: Anonymous data and merging
- When a user signs in for the first time, offer to upload the data saved on that device.
- If the account is empty, upload it. If both have data, show the user a choice.
- Merge by topic and by day. Use the larger value for a day, not the sum, so the same time isn't counted twice.

**Done when:** someone who used the app without an account keeps their history after signing in.

## Phase 5: Sign-in prompt
- Show a small, dismissible message explaining that an account gives sync across devices and keeps history safe.
- Show it after the user has used the app for a while, not on the first visit.
- Remember a dismissal, and don't bring it back for the same user.

**Done when:** the prompt appears, can be dismissed, and doesn't reappear.

## Phase 6: Export
- **CSV:** build the file in the browser from the history table's data.
- **PNG:** draw the table to an image using the current theme colours and fonts. Include all visible columns, not just the part on screen.

**Done when:** both downloads open correctly on phone and desktop, and the PNG matches the table.

## Phase 7: Layout
- When the user scrolls up from the table, the cards row fills 80% of the window and the history table takes the bottom 20% or less.
- Keep the table's header row visible while scrolling.
- Test at phone and desktop sizes.

**Done when:** the split holds at common screen sizes without the cards getting cut off.

## Risks
- **Merging:** the rule for combining device and account data must be right before users have real data. Test it with two devices.
- **Facebook review:** Meta may require an app review before anyone outside the test list can sign in.
- **Privacy:** store only what's needed, and let users delete their account and data.
- **Supabase limits:** the free tier is too small once data grows. Move to a paid plan before launch.

## Suggested order
1. Phases 1 and 2 first.
2. Phases 3 and 4 together, since sync and merging depend on each other.
3. Phases 5, 6 and 7 in parallel once sign-in works.

## Open questions
1. Is the scroll-up layout the one described above?
2. Is a domain ready?
