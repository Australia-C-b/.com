/*! Capital Bank of Australia – install-as-app helper
 *  - registers the service worker
 *  - Android / Windows / macOS / ChromeOS (Chrome, Edge, Samsung, Opera): one-tap install via the native prompt
 *  - iPhone / iPad / Safari on Mac: shows a short "Add to Home Screen / Dock" guide (Apple offers no install API)
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var BASE = new URL('./', script && script.src ? script.src : location.href).href;

  /* ---------- service worker ---------- */
  var secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && secure) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(BASE + 'sw.js', { scope: BASE }).catch(function () {});
    });
  }

  /* ---------- already running as an app? ---------- */
  function isStandalone() {
    return ['standalone', 'window-controls-overlay', 'minimal-ui', 'fullscreen'].some(function (m) {
      return window.matchMedia('(display-mode: ' + m + ')').matches;
    }) || window.navigator.standalone === true;
  }
  if (isStandalone()) return;

  /* ---------- platform detection ---------- */
  var ua = navigator.userAgent || '';
  var isIPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;       // iPad pretending to be a Mac
  var isIOS = /iPhone|iPad|iPod/.test(ua) || isIPadOS;
  var safariVer = (ua.match(/Version\/(\d+)/) || [])[1] | 0;
  var isMacSafari = !isIOS && /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);
  var canGuide = isIOS || (isMacSafari && safariVer >= 17);                  // Safari 17+ can "Add to Dock"

  var deferred = null, banner = null, shown = false;
  var KEY = 'cboa-pwa-dismissed';
  function dismissed() { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function rememberDismiss() { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} }

  /* ---------- styles ---------- */
  var css = '' +
    '.cboa-pwa,.cboa-guide{font-family:"Hanken Grotesk",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;box-sizing:border-box}' +
    '.cboa-pwa *,.cboa-guide *{box-sizing:border-box}' +
    '.cboa-pwa{position:fixed;z-index:2147483000;left:50%;top:14px;width:min(440px,calc(100vw - 24px));transform:translate(-50%,-150%);opacity:0;' +
      'display:grid;grid-template-columns:48px 1fr;gap:10px 12px;padding:14px;background:#06291a;color:#f3ecd8;border:1px solid rgba(236,208,138,.5);border-radius:14px;' +
      'box-shadow:0 18px 48px rgba(0,0,0,.4);transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .3s}' +
    '.cboa-pwa.in{transform:translate(-50%,0);opacity:1}' +
    '.cboa-pwa img{width:48px;height:48px;border-radius:11px;display:block}' +
    '.cboa-pwa .t strong{display:block;font:600 17px/1.2 "Newsreader","Cormorant Garamond",Georgia,serif;margin:1px 0 3px}' +
    '.cboa-pwa .t span{display:block;font-size:12.5px;line-height:1.45;color:#cfdcd2}' +
    '.cboa-pwa .b{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px}' +
    '.cboa-pwa button,.cboa-guide button{font:inherit;cursor:pointer;border-radius:9px;border:0}' +
    '.cboa-pwa .go,.cboa-guide .go{background:linear-gradient(135deg,#f0d98f,#c9961f);color:#14301f;font-weight:700;font-size:13px;padding:10px 20px}' +
    '.cboa-pwa .no{background:transparent;color:#cfdcd2;font-size:13px;padding:10px 12px;border:1px solid rgba(207,220,210,.25)}' +
    '.cboa-pwa .go:focus-visible,.cboa-pwa .no:focus-visible,.cboa-guide button:focus-visible{outline:2px solid #ecd08a;outline-offset:2px}' +
    '.cboa-guide{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:flex-end;justify-content:center;background:rgba(2,16,10,.62);opacity:0;transition:opacity .25s}' +
    '.cboa-guide.in{opacity:1}' +
    '.cboa-guide .sheet{width:min(460px,100%);background:#fff;color:#19382c;border-radius:18px 18px 0 0;padding:22px 22px 26px;transform:translateY(30px);transition:transform .35s cubic-bezier(.2,.8,.2,1)}' +
    '.cboa-guide.in .sheet{transform:none}' +
    '.cboa-guide h3{margin:0 0 4px;font:600 21px/1.2 "Newsreader",Georgia,serif;color:#0b4a2c}' +
    '.cboa-guide p{margin:0 0 14px;font-size:13px;color:#66776e;line-height:1.5}' +
    '.cboa-guide ol{margin:0 0 18px;padding:0;list-style:none;counter-reset:s}' +
    '.cboa-guide li{counter-increment:s;display:flex;gap:12px;align-items:center;padding:11px 0;border-top:1px solid rgba(6,75,53,.12);font-size:14px;line-height:1.4}' +
    '.cboa-guide li:before{content:counter(s);flex:none;width:26px;height:26px;border-radius:50%;background:#0b4a2c;color:#ecd08a;font-weight:700;font-size:13px;display:grid;place-items:center}' +
    '.cboa-guide li svg{width:20px;height:20px;vertical-align:-4px;margin:0 2px;color:#146432}' +
    '.cboa-guide .go{width:100%}' +
    '@media(min-width:600px){.cboa-guide{align-items:center}.cboa-guide .sheet{border-radius:18px}}' +
    '@media(prefers-reduced-motion:reduce){.cboa-pwa,.cboa-guide,.cboa-guide .sheet{transition:none}}';

  function injectStyles() {
    if (document.getElementById('cboa-pwa-css')) return;
    var s = document.createElement('style'); s.id = 'cboa-pwa-css'; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  var SHARE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"/><path d="M8 8l4-4 4 4"/><path d="M6 12H5a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-1"/></svg>';
  var PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';

  /* ---------- guide (iPhone / iPad / Safari on Mac) ---------- */
  function openGuide() {
    injectStyles();
    var device = isIPadOS || /iPad/.test(ua) ? 'iPad' : (isIOS ? 'iPhone' : 'Mac');
    var steps = isIOS
      ? ['Tap the <b>Share</b> button ' + SHARE_SVG + ' in Safari’s toolbar.',
         'Scroll down and tap <b>Add to Home Screen</b> ' + PLUS_SVG + '.',
         'Tap <b>Add</b>. Capital Bank now opens like an app.']
      : ['Click the <b>Share</b> button ' + SHARE_SVG + ' in Safari’s toolbar (or open the <b>File</b> menu).',
         'Choose <b>Add to Dock…</b>',
         'Click <b>Add</b>. Capital Bank now opens like an app.'];
    var g = document.createElement('div');
    g.className = 'cboa-guide'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-label', 'Install Capital Bank');
    g.innerHTML = '<div class="sheet"><h3>Install on your ' + device + '</h3>' +
      '<p>Apple doesn’t allow one-tap installs, so it takes three quick steps:</p><ol>' +
      steps.map(function (x) { return '<li><span>' + x + '</span></li>'; }).join('') +
      '</ol><button type="button" class="go">Got it</button></div>';
    function close() { g.classList.remove('in'); document.removeEventListener('keydown', onKey); setTimeout(function () { g.remove(); }, 260); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    g.addEventListener('click', function (e) { if (e.target === g) close(); });
    g.querySelector('.go').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(g);
    requestAnimationFrame(function () { g.classList.add('in'); });
  }

  /* ---------- install banner ---------- */
  function hide() {
    if (!banner) return;
    var b = banner; banner = null; b.classList.remove('in');
    setTimeout(function () { b.remove(); }, 450);
  }

  function install() {
    if (deferred) {
      var d = deferred; deferred = null;
      hide();
      d.prompt();                                   // native confirm – this is the actual install
      if (d.userChoice) d.userChoice.catch(function () {});
    } else if (canGuide) {
      hide(); openGuide();
    }
  }

  function show() {
    if (shown || banner || dismissed() || isStandalone() || !document.body) return;
    if (!deferred && !canGuide) return;
    shown = true;
    injectStyles();
    banner = document.createElement('div');
    banner.className = 'cboa-pwa'; banner.setAttribute('role', 'dialog'); banner.setAttribute('aria-label', 'Install Capital Bank app');
    banner.innerHTML = '<img src="' + BASE + 'icons/icon-192.png" alt="" width="48" height="48">' +
      '<div class="t"><strong>Install Capital Bank</strong><span>Add the app to your device for faster, full-screen access.</span></div>' +
      '<div class="b"><button type="button" class="no">Not now</button><button type="button" class="go">Install</button></div>';
    banner.querySelector('.go').addEventListener('click', install);
    banner.querySelector('.no').addEventListener('click', function () { rememberDismiss(); hide(); });
    document.body.appendChild(banner);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (banner) banner.classList.add('in'); }); });
  }

  function schedule() {
    if (shown || dismissed()) return;
    var go = function () { setTimeout(show, 700); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();                              // keep the event so our own button can fire it
    deferred = e;
    schedule();
  });
  window.addEventListener('appinstalled', function () { deferred = null; hide(); });
  if (canGuide) schedule();
})();
