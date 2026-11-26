# Idoma Lifeline: hackathon rehearsal

## Run the production app locally

Install dependencies with `npm run install:all`, then `npm run build:frontend` and `npm run backend`. Open http://localhost:3000. The production build is required to test offline reload; Vite development mode does not install a service worker. Check that `frontend/.env` does not point the demo at an unrelated API. Use `VITE_API_URL` only for a deliberately separate backend.

The backend uses SQLite by default, or PostgreSQL/PostGIS when DATABASE_URL is set. Set JWT_SECRET for a hosted deployment. A fresh database is seeded automatically; an existing one is preserved. The coordinator login screen shows the demo account. Only use sample data in this prototype.

## Before going on stage

- Open the production app online and wait for its service worker to activate. Reload once, inspect the resources, and visit the map areas you will demonstrate. Only viewed tiles are saved; this is not an offline regional map download.
- Keep the coordinator dashboard open in a second tab. Its reset action erases reports/resources/SMS logs and restores sample data: use it only in the isolated demo database, before rehearsal.
- Open **More options (⋯) → Otukpo demo** to reset the presentation location without changing data. The map never prompts for location on open; if location is already allowed (or a recent fix is saved on the device) it measures "nearest" from the person. Sync and manual pin placement are also in this menu.
- Test the exact road route on the presentation connection. The external routing provider may fail or find no clear alternative. Explain the warning honestly; use resource discovery and offline reporting as the core story.
- Language: the header switch (or **More options (⋯)** on a phone) toggles English and Pidgin. On the USSD simulator, option 3 switches the menu language.
- Freshness: records not re-checked for 72 hours show **May be outdated**. Use the coordinator **Re-seed Data** button before rehearsal so sample records are fresh, or leave one stale on purpose to show the warning.
- The coordinator dashboard's second row shows live impact measures: median review time, % reviewed within 24 hours, share of reports via SMS/USSD, and records needing re-check.
- Record a short backup walkthrough. Prepare a phone-sized window as well as the laptop layout.

## Three-minute script

**0:00–0:20:** “A displaced family near Otukpo needs shelter. Local information changes quickly, and internet access can drop.”

**0:20–0:55:** Choose Shelter, open List view, select a facility, show verification time and total capacity. Tap Directions: the route appears straight away from the person's location, with walking time and any reported dangers. No form to fill. Route warnings stay visible; no route is guaranteed safe.

**0:55–1:35:** Disconnect the browser from the network. Reload the production app to show saved resources. Tap **Report → Water**: the pin is placed automatically (phone GPS works without data; otherwise the last known location, or tap a town). Tap **Yes, it's here**, then **Save report**. Show “Saved on this device” and the waiting-to-sync count on the map.

**1:35–2:15:** Reconnect. Show “Report synced · Awaiting coordinator review.” In the coordinator tab, refresh and approve the report. Return to the public map: focusing the tab refreshes it, and it also refreshes every 30 seconds while connected. Show the new verified resource. Private reporter contact is not the public facility contact.

**2:15–2:40:** Show one `WATER Otukpo market` query in the SMS simulator. “This demonstrates the gateway workflow. Live SMS delivery and a dedicated USSD shortcode are future integrations.”

**2:40–3:00:** “We want to validate this workflow with local coordinators: how quickly reports can be checked, whether families can find relevant help, and how well saved information supports a network outage.” Describe partnerships as proposed unless confirmed.

## Location on a laptop versus phone

The browser supplies an estimate, not a guaranteed GPS fix. A laptop may have a much larger uncertainty than a phone. The app requests fresh, high-accuracy positioning, displays the full reported accuracy radius, and requires confirmation before using it as the route start. **Place a pin** or select a landmark if the estimate is wrong. When reporting, the pin is placed automatically from fresh GPS, then the last known location saved on the device (shown with its age), and otherwise the person taps the map or picks a town. Laptops' rough network estimates (over 2 km) are never used automatically. A laptop on a phone's mobile-data hotspot has no GPS and is often placed in the network's gateway city (Abuja, Lagos), sometimes with a confident accuracy figure: any fix outside Idoma land is refused with a plain explanation and never saved as the last known location. On stage, demo location from the phone itself, or use Place a pin on the laptop. Coordinators see how each report's location was found. The app cannot manufacture a precise location when the device/provider cannot supply one.

## Claims to keep precise

- Built: resource discovery, reporting, coordinator review, saved resources, queued reports with retry deduplication, road-route hazard checks.
- Offline: cached application, saved resources, the full street map of Idoma land (6.5 MB, saved automatically on the first visit, sharp at every zoom, including places never viewed), report storage, and directions. While online the app quietly saves road routes from the person to the nearest place of each kind (and every route they open). Offline, Directions uses a saved road route that starts within 1.5 km; otherwise it shows a compass direction, straight-line distance and walking time, clearly labelled as not a road.
- Simulated: sample resource availability, SMS/USSD gateway interactions. Real place names do not establish real facility availability.
- Next: field validation, live telecom integration, operational verification/expiry policies, deployment hardening. Do not claim measured impact or signed partners without evidence.
