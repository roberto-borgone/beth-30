/* Scroll-scrub birthday card: 2 vertical videos + dissolves + text reveals */

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const lerp = (a, b, t) => a + (b - a) * t;

function piecewiseMap01(u, s1, t1, s2, t2) {
  // Maps u in [0..1] -> [0..1] with 3 linear segments:
  // [0..s1] -> [0..t1] (fast start if t1 > s1)
  // [s1..s2] -> [t1..t2]
  // [s2..1] -> [t2..1] (fast end if 1-t2 > 1-s2)
  const x = clamp01(u);
  const a = Math.max(0.001, Math.min(0.999, s1));
  const b = Math.max(a + 0.001, Math.min(0.999, s2));
  const ta = clamp01(t1);
  const tb = Math.max(ta, clamp01(t2));

  if (x <= a) return (x / a) * ta;
  if (x <= b) return ta + ((x - a) / (b - a)) * (tb - ta);
  return tb + ((x - b) / (1 - b)) * (1 - tb);
}

function setOpacity(el, v) {
  el.style.opacity = String(Math.max(0, Math.min(1, v)));
}

function easeOutCubic(t) {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

function easeInOutCubic(t) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeOutBack(t) {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function isMobileish() {
  return window.matchMedia?.("(max-width: 520px)")?.matches ?? true;
}

function isMobileBrowser() {
  const ua = navigator.userAgent || "";
  return /Android/i.test(ua) || /iPhone|iPad|iPod/i.test(ua) || isMobileish();
}

function trySeek(video, timeSeconds) {
  // Some browsers (notably iOS Safari) can reject programmatic seeking
  // until a user gesture. We attempt and return whether it worked.
  try {
    const hasDuration = Number.isFinite(video.duration) && video.duration > 0;
    const t = hasDuration
      ? Math.max(0, Math.min(video.duration, timeSeconds))
      : Math.max(0, timeSeconds);
    // Use currentTime for frame-accurate scrubbing (fastSeek may jump keyframes).
    video.currentTime = t;
    return true;
  } catch {
    return false;
  }
}

function createScrubber(video) {
  // iOS + some Android builds get glitchy if you set currentTime repeatedly
  // while a previous seek is still in flight. This queues seeks safely and
  // supports scrubbing backwards.
  const state = {
    pending: null,
    lastApplied: -1,
    deadband: 0.04,
  };

  function applyPending() {
    if (state.pending == null) return;
    if (video.seeking) return;

    const next = state.pending;
    state.pending = null;

    if (state.lastApplied >= 0 && Math.abs(next - state.lastApplied) < state.deadband) {
      return;
    }

    state.lastApplied = next;
    try {
      video.currentTime = next;
    } catch {
      // ignore
    }
  }

  function requestSeek(t) {
    const hasDuration = Number.isFinite(video.duration) && video.duration > 0;
    const clamped = hasDuration ? Math.max(0, Math.min(video.duration, t)) : Math.max(0, t);
    state.pending = clamped; // always keep the latest target
    applyPending();
  }

  function onSeeked() {
    // When a seek completes, apply the latest requested seek (if any).
    applyPending();
  }

  video.addEventListener("seeked", onSeeked);

  return {
    seek: requestSeek,
    destroy() {
      video.removeEventListener("seeked", onSeeked);
    },
  };
}

function main() {
  const video1 = document.getElementById("video1");
  const video2 = document.getElementById("video2");
  const message1 = document.getElementById("message1");
  const message2 = document.getElementById("message2");
  const wipe1 = document.getElementById("wipe1");
  const soSlideshow = document.getElementById("soSlideshow");
  const slides1Root = document.getElementById("slides1");
  const slides1 =
    slides1Root instanceof HTMLElement ? Array.from(slides1Root.querySelectorAll(".slide")) : [];
  const soSlide = slides1Root?.querySelector?.('.slide[data-slide="2"]') ?? null;
  const soTrail = soSlide instanceof HTMLElement ? soSlide.querySelector(".soTrail") : null;
  const hint = document.getElementById("hint");
  const bethOverlay = document.getElementById("bethOverlay");
  const tbilisiLink = document.getElementById("tbilisiLink");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const loadingText = document.getElementById("loadingText");
  const tapToEnable = document.getElementById("tapToEnable");
  const scrollSpacer = document.getElementById("scrollSpacer");

  if (!(video1 instanceof HTMLVideoElement) || !(video2 instanceof HTMLVideoElement)) {
    return;
  }

  function pseudoRand01(i) {
    const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function applyMagazineCutouts() {
    const nodes = Array.from(document.querySelectorAll("[data-magcut='true']"));
    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.dataset.magcutDone === "1") continue;
      el.dataset.magcutDone = "1";

      const text = (el.textContent || "").trim();
      el.textContent = "";

      const chars = Array.from(text);
      chars.forEach((ch, idx) => {
        if (ch === " ") {
          const sp = document.createElement("span");
          sp.className = "magSpace";
          el.appendChild(sp);
          return;
        }
        const s = document.createElement("span");
        s.className = "magChar";
        s.textContent = ch;

        const r1 = pseudoRand01(idx + 1);
        const r2 = pseudoRand01(idx + 11);
        const r3 = pseudoRand01(idx + 111);
        const rot = (r1 - 0.5) * 8; // deg
        const x = (r2 - 0.5) * 6; // px
        const y = (r3 - 0.5) * 6; // px
        s.style.setProperty("--rot", `${rot.toFixed(2)}deg`);
        s.style.setProperty("--x", `${x.toFixed(2)}px`);
        s.style.setProperty("--y", `${y.toFixed(2)}px`);

        el.appendChild(s);
      });
    }
  }

  applyMagazineCutouts();

  // Build the "so" slideshow from local IMG_* files (Safari-friendly).
  const soImages = ["IMG_1282.HEIC", "IMG_4846.JPG", "IMG_4901.HEIC"];
  const soImgEls = [];
  if (soSlideshow instanceof HTMLElement) {
    for (const [i, name] of soImages.entries()) {
      const img = document.createElement("img");
      img.className = "soSlideImg";
      img.alt = "";
      img.loading = "eager";
      img.decoding = "async";
      img.src = `./${name}`;
      img.style.setProperty("--r", `${(i % 2 === 0 ? -1 : 1) * (1.2 + i * 0.4)}deg`);
      soSlideshow.appendChild(img);
      soImgEls.push(img);
    }
  }

  const activation = {
    started: false,
  };

  // While the loading screen is up, lock scroll so the user can't scrub
  // through the whole timeline behind it.
  const scrollLock = {
    htmlOverflow: "",
    bodyOverflow: "",
    active: false,
  };
  function lockScroll() {
    if (scrollLock.active) return;
    scrollLock.active = true;
    scrollLock.htmlOverflow = document.documentElement.style.overflowY;
    scrollLock.bodyOverflow = document.body.style.overflowY;
    document.documentElement.style.overflowY = "hidden";
    document.body.style.overflowY = "hidden";
    window.scrollTo(0, 0);
  }
  function unlockScroll() {
    if (!scrollLock.active) return;
    scrollLock.active = false;
    document.documentElement.style.overflowY = scrollLock.htmlOverflow;
    document.body.style.overflowY = scrollLock.bodyOverflow;
    window.scrollTo(0, 0);
  }

  let onLoadingGesture = null;

  if (loadingOverlay instanceof HTMLElement) {
    lockScroll();
    setLoadingText("Loading…");
  }

  function hideLoadingOverlay() {
    if (!(loadingOverlay instanceof HTMLElement)) return;
    loadingOverlay.setAttribute("aria-busy", "false");
    loadingOverlay.classList.add("isHidden");
    unlockScroll();
    activation.started = true;
    requestTick();
    if (onLoadingGesture) {
      loadingOverlay.removeEventListener("touchstart", onLoadingGesture);
      loadingOverlay.removeEventListener("pointerdown", onLoadingGesture);
      onLoadingGesture = null;
    }
    window.setTimeout(() => loadingOverlay.classList.add("isGone"), 480);
  }

  function setLoadingText(text) {
    if (!(loadingText instanceof HTMLElement)) return;
    loadingText.textContent = text;
  }

  // Ensure no native playback UI
  video1.controls = false;
  video2.controls = false;
  video1.loop = false;
  video2.loop = false;
  video1.muted = true;
  video2.muted = true;
  video1.playsInline = true;
  video2.playsInline = true;
  video1.autoplay = false;
  video2.autoplay = false;

  const scrub1 = createScrubber(video1);
  const scrub2 = createScrubber(video2);

  // Mobile scrubbing reliability:
  // Download MP4s fully (Blob URLs) before start, so seeking doesn't get stuck
  // near the first frames while the file is still downloading.
  const blobUrls = [];
  function cleanupBlobs() {
    for (const u of blobUrls.splice(0)) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        // ignore
      }
    }
  }
  window.addEventListener("pagehide", cleanupBlobs);

  async function fetchAsBlobWithProgress(url, onProgress) {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const total = Number(res.headers.get("content-length") || "0") || 0;
    if (!res.body) {
      const b = await res.blob();
      onProgress?.(1);
      return b;
    }
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      if (total > 0) onProgress?.(received / total);
    }
    onProgress?.(1);
    return new Blob(chunks, { type: "video/mp4" });
  }

  async function prepareVideosAsBlobs() {
    // Prefer MP4 first source URLs.
    const v1Url = "./kling_20260212_Image_to_Video_Make_a_vid_1541_0.mp4";
    const v2Url = "./Untitled3.mp4";

    let p1 = 0;
    let p2 = 0;
    const updateText = () => {
      const pct = Math.floor(((p1 + p2) / 2) * 100);
      if (pct > 0 && pct < 100) setLoadingText(`Loading… ${pct}%`);
      if (pct >= 100) setLoadingText("Tap to start");
    };

    setLoadingText("Loading…");
    updateText();

    const [b1, b2] = await Promise.all([
      fetchAsBlobWithProgress(v1Url, (p) => {
        p1 = p;
        updateText();
      }),
      fetchAsBlobWithProgress(v2Url, (p) => {
        p2 = p;
        updateText();
      }),
    ]);

    const u1 = URL.createObjectURL(b1);
    const u2 = URL.createObjectURL(b2);
    blobUrls.push(u1, u2);

    video1.src = u1;
    video2.src = u2;
    video1.load();
    video2.load();
  }

  async function setupLoadingGate() {
    if (!(loadingOverlay instanceof HTMLElement)) {
      activation.started = true;
      return;
    }

    try {
      await prepareVideosAsBlobs();
      setLoadingText("Tap to start");
    } catch {
      // If fetch fails for any reason, fall back to normal <source> loading.
      setLoadingText("Tap to start");
    }

    let activating = false;
    onLoadingGesture = async () => {
      if (activating) return;
      activating = true;

      setLoadingText("Starting…");

      // Synchronous unlock must happen inside the gesture.
      unlockAllSync();

      // Now verify that seeking actually works before we hide the overlay.
      const results = await Promise.allSettled([
        warmUpVideoForFirstFrame(video1),
        warmUpVideoForFirstFrame(video2),
      ]);

      const ok = results.every((r) => r.status === "fulfilled" && r.value === true);

      if (!ok) {
        // Keep the overlay up so the user can tap again (sometimes it takes 2 taps on iOS).
        setLoadingText("Tap to start");
        activating = false;
        return;
      }

      hideLoadingOverlay();
      requestTick();
    };

    loadingOverlay.addEventListener("touchstart", onLoadingGesture, { passive: true });
    loadingOverlay.addEventListener("pointerdown", onLoadingGesture);
  }

  setupLoadingGate();

  // Make sure refresh never restores a mid-scroll position.
  try {
    history.scrollRestoration = "manual";
  } catch {
    // ignore
  }

  let allowPlayUntil = 0;

  function allowBriefPlay(ms) {
    allowPlayUntil = Math.max(allowPlayUntil, performance.now() + ms);
  }

  function unlockForScrubbingSync(video) {
    // iOS Safari often requires play() to be called synchronously
    // inside a user gesture (touchstart/click) before seeking works.
    try {
      allowBriefPlay(450);
      const p = video.play();
      // Don't pause immediately; let a frame decode/paint, then pause.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            video.pause();
          } catch {
            // ignore
          }
        });
      });
      if (p && typeof p.catch === "function") p.catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  function unlockAllSync() {
    const ok1 = unlockForScrubbingSync(video1);
    const ok2 = unlockForScrubbingSync(video2);
    return ok1 || ok2;
  }

  function forcePause(video) {
    // Enforce "scrub-only" videos: never allow free playback.
    try {
      if (performance.now() < allowPlayUntil) return;
      if (!video.paused) video.pause();
    } catch {
      // ignore
    }
  }

  async function warmUpVideoForFirstFrame(video) {
    // Goal: get a decoded frame painted (avoid black screen), while still scrub-only.
    // On iOS Safari, this can require a tiny play window and/or a seek.
    try {
      // Wait for metadata if needed
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        await new Promise((resolve) => {
          if (video.readyState >= 1) return resolve();
          video.addEventListener("loadedmetadata", resolve, { once: true });
        });
      }

      // Seek a tiny amount in (some browsers won't paint at exactly 0)
      const eps = 0.03;
      const target = Math.max(0, Math.min(video.duration || 0, eps));
      trySeek(video, target);

      // If seek events fire, wait for it (best effort; don't hang forever)
      await Promise.race([
        new Promise((resolve) => video.addEventListener("seeked", resolve, { once: true })),
        new Promise((resolve) => setTimeout(resolve, 120)),
      ]);

      // Allow a *brief* play to encourage decoding/painting, then pause.
      allowBriefPlay(140);
      const p = video.play();
      await new Promise((r) => setTimeout(r, 90));
      video.pause();
      if (p && typeof p.catch === "function") {
        await p.catch(() => {});
      }

      // Return to the real start frame for scrubbing.
      trySeek(video, 0);
      video.pause();
      return true;
    } catch {
      return false;
    }
  }

  for (const v of [video1, video2]) {
    // If the browser tries to autoplay/play (e.g., on refresh), immediately pause.
    v.addEventListener("play", () => forcePause(v));
    v.addEventListener("playing", () => forcePause(v));
    v.addEventListener("ended", () => forcePause(v));
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      forcePause(video1);
      forcePause(video2);
    }
  });

  const state = {
    dur1: 6,
    dur2: 6,
    hasMeta1: false,
    hasMeta2: false,
    unlocked: false,
    needsTap: false,
  };

  const cfg = {
    // Pixels scrolled per second of video time.
    // Higher = less scrolling needed to scrub full video.
    ppsMobile: 700,
    ppsDesktop: 950,

    // Scene 1 scrub curve (video 1):
    // Fast start + fast end, with a slower middle so the ending doesn't "drag".
    // Tune these 4 numbers (must be increasing):
    // - scroll s1 reaches time t1
    // - scroll s2 reaches time t2
    video1ScrollS1: 0.2,
    video1TimeT1: 0.32,
    video1ScrollS2: 0.85,
    video1TimeT2: 0.78,

    // Scene 2 (video 2) fade-in behavior:
    // Video 2 reaches full opacity at this fraction of its own playback.
    // Example: 0.75 => full opacity at 3/4 of the video.
    video2FullOpacityAt: 0.75,

    // During the message1->video2 transition, we optionally "pre-roll"
    // a small fraction of video2 so it starts fading in immediately.
    video2PreRollDuringTransition: 0.08,

    // Scene 1 -> slides (wipe + slide timing)
    wipeUpPx: 420,
    slide1Px: 360,
    slide2Px: 520,
    slide3Px: 360,
    slide4Px: 820,
    slide5Px: 720,

    // Slides -> video2 transition
    fadeText1ToVideo2Px: 420,

    // Transition segment sizes in px (visual beats).
    fadeVideo2ToText2Px: 320,
    holdEndPx: 700,

    // Keep hint visible near top
    hintFadeOutPx: 180,

    // Intro overlay ("Beth" + arrow)
    bethFadeOutPx: 260,
  };

  function pps() {
    return isMobileish() ? cfg.ppsMobile : cfg.ppsDesktop;
  }

  function computeSegments() {
    const seg1 = Math.max(1, state.dur1 * pps());
    const seg2 = Math.max(1, state.dur2 * pps());

    const a = {
      seg1,
      wipe: cfg.wipeUpPx,
      s1: cfg.slide1Px,
      s2: cfg.slide2Px,
      s3: cfg.slide3Px,
      s4: cfg.slide4Px,
      s5: cfg.slide5Px,
      fadeTo2: cfg.fadeText1ToVideo2Px,
      seg2,
      fade2: cfg.fadeVideo2ToText2Px,
      holdEnd: cfg.holdEndPx,
    };

    const total =
      a.seg1 +
      a.wipe +
      a.s1 +
      a.s2 +
      a.s3 +
      a.s4 +
      a.s5 +
      a.fadeTo2 +
      a.seg2 +
      a.fade2 +
      a.holdEnd;

    return { ...a, total };
  }

  let segments = computeSegments();

  function setScrollHeight() {
    segments = computeSegments();
    // Add one viewport height so last state can be comfortably reached.
    const h = Math.ceil(segments.total + window.innerHeight * 0.75);
    scrollSpacer.style.height = `${h}px`;
  }

  function setInitialVisuals() {
    setOpacity(video1, 1);
    setOpacity(video2, 0);
    setOpacity(message1, 0);
    setOpacity(message2, 0);
  }

  function showTapOverlayIfNeeded() {
    tapToEnable.classList.toggle("isVisible", state.needsTap && !state.unlocked);
  }

  async function ensureUnlocked() {
    if (state.unlocked) return true;
    const ok1 = await warmUpVideoForFirstFrame(video1);
    const ok2 = await warmUpVideoForFirstFrame(video2);
    state.unlocked = ok1 && ok2;
    state.needsTap = !state.unlocked;
    showTapOverlayIfNeeded();
    return state.unlocked;
  }

  function onMetaLoaded(which) {
    if (which === 1) {
      state.hasMeta1 = true;
      state.dur1 = Number.isFinite(video1.duration) && video1.duration > 0 ? video1.duration : state.dur1;
    } else {
      state.hasMeta2 = true;
      state.dur2 = Number.isFinite(video2.duration) && video2.duration > 0 ? video2.duration : state.dur2;
    }
    setScrollHeight();
  }

  video1.addEventListener("loadedmetadata", () => onMetaLoaded(1), { once: true });
  video2.addEventListener("loadedmetadata", () => onMetaLoaded(2), { once: true });

  // If metadata fails (rare), still set something sensible.
  setTimeout(() => setScrollHeight(), 400);

  // Try to unlock without requiring a tap (works on many browsers due to muted + playsinline)
  // If it fails, we show a tap overlay.
  ensureUnlocked();

  tapToEnable.addEventListener("click", async () => {
    // Must be sync in the click handler for iOS.
    unlockAllSync();
    await ensureUnlocked();
    requestTick();
  });

  // Also treat any interaction as an attempt to unlock.
  const gestureHandler = () => {
    // Must be sync inside the gesture.
    unlockAllSync();
    // Warm-up can be async; after sync unlock it should succeed.
    ensureUnlocked()
      .then((ok) => {
        // Only stop listening once unlocking actually succeeded.
        if (ok) {
          window.removeEventListener("touchstart", gestureHandler);
          window.removeEventListener("pointerdown", gestureHandler);
          window.removeEventListener("keydown", gestureHandler);
        }
      })
      .finally(() => requestTick());
  };
  window.addEventListener("touchstart", gestureHandler, { passive: true });
  window.addEventListener("pointerdown", gestureHandler);
  window.addEventListener("keydown", gestureHandler);

  let ticking = false;
  function requestTick() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  // While the user is actively dragging (touch/pointer), keep updating each frame
  // to avoid scroll-event throttling causing choppy scrub.
  let interactionRaf = 0;
  let interacting = false;
  function interactionLoop() {
    if (!interacting) return;
    update();
    interactionRaf = requestAnimationFrame(interactionLoop);
  }
  function startInteracting() {
    if (interacting) return;
    interacting = true;
    interactionRaf = requestAnimationFrame(interactionLoop);
  }
  function stopInteracting() {
    interacting = false;
    if (interactionRaf) cancelAnimationFrame(interactionRaf);
    interactionRaf = 0;
  }
  window.addEventListener("touchstart", startInteracting, { passive: true });
  window.addEventListener("touchmove", startInteracting, { passive: true });
  window.addEventListener("touchend", stopInteracting, { passive: true });
  window.addEventListener("touchcancel", stopInteracting, { passive: true });
  window.addEventListener("pointerdown", startInteracting);
  window.addEventListener("pointermove", startInteracting);
  window.addEventListener("pointerup", stopInteracting);
  window.addEventListener("pointercancel", stopInteracting);

  let y = 0;
  let lastY = -1;
  function update() {
    ticking = false;

    y = Math.max(0, window.scrollY || 0);
    lastY = y;

    // Don't run the scrub timeline until the user has tapped "Tap to start".
    // This keeps iOS/Android seeking reliably tied to a user gesture.
    if (!activation.started) {
      setOpacity(video1, 1);
      setOpacity(video2, 0);
      setOpacity(message1, 0);
      setOpacity(message2, 0);
      if (tbilisiLink instanceof HTMLAnchorElement) {
        setOpacity(tbilisiLink, 0);
        tbilisiLink.style.pointerEvents = "none";
      }
      return;
    }

    // Critical: ensure videos never free-play.
    forcePause(video1);
    forcePause(video2);

    // Hint fades out quickly after user starts scrolling.
    setOpacity(hint, 1 - clamp01(y / cfg.hintFadeOutPx));

    if (bethOverlay instanceof HTMLElement) {
      setOpacity(bethOverlay, 1 - clamp01(y / cfg.bethFadeOutPx));
    }

    const s = segments;
    const y0 = 0;
    const y1 = y0 + s.seg1;
    const yW = y1 + s.wipe;
    const yS1 = yW + s.s1;
    const yS2 = yS1 + s.s2;
    const yS3 = yS2 + s.s3;
    const yS4 = yS3 + s.s4;
    const yS5 = yS4 + s.s5;
    const y4 = yS5 + s.fadeTo2;
    const y5 = y4 + s.seg2;
    const y6 = y5 + s.fade2;
    // y6..end hold

    function hideAllSlides() {
      for (const el of slides1) {
        el.style.opacity = "0";
        el.style.transform = "translate(-50%, -50%)";
      }
    }

    function renderSlide(idx, p, globalOpacity = 1) {
      const el = slides1[idx];
      if (!el) return;

      const enterT = idx === 4 ? 0.22 : 0.18;
      const exitT = idx === 4 ? 0.0 : 0.18; // last slide shouldn't "leave" inside its segment
      const isSoSlide = idx === 1;
      const enterRaw = isSoSlide
        ? easeOutCubic(clamp01(p / 0.24))
        : easeOutBack(clamp01(p / enterT));
      const enterVis = clamp01(enterRaw);
      const exit =
        exitT <= 0 ? 0 : easeOutCubic(clamp01((p - (1 - exitT)) / Math.max(0.001, exitT)));
      const vis = clamp01(Math.min(enterVis, 1 - exit)) * globalOpacity;

      // Collage-like motion presets (each slide "cut" in differently).
      const presets = [
        { inX: -60, inY: 70, inRot: -5, inScale: 0.96, outX: 40, outY: -50, outRot: 4 },
        // Slide 2 ("so") is handled below with a simple right-to-left motion.
        { inX: 80, inY: 10, inRot: 6, inScale: 0.92, outX: -60, outY: -30, outRot: -4 },
        { inX: -20, inY: 90, inRot: 2, inScale: 0.88, outX: 30, outY: -80, outRot: 2 },
        { inX: 70, inY: 50, inRot: 3, inScale: 0.94, outX: -40, outY: -40, outRot: -2 },
        { inX: -70, inY: 110, inRot: -3, inScale: 0.9, outX: 50, outY: -70, outRot: 3 },
      ];
      const pr = presets[idx] || presets[0];

      let x = lerp(pr.inX, 0, enterRaw) + lerp(0, pr.outX, exit);
      let y = lerp(pr.inY, 0, enterRaw) + lerp(0, pr.outY, exit);
      let rot = lerp(pr.inRot, 0, enterRaw) + lerp(0, pr.outRot, exit);
      let scale = lerp(pr.inScale, 1.0, enterRaw) * (1.0 + 0.04 * exit);

      if (isSoSlide) {
        // Simple right-to-left motion (no rotation/overshoot/scale)
        x = lerp(320, 0, enterRaw) + lerp(0, -140, exit);
        y = 0;
        rot = 0;
        scale = 1;
      }

      el.style.opacity = String(vis);
      el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(2)}px, ${y.toFixed(
        2,
      )}px) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
    }

    // Defaults
    let v1Opacity = 0;
    let v2Opacity = 0;
    let m1Opacity = 0;
    let m2Opacity = 0;

    if (y < y1) {
      // Scene 1: scrub video1
      v1Opacity = 1;
      v2Opacity = 0;
      m1Opacity = 0;
      m2Opacity = 0;
      if (wipe1 instanceof HTMLElement) {
        wipe1.style.opacity = "0";
        wipe1.style.transform = "translateY(100%)";
      }
      hideAllSlides();

      const t = (y - y0) / Math.max(1, s.seg1);
      const u = clamp01(t);
      const curvedU = piecewiseMap01(
        u,
        cfg.video1ScrollS1,
        cfg.video1TimeT1,
        cfg.video1ScrollS2,
        cfg.video1TimeT2,
      );
      const time = lerp(0, state.dur1, curvedU);
      scrub1.seek(time);
      scrub2.seek(0);
    } else if (y < yW) {
      // Wipe up from bottom to top to introduce the first slide
      v1Opacity = 1;
      v2Opacity = 0;
      m1Opacity = 1;
      m2Opacity = 0;
      hideAllSlides();
      scrub1.seek(state.dur1);
      scrub2.seek(0);

      const t = (y - y1) / Math.max(1, s.wipe);
      const k = easeInOutCubic(t);
      if (wipe1 instanceof HTMLElement) {
        wipe1.style.opacity = "1";
        wipe1.style.transform = `translateY(${((1 - k) * 100).toFixed(3)}%)`;
      }
    } else if (y < yS5) {
      // Slides on top of black wipe
      v1Opacity = 0;
      v2Opacity = 0;
      m1Opacity = 1;
      m2Opacity = 0;
      scrub1.seek(state.dur1);
      scrub2.seek(0);

      if (wipe1 instanceof HTMLElement) {
        wipe1.style.opacity = "1";
        wipe1.style.transform = "translateY(0%)";
      }

      // Default slideshow off; only turned on during the "so" slide.
      if (soSlideshow instanceof HTMLElement) {
        setOpacity(soSlideshow, 0);
      }

      // Determine which slide segment we're in
      hideAllSlides();
      if (y < yS1) {
        renderSlide(0, (y - yW) / Math.max(1, s.s1), 1);
      } else if (y < yS2) {
        const p = (y - yS1) / Math.max(1, s.s2);
        renderSlide(1, p, 1);

        // Background slideshow + oOoOoO sweep synced to this slide.
        const k = clamp01(p);
        if (soSlideshow instanceof HTMLElement) {
          setOpacity(soSlideshow, 0.55);
        }
        if (soImgEls.length > 0) {
          const n = soImgEls.length;
          // Advance through images as k increases; crossfade between neighbors.
          const t = k * (n - 1);
          const i0 = Math.max(0, Math.min(n - 1, Math.floor(t)));
          const i1 = Math.max(0, Math.min(n - 1, i0 + 1));
          const a = t - i0;
          for (let i = 0; i < n; i++) soImgEls[i].style.opacity = "0";
          soImgEls[i0].style.opacity = String(1 - a);
          soImgEls[i1].style.opacity = String(a);
        }
        if (soTrail instanceof HTMLElement) {
          // Move the trail from offscreen right to far left.
          // Use vw so it feels consistent on mobile.
          const xVw = lerp(55, -220, easeInOutCubic(k));
          soTrail.style.transform = `translateX(${xVw.toFixed(2)}vw)`;
        }
      } else if (y < yS3) {
        renderSlide(2, (y - yS2) / Math.max(1, s.s3), 1);
      } else if (y < yS4) {
        renderSlide(3, (y - yS3) / Math.max(1, s.s4), 1);
      } else {
        renderSlide(4, (y - yS4) / Math.max(1, s.s5), 1);
      }
    } else if (y < y4) {
      // Fade OUT slides/wipe, then fade IN video2
      const t = (y - yS5) / Math.max(1, s.fadeTo2);
      const k = clamp01(t);
      const split = 0.55;
      const fullAt = Math.max(0.05, Math.min(0.95, cfg.video2FullOpacityAt));
      const v2StartTime = state.dur2 * Math.max(0, cfg.video2PreRollDuringTransition);

      scrub1.seek(state.dur1);
      if (soSlideshow instanceof HTMLElement) {
        setOpacity(soSlideshow, 0);
      }
      if (soTrail instanceof HTMLElement) {
        soTrail.style.transform = "translateX(0vw)";
      }

      if (k < split) {
        const a = clamp01(k / split);
        v1Opacity = 0;
        v2Opacity = 0;
        m1Opacity = 1;
        m2Opacity = 0;
        scrub2.seek(0);

        if (wipe1 instanceof HTMLElement) {
          wipe1.style.opacity = "1";
          wipe1.style.transform = "translateY(0%)";
        }
        hideAllSlides();
        // Keep the last slide in a stable pose while it fades out (no jump/glitch)
        renderSlide(4, 0.92, 1 - a);
      } else {
        const b = clamp01((k - split) / (1 - split));
        v1Opacity = 0;
        m2Opacity = 0;

        // Fade out the black wipe layer as video2 comes in underneath.
        m1Opacity = 1 - b;
        if (wipe1 instanceof HTMLElement) {
          wipe1.style.opacity = "1";
          wipe1.style.transform = "translateY(0%)";
        }
        hideAllSlides();

        const time = lerp(0, v2StartTime, b);
        const base = clamp01(time / (state.dur2 * fullAt));
        v2Opacity = base * b;
        scrub2.seek(time);
      }
    } else if (y < y5) {
      // Scene 2: scrub video2
      m1Opacity = 0;
      m2Opacity = 0;
      if (wipe1 instanceof HTMLElement) {
        wipe1.style.opacity = "0";
      }
      hideAllSlides();

      const t = (y - y4) / Math.max(1, s.seg2);
      const v2StartTime = state.dur2 * Math.max(0, cfg.video2PreRollDuringTransition);
      const u = clamp01(t);
      const time = lerp(v2StartTime, state.dur2, u);
      const fullAt = Math.max(0.05, Math.min(0.95, cfg.video2FullOpacityAt));
      v2Opacity = clamp01(time / (state.dur2 * fullAt));
      scrub2.seek(time);
    } else if (y < y6) {
      // Dissolve video2 -> message2
      const t = (y - y5) / Math.max(1, s.fade2);
      const k = clamp01(t);
      v2Opacity = 1 - k;
      m2Opacity = k;
      scrub2.seek(state.dur2);
    } else {
      // Hold message2
      m2Opacity = 1;
      scrub2.seek(state.dur2);
    }

    // Apply opacities
    setOpacity(video1, v1Opacity);
    setOpacity(video2, v2Opacity);
    setOpacity(message1, m1Opacity);
    setOpacity(message2, m2Opacity);

    if (tbilisiLink instanceof HTMLAnchorElement) {
      // Fade link in with the last title card, and only make it clickable when visible.
      setOpacity(tbilisiLink, m2Opacity);
      tbilisiLink.style.pointerEvents = m2Opacity > 0.6 ? "auto" : "none";
    }
  }

  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", () => {
    setScrollHeight();
    requestTick();
  });

  // Kick off
  setInitialVisuals();
  setScrollHeight();
  requestTick();
}

// Start after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}

