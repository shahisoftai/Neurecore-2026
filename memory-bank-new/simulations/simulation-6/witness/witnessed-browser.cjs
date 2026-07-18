#!/usr/bin/env node
// witnessed-browser.cjs — driven via FIFO at /tmp/witness-cmd.fifo
const { chromium } = require('/home/najeeb/Linux-Dev/neurecore-2026/neurecore/memory-bank-new/simulations/simulation-6/witness/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const ROOT = '/home/najeeb/Linux-Dev/neurecore-2026/neurecore/memory-bank-new/simulations/simulation-6/witness';
const LOG = path.join(ROOT, 'witness.log');
const SHOTS = path.join(ROOT, 'screenshots');
const REC = path.join(ROOT, 'recording');
const FIFO = '/tmp/witness-cmd.fifo';

fs.mkdirSync(ROOT, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(REC, { recursive: true });
fs.writeFileSync(LOG, '');
try { fs.unlinkSync(FIFO); } catch {}
require('child_process').execSync(`mkfifo "${FIFO}"`);

const ts = () => new Date().toISOString();
const log = (m) => { const l = `[${ts()}] ${m}\n`; fs.appendFileSync(LOG, l); process.stdout.write(l); };

log('=== Witnessed Browser Session Start ===');
log('DISPLAY=:0');
log('FIFO: ' + FIFO);
log('Logger: ' + LOG);

(async () => {
  log('Launching HEADED Chrome...');
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--start-maximized', '--window-position=200,100'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: REC, size: { width: 1280, height: 800 } } });
  const page = await ctx.newPage();
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) log(`NAV ${f.url()}`); });
  page.on('console', (m) => { if (m.type() === 'error') log(`CONSOLE ERR: ${m.text().slice(0,300)}`); });

  log('Browser launched. Bringing window to front via wmctrl...');
  const { execSync } = require('child_process');
  try {
    execSync('sleep 1; WID=$(DISPLAY=:0 wmctrl -l | grep -i "about:blank - Google Chrome" | head -1 | awk "{print \\$1}"); [ -n "$WID" ] && DISPLAY=:0 wmctrl -i -R "$WID"', { stdio: 'inherit' });
    log('Window brought to front.');
  } catch (e) { log('wmctrl bring-to-front failed: ' + e.message); }

  log('');
  log('Ready for commands via FIFO. Send JSON lines:');
  log('  {"action":"goto","url":"https://hq.neurecore.com"}');
  log('  {"action":"click","selector":"..."}');
  log('  {"action":"fill","selector":"...","text":"..."}');
  log('  {"action":"type","selector":"...","text":"..."}');
  log('  {"action":"press","key":"Enter"}');
  log('  {"action":"wait","ms":2000}');
  log('  {"action":"screenshot","name":"..."}');
  log('  {"action":"snapshot"}');
  log('  {"action":"eval","code":"..."}');
  log('  {"action":"stop"}');
  log('');

  const handleCmd = async (line) => {
    let cmd;
    try { cmd = JSON.parse(line); } catch (e) { log('BAD JSON: ' + line); return; }
    log(`CMD ${JSON.stringify(cmd).slice(0,200)}`);
    try {
      if (cmd.action === 'goto') await page.goto(cmd.url);
      else if (cmd.action === 'click') { await page.click(cmd.selector); await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {}); }
      else if (cmd.action === 'fill') await page.fill(cmd.selector, cmd.text);
      else if (cmd.action === 'wait') await page.waitForTimeout(cmd.ms);
      else if (cmd.action === 'screenshot') { const n = cmd.name || `shot-${Date.now()}`; const fp = path.join(SHOTS, `${n}.png`); await page.screenshot({ path: fp }); log(`SHOT ${fp}`); }
      else if (cmd.action === 'snapshot') { const u = page.url(); const t = await page.title(); log(`SNAP url=${u} title=${t}`); }
      else if (cmd.action === 'eval') { const r = await page.evaluate(cmd.code); log(`EVAL ${JSON.stringify(r).slice(0,500)}`); }
      else if (cmd.action === 'type') { await page.click(cmd.selector); await page.keyboard.type(cmd.text, { delay: 20 }); log(`TYPED ${cmd.text.slice(0,30)}`); }
      else if (cmd.action === 'press') { await page.keyboard.press(cmd.key); log(`PRESS ${cmd.key}`); }
      else if (cmd.action === 'window-front') {
        try { execSync('WID=$(DISPLAY=:0 wmctrl -l | grep -i "Google Chrome" | head -1 | awk "{print \\$1}"); [ -n "$WID" ] && DISPLAY=:0 wmctrl -i -R "$WID"', { stdio: 'inherit' }); } catch (e) { log('front failed: ' + e.message); }
      }
      else if (cmd.action === 'stop') { log('stopping'); running = false; await browser.close(); process.exit(0); }
      else log('UNKNOWN action: ' + cmd.action);
    } catch (e) {
      log('ERR on ' + cmd.action + ': ' + e.message);
    }
  };

  let running = true;
  const readFifo = () => {
    const stream = fs.createReadStream(FIFO, { encoding: 'utf8' });
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) handleCmd(line.trim()).catch(e => log('HANDLE ERR: ' + e.message));
    });
    stream.on('end', () => { if (running) setTimeout(readFifo, 100); });
    stream.on('error', (e) => log('FIFO ERR: ' + e.message));
  };

  log('Opening FIFO for reading...');
  readFifo();

  while (running) await new Promise(r => setTimeout(r, 500));
})().catch(e => { log('FATAL: ' + e.message); log(e.stack); process.exit(1); });
