# Analytics (PostHog)

Traffic, heatmaps, engagement time and user journeys come from PostHog Cloud (EU).

## Setup
1. PostHog (eu.posthog.com): Project settings, copy the **Project API key** (starts with `phc_`).
2. Same page: set the time zone to Asia/Dhaka, and turn on **Heatmaps** and **Web analytics**.
3. GitHub, Settings, Secrets and variables, Actions: add `POSTHOG_KEY` (secret or variable). Push to deploy.
4. Locally, put `POSTHOG_KEY=phc_...` in `.env.local` to test. With no key, analytics does nothing.

## What is and is not collected
- No cookies, no local storage, no session recording. A new visit counts as a new visitor.
- Room links are replaced by `/room` in every address, and query strings and fragments are dropped, so room
  ids never reach PostHog. Text and element attributes are masked, so topic names are never sent.
- Do Not Track is respected.
- Requests go through `/ingest` on our own domain (see `next.config.mjs`), which avoids most ad blockers.

## Events
`$pageview`, `$pageleave`, clicks (autocapture and heatmaps), `room_created`, `share_opened`,
`notifications_opened`, `notifications_enabled`, `topic_saved`, `topic_archived`, `topic_restored`,
`topic_deleted`, `timer_started`, `timer_paused`, `break_set`. Events carry no properties.

## Suggested dashboards
- Funnel: `$pageview` -> `topic_saved` -> `timer_started` -> `notifications_enabled`.
- Paths and Web analytics for the user journey; Heatmaps for clicks and scroll depth.

## The /room sample page
Analytics reports every room as `/room`, so heatmaps are drawn over `https://tickwell.atonu.online/room`.
That page (`src/app/room/page.tsx`) is a sample room with example topics. It is kept in memory only, never
saved or synced, has no welcome tour, and is hidden from search engines. In PostHog, open Heatmaps and enter
that address.
