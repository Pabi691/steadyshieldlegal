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
    document.body.classList.add('use-cursor');

    let mx = innerWidth / 2, my = innerHeight / 2;
    let rx = mx, ry = my;

    addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    }, { passive: true });

    addEventListener('pointerdown', () => document.body.classList.add('cursor-down'));
    addEventListener('pointerup', () => document.body.classList.remove('cursor-down'));

    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    };
    loop();

    const hoverSel = 'a, button, [data-cursor], input, select, textarea, .panel, .doc, .card';
    document.querySelectorAll(hoverSel).forEach((el) => {
      el.addEventListener('pointerenter', () => document.body.classList.add('cursor-hover'));
      el.addEventListener('pointerleave', () => document.body.classList.remove('cursor-hover'));
    });
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

  /* ---------------------------------------------------------------- Intro orchestration */
  function initIntro() {
    const intro = document.getElementById('intro');
    const brand = document.getElementById('intro-brand');
    const words = brand?.querySelectorAll('.intro__word');
    const shock = document.getElementById('intro-shock');
    const skip = document.getElementById('intro-skip');
    if (!intro) return;

    const seen = sessionStorage.getItem('ss-intro-seen');
    // The intro is a dark courtroom set, built as the entrance to the dark
    // stage. In daylight or reading mode it would be seconds of black in front
    // of a light site — so it only plays for visitors who open in dark mode.
    const lightMode = document.documentElement.getAttribute('data-theme') === 'light';
    const skipIntro = prefersReduced || seen || !useWebGL || lightMode;

    const finish = () => {
      intro.classList.add('is-done');
      document.body.classList.remove('intro-lock');
      sessionStorage.setItem('ss-intro-seen', '1');
      moveSoundToggle();
      if (hasGSAP) ScrollTrigger.refresh();
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
    window.addEventListener('ss:intro-complete', finish, { once: true });

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
    initIntro();

    // Section modules
    initReveals();
    initParallax();
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
