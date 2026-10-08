#!/usr/bin/env node
/* ============================================================================
   ship.js — build + publish Stack Cases.

     node ship.js setup <github-user> <repo>   one-time: wire the launcher up
     node ship.js "what changed"               check, stamp a build, commit, push
     node ship.js --local "what changed"       build into dist/ but don't push
     node ship.js status                       what's shipped vs what's local

   Shipping does, in order:
     1. check stack-cases.html   (refuses to ship a file with a syntax error)
     2. stamp a new version into the published copy
     3. write dist/stack-cases.html + dist/version.json
     4. git commit + push

   launcher-cases.html downloads dist/stack-cases.html every time it's opened online,
   caches it, and runs it. Nothing to re-send, ever.
   ========================================================================== */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT     = __dirname;
const GAME     = path.join(ROOT, 'stack-cases.html');
const LAUNCHER = path.join(ROOT, 'launcher-cases.html');
const DIST     = path.join(ROOT, 'dist');
const VER_RE   = /<meta name="stack-version" content="([^"]*)">/;

const read  = f => fs.readFileSync(f, 'utf8');
const write = (f, s) => fs.writeFileSync(f, s);
const die   = m => { console.error('\n  ' + m + '\n'); process.exit(1); };

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function gitSoft(...args) {
  try { return git(...args); } catch (e) { return null; }
}

/* D: is a removable drive. exFAT/FAT record no ownership, so git treats the repo
   as "dubious" and refuses every command until the path is allow-listed. */
function ensureTrusted() {
  if (!fs.existsSync(path.join(ROOT, '.git'))) return;
  try { git('status', '--porcelain'); return; } catch (e) {
    if (!/dubious ownership/i.test(String(e.stderr || ''))) return;
    const p = ROOT.replace(/\\/g, '/');
    console.log(`  allow-listing ${p} with git (removable drive, no ownership recorded)`);
    try { execFileSync('git', ['config', '--global', '--add', 'safe.directory', p], { stdio: 'ignore' }); } catch (e2) {}
  }
}

/* ---------- check: never ship a file that can't run ---------- */
function check() {
  const html = read(GAME);
  let bad = 0;
  if (!VER_RE.test(html)) { console.log('x  no <meta name="stack-version"> tag in <head>'); bad++; }
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (!scripts.length) { console.log('x  no <script> block found'); bad++; }
  scripts.forEach((m, i) => {
    const jsStart = html.slice(0, m.index).split('\n').length;
    const tmp = path.join(os.tmpdir(), `stack-cases-check-${i}.js`);
    write(tmp, m[1]);
    const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
    fs.unlinkSync(tmp);
    if (r.status !== 0) {
      bad++;
      console.log('x  SYNTAX ERROR');
      console.log((r.stderr || '').split('\n').slice(0, 10).join('\n')
        .split(tmp).join('stack-cases.html')
        .replace(/stack-cases\.html:(\d+)/g, (_, n) => `stack-cases.html:${jsStart + (+n) - 1}`));
    }
  });
  if (!bad) console.log('ok stack-cases.html passes its checks');
  return bad === 0;
}

/* ---------- version numbers: YYYY.MM.DD.N, N resets each day ---------- */
const vKey = v => {
  const m = /^(\d{4})\.(\d{2})\.(\d{2})\.(\d+)$/.exec(v || '');
  return m ? (+m[1] * 1e10 + +m[2] * 1e8 + +m[3] * 1e6 + +m[4]) : -1;
};

/* Highest version ever published, from git history as well as dist/, so a
   version number can never be reused. */
function highestShipped() {
  let best = null, bestK = -1;
  const consider = v => { const k = vKey(v); if (k > bestK) { bestK = k; best = v; } };
  const f = path.join(DIST, 'version.json');
  if (fs.existsSync(f)) { try { consider(JSON.parse(read(f)).version); } catch (e) {} }
  const log = gitSoft('log', '--format=%s');
  if (log) for (const line of log.split('\n')) consider(line.trim().split(/\s+/)[0]);
  return best;
}

function nextVersion() {
  const d = new Date();
  const today = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('.');
  const hi = highestShipped();
  const h = /^(\d{4}\.\d{2}\.\d{2})\.(\d+)$/.exec(hi || '');
  if (!h) return `${today}.1`;
  const next = h[1] === today ? `${today}.${+h[2] + 1}` : `${today}.1`;
  return vKey(next) > vKey(hi) ? next : `${h[1]}.${+h[2] + 1}`;
}

