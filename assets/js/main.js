/* =============================================================================
   STEADYSHIELD LEGAL — Interaction layer
   Smooth scroll (Lenis) · scroll choreography (GSAP/ScrollTrigger) ·
   custom cursor · magnetic UI · nav · mobile menu · intro orchestration ·
   synthesised sound design · section modules.
   Depends on globals: gsap, ScrollTrigger, Lenis  (loaded via CDN before this).
   ========================================================================== */
(() => {
  'use strict';

  /* ---------------------------------------------------------------- Capability */
  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const w = window.innerWidth;

  let quality = 'high';
  if (coarse || w < 1000) quality = 'medium';
  if ((coarse && cores <= 4) || mem <= 3 || w < 560) quality = 'low';

  const useWebGL = !prefersReduced && quality !== 'low' && supportsWebGL();
  if (!useWebGL) document.body.classList.add('no-webgl');

  // Shared flag object read by the WebGL module (scene.js)
  const SS = (window.__SS = {
    prefersReduced,
    coarse,
    quality,
    useWebGL,
    soundOn: false,
    lenis: null,
    audio: null,
  });

  function supportsWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  const hasGSAP = typeof gsap !== 'undefined';
  if (hasGSAP && typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------------- Smooth scroll */
  function initLenis() {
    if (prefersReduced || typeof Lenis === 'undefined') return;
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.4,
    });
    SS.lenis = lenis;

    if (hasGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  function scrollTo(target) {
    if (SS.lenis) SS.lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    else document.querySelector(target)?.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
  }

  /* ---------------------------------------------------------------- Custom cursor */
  function initCursor() {
    if (coarse || prefersReduced) return;
    const dot = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    if (!dot || !ring) return;
    const body = document.body;
    body.classList.add('use-cursor', 'cursor-away');

    let mx = innerWidth / 2, my = innerHeight / 2;
    let rx = mx, ry = my;

    // Position only. The CSS `translate: -50% -50%` already centres both on
    // the point; a second -50% here stacked with it, which left the real click
    // point on the dot's lower-right edge and the ring well up-left of it.
    addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (body.classList.contains('cursor-away')) {
        // Arriving on the page: snap the ring instead of sweeping it in.
        rx = mx; ry = my;
        body.classList.remove('cursor-away');
      }
      dot.style.transform = `translate(${mx}px, ${my}px)`;
    }, { passive: true });
    document.addEventListener('pointerout', (e) => {
      if (!e.relatedTarget) body.classList.add('cursor-away');
    });

    addEventListener('pointerdown', () => body.classList.add('cursor-down'));
    addEventListener('pointerup', () => body.classList.remove('cursor-down'));

    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(loop);
    };
    loop();

    // Delegated, so controls created after boot — toasts, palette results,
    // drawer content — get the hover state as well.
    const hoverSel = 'a, button, [data-cursor], input, select, textarea, .panel, .doc, .card';
    addEventListener('pointerover', (e) => {
      body.classList.toggle('cursor-hover', !!e.target.closest?.(hoverSel));
    }, { passive: true });
  }

  /* ---------------------------------------------------------------- Magnetic buttons */
  function initMagnetic() {
    if (coarse || prefersReduced || !hasGSAP) return;
    document.querySelectorAll('.magnetic').forEach((el) => {
      const strength = 0.32;
      const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ---------------------------------------------------------------- Navigation */
  function initNav() {
    const nav = document.getElementById('nav');
    const burger = document.getElementById('nav-burger');
    const menu = document.getElementById('mobile-menu');
    let lastY = 0;

    const onScroll = () => {
      const y = window.scrollY;
      nav.dataset.state = y > 40 ? (y > lastY && y > 400 ? 'hidden' : 'scrolled') : 'top';
      lastY = y;
      updateProgress(y);
      spyActive();
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // mobile menu
    let open = false;
    const toggle = (state) => {
      open = state ?? !open;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) menu.querySelectorAll('a').forEach((a, i) => (a.style.setProperty('--d', `${0.12 + i * 0.05}s`)));
    };
    burger?.addEventListener('click', () => toggle());
    menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => toggle(false)));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) toggle(false); });

    // smooth anchor nav
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const t = document.querySelector(id);
        if (!t) return;
        e.preventDefault();
        scrollTo(id);
        history.replaceState(null, '', id);
      });
    });
  }

  function updateProgress(y) {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.height = `${Math.min(100, (y / max) * 100)}%`;
  }

  const sections = ['home', 'about', 'practice', 'our-approach', 'insights', 'contact'];
  function spyActive() {
    let current = sections[0];
    for (const id of sections) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= innerHeight * 0.4) current = id;
    }
    document.querySelectorAll('.nav__link').forEach((l) =>
      l.classList.toggle('is-active', l.getAttribute('href') === `#${current}`));
  }

  /* ---------------------------------------------------------------- Text reveals */
  function splitLines(el) {
    if (el.dataset.split === '1') return Array.from(el.querySelectorAll('.line-inner, .word'));
    el.dataset.split = '1';
    const text = el.textContent.trim();
    // keep existing markup for elements with <em>/<br>; only split plain nodes
    if (el.children.length && el.querySelector('em, br')) {
      el.innerHTML = `<span class="line-inner">${el.innerHTML}</span>`;
      return [el.querySelector('.line-inner')];
    }
    const words = text.split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="word" style="display:inline-block">${w}&nbsp;</span>`).join('');
    return Array.from(el.querySelectorAll('.word'));
  }

  function initReveals() {
    if (!hasGSAP) return;
    if (prefersReduced) return;

    document.querySelectorAll('.reveal-lines').forEach((el) => {
      const parts = splitLines(el);
      gsap.set(parts, { yPercent: 120, opacity: 0 });
      ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: () =>
          gsap.to(parts, {
            yPercent: 0, opacity: 1, duration: 1, ease: 'power4.out',
            stagger: parts.length > 1 ? 0.05 : 0,
          }),
      });
    });

    // generic fade-up for structural blocks
    const blocks = document.querySelectorAll(
      '.panel, .card, .trust__item, .step, .pill-row, .contact__info, .hero__actions'
    );
    blocks.forEach((el) => {
      gsap.set(el, { y: 40, opacity: 0 });
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: () => gsap.to(el, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }),
      });
    });
  }

  /* ---------------------------------------------------------------- Parallax */
  function initParallax() {
    if (!hasGSAP || prefersReduced) return;
    gsap.utils.toArray('[data-parallax]').forEach((el) => {
      const depth = parseFloat(el.dataset.parallax) || 0.15;
      gsap.to(el, {
        yPercent: -depth * 100,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  }

  /* ---------------------------------------------------------------- Practice panels */
  function initPanels() {
    const panels = document.querySelectorAll('.panel');
    panels.forEach((p) => {
      p.addEventListener('focus', () => {
        panels.forEach((x) => x.classList.toggle('is-open', x === p));
      });
      p.addEventListener('pointerenter', () => tick());
    });
  }

  /* ---------------------------------------------------------------- Floating docs */
  function initDocs() {
    if (coarse || prefersReduced || !hasGSAP) return;
    const field = document.getElementById('docs-field');
    if (!field) return;
    const docs = field.querySelectorAll('.doc');
    docs.forEach((d) => { d.style.setProperty('--px', '0px'); d.style.setProperty('--py', '0px'); });
    const setters = Array.from(docs).map((d) => ({
      x: gsap.quickTo(d, '--px', { duration: 1, ease: 'power2' }),
      y: gsap.quickTo(d, '--py', { duration: 1, ease: 'power2' }),
      d: parseFloat(getComputedStyle(d).getPropertyValue('--d')) || 2,
    }));

    field.addEventListener('pointermove', (e) => {
      const r = field.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      setters.forEach((s) => { s.x(-nx * 26 * s.d); s.y(-ny * 26 * s.d); });
    });
    field.addEventListener('pointerleave', () => setters.forEach((s) => { s.x(0); s.y(0); }));
  }

  /* ------------------------------------------------------- Docs collate on scroll */
  function initDocsCollate() {
    if (prefersReduced || !hasGSAP) return;
    const field = document.getElementById('docs-field');
    if (!field) return;
    // Tween a plain number and write it out, rather than handing GSAP the
    // custom property itself — no unregistered-property parsing to rely on.
    const state = { c: 0 };
    gsap.to(state, {
      c: 1,
      ease: 'none',
      onUpdate: () => field.style.setProperty('--c', state.c.toFixed(3)),
      scrollTrigger: {
        trigger: field,
        // Wide enough that the scatter is fully on screen and read as scatter
        // before it starts resolving — a tighter range collated the pile while
        // the field was still entering, so the transformation was never seen.
        start: 'top 45%',
        end: 'bottom 60%',
        scrub: true,
      },
    });
  }

  /* ---------------------------------------------------------------- Chambers reel */
  // The page holds one set of photographs. A second set, hidden from assistive
  // tech, makes the strip loop without a seam: the track slides exactly half
  // its width (CSS), then starts over. Reduced motion keeps the scrollable strip.
  function initReel() {
    const track = document.querySelector('.reel__track');
    if (!track || prefersReduced) return;
    Array.from(track.children).forEach((item) => {
      const copy = item.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.querySelectorAll('img').forEach((img) => { img.alt = ''; });
      track.appendChild(copy);
    });
    track.closest('.reel').classList.add('is-looping');
  }

  /* ---------------------------------------------------------------- Photo parallax */
  // About's two photographs drift apart as they pass: the tall one slower than
  // the page, the pinned square faster, so they read as two prints, not one.
  function initPhotoParallax() {
    if (!hasGSAP || prefersReduced || typeof ScrollTrigger === 'undefined') return;
    const pair = document.querySelector('.about__photos');
    if (!pair) return;
    const scrub = { trigger: pair, start: 'top bottom', end: 'bottom top', scrub: 0.8 };
    gsap.fromTo(pair.querySelector('.about__photo--main'), { y: 30 }, { y: -30, ease: 'none', scrollTrigger: scrub });
    gsap.fromTo(pair.querySelector('.about__photo--inset'), { y: 70 }, { y: -50, ease: 'none', scrollTrigger: { ...scrub } });
  }

  /* ---------------------------------------------------------------- Courtroom pin */
  function initCourtroom() {
    if (!hasGSAP || prefersReduced) return;
    const pin = document.getElementById('courtroom-pin');
    const words = pin?.querySelectorAll('.courtroom__words span');
    const lead = pin?.querySelector('.courtroom__line--lead');
    const bench = pin?.querySelector('.courtroom__bench');
    const light = pin?.querySelector('.courtroom__light');
    if (!pin) return;

    const tl = gsap.timeline({
      scrollTrigger: { trigger: '.courtroom', start: 'top top', end: 'bottom bottom', scrub: 0.8 },
    });
    tl.to(bench, { scale: 1.35, yPercent: 14, ease: 'none' }, 0)
      .to(light, { opacity: 0.9, ease: 'none' }, 0)
      .to(lead, { opacity: 0, y: -40, ease: 'none' }, 0.25)
      .fromTo(words, { opacity: 0, y: 40 }, { opacity: 1, y: 0, stagger: 0.35, ease: 'power2.out' }, 0.3);
  }

  /* ---------------------------------------------------------------- Our Approach horizontal */
  function initApproach() {
    const section = document.querySelector('.approach');
    const track = document.getElementById('approach-track');
    const bar = document.getElementById('approach-bar');
    if (!track || !section) return;

    if (!hasGSAP || prefersReduced) { section.classList.add('is-static'); return; }

    // CSS `position: sticky` on .approach__pin does the pinning; the section is
    // made tall enough that its scroll distance equals the horizontal travel.
    const getShift = () => Math.max(0, track.scrollWidth - window.innerWidth + 40);
    const sizeSection = () => { section.style.height = `${getShift() + window.innerHeight}px`; };
    sizeSection();
    addEventListener('resize', () => { sizeSection(); ScrollTrigger.refresh(); });

    gsap.to(track, {
      x: () => -getShift(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6,
        invalidateOnRefresh: true,
        onRefreshInit: sizeSection,
        onUpdate: (self) => {
          if (bar) bar.style.width = `${self.progress * 100}%`;
          window.dispatchEvent(new CustomEvent('ss:approach', { detail: { progress: self.progress } }));
        },
      },
    });
  }

  /* ---------------------------------------------------------------- Finale */
  function initFinale() {
    if (!hasGSAP || prefersReduced) return;
    const name = document.querySelector('.finale__name');
    const tag = document.querySelector('.finale__tag');
    gsap.timeline({
      scrollTrigger: { trigger: '.finale', start: 'top top', end: 'bottom bottom', scrub: 0.7 },
    })
      .to({}, { duration: 0.4 })
      .fromTo(name, { opacity: 0, letterSpacing: '0.4em', filter: 'blur(14px)' },
                    { opacity: 1, letterSpacing: '0em', filter: 'blur(0px)', duration: 0.5, ease: 'power3.out' })
      .fromTo(tag, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.3 }, '-=0.15')
      .to({}, { duration: 0.5 });

    ScrollTrigger.create({
      trigger: '.finale', start: 'top center',
      onEnter: () => window.dispatchEvent(new Event('ss:finale-enter')),
      onLeaveBack: () => window.dispatchEvent(new Event('ss:finale-leave')),
    });
  }

  /* ---------------------------------------------------------------- Testimonials */
  function initQuotes() {
    const track = document.getElementById('quotes-track');
    const prev = document.getElementById('quote-prev');
    const next = document.getElementById('quote-next');
    if (!track) return;
    const count = track.children.length;
    let i = 0;
    const render = () => {
      track.style.transform = `translateX(-${i * 100}%)`;
      Array.from(track.children).forEach((c, n) => {
        c.style.opacity = n === i ? '1' : '0.25';
        c.style.filter = n === i ? 'none' : 'blur(2px)';
        c.style.transition = 'opacity .6s, filter .6s';
      });
    };
    prev?.addEventListener('click', () => { i = (i - 1 + count) % count; render(); tick(); });
    next?.addEventListener('click', () => { i = (i + 1) % count; render(); tick(); });
    render();
    let timer = setInterval(() => { i = (i + 1) % count; render(); }, 7000);
    track.parentElement.addEventListener('pointerenter', () => clearInterval(timer));
    track.parentElement.addEventListener('pointerleave', () => { timer = setInterval(() => { i = (i + 1) % count; render(); }, 7000); });
  }

  /* ---------------------------------------------------------------- Contact form */
  function initForm() {
    const form = document.getElementById('contact-form');
    const status = document.getElementById('form-status');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      status.className = 'form-status';
      if (!form.checkValidity()) {
        status.textContent = 'Please complete the required fields and consent box.';
        status.classList.add('is-err');
        form.reportValidity();
        return;
      }
      status.textContent = 'Thank you. Your enquiry has been noted — connect this form to your intake system to receive it.';
      status.classList.add('is-ok');
      tick();
      form.reset();
    });
  }

  /* ---------------------------------------------------------------- Sound design (synthesised) */
  function initAudio() {
    const toggle = document.getElementById('sound-toggle');

    const audio = {
      ctx: null, master: null, ambientNodes: [],
      ready() {
        if (this.ctx) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.0001;
        this.master.connect(this.ctx.destination);
      },
      fadeMaster(to, t = 1.2) {
        if (!this.ctx) return;
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.setTargetAtTime(to, this.ctx.currentTime, t / 3);
      },
      ambient(on) {
        if (!this.ctx) return;
        if (on && !this.ambientNodes.length) {
          // low drone: two detuned sines through a slow LFO-filtered gain
          [55, 82.5].forEach((f, idx) => {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            const lfo = this.ctx.createOscillator();
            const lg = this.ctx.createGain();
            o.type = 'sine'; o.frequency.value = f; o.detune.value = idx ? 6 : -4;
            g.gain.value = 0.05;
            lfo.frequency.value = 0.06 + idx * 0.03; lg.gain.value = 0.03;
            lfo.connect(lg); lg.connect(g.gain);
            o.connect(g); g.connect(this.master);
            o.start(); lfo.start();
            this.ambientNodes.push(o, lfo);
          });
          // faint room air (filtered noise)
          const noise = this.ctx.createBufferSource();
          const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let n = 0; n < data.length; n++) data[n] = (Math.random() * 2 - 1) * 0.4;
          noise.buffer = buf; noise.loop = true;
          const bp = this.ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.6;
          const ng = this.ctx.createGain(); ng.gain.value = 0.015;
          noise.connect(bp); bp.connect(ng); ng.connect(this.master);
          noise.start();
          this.ambientNodes.push(noise);
        } else if (!on) {
          this.ambientNodes.forEach((nd) => { try { nd.stop(); } catch (e) {} });
          this.ambientNodes = [];
        }
      },
      gavel() {
        if (!this.ctx || !SS.soundOn) return;
        const t = this.ctx.currentTime;
        // low thump
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
        g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.55);
        // crack (noise burst)
        const nb = this.ctx.createBufferSource();
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let n = 0; n < d.length; n++) d[n] = (Math.random() * 2 - 1) * Math.pow(1 - n / d.length, 2);
        nb.buffer = buf;
        const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1600;
        const ng = this.ctx.createGain(); ng.gain.setValueAtTime(0.5, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        nb.connect(hp); hp.connect(ng); ng.connect(this.master); nb.start(t);
      },
      ui(freq = 660) {
        if (!this.ctx || !SS.soundOn) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.12);
        o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.14);
      },
    };
    SS.audio = audio;

    const setState = (on) => {
      SS.soundOn = on;
      toggle.setAttribute('aria-pressed', String(on));
      toggle.setAttribute('aria-label', on ? 'Mute sound' : 'Enable sound');
      if (on) { audio.ready(); audio.ctx?.resume(); audio.fadeMaster(0.6); audio.ambient(true); }
      else { audio.fadeMaster(0.0001); audio.ambient(false); }
    };
    toggle?.addEventListener('click', () => setState(!SS.soundOn));

    // expose a small API for the WebGL module + UI
    window.addEventListener('ss:gavel-impact', () => audio.gavel());
    document.querySelectorAll('.btn, .nav__link').forEach((el) =>
      el.addEventListener('pointerenter', () => audio.ui(el.classList.contains('btn') ? 720 : 540)));
  }

  const tick = () => SS.audio?.ui(880);

  /* ---------------------------------------------------------------- Seal artwork
     The seal is on the page twice — struck in the intro, alive in the hero —
     from the same drawing, so these build and move either copy. */
  const SEAL_ARM = 44;   // beam pivot to each hook, in viewBox units

  // Damped swing that lands exactly level: the envelope is zero at p = 1, so
  // there is no final snap.
  const sealSettle = (p, amp = 13) => -amp * Math.pow(1 - p, 2.2) * Math.cos(p * 13.2);

  // Returns a setter for the beam's angle. Written as SVG transform attributes,
  // not GSAP transforms: the pans hang from the beam's ends, so they only ever
  // translate, and plain SVG maths keeps them on the hooks.
  function sealScales(root) {
    const beam = root.querySelector('.s-beam');
    const pans = root.querySelectorAll('.s-pan');
    return (deg) => {
      const rad = (deg * Math.PI) / 180;
      const dx = SEAL_ARM - SEAL_ARM * Math.cos(rad);
      const dy = SEAL_ARM * Math.sin(rad);
      beam.setAttribute('transform', `rotate(${deg.toFixed(3)} 200 164)`);
      pans[0].setAttribute('transform', `translate(${dx.toFixed(3)} ${(-dy).toFixed(3)})`);
      pans[1].setAttribute('transform', `translate(${(-dx).toFixed(3)} ${dy.toFixed(3)})`);
    };
  }

  // Undraw: every stroke back to a dash offset that hides it (the inner ring
  // draws the other way round), every accent node to nothing, the fill clear.
  function primeSeal(root) {
    root.querySelectorAll('[stroke-dasharray="1"]').forEach((el) =>
      el.setAttribute('stroke-dashoffset', el.classList.contains('s-ring-in') ? -1 : 1));
    root.querySelectorAll('[data-r]').forEach((el) => el.setAttribute('r', 0));
    root.querySelectorAll('.s-fill').forEach((el) => el.setAttribute('fill-opacity', 0));
  }

  // The construction, added to `tl` from label `at`: rim, shield, the legend
  // engraved in one sweep, then the scales drawn tipped and swung level (done
  // by at+3.2). Returns a function that re-applies the beam's current angle —
  // a seek suppresses onUpdate, so a skip has to call it.
  function drawSeal(tl, root, at) {
    const one = (s) => root.querySelector(s);
    const all = (s) => Array.from(root.querySelectorAll(s));
    const draw = (targets, t, duration, ease = 'power2.inOut') =>
      tl.to(targets, { attr: { 'stroke-dashoffset': 0 }, duration, ease }, `${at}+=${t}`);
    const pop = (targets, t, stagger = 0.06) =>
      tl.to(targets, { attr: { r: (i, el) => el.dataset.r }, duration: 0.45, ease: 'back.out(3)', stagger }, `${at}+=${t}`);

    draw(one('.s-ring'), 0, 0.95);
    draw(one('.s-ring-in'), 0.08, 1.05);
    draw(all('.s-arm'), 0.28, 0.42, 'power2.in');
    draw(one('.s-point'), 0.7, 0.5, 'power2.out');
    draw(one('.s-engrave'), 0.5, 1.15, 'power1.inOut');
    draw(one('.s-inset'), 0.85, 0.8);
    draw(one('.s-pillar'), 0.95, 0.3, 'power2.out');
    draw(one('.s-base'), 1.08, 0.3);
    draw(one('.s-bar'), 1.1, 0.32);
    draw(all('.s-string'), 1.32, 0.26);
    draw(all('.s-dish'), 1.5, 0.24, 'power2.out');
    pop(all('.s-shield-node'), 1.15, 0.07);
    pop(all('.s-beam-node'), 1.28, 0.05);
    pop(all('.s-rim-dot'), 1.6);

    const tilt = sealScales(root);
    const swing = { p: 0 };
    const sync = () => tilt(sealSettle(swing.p));
    sync();
    tl.to(swing, { p: 1, duration: 1.9, ease: 'none', onUpdate: sync }, `${at}+=1.3`);
    return sync;
  }

  /* ---------------------------------------------------------------- Hero seal
     Enters one of two ways — the intro's seal lands on it (land), or it draws
     itself in (enter) — then lives: bezels turning against each other, light
     breathing, dust rising, and every ten seconds a tap on the scales, a
     ripple off the rim and a glint of light round it. Turns in 3D with the
     pointer (a slow drift on touch), and tilts away as the hero scrolls off. */
  let heroSeal = null;

  function initHeroSeal() {
    const el = document.getElementById('hero-seal');
    const noop = { enter() {}, land() {}, target: () => null };
    if (!el) return noop;
    el.classList.add('is-live');
    // Reduced motion, or no motion library: the finished seal, standing still.
    if (prefersReduced || !hasGSAP) return noop;

    const one = (s) => el.querySelector(s);
    const all = (s) => Array.from(el.querySelectorAll(s));
    const scroller = one('.hseal__scroll');
    const tiltEl = one('.hseal__tilt');
    // back glow + light, the two bezels, then ripple and dust — in page order
    const fx = all('.hseal__fx');
    const ripple = one('.hseal__ripple');
    const glint = one('.s-glint');
    const setBeam = sealScales(el);

    // Depth. Each plane is pushed along z and scaled by the inverse of the
    // perspective it gains, so at rest every plane lines up with the flat seal
    // the intro hands over — the depth only shows once the seal turns.
    const PERSPECTIVE = 1400;
    all('.hseal__layer').forEach((layer) => {
      const z = Number(layer.dataset.z) || 0;
      gsap.set(layer, { z, scale: (PERSPECTIVE - z) / PERSPECTIVE });
    });
    gsap.set(el, { autoAlpha: 0 });
    el.classList.add('is-dormant');

    let shown = false, idle = null, drift = null, active = true;

    const setActive = (on) => {
      active = on;
      el.classList.toggle('is-paused', !on);
      idle?.paused(!on);
      drift?.paused(!on);
    };

    const startIdle = () => {
      if (idle) return;
      // One ten-second cycle so every beat stays in step: a tap on the scales
      // that settles into a slow breath, a ripple as it's tapped, then the glint.
      const clock = { u: 0 };
      idle = gsap.timeline({ repeat: -1, paused: !active })
        .to(clock, {
          u: 10, duration: 10, ease: 'none',
          onUpdate: () => {
            const u = clock.u;
            setBeam(u < 2.6
              ? 5 * Math.sin((u / 2.6) * 12.6) * Math.pow(1 - u / 2.6, 2.2)
              : 0.9 * Math.sin(((u - 2.6) / 7.4) * Math.PI * 2));
          },
        }, 0)
        .fromTo(ripple, { scale: 1, opacity: 0.5 },
          { scale: 1.75, opacity: 0, duration: 2.6, ease: 'power2.out', immediateRender: false }, 0.2)
        .set(glint, { attr: { 'stroke-dashoffset': 0 } }, 3.2)
        .to(glint, { attr: { opacity: 0.9 }, duration: 0.3 }, 3.2)
        .to(glint, { attr: { 'stroke-dashoffset': -1 }, duration: 1.8, ease: 'power2.inOut' }, 3.2)
        .to(glint, { attr: { opacity: 0 }, duration: 0.4 }, 4.6);

      if (SS.coarse) {
        drift = gsap.timeline({ repeat: -1, paused: !active })
          .to(tiltEl, { rotationY: 7, rotationX: -3, duration: 4, ease: 'sine.inOut' })
          .to(tiltEl, { rotationY: -7, rotationX: 3, duration: 8, ease: 'sine.inOut' })
          .to(tiltEl, { rotationY: 0, rotationX: 0, duration: 4, ease: 'sine.inOut' });
      } else {
        const rx = gsap.quickTo(tiltEl, 'rotationX', { duration: 1.2, ease: 'power3' });
        const ry = gsap.quickTo(tiltEl, 'rotationY', { duration: 1.2, ease: 'power3' });
        addEventListener('pointermove', (e) => {
          if (!active) return;
          ry((e.clientX / innerWidth - 0.5) * 20);
          rx(-(e.clientY / innerHeight - 0.5) * 14);
        }, { passive: true });
      }
    };

    if (typeof ScrollTrigger !== 'undefined') {
      gsap.to(scroller, {
        yPercent: 16, scale: 0.84, rotation: -7, opacity: 0, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 },
      });
      ScrollTrigger.create({
        trigger: '.hero', start: 'top bottom', end: 'bottom top',
        onToggle: (self) => setActive(self.isActive),
      });
    }

    return {
      // Where the intro's seal should land: this seal's box, at rest.
      target: () => el.getBoundingClientRect(),

      // The intro's seal is arriving on top of this one, drawn and level:
      // crossfade under it, then bring up the light and bezels around it.
      land(duration = 0.45) {
        if (shown) return;
        shown = true;
        el.classList.remove('is-dormant');
        gsap.set(fx, { opacity: 0 });
        gsap.to(el, { autoAlpha: 1, duration, ease: 'power1.inOut' });
        gsap.to(fx, { opacity: 1, duration: 1.8, ease: 'power2.out', stagger: 0.12, delay: duration * 0.5 });
        gsap.delayedCall(duration + 0.4, startIdle);
      },

      // No intro to hand over: draw the seal in, strike it, bring it to life.
      enter(delay = 0) {
        if (shown) return;
        shown = true;
        el.classList.remove('is-dormant');
        primeSeal(el);
        gsap.set(fx, { opacity: 0 });
        gsap.set(el, { autoAlpha: 1 });
        const tl = gsap.timeline({ delay, defaults: { ease: 'power2.inOut' }, onComplete: startIdle });
        tl.addLabel('draw', 0.15)
          .to(fx[0], { opacity: 1, duration: 1.8, ease: 'power1.out' }, 0);
        drawSeal(tl, el, 'draw');
        tl.to(fx.slice(1, 3), { opacity: 1, duration: 1.4, ease: 'power2.out', stagger: 0.25 }, 'draw+=1.1')
          .addLabel('struck', 'draw+=2.1')
          .to(one('.s-fill'), { attr: { 'fill-opacity': 0.09 }, duration: 0.6, ease: 'power2.out' }, 'struck')
          .to(fx.slice(3), { opacity: 1, duration: 0.01 }, 'struck')
          .fromTo(ripple, { scale: 1, opacity: 0.6 },
            { scale: 1.9, opacity: 0, duration: 1.6, ease: 'power2.out', immediateRender: false }, 'struck')
          .set(glint, { attr: { 'stroke-dashoffset': 0, opacity: 0.9 } }, 'struck+=0.1')
          .to(glint, { attr: { 'stroke-dashoffset': -1 }, duration: 1.2, ease: 'power2.inOut' }, 'struck+=0.1')
          .to(glint, { attr: { opacity: 0 }, duration: 0.3 }, 'struck+=1.0');
      },
    };
  }

  /* ---------------------------------------------------------------- Intro orchestration */
  function initIntro() {
    const intro = document.getElementById('intro');
    const brand = document.getElementById('intro-brand');
    const words = brand?.querySelectorAll('.intro__word');
    const shock = document.getElementById('intro-shock');
    const skip = document.getElementById('intro-skip');
    if (!intro) return;

    const root = document.documentElement;
    const forced = /[?&]intro\b/.test(location.search);
    let seen = false;
    try { seen = !forced && !!sessionStorage.getItem('ss-intro-seen'); } catch (e) {}

    // Two entrances. The WebGL courtroom is a dark set, built as the way into
    // the dark stage — in daylight it would be seconds of black in front of a
    // light site. Daylight, and any device that can't run WebGL, gets the
    // drawn seal instead, which is plain SVG and takes its colours from the theme.
    const lightMode = root.getAttribute('data-theme') === 'light';
    const variant = useWebGL && !lightMode ? 'court' : 'seal';
    root.setAttribute('data-intro', variant);
    const skipIntro = prefersReduced || seen || (variant === 'seal' && !hasGSAP);

    const finish = () => {
      intro.classList.add('is-done');
      document.body.classList.remove('intro-lock');
      SS.lenis?.start();
      if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
      try { sessionStorage.setItem('ss-intro-seen', '1'); } catch (e) {}
      moveSoundToggle();
      if (hasGSAP) ScrollTrigger.refresh();
      // The seal intro has already landed its seal on the hero; the courtroom,
      // or an intro cut short by its deadline, hands over to the hero drawing its own.
      heroSeal?.enter(0.3);
      window.dispatchEvent(new Event('ss:site-ready'));
      setTimeout(() => intro.remove(), 1100);
    };

    if (skipIntro) {
      // no cinematic lock — reveal the site immediately with a clean static state
      document.body.classList.remove('intro-lock');
      intro.classList.add('is-done');
      setTimeout(() => intro.remove(), 200);
      moveSoundToggle();
      revealHeroStatic();
      heroSeal?.enter(0.35);
      // The dock, the consent bar and the sound toggle all wait on these to
      // know the intro is out of the way. This path never fired them, which
      // left the dock hidden ~8s and the consent bar ~12s. Next tick, so every
      // deferred script's listeners are attached before they go out.
      setTimeout(() => {
        window.dispatchEvent(new Event('ss:site-ready'));
        window.dispatchEvent(new Event('ss:intro-complete'));
      }, 0);
      return;
    }

    document.body.classList.add('intro-lock');
    // Lenis drives the scroll itself, so the overflow lock alone doesn't stop
    // a wheel moving the page behind the overlay.
    SS.lenis?.stop();
    // Open onto the hero, not wherever the last visit left the scroll — unless
    // the link was to a section. Restoration would otherwise land after this
    // and undo it; finish() hands it back for later reloads.
    if (!location.hash) {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
    }
    window.addEventListener('ss:intro-complete', finish, { once: true });

    if (variant === 'seal') { runSealIntro(skip); return; }

    // Brand reveal happens on gavel impact (fired by scene.js)
    const revealBrand = () => {
      if (shock && hasGSAP) {
        gsap.fromTo(shock,
          { scale: 0, opacity: 0.9 },
          { scale: 26, opacity: 0, duration: 1.1, ease: 'power3.out' });
        gsap.fromTo('.intro__canvas',
          { filter: 'brightness(2.2)' },
          { filter: 'brightness(1)', duration: 0.5 });
      }
      if (hasGSAP && words) {
        gsap.set(brand, { opacity: 1 });
        gsap.to(words, {
          clipPath: 'inset(0 0 0% 0)', duration: 1.1, ease: 'power4.out', stagger: 0.18,
        });
      } else if (brand) {
        brand.style.opacity = '1';
        words?.forEach((wd) => (wd.style.clipPath = 'inset(0 0 0% 0)'));
      }
    };

    window.addEventListener('ss:gavel-impact', revealBrand, { once: true });

    skip?.addEventListener('click', () => {
      window.dispatchEvent(new Event('ss:intro-skip'));
      revealBrand();
      setTimeout(finish, 500);
    });

    // Hard safety net: never trap the visitor on the intro, whatever the
    // WebGL timeline does. CSS-only reveal if the module never even started;
    // a longer absolute deadline if it started but never reported completion.
    setTimeout(() => {
      if (!intro.classList.contains('is-done') && !window.__ssIntroStarted) {
        revealBrand();
        setTimeout(finish, 1800);
      }
    }, 3200);

    // absolute deadline — the intro is dismissed no later than this
    setTimeout(() => {
      if (!intro.classList.contains('is-done')) { revealBrand(); finish(); }
    }, 9000);
  }

  /* ---------------------------------------------------------------- Seal intro
     I.   A point of light stretches into a rule; the firm's three words rise off
          it one at a time, each with its index dropping beneath.
     II.  The rule collapses back to the point and the seal is drawn out of it —
          rim, shield, the scales tipping as they're drawn and swinging level,
          the legend engraved around the rim in one sweep.
     III. The seal is struck: a press, a shockwave, a glint round the rim.
     IV.  The ground parts at the centre like a pair of doors, and the seal flies
          across onto the hero's seal — the same drawing — and becomes it. */
  function runSealIntro(skip) {
    const film = document.getElementById('intro-film');
    let done = false;
    const complete = () => {
      if (done) return;
      done = true;
      detach();
      window.dispatchEvent(new Event('ss:intro-complete'));
    };

    // Skip lands on the doors opening rather than cutting to the page, so a
    // skipped intro still hands over the same way a watched one does.
    let tl = null, skipped = false, builtAt = 0, syncBeam = () => {};
    const skipNow = () => {
      if (skipped || done) return;
      skipped = true;
      detach();
      if (tl && tl.time() < tl.labels.exit) { tl.seek('exit'); syncBeam(); }
    };
    // A scroll is a request for the site — but not trackpad momentum carried
    // over from the page before.
    const onWheel = () => { if (tl && performance.now() - builtAt > 700) skipNow(); };
    const onKey = (e) => { if (e.key === 'Escape') skipNow(); };
    const detach = () => {
      removeEventListener('wheel', onWheel);
      removeEventListener('touchmove', onWheel);
      removeEventListener('keydown', onKey);
    };
    skip?.addEventListener('click', skipNow);
    addEventListener('wheel', onWheel, { passive: true });
    addEventListener('touchmove', onWheel, { passive: true });
    addEventListener('keydown', onKey);

    if (!film) { complete(); return; }
    window.__ssIntroStarted = true;

    const one = (s) => film.querySelector(s);
    const all = (s) => Array.from(film.querySelectorAll(s));
    const stage = one('.intro__stage');
    const seal = one('.intro__seal');

    // Where the seal lands: exactly on the hero's seal, which is the same
    // drawing. If that is off screen (a link straight to a section), onto the
    // nav logo instead, scaled so its rim sits on the rim printed in that image.
    // Measured once, when the flight starts.
    let flightPath = null;
    const flight = () => {
      if (flightPath) return flightPath;
      const a = seal.getBoundingClientRect();
      const hero = heroSeal?.target();
      const nav = document.querySelector('.brand__mark img')?.getBoundingClientRect();
      let b = null, fit = 1;
      if (hero && hero.width && hero.bottom > 0 && hero.top < innerHeight) b = hero;
      else if (nav && nav.width && nav.bottom > 0) { b = nav; fit = 0.92 / 0.91; }
      flightPath = b
        ? {
            x: b.left + b.width / 2 - (a.left + a.width / 2),
            y: b.top + b.height / 2 - (a.top + a.height / 2),
            scale: (b.width * fit) / a.width,
            hero: b === hero,
          }
        : { x: 0, y: -a.height * 0.15, scale: 0.5, hero: false };
      return flightPath;
    };

    const build = () => {
      if (done) return;
      const rule = one('.intro__rule');
      const spark = one('.intro__spark');
      const glow = one('.intro__glow');
      const seam = one('.intro__seam');
      const shock = one('.intro__shock-ring');
      const motto = one('.intro__motto');
      const glint = one('.s-glint');
      const words = all('.intro__say');
      const nums = all('.intro__say-n');

      gsap.set(spark, { scale: 0, opacity: 0 });
      gsap.set(rule, { scaleX: 0 });
      // Far enough to clear each window, padding included: the index is a short
      // line under a tall gap, so it has to travel well over its own height.
      const WORD_OUT = 150, NUM_OUT = -280;
      gsap.set(words, { yPercent: WORD_OUT });
      gsap.set(nums, { yPercent: NUM_OUT });
      gsap.set(seal, { autoAlpha: 0 });
      gsap.set([glow, seam, shock, motto], { opacity: 0 });
      primeSeal(seal);
      stage.style.visibility = 'visible';

      tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, onComplete: complete });

      /* I — the rule and the three cards */
      tl.to(spark, { scale: 1, opacity: 1, duration: 0.35, ease: 'power2.out' }, 0.1)
        .to(rule, { scaleX: 1, duration: 0.8, ease: 'expo.inOut' }, 0.25)
        .to(spark, { opacity: 0, duration: 0.4 }, 0.5);
      words.forEach((word, i) => {
        const t = 0.5 + i * 0.52;
        tl.fromTo(word, { letterSpacing: '0.1em' },
            { yPercent: 0, letterSpacing: '-0.01em', duration: 0.55, ease: 'power4.out', immediateRender: false }, t)
          .to(nums[i], { yPercent: 0, duration: 0.45, ease: 'power3.out' }, t + 0.06)
          .to(word, { yPercent: WORD_OUT, duration: 0.28, ease: 'power3.in' }, t + 0.46)
          .to(nums[i], { yPercent: NUM_OUT, duration: 0.24, ease: 'power3.in' }, t + 0.46);
      });

      /* II — collapse to the point, draw the seal out of it */
      tl.to(rule, { scaleX: 0, duration: 0.42, ease: 'expo.in' }, 1.98)
        .addLabel('seal', 2.38)
        .set(spark, { scale: 0.3, opacity: 1 }, 'seal')
        .to(spark, { scale: 2.6, opacity: 0, duration: 0.55, ease: 'power2.out' }, 'seal')
        .set(seal, { autoAlpha: 1 }, 'seal')
        .to(glow, { opacity: 1, duration: 1.2, ease: 'power1.out' }, 'seal');
      syncBeam = drawSeal(tl, seal, 'seal');

      /* III — struck */
      tl.addLabel('stamp', 'seal+=2.05')
        .to(seal, { scale: 1.05, duration: 0.24, ease: 'power2.out' }, 'stamp')
        .to(seal, { scale: 1, duration: 0.14, ease: 'power4.in' }, 'stamp+=0.24')
        .addLabel('impact', 'stamp+=0.38')
        // the synthesised gavel, if the visitor has sound on
        .call(() => window.dispatchEvent(new Event('ss:gavel-impact')), null, 'impact')
        .to(stage, { keyframes: { x: [0, -5, 4, -2, 1, 0] }, duration: 0.32, ease: 'none' }, 'impact')
        .set(shock, { scale: 1, opacity: 0.75 }, 'impact')
        .to(shock, { scale: 2.7, opacity: 0, duration: 1.1, ease: 'power2.out' }, 'impact')
        .set(glow, { scale: 1.3 }, 'impact')
        .to(glow, { scale: 1, duration: 0.9, ease: 'power2.out' }, 'impact')
        .to(one('.s-fill'), { attr: { 'fill-opacity': 0.09 }, duration: 0.5, ease: 'power2.out' }, 'impact')
        .set(glint, { attr: { 'stroke-dashoffset': 0, opacity: 1 } }, 'impact+=0.08')
        .to(glint, { attr: { 'stroke-dashoffset': -1 }, duration: 1.0, ease: 'power2.inOut' }, 'impact+=0.08')
        .to(glint, { attr: { opacity: 0 }, duration: 0.25 }, 'impact+=0.85')
        .fromTo(motto, { y: 10 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', immediateRender: false }, 'impact+=0.12');

      /* IV — the doors part and the seal settles into the hero */
      tl.addLabel('exit', 'stamp+=1.02')
        .to([motto, glow], { opacity: 0, duration: 0.35, ease: 'power1.in' }, 'exit')
        .set(seam, { scaleY: 0 }, 'exit')
        .to(seam, { scaleY: 1, opacity: 1, duration: 0.3, ease: 'power2.out' }, 'exit')
        .to(one('.intro__door--l'), { xPercent: -101, duration: 1.2, ease: 'expo.inOut' }, 'exit+=0.2')
        .to(one('.intro__door--r'), { xPercent: 101, duration: 1.2, ease: 'expo.inOut' }, 'exit+=0.2')
        .to(seam, { opacity: 0, duration: 0.3 }, 'exit+=0.42')
        .to(seal, {
          x: () => flight().x, y: () => flight().y, scale: () => flight().scale,
          duration: 1.15, ease: 'power3.inOut',
        }, 'exit+=0.2')
        // On the hero seal it crossfades into its twin as it lands; on the nav
        // logo it simply fades as it arrives.
        .call(() => { if (flight().hero) heroSeal.land(0.45); }, null, 'exit+=1.2')
        .to(seal, { autoAlpha: 0, duration: 0.45, ease: 'power1.inOut' }, 'exit+=1.2')
        .call(() => {
          revealHeroStatic();
          gsap.fromTo('.hero__actions', { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.35 });
        }, null, 'exit+=0.5');

      builtAt = performance.now();
      if (skipped) { tl.seek('exit'); syncBeam(); }
    };

    // Start once the serif is in, so the first card doesn't swap faces mid-rise.
    const fonts = document.fonts?.ready || Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 900))]).then(build);

    // Absolute deadline, well past the sequence (a hidden tab pauses the timeline).
    setTimeout(complete, 14000);
  }

  function moveSoundToggle() {
    const toggle = document.getElementById('sound-toggle');
    if (toggle && !toggle.classList.contains('sound-toggle--fixed')) {
      toggle.classList.remove('sound-toggle--intro');
      toggle.classList.add('sound-toggle--fixed');
    }
  }

  function revealHeroStatic() {
    if (!hasGSAP || prefersReduced) return;
    const parts = document.querySelectorAll('.hero .reveal-lines');
    parts.forEach((el) => {
      const p = splitLines(el);
      gsap.fromTo(p, { yPercent: 120, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 1, ease: 'power4.out', stagger: 0.06, delay: 0.1 });
    });
  }

  /* ---------------------------------------------------------------- Boot */
  // If the motion library failed to load, collapse the tall scroll-story
  // sections and reveal their text so the page still reads as a finished site.
  function applyNoGsapFallback() {
    document.querySelectorAll('.courtroom, .approach, .finale').forEach((s) => s.classList.add('is-static'));
  }

  function boot() {
    document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());
    if (!hasGSAP) applyNoGsapFallback();

    initLenis();
    initCursor();
    initMagnetic();
    initNav();
    initAudio();
    heroSeal = initHeroSeal();   // before the intro, which lands its seal on this one
    initIntro();

    // Section modules
    initReveals();
    initParallax();
    initReel();
    initPhotoParallax();
    initPanels();
    initDocs();
    initDocsCollate();
    initCourtroom();
    initApproach();
    initFinale();
    // smart.js supersedes these two with richer versions when it is present.
    if (!window.__SMART__) { initQuotes(); initForm(); }

    if (hasGSAP) {
      ScrollTrigger.refresh();
      addEventListener('load', () => ScrollTrigger.refresh());
    }

    // Reveal WebGL stage once its module reports in
    window.addEventListener('ss:stage-live', () => {
      document.getElementById('stage')?.classList.add('is-live');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
