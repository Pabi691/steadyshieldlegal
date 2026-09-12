/* =============================================================================
   STEADYSHIELD LEGAL — Smart UI layer
   Command palette · theme switch · practice filter + detail drawer · matter
   triage · insights filter + bookmarks · FAQ · counters · toasts · action dock ·
   section rail · smart contact form · consent · keyboard shortcuts.

   Classic script, no dependencies. Loaded BEFORE main.js so it can claim the
   modules it supersedes (`window.__SMART__`); its own work is deferred to
   DOMContentLoaded, by which point main.js has published window.__SS.
   ========================================================================== */
(() => {
  'use strict';

  window.__SMART__ = true;

  /* ==========================================================================
     UTILITIES
     ====================================================================== */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const debounce = (fn, ms = 140) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  /** localStorage that never throws (private mode, blocked cookies, quota). */
  const store = {
    get(k, fallback = null) {
      try {
        const v = localStorage.getItem('ss:' + k);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(k, v) {
      try { localStorage.setItem('ss:' + k, JSON.stringify(v)); return true; }
      catch (e) { return false; }
    },
    del(k) { try { localStorage.removeItem('ss:' + k); } catch (e) {} },
  };

  const reduced = () => (window.__SS ? window.__SS.prefersReduced : false) ||
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = () => (window.__SS ? window.__SS.coarse : false) ||
    matchMedia('(pointer: coarse)').matches;

  /** Scroll that honours Lenis when main.js has it running. */
  function goTo(target) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    const lenis = window.__SS && window.__SS.lenis;
    if (lenis) lenis.scrollTo(el, { duration: 1.3 });
    else el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }

  /** Fuzzy subsequence match. Returns {score, html} or null. */
  function fuzzy(needle, hay) {
    const n = needle.toLowerCase().trim();
    if (!n) return { score: 0, html: esc(hay) };
    const h = hay.toLowerCase();
    const direct = h.indexOf(n);
    if (direct > -1) {
      return {
        score: 1000 - direct * 2 - (hay.length - n.length) * 0.1,
        html: esc(hay.slice(0, direct)) + '<mark>' + esc(hay.slice(direct, direct + n.length)) +
              '</mark>' + esc(hay.slice(direct + n.length)),
      };
    }
    let hi = 0, score = 0, run = 0;
    for (let ni = 0; ni < n.length; ni++) {
      const c = n[ni];
      if (c === ' ') { run = 0; continue; }
      const found = h.indexOf(c, hi);
      if (found === -1) return null;
      run = found === hi ? run + 1 : 1;
      score += 10 + run * 4 - Math.min(found - hi, 12);
      hi = found + 1;
    }
    return { score, html: esc(hay) };
  }

  /** Every whitespace token must appear literally. Fuzzy subsequence matching
      is right for a command palette and far too permissive for a filter. */
  function tokensMatch(query, hay) {
    const h = hay.toLowerCase();
    return query.toLowerCase().split(/\s+/).filter(Boolean).every((t) => h.includes(t));
  }

  /* --------------------------------------------------------------- focus trap */
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function trap(container) {
    const prev = document.activeElement;
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const items = $$(FOCUSABLE, container).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    container.addEventListener('keydown', onKey);
    return () => {
      container.removeEventListener('keydown', onKey);
      if (prev && prev.focus) prev.focus();
    };
  }

  /** Page scroll lock that stacks (drawer over palette, etc). */
  const lock = (() => {
    let depth = 0;
    return {
      on() {
        if (depth++ === 0) {
          document.body.style.overflow = 'hidden';
          const l = window.__SS && window.__SS.lenis; if (l) l.stop();
        }
      },
      off() {
        if (depth > 0 && --depth === 0) {
          document.body.style.overflow = '';
          const l = window.__SS && window.__SS.lenis; if (l) l.start();
        }
      },
    };
  })();

  /* ==========================================================================
     TOASTS
     ====================================================================== */
  const toast = (() => {
    let host;
    const ICONS = {
      ok:   '<path d="M20 6 9 17l-5-5"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
      err:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16h.01"/>',
    };
    return function show(msg, opts = {}) {
      const { type = 'ok', duration = 4200, action = null } = opts;
      host = host || $('#toasts');
      if (!host) return;
      const el = document.createElement('div');
      el.className = 'toast' + (type === 'err' ? ' toast--err' : '');
      el.setAttribute('role', type === 'err' ? 'alert' : 'status');
      el.innerHTML =
        `<svg class="toast__ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[type] || ICONS.info}</svg>` +
        `<span class="toast__txt">${esc(msg)}</span>` +
        (action ? `<button type="button" class="toast__act">${esc(action.label)}</button>` : '') +
        `<button type="button" class="toast__x" aria-label="Dismiss">&times;</button>`;

      const close = () => {
        el.classList.add('is-out');
        setTimeout(() => el.remove(), 320);
      };
      on($('.toast__x', el), 'click', close);
      if (action) on($('.toast__act', el), 'click', () => { action.run(); close(); });

      host.appendChild(el);
      const timer = setTimeout(close, duration);
      on(el, 'pointerenter', () => clearTimeout(timer));
      while (host.children.length > 3) host.firstElementChild.remove();
      return close;
    };
  })();

  /* ==========================================================================
     THEME — three modes, cycled in one control:
       dark      · midnight ground, WebGL stage running
       daylight  · paper ground, WebGL stage running (retuned for light)
       reading   · paper ground, stage stood down for a calm, fast read

     data-mode carries the mode; data-theme keeps carrying only the palette
     (dark | light) so every selector written against it still applies.
     ====================================================================== */
  const theme = (() => {
    const KEY = 'mode';
    const ORDER = ['dark', 'daylight', 'reading'];
    const meta = () => $('meta[name="theme-color"]');

    const MODES = {
      dark: {
        palette: 'dark', themeColor: '#0a0c10',
        next: 'daylight', nextLabel: 'Switch to daylight cinematic mode',
        toast: 'Cinematic mode on — full dark stage restored.',
      },
      daylight: {
        palette: 'light', themeColor: '#f3f0e9',
        next: 'reading', nextLabel: 'Switch to light reading mode',
        toast: 'Daylight mode on — paper ground, cinematic layer still running.',
      },
      reading: {
        palette: 'light', themeColor: '#f3f0e9',
        next: 'dark', nextLabel: 'Switch to cinematic dark mode',
        toast: 'Reading mode on — lighter palette, cinematic layer paused.',
      },
    };

    function current() {
      const m = document.documentElement.getAttribute('data-mode');
      return MODES[m] ? m : 'daylight';
    }

    function apply(mode, animate) {
      const cfg = MODES[mode] || MODES.dark;
      const root = document.documentElement;
      if (animate && !reduced()) {
        root.classList.add('theme-anim');
        setTimeout(() => root.classList.remove('theme-anim'), 620);
      }
      root.setAttribute('data-mode', mode);
      root.setAttribute('data-theme', cfg.palette);
      root.style.colorScheme = cfg.palette;
      const m = meta();
      if (m) m.setAttribute('content', cfg.themeColor);
      $$('[data-theme-toggle]').forEach((b) => {
        b.setAttribute('aria-pressed', String(cfg.palette === 'light'));
        b.setAttribute('aria-label', cfg.nextLabel);
      });
      document.dispatchEvent(new CustomEvent('ss:theme', {
        detail: { mode, palette: cfg.palette },
      }));
    }

    function set(mode, opts = {}) {
      if (!MODES[mode]) mode = 'dark';
      apply(mode, true);
      store.set(KEY, mode);
      if (opts.announce !== false) {
        toast(MODES[mode].toast, { type: 'info', duration: 3400 });
      }
    }

    function toggle() { set(MODES[current()].next); }

    function init() {
      apply(current(), false);
      $$('[data-theme-toggle]').forEach((b) => on(b, 'click', () => toggle()));
    }

    return { init, toggle, set, current, ORDER };
  })();

  /* ==========================================================================
     PRACTICE AREA CONTENT (drives the drawer, the palette and the triage)
     ====================================================================== */
  const AREAS = {
    bank: {
      matter: 'Bank & NBFC Dispute Resolution',
      lede: 'Borrower-side representation against banks and NBFCs — from the first demand notice through to recovery proceedings.',
      handle: [
        'Loan account disputes, statement reconciliation and excess interest claims',
        'Challenges to NPA classification and premature recall of facilities',
        'One-Time Settlement (OTS) proposals and restructuring negotiation',
        'Guarantor and co-borrower liability, including release and substitution',
        'RBI Ombudsman complaints and regulatory escalation',
      ],
      call: [
        'A recall or demand notice has arrived from a bank or NBFC',
        'An account has been classified NPA and you dispute the basis',
        'An OTS is on the table and the terms need testing before you sign',
      ],
    },
    sarfaesi: {
      matter: 'SARFAESI Act',
      lede: 'Secured-asset enforcement under the SARFAESI Act, where the timelines are short and almost all of them run against the borrower.',
      handle: [
        'Replies to Section 13(2) demand notices and Section 13(3A) representations',
        'Resisting symbolic and physical possession under Section 13(4)',
        'Section 17 securitisation applications before the DRT',
        'District Magistrate proceedings under Section 14',
        'Challenges to valuation, auction and sale certificates',
      ],
      call: [
        'A Section 13(2) notice has been served and the sixty days are running',
        'A possession notice has been affixed to the property',
        'An auction or sale notice has been published',
      ],
    },
    drt: {
      matter: 'DRT/DRAT Proceedings',
      lede: 'Recovery litigation before the Debts Recovery Tribunal and its appellate forum, conducted end to end.',
      handle: [
        'Original Applications under the RDB Act — for and against',
        'Written statements, counter-claims and set-off',
        'Interim applications, stay and injunctions before the Tribunal',
        'Recovery certificates, execution and Recovery Officer proceedings',
        'Appeals to the DRAT, including pre-deposit applications',
      ],
      call: [
        'An Original Application has been filed against you',
        'A recovery certificate has been issued and execution has begun',
        'A Tribunal order needs appealing within the limitation period',
      ],
    },
    nclt: {
      matter: 'NCLT & Insolvency',
      lede: 'Insolvency and company matters before the NCLT — creditor and debtor side, from admission through to resolution.',
      handle: [
        'Sections 7, 9 and 10 applications under the Insolvency and Bankruptcy Code',
        'Section 8 demand notices, and replies disputing the debt',
        'Claim submission, verification and Committee of Creditors representation',
        'Resolution plans, liquidation and avoidance proceedings',
        'NCLAT appeals, and oppression and mismanagement petitions',
      ],
      call: [
        'A Section 8 demand notice has been received, or needs issuing',
        'A CIRP has been admitted and claims must be filed with the RP',
        'A company petition or appeal is being contemplated',
      ],
    },
    cheque: {
      matter: 'Section 138 NI (Cheque Bounce) Cases',
      lede: 'Dishonoured cheque prosecutions under the Negotiable Instruments Act — for complainants and for the accused.',
      handle: [
        'Statutory demand notice within thirty days of the return memo',
        'Filing and conduct of complaints within limitation',
        'Defence of the accused, including rebuttal of the Section 139 presumption',
        'Interim compensation under Sections 143A and 148',
        'Compounding, settlement, and appeals or revisions',
      ],
      call: [
        'A cheque has been returned unpaid and the notice clock has started',
        'Summons in a Section 138 complaint have been received',
        'A settlement is possible and needs recording properly',
      ],
    },
    arbitration: {
      matter: 'Arbitration Services',
      lede: 'Arbitration under the 1996 Act — clause to award, and the court applications that sit on either side of it.',
      handle: [
        'Drafting and review of arbitration and escalation clauses',
        'Section 11 applications for appointment of an arbitrator',
        'Interim protection under Section 9 and Section 17',
        'Conduct of proceedings, pleadings and evidence',
        'Section 34 challenges and Section 36 enforcement of awards',
      ],
      call: [
        'A contract contains an arbitration clause and a dispute has crystallised',
        'An award needs enforcing, or challenging within limitation',
        'Assets need protecting before the tribunal is constituted',
      ],
    },
    consumer: {
      matter: 'Consumer Protection Law',
      lede: 'Complaints before the District, State and National Commissions under the Consumer Protection Act, 2019.',
      handle: [
        'Deficiency in service and unfair trade practice complaints',
        'Banking, insurance and finance-related consumer claims',
        'Real estate possession, delay and refund claims',
        'Product liability and e-commerce disputes',
        'Appeals to the SCDRC and NCDRC, and execution of orders',
      ],
      call: [
        'A service you paid for was not delivered as promised',
        'An insurer has repudiated or short-settled a claim',
        'A builder has failed to deliver possession or refund',
      ],
    },
    family: {
      matter: 'Divorce & Family Law',
      lede: 'Matrimonial and family matters handled quietly, with the long view kept in sight throughout.',
      handle: [
        'Mutual consent and contested divorce petitions',
        'Maintenance under Section 125 CrPC and the Hindu Marriage Act',
        'Custody, guardianship and visitation arrangements',
        'Protection under the Domestic Violence Act, and Section 498A matters',
        'Return of stridhan, and mediation and settlement recording',
      ],
      call: [
        'A separation is being contemplated or has just begun',
        'Maintenance or custody needs to be settled properly, not provisionally',
        'Protection or domestic violence proceedings are involved',
      ],
    },
  };

  /* ==========================================================================
     COMMAND PALETTE
     ====================================================================== */
  const cmdk = (() => {
    let root, input, list, index = [], results = [], cursor = 0, open = false, release = null;

    const ICO = {
      section:  '<path d="M4 6h16M4 12h16M4 18h10"/>',
      practice: '<path d="M12 3 4 6.5v5C4 16.5 7.5 19.6 12 21c4.5-1.4 8-4.5 8-9.5v-5z"/>',
      insight:  '<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/>',
      faq:      '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3 2.45V14M12 17h.01"/>',
      action:   '<path d="M13 2 4.5 13H11l-1 9 8.5-11H12z"/>',
    };

    function build() {
      index = [];

      $$('[data-cmdk-section]').forEach((s) => {
        index.push({
          group: 'Sections',
          type: 'section',
          label: s.dataset.cmdkSection,
          meta: s.dataset.cmdkMeta || '',
          run: () => goTo('#' + s.id),
        });
      });

      $$('.panel[data-panel]').forEach((p) => {
        const key = p.dataset.panel;
        const a = AREAS[key];
        index.push({
          group: 'Practice areas',
          type: 'practice',
          label: ($('.panel__title', p).dataset.raw || $('.panel__title', p).textContent).trim(),
          meta: (a && a.lede) || '',
          keywords: [p.dataset.tags || '', a ? a.handle.join(' ') : '', a ? a.call.join(' ') : ''].join(' '),
          run: () => drawer.open(key),
        });
      });

      $$('.card[data-cat]').forEach((c) => {
        index.push({
          group: 'Insights',
          type: 'insight',
          label: (($('.card__link', c) || $('.card__title', c)).dataset.raw ||
                  $('.card__title', c).textContent).trim(),
          meta: $('.card__cat', c).textContent.trim(),
          run: () => { goTo('#insights'); flash(c); },
        });
      });

      $$('.faq__item').forEach((f) => {
        const btn = $('.faq__q', f);
        index.push({
          group: 'Questions',
          type: 'faq',
          label: btn.querySelector('span').textContent.trim(),
          meta: 'Frequently asked',
          run: () => { goTo('#faq'); setTimeout(() => { if (btn.getAttribute('aria-expanded') !== 'true') btn.click(); }, 620); },
        });
      });

      index.push(
        { group: 'Actions', type: 'action', label: 'Schedule a consultation', meta: 'Jump to the enquiry form',
          run: () => { goTo('#contact'); setTimeout(() => $('#f-name') && $('#f-name').focus(), 900); } },
        { group: 'Actions', type: 'action', label: 'Find my practice area', meta: 'Answer three questions',
          run: () => { goTo('#triage'); } },
        { group: 'Actions', type: 'action', label: 'Cinematic mode', meta: 'Dark ground, full WebGL stage',
          run: () => theme.set('dark') },
        { group: 'Actions', type: 'action', label: 'Daylight mode', meta: 'Light ground, WebGL stage running',
          run: () => theme.set('daylight') },
        { group: 'Actions', type: 'action', label: 'Reading mode', meta: 'Light ground, stage paused',
          run: () => theme.set('reading') },
        { group: 'Actions', type: 'action', label: 'Copy email address', meta: 'hello@steadyshieldlegal.com',
          run: () => copy('hello@steadyshieldlegal.com', 'Email address copied.') },
        { group: 'Actions', type: 'action', label: 'Call the office', meta: '+00 000 000 0000',
          run: () => { location.href = 'tel:+000000000000'; } },
        { group: 'Actions', type: 'action', label: 'Keyboard shortcuts', meta: 'Show every shortcut',
          run: () => shortcuts.open() },
        { group: 'Actions', type: 'action', label: 'Saved insights', meta: 'Show only what you bookmarked',
          run: () => { goTo('#insights'); insights.showSaved(); } },
      );
    }

    function flash(el) {
      el.animate(
        [{ boxShadow: '0 0 0 0 rgba(217,201,172,0)' },
         { boxShadow: '0 0 0 3px rgba(217,201,172,0.55)' },
         { boxShadow: '0 0 0 0 rgba(217,201,172,0)' }],
        { duration: 1400, delay: 700, easing: 'ease-out' }
      );
    }

    function render() {
      const q = input.value.trim();
      const scored = [];
      for (const item of index) {
        // Rank on the best-scoring field, so a literal hit in the tags of a
        // practice area outranks a loose subsequence hit in some other label.
        const onLabel = fuzzy(q, item.label);
        const onKeys  = q && item.keywords ? fuzzy(q, item.keywords) : null;
        const onMeta  = q && item.meta ? fuzzy(q, item.meta) : null;
        const score = Math.max(
          onLabel ? onLabel.score : -Infinity,
          onKeys ? onKeys.score * 0.9 : -Infinity,
          onMeta ? onMeta.score * 0.5 : -Infinity
        );
        if (score === -Infinity) continue;
        scored.push({ item, score, html: onLabel ? onLabel.html : esc(item.label) });
      }
      if (q) scored.sort((a, b) => b.score - a.score);
      results = scored.slice(0, q ? 24 : 40);
      cursor = 0;

      if (!results.length) {
        list.innerHTML = `<p class="cmdk__empty">No match for &ldquo;${esc(q)}&rdquo;. Try a practice area, a section, or &ldquo;consultation&rdquo;.</p>`;
        return;
      }

      // Bucket by group in order of first appearance, keeping the ranking
      // inside each bucket, so a heading is never printed twice.
      const buckets = new Map();
      results.forEach((r, i) => {
        if (!buckets.has(r.item.group)) buckets.set(r.item.group, []);
        buckets.get(r.item.group).push({ r, i });
      });

      let html = '';
      buckets.forEach((rows, group) => {
        html += `<p class="cmdk__group" role="presentation">${esc(group)}</p>`;
        rows.forEach(({ r, i }) => {
          html +=
            `<button type="button" class="cmdk__item" role="option" id="cmdk-o${i}" data-i="${i}" aria-selected="${i === 0}">` +
              `<span class="cmdk__ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ICO[r.item.type]}</svg></span>` +
              `<span class="cmdk__body">` +
                `<span class="cmdk__label">${r.html}</span>` +
                (r.item.meta ? `<span class="cmdk__meta">${esc(r.item.meta)}</span>` : '') +
              `</span>` +
              `<span class="cmdk__go"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>` +
            `</button>`;
        });
      });
      list.innerHTML = html;
      select($('.cmdk__item', list));
    }

    function select(node) {
      if (!node) return;
      cursor = Number(node.dataset.i);
      $$('.cmdk__item', list).forEach((b) => b.setAttribute('aria-selected', String(b === node)));
      node.scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', node.id);
    }

    function move(delta) {
      const nodes = $$('.cmdk__item', list);
      if (!nodes.length) return;
      const at = nodes.findIndex((n) => Number(n.dataset.i) === cursor);
      select(nodes[((at === -1 ? 0 : at) + delta + nodes.length) % nodes.length]);
    }

    function run(i) {
      const r = results[i];
      if (!r) return;
      close();
      setTimeout(() => r.item.run(), 60);
    }

    function show() {
      if (open) return;
      build();
      open = true;
      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
      lock.on();
      input.value = '';
      render();
      release = trap(root);
      setTimeout(() => input.focus(), 60);
    }

    function close() {
      if (!open) return;
      open = false;
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      lock.off();
      if (release) { release(); release = null; }
    }

    function init() {
      root = $('#cmdk');
      if (!root) return;
      input = $('#cmdk-input');
      list = $('#cmdk-list');

      on(input, 'input', render);
      on(root, 'keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
        else if (e.key === 'Home' && document.activeElement === input) { e.preventDefault(); select($$('.cmdk__item', list)[0]); }
        else if (e.key === 'Enter') { e.preventDefault(); run(cursor); }
      });
      on(list, 'click', (e) => {
        const b = e.target.closest('.cmdk__item');
        if (b) run(Number(b.dataset.i));
      });
      on(list, 'pointermove', (e) => {
        const b = e.target.closest('.cmdk__item');
        if (b && Number(b.dataset.i) !== cursor) select(b);
      });
      on(root, 'pointerdown', (e) => { if (e.target === root) close(); });
      $$('[data-cmdk-open]').forEach((b) => on(b, 'click', show));
    }

    return { init, show, close, isOpen: () => open };
  })();

  /* ==========================================================================
     PRACTICE DRAWER
     ====================================================================== */
  const drawer = (() => {
    let root, scrim, order = [], key = null, release = null;

    function keys() {
      if (!order.length) order = $$('.panel[data-panel]').map((p) => p.dataset.panel);
      return order;
    }

    function render(k) {
      const a = AREAS[k];
      const panel = $(`.panel[data-panel="${k}"]`);
      if (!a || !panel) return;
      const title = $('.panel__title', panel).textContent.trim();
      const no = $('.panel__no', panel).textContent.trim();

      $('#drawer-eyebrow').textContent = `${no} / Practice area`;
      $('#drawer-title').textContent = title;
      $('#drawer-body').innerHTML =
        `<p class="drawer__lede">${esc(a.lede)}</p>` +
        `<div class="drawer__block"><h3>What we handle</h3>` +
          `<ul class="drawer__list">${a.handle.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` +
        `<div class="drawer__block"><h3>When to call us</h3>` +
          `<ul class="drawer__list">${a.call.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` +
        `<p class="drawer__note">Scope described in general terms. Specific advice depends on the facts of your matter.</p>`;
      $('#drawer-body').scrollTop = 0;
      key = k;
    }

    function open(k) {
      if (!root || !AREAS[k]) return;
      render(k);
      root.classList.add('is-open');
      scrim.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
      $$('.panel').forEach((p) => p.classList.toggle('is-open', p.dataset.panel === k));
      lock.on();
      if (!release) release = trap(root);
      setTimeout(() => $('#drawer-close').focus(), 120);
    }

    function close() {
      if (!root || !root.classList.contains('is-open')) return;
      root.classList.remove('is-open');
      scrim.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      lock.off();
      if (release) { release(); release = null; }
      const panel = key && $(`.panel[data-panel="${key}"]`);
      if (panel) panel.focus({ preventScroll: true });
      key = null;
    }

    function step(delta) {
      const ks = keys();
      const i = ks.indexOf(key);
      if (i === -1) return;
      const next = ks[(i + delta + ks.length) % ks.length];
      render(next);
      $$('.panel').forEach((p) => p.classList.toggle('is-open', p.dataset.panel === next));
    }

    function init() {
      root = $('#drawer');
      scrim = $('#drawer-scrim');
      if (!root) return;

      on($('#drawer-close'), 'click', close);
      on(scrim, 'click', close);
      on($('#drawer-prev'), 'click', () => step(-1));
      on($('#drawer-next'), 'click', () => step(1));
      on(root, 'keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        if (e.key === 'ArrowLeft') step(-1);
        if (e.key === 'ArrowRight') step(1);
      });

      on($('#drawer-enquire'), 'click', (e) => {
        e.preventDefault();
        const matter = AREAS[key] && AREAS[key].matter;
        close();
        setTimeout(() => {
          goTo('#contact');
          if (matter) form.prefill(matter);
        }, 220);
      });

      $$('.panel[data-panel]').forEach((p) => {
        p.setAttribute('role', 'button');
        p.setAttribute('aria-haspopup', 'dialog');
        on(p, 'click', () => open(p.dataset.panel));
        on(p, 'keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(p.dataset.panel); }
        });
      });
    }

    return { init, open, close, isOpen: () => !!root && root.classList.contains('is-open') };
  })();

  /* ==========================================================================
     PRACTICE FILTERING
     ====================================================================== */
  const practice = (() => {
    let panels = [], search, clear, countEl, empty, group = 'all', q = '';

    function haystack(p) {
      const a = AREAS[p.dataset.panel];
      return [
        $('.panel__title', p).textContent,
        $('.panel__desc', p).textContent,
        p.dataset.tags || '',
        a ? a.handle.join(' ') + ' ' + a.call.join(' ') : '',
      ].join(' ');
    }

    function highlight(p, needle) {
      const t = $('.panel__title', p);
      if (!t.dataset.raw) t.dataset.raw = t.textContent;
      const raw = t.dataset.raw;
      if (!needle) { t.textContent = raw; return; }
      const m = fuzzy(needle, raw);
      t.innerHTML = m ? m.html : esc(raw);
    }

    function apply() {
      let shown = 0;
      panels.forEach((p) => {
        const groupOk = group === 'all' || (p.dataset.group || '').split(' ').includes(group);
        const textOk = !q || tokensMatch(q, haystack(p));
        const ok = groupOk && textOk;
        p.classList.toggle('is-filtered-out', !ok);
        p.setAttribute('aria-hidden', String(!ok));
        p.tabIndex = ok ? 0 : -1;
        highlight(p, ok ? q : '');
        if (ok) shown++;
      });
      countEl.textContent = shown === panels.length
        ? `${panels.length} practice areas`
        : `${shown} of ${panels.length} shown`;
      empty.hidden = shown > 0;
      search.parentElement.classList.toggle('has-value', !!q);

      $$('.filterbar__chips .chip').forEach((c) =>
        c.setAttribute('aria-pressed', String(c.dataset.group === group)));
    }

    function counts() {
      $$('.filterbar__chips .chip').forEach((c) => {
        const g = c.dataset.group;
        const n = g === 'all'
          ? panels.length
          : panels.filter((p) => (p.dataset.group || '').split(' ').includes(g)).length;
        const badge = $('.chip__count', c);
        if (badge) badge.textContent = n;
      });
    }

    function init() {
      panels = $$('.panel[data-panel]');
      search = $('#practice-search');
      clear = $('#practice-clear');
      countEl = $('#practice-count');
      empty = $('#panels-empty');
      if (!panels.length || !search) return;

      counts();
      on(search, 'input', debounce(() => { q = search.value.trim(); apply(); }, 120));
      on(search, 'keydown', (e) => { if (e.key === 'Escape') { search.value = ''; q = ''; apply(); } });
      on(clear, 'click', () => { search.value = ''; q = ''; apply(); search.focus(); });
      $$('.filterbar__chips .chip').forEach((c) =>
        on(c, 'click', () => { group = c.dataset.group === group && group !== 'all' ? 'all' : c.dataset.group; apply(); }));
      on($('#panels-reset'), 'click', () => { search.value = ''; q = ''; group = 'all'; apply(); });
      apply();
    }

    /** Used by the triage result to jump straight to a filtered view. */
    function focusArea(key) {
      const p = $(`.panel[data-panel="${key}"]`);
      if (!p) return;
      search.value = ''; q = ''; group = 'all'; apply();
      goTo('#practice');
      setTimeout(() => drawer.open(key), 800);
    }

    return { init, focusArea };
  })();

  /* ==========================================================================
     MATTER TRIAGE — three questions, weighted match
     ====================================================================== */
  const triage = (() => {
    const QUESTIONS = [
      {
        q: 'What is the matter about?',
        opts: [
          { label: 'A loan, guarantee or bank account', note: 'Bank or NBFC facility, security or recovery',
            w: { bank: 3, sarfaesi: 2, drt: 2, nclt: 1 } },
          { label: 'A dishonoured cheque', note: 'A cheque returned unpaid',
            w: { cheque: 3, bank: 1 } },
          { label: 'A company or insolvency issue', note: 'Corporate debt, CIRP or tribunal matter',
            w: { nclt: 3, drt: 1, arbitration: 1 } },
          { label: 'A personal or consumer matter', note: 'Family, service or purchase',
            w: { family: 3, consumer: 3, cheque: 1 } },
        ],
      },
      {
        q: 'What stage has it reached?',
        opts: [
          { label: 'A notice has arrived', note: 'Demand, possession or statutory notice',
            w: { sarfaesi: 3, bank: 2, cheque: 2, nclt: 2 } },
          { label: 'Proceedings have started', note: 'A case is filed before a court or tribunal',
            w: { drt: 3, cheque: 2, consumer: 2, nclt: 2, family: 1 } },
          { label: 'An order or award needs challenging', note: 'Appeal, revision or set-aside',
            w: { arbitration: 3, drt: 2, nclt: 2, consumer: 1 } },
          { label: 'Nothing formal yet', note: 'Getting the position right first',
            w: { bank: 2, family: 2, arbitration: 1, consumer: 1 } },
        ],
      },
      {
        q: 'How urgent is it?',
        opts: [
          { label: 'There is a deadline this week', note: 'A notice period, hearing or auction date is fixed',
            w: { sarfaesi: 3, cheque: 2, drt: 2, nclt: 1 } },
          { label: 'Weeks, not days', note: 'Moving, but there is room to plan',
            w: { bank: 1, drt: 1, consumer: 1, family: 1 } },
          { label: 'Planning ahead', note: 'Getting the position right first',
            w: { arbitration: 2, bank: 1, family: 1 } },
        ],
      },
    ];

    let stepIdx = 0, answers = [], root, bar;

    /** Weights are recomputed from the answer history, so Back is lossless. */
    function tally() {
      const scores = {};
      answers.forEach((oi, qi) => {
        const w = QUESTIONS[qi].opts[oi].w;
        for (const k in w) scores[k] = (scores[k] || 0) + w[k];
      });
      return scores;
    }

    function reset() {
      stepIdx = 0;
      answers = [];
      $('#triage-result').classList.remove('is-active');
      $('#triage-steps').hidden = false;
      draw();
    }

    function draw() {
      const total = QUESTIONS.length;
      bar.style.width = `${(stepIdx / total) * 100}%`;
      const host = $('#triage-steps');
      const qd = QUESTIONS[stepIdx];
      host.innerHTML =
        `<div class="triage__step is-active">` +
          `<p class="triage__count">Question ${stepIdx + 1} of ${total}</p>` +
          `<h3 class="triage__q">${esc(qd.q)}</h3>` +
          `<div class="triage__opts">` +
            qd.opts.map((o, i) =>
              `<button type="button" class="triage__opt" data-o="${i}">` +
                `<strong>${esc(o.label)}</strong><span>${esc(o.note)}</span>` +
              `</button>`).join('') +
          `</div>` +
          (stepIdx > 0
            ? `<button type="button" class="triage__back" data-back><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Back</button>`
            : '') +
        `</div>`;
      host.hidden = false;
      const first = $('.triage__opt', host);
      if (first && stepIdx > 0) first.focus();
    }

    function pick(i) {
      answers[stepIdx] = i;
      answers.length = stepIdx + 1;
      stepIdx++;
      if (stepIdx >= QUESTIONS.length) result();
      else draw();
    }

    function back() {
      stepIdx = Math.max(0, stepIdx - 1);
      answers.length = stepIdx;
      $('#triage-result').classList.remove('is-active');
      $('#triage-steps').hidden = false;
      draw();
    }

    function result() {
      bar.style.width = '100%';
      $('#triage-steps').hidden = true;
      const scores = tally();
      const ranked = Object.keys(scores)
        .sort((a, b) => scores[b] - scores[a])
        .slice(0, 3)
        .filter((k) => AREAS[k]);
      const top = scores[ranked[0]] || 1;

      const labelFor = (k) => {
        const p = $(`.panel[data-panel="${k}"]`);
        return p ? $('.panel__title', p).textContent.trim() : k;
      };

      $('#triage-matches').innerHTML = ranked.map((k, i) => {
        const pct = Math.round((scores[k] / top) * 100);
        return `<button type="button" class="triage__match" data-area="${esc(k)}">` +
          `<span><strong>${esc(labelFor(k))}</strong><p>${esc(AREAS[k].lede)}</p></span>` +
          `<span class="triage__score">${i === 0 ? 'Closest match' : pct + '% fit'}</span>` +
        `</button>`;
      }).join('');

      const res = $('#triage-result');
      res.classList.add('is-active');
      res.dataset.top = ranked[0] || '';
      const first = $('.triage__match', res);
      if (first) first.focus();
    }

    function init() {
      root = $('#triage');
      if (!root) return;
      bar = $('#triage-bar');

      on($('#triage-steps'), 'click', (e) => {
        const opt = e.target.closest('.triage__opt');
        if (opt) return pick(Number(opt.dataset.o));
        if (e.target.closest('[data-back]')) back();
      });
      on($('#triage-result'), 'click', (e) => {
        if (e.target.closest('[data-back]')) back();
      });

      on($('#triage-matches'), 'click', (e) => {
        const b = e.target.closest('.triage__match');
        if (b) practice.focusArea(b.dataset.area);
      });

      on($('#triage-restart'), 'click', reset);
      on($('#triage-enquire'), 'click', (e) => {
        e.preventDefault();
        const top = $('#triage-result').dataset.top;
        goTo('#contact');
        if (top && AREAS[top]) form.prefill(AREAS[top].matter);
      });

      draw();
    }

    return { init };
  })();

  /* ==========================================================================
     INSIGHTS — filter, search, bookmarks
     ====================================================================== */
  const insights = (() => {
    let cards = [], search, clear, chips, countEl, empty, cat = 'all', q = '', savedOnly = false;
    const titleOf = (c) => $('.card__link', c) || $('.card__title', c);
    let saved = new Set(store.get('saved', []));

    function persist() { store.set('saved', Array.from(saved)); }

    function apply() {
      let shown = 0;
      cards.forEach((c) => {
        const id = c.dataset.id;
        const catOk = cat === 'all' || c.dataset.cat === cat;
        const savedOk = !savedOnly || saved.has(id);
        const hay = titleOf(c).textContent + ' ' + $('.card__cat', c).textContent;
        const textOk = !q || tokensMatch(q, hay);
        const ok = catOk && savedOk && textOk;
        c.classList.toggle('is-filtered-out', !ok);
        c.setAttribute('aria-hidden', String(!ok));

        const t = titleOf(c);
        if (!t.dataset.raw) t.dataset.raw = t.textContent;
        if (ok && q) { const m = fuzzy(q, t.dataset.raw); t.innerHTML = m ? m.html : esc(t.dataset.raw); }
        else t.textContent = t.dataset.raw;

        c.classList.toggle('is-saved', saved.has(id));
        const btn = $('.card__save', c);
        if (btn) {
          btn.setAttribute('aria-pressed', String(saved.has(id)));
          btn.setAttribute('aria-label', (saved.has(id) ? 'Remove ' : 'Save ') + t.dataset.raw);
        }
        if (ok) shown++;
      });

      countEl.textContent = savedOnly
        ? `${shown} saved`
        : (shown === cards.length ? `${cards.length} articles` : `${shown} of ${cards.length} shown`);
      empty.hidden = shown > 0;
      $('#insights-saved').setAttribute('aria-pressed', String(savedOnly));
      $('#insights-saved-n').textContent = saved.size;
      search.parentElement.classList.toggle('has-value', !!q);
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === cat)));
    }

    function toggleSave(card) {
      const id = card.dataset.id;
      const t = titleOf(card);
      const title = t.dataset.raw || t.textContent;
      if (saved.has(id)) {
        saved.delete(id);
        toast('Removed from saved.', { type: 'info', duration: 2600 });
      } else {
        saved.add(id);
        toast(`Saved “${title.slice(0, 42)}${title.length > 42 ? '…' : ''}”`, {
          type: 'ok', duration: 3600,
          action: { label: 'View saved', run: () => showSaved() },
        });
      }
      persist();
      apply();
    }

    function showSaved() {
      if (!saved.size) { toast('Nothing saved yet — use the bookmark on any article.', { type: 'info' }); return; }
      savedOnly = true; cat = 'all'; q = ''; if (search) search.value = '';
      apply();
    }

    function init() {
      cards = $$('.card[data-id]');
      search = $('#insights-search');
      clear = $('#insights-clear');
      countEl = $('#insights-count');
      empty = $('#insights-empty');
      chips = $$('#insights-chips .chip');
      if (!cards.length || !search) return;

      chips.forEach((c) => {
        const n = c.dataset.cat === 'all' ? cards.length : cards.filter((x) => x.dataset.cat === c.dataset.cat).length;
        const badge = $('.chip__count', c);
        if (badge) badge.textContent = n;
        on(c, 'click', () => { cat = c.dataset.cat; savedOnly = false; apply(); });
      });

      on(search, 'input', debounce(() => { q = search.value.trim(); savedOnly = false; apply(); }, 120));
      on(clear, 'click', () => { search.value = ''; q = ''; apply(); search.focus(); });
      on($('#insights-saved'), 'click', () => { savedOnly = !savedOnly; apply(); });
      on($('#insights-reset'), 'click', () => { cat = 'all'; q = ''; savedOnly = false; search.value = ''; apply(); });

      $$('.card__save').forEach((b) => on(b, 'click', (e) => {
        e.preventDefault(); e.stopPropagation();
        toggleSave(b.closest('.card'));
      }));

      apply();
    }

    return { init, showSaved };
  })();

  /* ==========================================================================
     FAQ ACCORDION
     ====================================================================== */
  const faq = (() => {
    function init() {
      $$('.faq__q').forEach((btn) => {
        const body = document.getElementById(btn.getAttribute('aria-controls'));
        if (!body) return;
        on(btn, 'click', () => {
          const isOpen = btn.getAttribute('aria-expanded') === 'true';
          if (!isOpen) {
            // single-open accordion reads better at this length
            $$('.faq__q').forEach((o) => {
              if (o === btn) return;
              o.setAttribute('aria-expanded', 'false');
              const ob = document.getElementById(o.getAttribute('aria-controls'));
              if (ob) ob.classList.remove('is-open');
            });
          }
          btn.setAttribute('aria-expanded', String(!isOpen));
          body.classList.toggle('is-open', !isOpen);
        });
      });
    }
    return { init };
  })();

  /* ==========================================================================
     COUNTERS
     ====================================================================== */
  const counters = (() => {
    const SVG = 'http://www.w3.org/2000/svg';

    /* A dial showing the count itself — one tick per unit, so the shape of the
       figure is legible before you read it (24 lands as a clock face). Built
       here rather than in markup because 38 hand-written ticks would be noise. */
    function buildDial(host) {
      const n = parseInt(host.dataset.dial, 10);
      if (!Number.isFinite(n) || n < 1 || n > 60) return null;
      const outer = 44;
      const inner = outer - Math.max(8, Math.min(16, 96 / n));
      const w = n <= 6 ? 2.4 : n <= 12 ? 2 : 1.5;

      const svg = document.createElementNS(SVG, 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('focusable', 'false');

      const ring = document.createElementNS(SVG, 'circle');
      ring.setAttribute('class', 'dial__track');
      ring.setAttribute('cx', 50); ring.setAttribute('cy', 50); ring.setAttribute('r', outer);
      svg.appendChild(ring);

      const ticks = [];
      for (let i = 0; i < n; i++) {
        const a = (-90 + (i * 360) / n) * (Math.PI / 180);
        const line = document.createElementNS(SVG, 'line');
        line.setAttribute('class', 'dial__tick' + (i === n - 1 ? ' is-last' : ''));
        line.setAttribute('x1', (50 + inner * Math.cos(a)).toFixed(2));
        line.setAttribute('y1', (50 + inner * Math.sin(a)).toFixed(2));
        line.setAttribute('x2', (50 + outer * Math.cos(a)).toFixed(2));
        line.setAttribute('y2', (50 + outer * Math.sin(a)).toFixed(2));
        line.setAttribute('stroke-width', w);
        svg.appendChild(line);
        ticks.push(line);
      }
      host.appendChild(svg);
      return ticks;
    }

    /** The dial belonging to the same metric cell as this counter. */
    function dialFor(el) {
      const cell = el.closest('.metric');
      return cell ? cell.querySelector('.metric__dial') : null;
    }

    function run(el) {
      const to = parseFloat(el.dataset.count);
      const dec = (el.dataset.count.split('.')[1] || '').length;
      const ticks = el._ssTicks || [];
      const light = (upto) => {
        for (let i = 0; i < upto; i++) ticks[i].classList.add('is-lit');
      };
      if (reduced() || !Number.isFinite(to)) {
        el.textContent = to.toFixed(dec); light(ticks.length); return;
      }
      const dur = 1500;
      const t0 = performance.now();
      let lit = 0;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        const v = to * eased;
        el.textContent = v.toFixed(dec);
        // Light in lockstep with the digit, so a tick lands exactly as the
        // number ticks over rather than on a timeline of its own. Derive the
        // count from the value as DISPLAYED — toFixed rounds, so flooring the
        // raw value here would leave the dial one tick behind the digit.
        const shown = +v.toFixed(dec);
        const want = Math.min(ticks.length, Math.round(shown * (ticks.length / to)));
        if (want > lit) { light(want); lit = want; }
        if (p < 1) requestAnimationFrame(tick);
        else if (lit < ticks.length) { light(ticks.length); lit = ticks.length; }
      };
      requestAnimationFrame(tick);
    }

    function init() {
      const els = $$('[data-count]');
      if (!els.length) return;
      els.forEach((el) => {
        const host = dialFor(el);
        if (host) el._ssTicks = buildDial(host) || [];
      });
      if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          run(e.target);
          io.unobserve(e.target);
        });
      }, { threshold: 0.4 });
      els.forEach((el) => io.observe(el));
    }
    return { init };
  })();

  /* ==========================================================================
     TESTIMONIALS — dots, autoplay with visible timing, drag, keyboard
     ====================================================================== */
  const quotes = (() => {
    const DUR = 7000;
    let track, viewport, dots = [], i = 0, count = 0, timer = null, paused = false;

    function render(animate = true) {
      track.style.transition = animate ? '' : 'none';
      track.style.transform = `translateX(-${i * 100}%)`;
      Array.from(track.children).forEach((c, n) => {
        c.style.opacity = n === i ? '1' : '0.22';
        c.style.filter = n === i ? 'none' : 'blur(2px)';
        c.style.transition = 'opacity .6s, filter .6s';
        c.setAttribute('aria-hidden', String(n !== i));
      });
      dots.forEach((d, n) => {
        d.setAttribute('aria-current', String(n === i));
        d.classList.remove('is-timing');
        if (n === i && !paused && !reduced()) {
          void d.offsetWidth;           // restart the fill animation
          d.classList.add('is-timing');
        }
      });
    }

    function go(n, user) {
      i = (n + count) % count;
      render();
      if (user) restart();
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() {
      stop();
      if (reduced() || paused) return;
      timer = setInterval(() => go(i + 1), DUR);
    }
    function restart() { stop(); start(); render(); }

    function drag() {
      let x0 = null, dx = 0;
      on(viewport, 'pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        x0 = e.clientX; dx = 0;
        viewport.classList.add('is-dragging');
        viewport.setPointerCapture(e.pointerId);
        stop();
      });
      on(viewport, 'pointermove', (e) => {
        if (x0 === null) return;
        dx = e.clientX - x0;
        track.style.transform = `translateX(calc(-${i * 100}% + ${dx}px))`;
      });
      const end = () => {
        if (x0 === null) return;
        viewport.classList.remove('is-dragging');
        const w = viewport.offsetWidth || 1;
        if (Math.abs(dx) > Math.min(90, w * 0.14)) go(i + (dx < 0 ? 1 : -1));
        else render();
        x0 = null; dx = 0;
        start();
      };
      on(viewport, 'pointerup', end);
      on(viewport, 'pointercancel', end);
    }

    function init() {
      track = $('#quotes-track');
      viewport = $('.quotes__viewport');
      if (!track || !viewport) return;
      count = track.children.length;
      if (!count) return;

      const host = $('#quotes-dots');
      if (host) {
        host.innerHTML = Array.from({ length: count }, (_, n) =>
          `<button type="button" class="quotes__dot" data-n="${n}" aria-label="Testimonial ${n + 1} of ${count}"><span></span></button>`
        ).join('');
        dots = $$('.quotes__dot', host);
        host.style.setProperty('--quote-dur', DUR + 'ms');
        dots.forEach((d) => { d.style.setProperty('--quote-dur', DUR + 'ms'); on(d, 'click', () => go(Number(d.dataset.n), true)); });
      }

      on($('#quote-prev'), 'click', () => go(i - 1, true));
      on($('#quote-next'), 'click', () => go(i + 1, true));

      viewport.setAttribute('tabindex', '0');
      viewport.setAttribute('role', 'group');
      viewport.setAttribute('aria-roledescription', 'carousel');
      viewport.setAttribute('aria-label', 'Client testimonials');
      on(viewport, 'keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1, true); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1, true); }
      });

      const pause = () => { paused = true; stop(); render(); };
      const resume = () => { paused = false; start(); render(); };
      on(viewport, 'pointerenter', pause);
      on(viewport, 'pointerleave', resume);
      on(viewport, 'focusin', pause);
      on(viewport, 'focusout', resume);
      on(document, 'visibilitychange', () => (document.hidden ? stop() : start()));

      if (!coarse()) drag();
      render(false);
      start();
    }

    return { init };
  })();

  /* ==========================================================================
     SMART CONTACT FORM
     ====================================================================== */
  const form = (() => {
    const DRAFT = 'draft';
    let el, fields = [], bar, num, status, submitBtn;

    const MATTER_HINTS = {
      'Bank & NBFC Dispute Resolution': 'Helpful to mention: the lender, the type of facility, and the date of any notice you have received.',
      'SARFAESI Act': 'Helpful to mention: the date on the Section 13(2) notice and whether possession has been taken. These timelines are short — please also give a phone number.',
      'DRT/DRAT Proceedings': 'Helpful to mention: the Tribunal, the case or OA number if you have it, and the next date.',
      'NCLT & Insolvency': 'Helpful to mention: whether you are the creditor or the corporate debtor, and whether a CIRP has been admitted.',
      'Section 138 NI (Cheque Bounce) Cases': 'Helpful to mention: the date of the return memo and whether the demand notice has already gone out. Please do not upload the cheque here.',
      'Arbitration Services': 'Helpful to mention: whether the contract contains an arbitration clause, and whether an award has already been passed.',
      'Consumer Protection Law': 'Helpful to mention: what was paid for, what went wrong, and any complaint reference already raised.',
      'Divorce & Family Law': 'Helpful to mention: whether proceedings have started and whether children are involved. Keep detail brief at this stage.',
      'Not sure yet': 'That is fine. Describe the situation in plain terms and we will point you to the right team.',
    };

    const RULES = {
      'f-name': (v) => (v.trim().length >= 2 ? '' : 'Please enter your full name.'),
      'f-email': (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please enter a valid email address.'),
      'f-phone': (v) => (!v.trim() || /^[\d\s+()\-.]{7,}$/.test(v.trim()) ? '' : 'Please enter a valid phone number, or leave it blank.'),
      'f-matter': (v) => (v ? '' : 'Please choose the closest matter type.'),
      'f-message': (v) => (v.trim().length >= 20 ? '' : 'A little more detail helps — 20 characters or more.'),
      'f-consent': (v, node) => (node.checked ? '' : 'Please confirm consent so we can reply.'),
    };

    function validate(node, show) {
      const rule = RULES[node.id];
      if (!rule) return true;
      const wrap = node.closest('.field') || node.closest('.consent-field');
      const msg = rule(node.value, node);
      if (wrap) {
        const err = $('.field__err', wrap);
        if (err) err.textContent = msg;
        if (show) {
          wrap.classList.toggle('is-invalid', !!msg);
          wrap.classList.toggle('is-valid', !msg && (node.type === 'checkbox' ? node.checked : !!node.value.trim()));
        } else if (!msg) {
          wrap.classList.remove('is-invalid');
        }
      }
      return !msg;
    }

    function progress() {
      const required = fields.filter((f) => f.required);
      const done = required.filter((f) => (f.type === 'checkbox' ? f.checked : validate(f, false))).length;
      const pct = Math.round((done / Math.max(1, required.length)) * 100);
      if (bar) bar.style.width = pct + '%';
      if (num) num.textContent = pct + '%';
    }

    function saveDraft() {
      const data = {};
      fields.forEach((f) => { if (f.type !== 'checkbox') data[f.name] = f.value; });
      if (Object.values(data).some((v) => v && v.trim())) store.set(DRAFT, data);
      else store.del(DRAFT);
    }

    function restoreDraft() {
      const data = store.get(DRAFT);
      if (!data) return;
      const filled = Object.values(data).filter((v) => v && v.trim()).length;
      if (!filled) return;
      toast('We kept your unfinished enquiry on this device.', {
        type: 'info', duration: 9000,
        action: {
          label: 'Restore it',
          run: () => {
            fields.forEach((f) => { if (data[f.name] != null && f.type !== 'checkbox') f.value = data[f.name]; });
            matterHint();
            progress();
            goTo('#contact');
            toast('Draft restored.', { type: 'ok', duration: 2600 });
          },
        },
      });
    }

    function matterHint() {
      const sel = $('#f-matter');
      const hint = $('#matter-hint');
      if (!sel || !hint) return;
      const text = MATTER_HINTS[sel.value];
      hint.textContent = text || '';
      hint.classList.toggle('is-shown', !!text);
    }

    function prefill(matter) {
      const sel = $('#f-matter');
      if (sel) {
        const opt = Array.from(sel.options).find((o) => o.value === matter || o.textContent.trim() === matter);
        if (opt) { sel.value = opt.value || opt.textContent; matterHint(); validate(sel, true); }
      }
      progress();
      setTimeout(() => {
        const target = $('#f-name');
        if (target && !target.value) target.focus({ preventScroll: true });
        toast(`Matter type set to “${matter}”.`, { type: 'ok', duration: 3200 });
      }, 900);
    }

    function counter() {
      const ta = $('#f-message');
      const out = $('#message-count');
      if (!ta || !out) return;
      const max = Number(ta.getAttribute('maxlength')) || 1200;
      const upd = () => {
        const n = ta.value.length;
        out.textContent = `${n} / ${max}`;
        out.classList.toggle('is-warn', n > max * 0.92);
      };
      on(ta, 'input', upd);
      upd();
    }

    function init() {
      el = $('#contact-form');
      if (!el) return;
      fields = $$('input, select, textarea', el);
      bar = $('#form-bar');
      num = $('#form-pct');
      status = $('#form-status');
      submitBtn = $('#form-submit');

      fields.forEach((f) => {
        on(f, 'blur', () => validate(f, true));
        on(f, 'input', () => { validate(f, false); progress(); });
        on(f, 'change', () => { validate(f, true); progress(); });
      });
      on(el, 'input', debounce(saveDraft, 700));
      on($('#f-matter'), 'change', matterHint);

      counter();
      progress();
      restoreDraft();

      on(el, 'submit', (e) => {
        e.preventDefault();
        status.className = 'form-status';
        status.textContent = '';

        const bad = fields.filter((f) => !validate(f, true));
        if (bad.length) {
          status.textContent = `${bad.length} field${bad.length > 1 ? 's need' : ' needs'} attention before we can send this.`;
          status.classList.add('is-err');
          toast('Please complete the highlighted fields.', { type: 'err' });
          bad[0].focus();
          return;
        }

        submitBtn.classList.add('is-busy');
        submitBtn.setAttribute('aria-busy', 'true');

        // Placeholder transport — point this at your intake endpoint.
        setTimeout(() => {
          submitBtn.classList.remove('is-busy');
          submitBtn.removeAttribute('aria-busy');
          status.textContent =
            'Thank you. Your enquiry has been noted — connect this form to your intake system to receive it.';
          status.classList.add('is-ok');
          toast('Enquiry noted. We will be in touch.', { type: 'ok', duration: 5200 });
          el.reset();
          store.del(DRAFT);
          $$('.field, .consent-field', el).forEach((w) => w.classList.remove('is-valid', 'is-invalid'));
          matterHint();
          counter();
          progress();
        }, 900);
      });
    }

    return { init, prefill };
  })();

  /* ==========================================================================
     SECTION RAIL — scroll spy
     ====================================================================== */
  const rail = (() => {
    let root, dots = [], targets = [];

    function spy() {
      let current = 0;
      targets.forEach((t, i) => {
        if (t && t.getBoundingClientRect().top <= innerHeight * 0.42) current = i;
      });
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === current)));
      root.classList.toggle('is-live', scrollY > innerHeight * 0.35);
    }

    function init() {
      root = $('#rail');
      if (!root) return;
      const secs = $$('[data-cmdk-section]');
      root.innerHTML = secs.map((s) =>
        `<a class="rail__dot" href="#${s.id}" aria-current="false">` +
          `<span class="rail__tip">${esc(s.dataset.cmdkSection)}</span>` +
        `</a>`).join('');
      dots = $$('.rail__dot', root);
      targets = secs;
      dots.forEach((d, i) => on(d, 'click', (e) => { e.preventDefault(); goTo(targets[i]); }));
      on(window, 'scroll', spy, { passive: true });
      spy();
    }
    return { init };
  })();

  /* ==========================================================================
     ACTION DOCK
     ====================================================================== */
  const dock = (() => {
    let root, ring, circ = 0;

    function tick() {
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, scrollY / max) : 0;
      if (ring) ring.style.strokeDashoffset = String(circ * (1 - p));
      root.classList.toggle('is-live', scrollY > innerHeight * 0.6);
    }

    function init() {
      root = $('#dock');
      if (!root) return;
      ring = $('.dock__ring .fill', root);
      if (ring) {
        const r = Number(ring.getAttribute('r')) || 25;
        circ = 2 * Math.PI * r;
        ring.style.strokeDasharray = String(circ);
        ring.style.strokeDashoffset = String(circ);
      }
      on($('#dock-top'), 'click', () => goTo('#home'));
      on(window, 'scroll', tick, { passive: true });
      on(window, 'resize', tick);
      tick();

      // Adopt the persistent sound toggle once the intro hands it over.
      const adopt = () => {
        const t = $('#sound-toggle');
        const slot = $('#dock-sound-slot');
        if (t && slot && t.parentElement !== slot) slot.appendChild(t);
      };
      on(window, 'ss:intro-complete', () => setTimeout(adopt, 400));
      setTimeout(adopt, 4000);
    }
    return { init };
  })();

  /* ==========================================================================
     CONSENT BAR
     ====================================================================== */
  const consent = (() => {
    function init() {
      const bar = $('#consent-bar');
      if (!bar) return;
      if (store.get('consent')) return;
      const show = () => bar.classList.add('is-shown');

      const decide = (v) => {
        store.set('consent', v);
        bar.classList.remove('is-shown');
        toast(v === 'all' ? 'Preferences saved.' : 'Only essential storage will be used.', { type: 'ok', duration: 3000 });
      };
      on($('#consent-accept'), 'click', () => decide('all'));
      on($('#consent-essential'), 'click', () => decide('essential'));

      // Never surface this over the cinematic intro — wait for the site to be
      // handed over, with a timeout in case the intro never signals.
      const intro = $('#intro');
      if (intro && !intro.classList.contains('is-done')) {
        let done = false;
        const later = () => { if (!done) { done = true; setTimeout(show, 1800); } };
        on(window, 'ss:site-ready', later);
        on(window, 'ss:intro-complete', later);
        setTimeout(later, 11000);
        return;
      }
      setTimeout(show, 2600);
    }
    return { init };
  })();

  /* ==========================================================================
     SHORTCUTS SHEET
     ====================================================================== */
  const shortcuts = (() => {
    let root, release = null;
    function open() {
      if (!root) return;
      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
      lock.on();
      release = trap(root);
      setTimeout(() => $('#shortcuts-close') && $('#shortcuts-close').focus(), 60);
    }
    function close() {
      if (!root || !root.classList.contains('is-open')) return;
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      lock.off();
      if (release) { release(); release = null; }
    }
    function init() {
      root = $('#shortcuts');
      if (!root) return;
      on($('#shortcuts-close'), 'click', close);
      on(root, 'pointerdown', (e) => { if (e.target === root) close(); });
      on(root, 'keydown', (e) => { if (e.key === 'Escape') close(); });
      $$('[data-shortcuts-open]').forEach((b) => on(b, 'click', open));
    }
    return { init, open, close, isOpen: () => !!root && root.classList.contains('is-open') };
  })();

  /* ==========================================================================
     COPY TO CLIPBOARD
     ====================================================================== */
  function copy(text, msg) {
    const done = () => toast(msg || 'Copied to clipboard.', { type: 'ok', duration: 2600 });
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();

    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      ok ? done() : toast('Copy is blocked here — select the text instead.', { type: 'err' });
    }
  }

  function initCopyables() {
    $$('[data-copy]').forEach((el) => {
      on(el, 'click', (e) => {
        e.preventDefault();
        copy(el.dataset.copy, el.dataset.copyMsg || 'Copied to clipboard.');
      });
    });
  }

  /* ==========================================================================
     REVEAL FALLBACK — IntersectionObserver, independent of GSAP
     ====================================================================== */
  function initReveal() {
    const els = $$('[data-io]');
    if (!els.length) return;
    if (reduced() || !('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    els.forEach((el) => {
      if (el.dataset.io) el.style.setProperty('--io-delay', el.dataset.io);
      io.observe(el);
    });
  }

  /* ==========================================================================
     GLOBAL KEY MAP
     ====================================================================== */
  function initKeys() {
    on(document, 'keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;

      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdk.isOpen() ? cmdk.close() : cmdk.show(); return; }
      if (e.key === 'Escape') { drawer.close(); shortcuts.close(); return; }
      if (typing || mod || e.altKey) return;

      if (e.key === '/') { e.preventDefault(); cmdk.show(); }
      else if (e.key === '?') { e.preventDefault(); shortcuts.isOpen() ? shortcuts.close() : shortcuts.open(); }
      else if (e.key.toLowerCase() === 't') { theme.toggle(); }
      else if (e.key.toLowerCase() === 'c') { goTo('#contact'); }
      else if (e.key.toLowerCase() === 'g') { goTo('#home'); }
    });
  }

  /* ==========================================================================
     BOOT
     ====================================================================== */
  function boot() {
    theme.init();
    cmdk.init();
    drawer.init();
    practice.init();
    triage.init();
    insights.init();
    faq.init();
    counters.init();
    quotes.init();
    form.init();
    rail.init();
    dock.init();
    consent.init();
    shortcuts.init();
    initCopyables();
    initReveal();
    initKeys();

    // The intro overlay owns the viewport until it finishes; hold the dock back.
    const introOpen = $('#intro') && !$('#intro').classList.contains('is-done');
    if (introOpen) {
      const d = $('#dock');
      if (d) d.style.visibility = 'hidden';
      on(window, 'ss:intro-complete', () => { if (d) d.style.visibility = ''; });
      setTimeout(() => { if (d) d.style.visibility = ''; }, 9500);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
