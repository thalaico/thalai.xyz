# thalai.xyz

Personal site for projects and experiments. Plain static HTML, CSS and JS, served by GitHub Pages. No build step.

```
/                         landing page
/about/                   about me
/projects/                project list
/projects/hai/            HAI: what it is, how it's built, the plan
/projects/hai/progress/   HAI timeline, live scoreboard and result charts
/projects/hai/data/       timeline.json and runs.json (the progress page reads these)
```

## Updating HAI progress

The progress page is generated in the browser from two files. Edit them and push; nothing else changes.

**`projects/hai/data/timeline.json`**: the timeline of milestones, decisions and results.

```json
{
  "date": "2026-10-24",
  "stage": "baseline",
  "kind": "result",
  "title": "Baseline: 32% on held-out tasks",
  "note": "One or two sentences on what happened.",
  "details": ["Optional longer paragraphs, shown under 'More'."],
  "metrics": { "config": "baseline", "tasks_seen": 100, "heldout_pass_rate": 0.32, "delta_pts": 0 }
}
```

- `kind`: `milestone`, `decision`, `learning`, `direction` (a change of course) or `result`.
- `stage`: one of the ids in `stages`. A new stage heading appears on the timeline when it changes.
- `metrics` is only for `result` entries; the bubble on the spine shows the pass rate.
- `next` at the top level is the dashed "Up next" bubble at the end. Update it as plans change.

**`projects/hai/data/runs.json`**: one checkpoint per held-out evaluation, used by the charts and the scoreboard.

```json
{
  "date": "2026-10-24",
  "config": "baseline",
  "tasks_seen": 100,
  "heldout_pass_rate": 0.32,
  "regression_rate": 0.0,
  "steps_per_solved": 17.4,
  "memory_items": 0,
  "cost_per_solved": 0.04
}
```

Rates are fractions (0.32 = 32%); `cost_per_solved` is in US dollars. `config` must match an id in `configs`.

The HAI runner can write these files and commit them automatically after each evaluation. Keep any API keys (for example the OpenCode key used for DeepSeek) in the runner's environment or GitHub Actions secrets, never in this repo.

## Custom domain

`CNAME` already contains `thalai.xyz`. At your DNS provider, add:

| Type | Name | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | `<github-user-or-org>.github.io` |

Then in the repo: Settings, Pages, deploy from the `main` branch root, and tick "Enforce HTTPS" once the certificate is issued.

## Previewing locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Pages use root-relative paths, so open the site from a server rather than the file system.
