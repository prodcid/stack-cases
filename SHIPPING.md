# Shipping Stack Cases

Double-click these in the `stack cases` folder:

| File | What it does |
|---|---|
| **1 - Play.cmd** | Opens your working copy (`stack-cases.html`) |
| **2 - Try before shipping.cmd** | Builds exactly what your mate would get and opens it. Sends nothing. |
| **3 - Ship to mate.cmd** | Asks what changed, checks the file, publishes it |
| **4 - First time setup.cmd** | One-time GitHub wiring (already done for prodcid/stack-cases) |

Terminal equivalents: `node ship.js "what changed"`, `node ship.js --local "notes"`,
`node ship.js status`, `node ship.js check`.

## How it works

- `stack-cases.html` is the game. Edit this one.
- Shipping stamps a version (`YYYY.MM.DD.N`) into `dist/stack-cases.html`, commits, pushes.
- `launcher-cases.html` is the only file your mate has. Each time he opens it online it downloads
  `dist/stack-cases.html` from GitHub (jsdelivr as backup), caches it, and runs it.
  Offline, it runs the last cached build.
- Saves (`stackCases.v2`) stay put across updates.
- The repo must be **public** or the launcher can't download.
- Don't hand-edit `dist/`; it's rebuilt every ship.

## Rolling back

```
git log --oneline
git revert <bad-commit>
node ship.js "roll back"
```
