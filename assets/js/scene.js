/* =============================================================================
   STEADYSHIELD LEGAL — WebGL layer  (Three.js, ES module)
   1. Cinematic intro : dust · beam · procedural gavel · strike · dissolve
   2. Persistent stage : brushed-metal shield that responds to scroll + pointer,
      assembles in the "Our Approach" section and opens in the finale.
   Device-aware quality. Bails cleanly when WebGL is disabled — the CSS
   gradient fallback (.stage-fallback) covers that case.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SS = window.__SS || { useWebGL: false, quality: 'low', prefersReduced: true };
const G = window.gsap;

if (!SS.useWebGL) {
  // Nothing to do — main.js safety net reveals the site, CSS fallback paints the bg.
} else {
  const QUALITY = SS.quality; // 'high' | 'medium'
  const DPR = Math.min(window.devicePixelRatio || 1, QUALITY === 'high' ? 1.6 : 1);

  /* ============================ shared helpers ============================ */
  /* Heraldic shield traced off the wordmark path in index.html: a shallow peak
     at the top centre, straight shoulders down to the waist, then one clean
     sweep into the point. The all-bezier version this replaces had no corners
     at all, so it read as a teardrop rather than a shield. */
  function shieldShape(w = 1, h = 1.28) {
    const s = new THREE.Shape();
    s.moveTo(0, h);                       // top centre peak
    s.lineTo(-w, h * 0.6875);             // down the sloped top edge
    s.lineTo(-w, h * 0.0313);             // straight shoulder to the waist
    s.bezierCurveTo(-w, -h * 0.5625, -w * 0.5385, -h * 0.875, 0, -h);
    s.bezierCurveTo(w * 0.5385, -h * 0.875, w, -h * 0.5625, w, h * 0.0313);
    s.lineTo(w, h * 0.6875);
    s.closePath();                        // back up to the peak
    return s;
  }

  function sampleShield(count, w, h) {
    // reject-sampling inside the shield silhouette for the particle formation
    const geo = new THREE.ShapeGeometry(shieldShape(w, h), 24);
    const pos = geo.attributes.position;
    const idx = geo.index.array;
    const tris = idx.length / 3;
    const areas = new Float32Array(tris);
    let total = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < tris; t++) {
      a.fromBufferAttribute(pos, idx[t * 3]);
      b.fromBufferAttribute(pos, idx[t * 3 + 1]);
      c.fromBufferAttribute(pos, idx[t * 3 + 2]);
      const area = b.clone().sub(a).cross(c.clone().sub(a)).length() * 0.5;
      areas[t] = area; total += area;
    }
    const out = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      let r = Math.random() * total, t = 0;
      while (r > areas[t] && t < tris - 1) { r -= areas[t]; t++; }
      a.fromBufferAttribute(pos, idx[t * 3]);
      b.fromBufferAttribute(pos, idx[t * 3 + 1]);
      c.fromBufferAttribute(pos, idx[t * 3 + 2]);
      let u = Math.random(), v = Math.random();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      out[i * 3]     = a.x + u * (b.x - a.x) + v * (c.x - a.x);
      out[i * 3 + 1] = a.y + u * (b.y - a.y) + v * (c.y - a.y);
      out[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
    }
    geo.dispose();
    return out;
  }

  const metal = (opts) => new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.34, ...opts });

  /* ====================================================================== */
  /*  INTRO                                                                  */
  /* ====================================================================== */
  function runIntro() {
    window.__ssIntroStarted = true;
    const canvas = document.getElementById('intro-canvas');
    const intro = document.getElementById('intro');
    if (!canvas || intro?.classList.contains('is-done')) { finalizeIntroSkip(); return; }

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY === 'high', alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(DPR);
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = QUALITY === 'high';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;

    const scene = new THREE.Scene();
    // Midnight navy, not pure black: the room has to read as an interior,
    // otherwise the dust motes turn into a starfield.
    scene.background = new THREE.Color(0x030a17);
    scene.fog = new THREE.FogExp2(0x030a17, 0.042);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
    camera.position.set(1.4, 3.0, 13.5);
    camera.lookAt(0, 0.7, 0);

    /* --- lights --- */
    scene.add(new THREE.AmbientLight(0x13223d, 0.4));
    const rim = new THREE.DirectionalLight(0x6f83a8, 0.32);   // cool counter-light
    rim.position.set(-7, 5, -4);
    scene.add(rim);
    const bounce = new THREE.PointLight(0x2c5aa0, 3.2, 14, 2); // blue bench bounce
    bounce.position.set(0, -0.1, 1.6);
    scene.add(bounce);

    const beam = new THREE.SpotLight(0xdce8ff, 0, 42, 0.46, 0.62, 1.2);
    beam.position.set(1.6, 9.5, 3.2);
    beam.target.position.set(0, -0.2, 0.2);
    beam.castShadow = QUALITY === 'high';
    beam.shadow.mapSize.set(1024, 1024);
    beam.shadow.bias = -0.0004;
    scene.add(beam, beam.target);

    /* --- visible light shaft: the single strongest courtroom cue --- */
    const shaftMat = new THREE.MeshBasicMaterial({
      color: 0xcfe0ff, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const shaft = new THREE.Mesh(new THREE.ConeGeometry(3.1, 10.6, 40, 1, true), shaftMat);
    shaft.position.set(1.0, 4.4, 1.7);
    shaft.rotation.z = 0.16;
    shaft.renderOrder = 2;
    scene.add(shaft);

    /* --- the room: back wall + panelling closes the space --- */
    const roomMats = [];
    const mkWood = (color, rough) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.06 });
      m.envMapIntensity = 0.25;
      roomMats.push(m);
      return m;
    };

    // Navy-lacquered panelling — the logo's blue, deepened for a dark room.
    const wallMat  = mkWood(0x07142b, 0.72);
    const panelMat = mkWood(0x0a1c3a, 0.6);
    const wood     = mkWood(0x0d2246, 0.5);
    const blockMat = mkWood(0x12305e, 0.42);

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(34, 18), wallMat);
    wall.position.set(0, 4.5, -7.5);
    wall.receiveShadow = true;
    scene.add(wall);

    // Vertical panelling: cheap geometry, but it is what makes the void read
    // as a wall rather than as empty sky behind the bench.
    const panels = new THREE.Group();
    for (let i = -5; i <= 5; i++) {
      const pan = new THREE.Mesh(new THREE.BoxGeometry(1.9, 7.4, 0.16), panelMat);
      pan.position.set(i * 2.15, 2.4, -7.3);
      pan.receiveShadow = true;
      panels.add(pan);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(34, 0.28, 0.34), wood);
    rail.position.set(0, 6.2, -7.2);
    panels.add(rail);
    scene.add(panels);

    /* --- judge's bench --- */
    const desk = new THREE.Mesh(new THREE.BoxGeometry(24, 1.4, 9), wood);
    desk.position.set(0, -1.15, 0);
    desk.receiveShadow = true;
    scene.add(desk);

    const benchFace = new THREE.Mesh(new THREE.BoxGeometry(24, 3.4, 0.4), panelMat);
    benchFace.position.set(0, -2.4, 4.4);
    scene.add(benchFace);

    const benchLip = new THREE.Mesh(new THREE.BoxGeometry(24, 0.22, 0.5), mkWood(0x163a6e, 0.42));
    benchLip.position.set(0, -0.55, 4.45);
    scene.add(benchLip);

    /* --- sound block --- */
    const block = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.12, 0.42, 44), blockMat);
    block.position.set(0, -0.24, 0.2);
    block.castShadow = block.receiveShadow = true;
    scene.add(block);

    const blockInlay = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.44, 44),
      mkWood(0x1a4380, 0.36));
    blockInlay.position.copy(block.position);
    scene.add(blockInlay);

    /* --- impact shockwave ring (hidden until the strike) --- */
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xbcd4ff, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 48), ringMat);
    shock.rotation.x = -Math.PI / 2;
    shock.position.set(0, -0.01, 0.2);
    scene.add(shock);

    /* --- gavel: turned navy lacquer, silver bands, handle rising to the wrist ---
       Lathe profiles rather than a capsule: a capsule reads as a bullet, a
       chamfered barrel reads as a turned wooden head. */
    const HANDLE = 2.35;                       // head centre -> wrist
    const gavel = new THREE.Group();

    const gavelWood = new THREE.MeshStandardMaterial({ color: 0x1c3f78, roughness: 0.38, metalness: 0.05 });
    gavelWood.envMapIntensity = 0.35;
    const silver = new THREE.MeshStandardMaterial({ color: 0xc3cfe0, roughness: 0.28, metalness: 0.9 });
    silver.envMapIntensity = 0.8;

    const lathe = (pts, seg) => new THREE.LatheGeometry(
      pts.map(([x, y]) => new THREE.Vector2(x, y)), seg || 32);

    // Head: barrel with chamfered ends, built along Y then laid along X.
    const head = new THREE.Mesh(lathe([
      [0.00, -1.10], [0.26, -1.10], [0.38, -1.01], [0.42, -0.88],
      [0.43,  0.00], [0.42,  0.88], [0.38,  1.01], [0.26,  1.10], [0.00, 1.10],
    ]), gavelWood);
    head.rotation.z = Math.PI / 2;
    head.castShadow = true;
    gavel.add(head);

    [-0.74, 0.74].forEach((x) => {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.13, 32), silver);
      band.rotation.z = Math.PI / 2;
      band.position.x = x;
      band.castShadow = true;
      gavel.add(band);
    });

    // Handle: rises from the head (+Y) to the hand. The old build pointed it
    // down (-Y), which buried 90% of it inside the bench.
    const handle = new THREE.Mesh(lathe([
      [0.00, 0.00], [0.19, 0.05], [0.155, 0.30], [0.125, 0.95],
      [0.122, 1.70], [0.145, 2.02], [0.192, 2.20], [0.165, 2.33], [0.00, 2.38],
    ], 28), gavelWood);
    handle.castShadow = true;
    gavel.add(handle);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.09, 28), silver);
    collar.position.y = 0.2;
    gavel.add(collar);

    // Wrist pivot sits at the top of the handle, so the swing is a real arc.
    const pivot = new THREE.Group();
    pivot.position.set(0.12, -0.03 + 0.43 + HANDLE, 0.2);   // block top + head radius + handle
    gavel.position.set(0, -HANDLE, 0);
    pivot.add(gavel);
    pivot.rotation.z = -0.16;
    scene.add(pivot);

    /* --- dust --- */
    // Kept inside the shaft and softly blended. Spread wide over pure black with
    // additive blending, these were reading as a starfield.
    const dustCount = QUALITY === 'high' ? 380 : 170;
    const dpos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dpos[i * 3]     = 1.0 + (Math.random() - 0.5) * 6.0;
      dpos[i * 3 + 1] = Math.random() * 6.5 - 0.6;
      dpos[i * 3 + 2] = 1.8 + (Math.random() - 0.5) * 5.0;
    }
    const dustTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0.0, 'rgba(236,244,255,1)');
      g.addColorStop(0.35, 'rgba(220,234,255,0.42)');
      g.addColorStop(1.0, 'rgba(210,228,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 32, 32);
      return new THREE.CanvasTexture(c);
    })();

    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      map: dustTex, color: 0xbcd0f0, size: 0.075, transparent: true, opacity: 0,
      depthWrite: false, sizeAttenuation: true,
    }));
    scene.add(dust);

    /* --- dissolve particles (hidden until strike) --- */
    const pcount = QUALITY === 'high' ? 4200 : 1800;
    const target = sampleShield(pcount, 2.4, 3.0);
    const scatter = new Float32Array(pcount * 3);
    for (let i = 0; i < pcount; i++) {
      scatter[i * 3]     = (Math.random() - 0.5) * 18;
      scatter[i * 3 + 1] = (Math.random() - 0.5) * 12;
      scatter[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
    }
    const formGeo = new THREE.BufferGeometry();
    formGeo.setAttribute('position', new THREE.BufferAttribute(scatter.slice(), 3));
    const form = new THREE.Points(formGeo, new THREE.PointsMaterial({
      color: 0xc6d7f2, size: 0.02, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    form.position.z = 2.5;
    scene.add(form);
    let formT = 0, forming = false;

    /* --- resize --- */
    const onResize = () => {
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    };
    addEventListener('resize', onResize);

    /* --- render loop --- */
    let raf, alive = true, shake = 0;
    const clock = new THREE.Clock();
    function loop() {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const dt = clock.getDelta();
      const el = clock.elapsedTime;

      // dust drift
      const dp = dustGeo.attributes.position.array;
      for (let i = 0; i < dustCount; i++) {
        dp[i * 3 + 1] += dt * 0.1;
        dp[i * 3]     += Math.sin(el * 0.3 + i) * dt * 0.02;
        if (dp[i * 3 + 1] > 5.9) dp[i * 3 + 1] = -0.6;
      }
      dustGeo.attributes.position.needsUpdate = true;

      if (forming) {
        formT = Math.min(1, formT + dt * 0.5);
        const fp = formGeo.attributes.position.array;
        const e = 1 - Math.pow(1 - formT, 3);
        for (let i = 0; i < pcount; i++) {
          fp[i * 3]     = scatter[i * 3]     + (target[i * 3]     - scatter[i * 3])     * e;
          fp[i * 3 + 1] = scatter[i * 3 + 1] + (target[i * 3 + 1] - scatter[i * 3 + 1]) * e;
          fp[i * 3 + 2] = scatter[i * 3 + 2] + (target[i * 3 + 2] - scatter[i * 3 + 2]) * e;
        }
        formGeo.attributes.position.needsUpdate = true;
        form.rotation.y = formT * Math.PI * 0.6 + el * 0.15;
      }

      if (shake > 0) {
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        shake *= 0.86;
      }

      renderer.render(scene, camera);
    }
    loop();

    /* --- choreography --- */
    function dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      pmrem.dispose();
      renderer.dispose();
    }

    function strike() {
      window.dispatchEvent(new Event('ss:gavel-impact'));
      shake = 0.22;
      forming = true;
      if (G) {
        // hard flash on contact, then settle back
        G.fromTo(beam, { intensity: 26 }, { intensity: 8, duration: 0.75, ease: 'power3.out' });
        // shockwave across the block
        shock.scale.set(0.35, 0.35, 0.35);
        G.set(ringMat, { opacity: 0.85 });
        G.to(shock.scale, { x: 3.4, y: 3.4, z: 3.4, duration: 0.9, ease: 'power2.out' });
        G.to(ringMat, { opacity: 0, duration: 0.9, ease: 'power2.out' });
        // dust kicked up by the impact, then falling away
        G.timeline()
          .to(dust.material, { opacity: 0.62, duration: 0.12 })
          .to(dust.material, { opacity: 0.14, duration: 1.1 });
        G.to(form.material, { opacity: 0.9, duration: 0.4 });
      } else {
        form.material.opacity = 0.9;
      }
    }

    function complete() {
      window.dispatchEvent(new Event('ss:intro-complete'));
      startStage();
      setTimeout(dispose, 1400);
    }

    if (G) {
      const tl = G.timeline({ defaults: { ease: 'power2.inOut' } });
      const look = () => camera.lookAt(0, 0.55, 0.2);
      tl.to(beam, { intensity: 8, duration: 2.0 }, 0.2)
        .to(shaftMat, { opacity: 0.055, duration: 1.8 }, 0.3)
        .to(camera.position, { x: 0.55, y: 2.0, z: 9.4, duration: 2.6, onUpdate: look }, 0)
        .to(dust.material, { opacity: 0.3, duration: 1.4 }, 0.4)
        // lift — shallow enough that the head stays in shot
        .to(pivot.rotation, { z: -0.72, duration: 0.75, ease: 'power2.out' }, 2.5)
        .to(camera.position, { z: 8.6, duration: 0.75, onUpdate: look }, 2.5)
        // strike
        .to(pivot.rotation, { z: 0.1, duration: 0.2, ease: 'power4.in', onComplete: strike }, 3.4)
        .to(pivot.rotation, { z: -0.04, duration: 0.55, ease: 'elastic.out(1,0.5)' }, 3.6)
        // the room dissolves and the shield forms out of it
        .to(gavel.children.map((c) => c.material || {}), { opacity: 0, duration: 0.5 }, 3.9)
        .to(roomMats, { opacity: 0, duration: 0.7 }, 3.9)
        .to(shaftMat, { opacity: 0, duration: 0.6 }, 3.9)
        .to(camera.position, { z: 5.2, y: 1.1, duration: 1.8, ease: 'power1.in', onUpdate: look }, 4.0)
        .to(form.material, { opacity: 0, duration: 0.7, onComplete: complete }, 5.5);
      gavel.children.forEach((c) => { if (c.material) { c.material.transparent = true; } });
      roomMats.forEach((m) => { m.transparent = true; });

      // Skip: fast-forward the timeline
      addEventListener('ss:intro-skip', () => { tl.progress(1, false); tl.kill(); setTimeout(complete, 60); }, { once: true });
    } else {
      // no GSAP: minimal
      beam.intensity = 8;
      shaftMat.opacity = 0.06;
      dust.material.opacity = 0.3;
      setTimeout(strike, 800);
      setTimeout(complete, 2600);
    }
  }

  function finalizeIntroSkip() {
    // Intro already dismissed (reduced motion / seen). Still bring the stage up.
    startStage();
  }

  /* ====================================================================== */
  /*  PERSISTENT STAGE                                                       */
  /* ====================================================================== */
  let stageStarted = false;
  function startStage() {
    if (stageStarted) return;
    stageStarted = true;
    const canvas = document.getElementById('stage');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY === 'high', alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(DPR);
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;

    const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
    camera.position.set(0, 0, 9);

    const amb = new THREE.AmbientLight(0x24304a, 0.55);
    scene.add(amb);
    const key = new THREE.DirectionalLight(0xe7edf7, 2.4);
    key.position.set(5, 7, 6); scene.add(key);
    const fill = new THREE.DirectionalLight(0x2f4f82, 1.0);
    fill.position.set(-6, -2, 3); scene.add(fill);
    const rimBack = new THREE.DirectionalLight(0xaec4e8, 1.6);
    rimBack.position.set(-4, 3, -7); scene.add(rimBack);
    const glow = new THREE.PointLight(0x7fa8e8, 20, 32);
    glow.position.set(-3, 2, 4); scene.add(glow);

    /* --- master group holds every shield state --- */
    // The hero has no 3D shield: its emblem is the drawn seal in the page
    // (#hero-seal, animated by main.js). The stage behind it keeps the dust halo.
    const rig = new THREE.Group();
    scene.add(rig);

    // approach layers: 5 concentric shield outlines that assemble on scroll
    const layers = [];
    for (let i = 0; i < 5; i++) {
      const sc = 0.55 + i * 0.2;
      const g = new THREE.ExtrudeGeometry(shieldShape(1.05 * sc, 1.4 * sc), {
        depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 32,
      });
      g.center();
      const m = metal({ color: i % 2 ? 0x163060 : 0x0b1f42, roughness: 0.3, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(g, m);
      mesh.userData.rest = { z: -i * 0.16, rx: 0, ry: 0 };
      mesh.userData.scatter = {
        x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 6 - 3,
        rx: Math.random() * 3, ry: Math.random() * 3,
      };
      layers.push(mesh); rig.add(mesh);
    }

    // finale rings: shield outlines that open outward
    const rings = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.ExtrudeGeometry(shieldShape(1.2 + i * 0.02, 1.55 + i * 0.02), {
        depth: 0.03, bevelEnabled: false, curveSegments: 40,
      });
      g.center();
      const m = metal({ color: 0x0f2548, roughness: 0.28, transparent: true, opacity: 0, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(g, m);
      mesh.visible = false;
      rings.push(mesh); rig.add(mesh);
    }

    // particle halo
    const halo = QUALITY === 'high' ? 1600 : 700;
    const hp = new Float32Array(halo * 3);
    for (let i = 0; i < halo; i++) {
      const r = 2.6 + Math.random() * 4;
      const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI * 0.6;
      hp[i * 3] = Math.cos(a) * Math.cos(b) * r;
      hp[i * 3 + 1] = Math.sin(b) * r;
      hp[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r - 1;
    }
    const haloGeo = new THREE.BufferGeometry();
    haloGeo.setAttribute('position', new THREE.BufferAttribute(hp, 3));
    const haloPts = new THREE.Points(haloGeo, new THREE.PointsMaterial({
      color: 0x8fa6cc, size: 0.018, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    scene.add(haloPts);

    /* --- palettes ---------------------------------------------------------
       The stage has to hold up on chambers paper as well as on midnight, so
       every colour that was tuned for the dark ground gets a daylight twin.
       Two rules drive the light set: the shield layers stay dark solids (a
       dark solid reads as an emblem on white, a silver one washes out), and the
       halo has to drop additive blending or it disappears into the page entirely. */
    const PALETTES = {
      dark: {
        exposure: 1.0,
        amb:  { c: 0x24304a, i: 0.55 },
        key:  { c: 0xe7edf7, i: 2.4 },
        fill: { c: 0x2f4f82, i: 1.0 },
        rim:  { c: 0xaec4e8, i: 1.6 },
        glow: { c: 0x7fa8e8, i: 20 },
        metalness: 1,
        layer:  { odd: 0x163060, even: 0x0b1f42 },
        ring:   0x0f2548,
        halo:   { c: 0x8fa6cc, size: 0.018, blend: THREE.AdditiveBlending, base: 0.14, gain: 0.36 },
      },
      light: {
        exposure: 1.06,
        amb:  { c: 0xe4ecf8, i: 0.6 },   // cool bounce, as if off pale walls
        key:  { c: 0xf6f9ff, i: 1.95 },
        fill: { c: 0xa8b8d4, i: 0.8 },
        rim:  { c: 0x2c5aa0, i: 1.1 },   // blue counter-rim
        glow: { c: 0xcfe0ff, i: 8 },     // kept low or the bevel washes out
        // The logo's navy as a lacquer. A full metal is lit almost entirely by
        // the environment, so a dark base would collapse to a flat cut-out on
        // paper; a low metalness keeps it enamel and lets the key and fill
        // sculpt the faces into a real gradient.
        metalness: 0.35,
        layer:  { odd: 0x1c3f78, even: 0x052651 },
        ring:   0x0b2d5c,
        halo:   { c: 0x4a6592, size: 0.02, blend: THREE.NormalBlending, base: 0.1, gain: 0.26 },
      },
    };

    let PAL = PALETTES.dark;

    function applyPalette(kind) {
      const p = PALETTES[kind] || PALETTES.dark;
      PAL = p;
      renderer.toneMappingExposure = p.exposure;

      amb.color.setHex(p.amb.c);      amb.intensity = p.amb.i;
      key.color.setHex(p.key.c);      key.intensity = p.key.i;
      fill.color.setHex(p.fill.c);    fill.intensity = p.fill.i;
      rimBack.color.setHex(p.rim.c);  rimBack.intensity = p.rim.i;
      glow.color.setHex(p.glow.c);    glow.intensity = p.glow.i;

      layers.forEach((m, i) => {
        m.material.color.setHex(i % 2 ? p.layer.odd : p.layer.even);
        m.material.metalness = p.metalness;
      });
      rings.forEach((m) => { m.material.color.setHex(p.ring); m.material.metalness = p.metalness; });

      haloPts.material.color.setHex(p.halo.c);
      haloPts.material.size = p.halo.size;
      haloPts.material.blending = p.halo.blend;
      haloPts.material.needsUpdate = true;
    }

    // 'daylight' is the light-ground cinematic mode; dark keeps the stage on
    // its midnight palette.
    const paletteFor = () =>
      document.documentElement.getAttribute('data-mode') === 'daylight' ? 'light' : 'dark';
    applyPalette(paletteFor());
    document.addEventListener('ss:theme', () => applyPalette(paletteFor()));

    /* --- interaction state --- */
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    if (!SS.coarse) {
      addEventListener('pointermove', (e) => {
        pointer.tx = (e.clientX / innerWidth - 0.5) * 2;
        pointer.ty = (e.clientY / innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    let approachProg = 0, finaleActive = false;
    addEventListener('ss:approach', (e) => { approachProg = e.detail.progress; });
    addEventListener('ss:finale-enter', () => { finaleActive = true; });
    addEventListener('ss:finale-leave', () => { finaleActive = false; });

    // which mode based on scroll position of key sections
    const sec = (id) => document.getElementById(id);
    function currentMode() {
      const ap = sec('our-approach')?.getBoundingClientRect();
      const fi = sec('finale')?.getBoundingClientRect();
      if (fi && fi.top < innerHeight * 0.6 && fi.bottom > 0) return 'finale';
      if (ap && ap.top < innerHeight * 0.5 && ap.bottom > innerHeight * 0.3) return 'approach';
      return 'hero';
    }

    const onResize = () => {
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    };
    addEventListener('resize', onResize);

    // reveal the canvas
    window.dispatchEvent(new Event('ss:stage-live'));

    /* --- loop --- */
    const clock = new THREE.Clock();
    let visible = true;
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

    const lerp = (a, b, t) => a + (b - a) * t;

    function loop() {
      requestAnimationFrame(loop);
      if (!visible) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      pointer.x = lerp(pointer.x, pointer.tx, 0.05);
      pointer.y = lerp(pointer.y, pointer.ty, 0.05);

      const mode = currentMode();
      const scrollY = window.scrollY;
      const heroFade = Math.max(0, 1 - scrollY / (innerHeight * 0.8));

      // camera parallax
      camera.position.x = lerp(camera.position.x, pointer.x * 0.6, 0.06);
      camera.position.y = lerp(camera.position.y, -pointer.y * 0.4, 0.06);
      camera.lookAt(0, 0, 0);
      glow.position.x = lerp(glow.position.x, -3 + pointer.x * 2, 0.05);

      // ---- APPROACH (assemble) ----
      layers.forEach((m, i) => {
        const startAt = i * 0.16;
        const p = THREE.MathUtils.clamp((approachProg - startAt) / 0.4, 0, 1);
        const e = 1 - Math.pow(1 - p, 3);
        const s = m.userData.scatter, r = m.userData.rest;
        m.visible = mode === 'approach';
        m.position.set(lerp(s.x, 0, e), lerp(s.y, 0, e), lerp(s.z, r.z, e));
        m.rotation.x = lerp(s.rx, r.rx, e);
        m.rotation.y = lerp(s.ry, r.ry, e) + t * 0.1;
        m.material.opacity = e * 0.95;
      });

      // ---- FINALE (open) ----
      const fin = sec('finale')?.getBoundingClientRect();
      let fp = 0;
      if (fin) fp = THREE.MathUtils.clamp(1 - (fin.bottom - innerHeight) / (fin.height - innerHeight), 0, 1);
      rings.forEach((m, i) => {
        m.visible = mode === 'finale';
        const open = THREE.MathUtils.clamp((fp - 0.15) / 0.7, 0, 1);
        const dir = i - 1.5;
        m.position.set(dir * open * 1.4, 0, -i * 0.1 - open * dir * 0.6);
        m.rotation.y = t * 0.2 + open * dir * 0.5;
        m.rotation.x = -0.05;
        m.material.opacity = mode === 'finale' ? lerp(0.15, 0.95, THREE.MathUtils.clamp(fp * 2, 0, 1)) * (1 - open * 0.3) : 0;
        m.scale.setScalar(lerp(2.0, 2.4, open));
      });
      if (mode === 'finale') { camera.position.z = lerp(camera.position.z, 6.5, 0.04); }
      else { camera.position.z = lerp(camera.position.z, 9, 0.04); }

      haloPts.rotation.y = t * 0.03;
      haloPts.material.opacity = PAL.halo.base + PAL.halo.gain * Math.max(heroFade, mode !== 'hero' ? 0.5 : 0);

      renderer.render(scene, camera);
    }
    loop();
  }

  /* ====================================================================== */
  /*  BOOT                                                                   */
  /* ====================================================================== */
  const introEl = document.getElementById('intro');
  // main.js runs first and has already chosen the entrance. Only the courtroom
  // needs this module; the seal is SVG, so the stage starts straight away and is
  // warm behind the doors by the time they part.
  const courtIntro = document.documentElement.getAttribute('data-intro') === 'court';
  const introDismissed = !introEl || introEl.classList.contains('is-done')
    || document.body.classList.contains('no-webgl') || !courtIntro;

  if (SS.prefersReduced || introDismissed) {
    startStage();
  } else {
    // start after fonts/first paint settle a touch
    if (document.readyState === 'complete') runIntro();
    else addEventListener('load', runIntro, { once: true });
    // fallback: if load never fires promptly
    setTimeout(() => { if (!window.__ssIntroStarted) runIntro(); }, 1200);
  }
}
