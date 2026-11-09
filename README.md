# Chronogram Calendar: Ulster County pilot

A free, no-sign-up events site for Ulster County (Dec 2026 – May 2027) with a built-in trip planner.

- **Browse:** every Ulster County event from calendar.chronogram.com, with poster images, filters by category, date and town.
- **Plan:** type something like *"I like music and movies, plan Dec 19–20 near Kingston"*. The site builds a day-by-day plan with events, lunch and dinner stops nearby, drive times, distances and ticket prices.
- **Costs nothing:** hosting on GitHub Pages, daily updates via GitHub Actions, maps from OpenStreetMap, and a planner that runs in the browser. No API keys or accounts beyond GitHub.

---

## 1. Put it on GitHub (one time, ~5 minutes)

1. Go to **github.com/AChandrika/Chronogram**, then **Add file → Upload files**.
2. Unzip `chronogram-pilot.zip` on your computer and drag **everything inside the folder** into the upload box, including the hidden `.github` folder.
   - On a Mac, press **Cmd + Shift + .** in Finder to show hidden folders.
   - If `.github` won't upload by drag-and-drop, create the file by hand instead: **Add file → Create new file**, name it `.github/workflows/update-data.yml`, and paste in the contents of that file.
3. Click **Commit changes**.

## 2. Turn on the website

1. In the repo, open **Settings → Pages**.
2. Under "Build and deployment", set **Source: Deploy from a branch**, **Branch: main**, **Folder: / (root)**, then **Save**.
3. After a minute or two, the site is live at **https://achandrika.github.io/Chronogram/**.

## 3. Let the daily update save its work

1. Open **Settings → Actions → General**.
2. Scroll to "Workflow permissions" and choose **Read and write permissions**, then **Save**.
3. Open the **Actions** tab. If GitHub asks, click **"I understand my workflows, go ahead and enable them"**.
4. Click **Update calendar data → Run workflow**, choose **full**, then **Run**. The first full run takes 20–40 minutes, because it reads every day of the pilot window. After that:
   - **Every morning (~4am):** it re-reads Chronogram's calendar.
   - **Every hour:** it re-reads the Google Sheet, so your edits show up within about an hour.
   - To update right away, run the workflow by hand.

## 4. The Google Sheet (adding, fixing or hiding events)

The sheet is already linked in `config.json`.

1. Open the sheet. Paste this exact header row into **row 1**:

   ```
   type,title,category,start_date,end_date,start_time,end_time,venue,address,town,price,link,image_url,description
   ```
   Or import `sheet/sheet-columns.csv` with **File → Import → Replace current sheet**. It includes three example rows; delete them.
2. Keep sharing set to **Anyone with the link → Viewer**. That's how the site reads it.

| type | What it does |
|---|---|
| `event` | Adds an event. Needs at least `title` and `start_date` (2026-12-18 or 12/18/2026). Fill in times like `7:30 PM`. |
| `restaurant` | Adds a place to eat that the planner can suggest. Needs `title` plus `address` and/or `town`. |
| `hide` | Removes a Chronogram event from the pilot. Put the event's Chronogram link in `link`. |

Categories the site understands: Music, Film, Arts & Culture, Theater & Comedy, Food & Drink, Family, Outdoors, Classes & Workshops, Talks & Literary, Wellness, Markets & Festivals, Community.

---

## How it works (for whoever maintains it)

```
index.html, assets/        the website (plain HTML/CSS/JS, no build step)
assets/planner.js          the rule-based planner: reads dates, interests, town, budget, food wishes
scripts/update.mjs         data pipeline run by GitHub Actions
scripts/lib.mjs            shared helpers (Ulster town list, category mapping, time parsing)
config.json                pilot window, county, Google Sheet link, Chronogram dining categories
data/events.json           the events the site shows (generated)
data/places.json           restaurants for meal stops (generated)
data/cache/                saved lookups so daily runs are fast and polite
```

- **Events:** the pipeline asks calendar.chronogram.com for each day in the window (`EventSearch?narrowByDate=YYYY-MM-DD`). That gives the real dates for recurring events. Each event page's structured data supplies the venue, address, description, image and price.
- **Ulster County check:** addresses are located with the free US Census geocoder, which also reports the county. OpenStreetMap is the fallback, then a list of Ulster towns.
- **Restaurants:** Chronogram's Places dining listings in Ulster towns, plus OpenStreetMap. Chronogram listings are preferred in plans.
- **Drive times:** estimated as 1.3× straight-line distance at about 32 mph, plus parking. They're good for planning, not turn-by-turn.
- **Run locally:** `npm install && node scripts/update.mjs` (or `--sheet` for a quick sheet-only refresh), then serve the folder with any static server, e.g. `npx serve`.

**Upgrading later (optional):** the planner was built so an AI model can replace `parseQuery` in `assets/planner.js` without touching anything else. That would need an API key and a small server function, which costs money.