/* ---------- setup ---------- */
function setup(user, repo) {
  if (!user || !repo) die('Usage: node ship.js setup <github-user> <repo-name>');

  const L = read(LAUNCHER);
  if (!/user:\s*'[^']*'/.test(L) || !/repo:\s*'[^']*'/.test(L))
    die('Could not find the SRC block in launcher-cases.html. Did it get edited?');
  write(LAUNCHER, L.replace(/user:\s*'[^']*'/, `user:   '${user}'`)
                   .replace(/repo:\s*'[^']*'/, `repo:   '${repo}'`));

  ensureTrusted();
  if (!fs.existsSync(path.join(ROOT, '.git'))) {
    git('init');
    ensureTrusted();
    console.log('  git repo initialised');
  }
  // the launcher fetches from "main"; a repo left on "master" would 404 silently.
  if ((gitSoft('rev-parse', '--abbrev-ref', 'HEAD') || '') !== 'main') {
    gitSoft('branch', '-M', 'main');
    gitSoft('symbolic-ref', 'HEAD', 'refs/heads/main');
    console.log('  branch -> main');
  }
  const want = `https://github.com/${user}/${repo}.git`;
  if (!gitSoft('remote', 'get-url', 'origin')) git('remote', 'add', 'origin', want);
  else git('remote', 'set-url', 'origin', want);
  console.log(`  remote origin -> github.com/${user}/${repo}`);

  console.log(`
  Launcher now points at github.com/${user}/${repo}

  Next, one time only:
    1. Create an EMPTY public repo named "${repo}" at github.com/new
       (no README, no .gitignore - this folder supplies them)
    2. node ship.js "first build"
    3. Send launcher-cases.html to your mate. That's the only file he ever needs.
`);
}

/* ---------- status ---------- */
function status() {
  console.log('\n  shipped build  ' + (highestShipped() || '(nothing shipped yet)'));
  console.log('  next ship      ' + nextVersion());
  const dirty = gitSoft('status', '--porcelain');
  console.log('  uncommitted    ' + (dirty ? dirty.split('\n').length + ' file(s)' : 'none'));
  const L = read(LAUNCHER);
  const u = /user:\s*'([^']*)'/.exec(L), r = /repo:\s*'([^']*)'/.exec(L);
  console.log('  launcher       ' + (u && u[1] !== 'USER' ? `${u[1]}/${r[1]}` : 'NOT CONFIGURED - run: node ship.js setup <user> <repo>'));
  console.log('');
}

/* ---------- ship ---------- */
function ship(notes, local) {
  if (!check()) die('Check failed. Fix that first - a broken build would auto-install on your mate.');

  const version = nextVersion();
  const html = read(GAME).replace(VER_RE, `<meta name="stack-version" content="${version}">`);

  fs.mkdirSync(DIST, { recursive: true });
  write(path.join(DIST, 'stack-cases.html'), html);
  write(path.join(DIST, 'version.json'), JSON.stringify({
    version,
    notes: notes || '',
    bytes: Buffer.byteLength(html),
    at: new Date().toISOString()
  }, null, 2) + '\n');
  console.log(`\n  built ${version}  (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);

  if (local) {
    console.log('  --local: stopped before git. dist/ is up to date.\n');
    return;
  }

  if (!fs.existsSync(path.join(ROOT, '.git'))) die('No git repo yet. Run "4 - First time setup.cmd" first.');
  ensureTrusted();
  git('add', '-A');
  // Nothing new still pushes: a previous ship may have committed and then failed to push.
  if (gitSoft('diff', '--cached', '--name-only')) git('commit', '-m', `${version}${notes ? ' - ' + notes : ''}`);
  else console.log('  nothing new to commit - pushing anything not yet published.');

  try {
    git('push', '-u', 'origin', gitSoft('rev-parse', '--abbrev-ref', 'HEAD') || 'main');
  } catch (e) {
    die('Commit made, but the push failed:\n  ' + String(e.stderr || e.message).trim() +
        '\n\n  Usually: the GitHub repo does not exist yet, or you are not signed in to git.');
  }
  console.log(`  pushed ${version}. Your mate gets it next time he opens launcher-cases.html.\n`);
}

/* ---------- dispatch ---------- */
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'setup')        setup(rest[0], rest[1]);
else if (cmd === 'status')  status();
else if (cmd === 'check')   process.exit(check() ? 0 : 1);
else if (cmd === '--local') ship(rest.join(' '), true);
else if (!cmd)              die('Say what changed:  node ship.js "fixed the case opening"');
else                        ship([cmd, ...rest].join(' '), false);
