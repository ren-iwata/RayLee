/**
 * 宇宙（星図）の描画と操作。Canvas。パン・ピンチ・タップ。
 */

function lerp(a, b, t) { return a + (b - a) * t; }
function ease(t) { return 1 - Math.pow(1 - t, 3); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function seeded(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function routePoints(star) {
  const steps = star.steps || [];
  if (!steps.length) return [];
  const pts = [];
  const vague = !!star.vague;
  const n = steps.length;
  for (let i = 0; i < n; i++) {
    const ang = (star.isPlayer ? -Math.PI / 2 : Math.atan2(star.y, star.x) + Math.PI * 0.35) + i * 0.22;
    const len = vague ? 28 + i * 10 : 46 + i * 38;
    const wobble = vague ? 4 : Math.sin(i * 1.7 + star.x) * 18;
    const px = star.x + Math.cos(ang) * len + Math.cos(ang + Math.PI / 2) * wobble;
    const py = star.y + Math.sin(ang) * (vague ? len * 0.35 : len) + Math.sin(ang + Math.PI / 2) * wobble * 0.6;
    pts.push({ x: px, y: py, step: steps[i], i });
  }
  return pts;
}

export const Universe = {
  canvas: null,
  ctx: null,
  state: null,
  cam: { x: 0, y: 0, scale: 0.55 },
  target: null,
  dpr: 1,
  w: 0,
  h: 0,
  running: false,
  lastTs: 0,
  satAngle: 0,
  dust: [],
  pointers: new Map(),
  pinch: null,
  dragging: false,
  moved: false,
  downAt: 0,
  downPos: null,
  inertia: { vx: 0, vy: 0 },
  selected: null,
  onSelect: null,
  onEmpty: null,
  hover: null,
  flash: 0,
  birth: 0,

  init(canvas, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.state = state;
    this._resize();
    this._dust();
    window.addEventListener("resize", () => this._resize());
    this._bind();
  },

  _resize() {
    const c = this.canvas;
    const r = c.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = r.width;
    this.h = r.height;
    c.width = Math.round(r.width * this.dpr);
    c.height = Math.round(r.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  _dust() {
    this.dust = [];
    for (let i = 0; i < 280; i++) {
      this.dust.push({
        x: seeded(i + 1) * 5000 - 2500,
        y: seeded(i + 80) * 5000 - 2500,
        r: 0.4 + seeded(i + 200) * 1.3,
        a: 0.15 + seeded(i + 300) * 0.45,
      });
    }
  },

  worldToScreen(x, y) {
    return {
      x: (x - this.cam.x) * this.cam.scale + this.w / 2,
      y: (y - this.cam.y) * this.cam.scale + this.h / 2,
    };
  },
  screenToWorld(x, y) {
    return {
      x: (x - this.w / 2) / this.cam.scale + this.cam.x,
      y: (y - this.h / 2) / this.cam.scale + this.cam.y,
    };
  },

  flyTo(x, y, scale, ms = 900) {
    this.target = {
      x0: this.cam.x, y0: this.cam.y, s0: this.cam.scale,
      x1: x, y1: y, s1: scale ?? this.cam.scale,
      t0: performance.now(), ms,
    };
  },

  lookAtStar(star, close = true) {
    if (!star) return;
    const pts = routePoints(star);
    if (close && pts.length) {
      const mid = pts[Math.floor(pts.length / 2)];
      this.flyTo(lerp(star.x, mid.x, 0.35), lerp(star.y, mid.y, 0.35), 1.35, 800);
    } else {
      this.flyTo(star.x, star.y, close ? 1.4 : 0.85, 800);
    }
  },

  overview() {
    const clusters = this.state.clusters();
    const stars = this.state.allStars();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of clusters) {
      minX = Math.min(minX, c.x - 260);
      maxX = Math.max(maxX, c.x + 260);
      minY = Math.min(minY, c.y - 260);
      maxY = Math.max(maxY, c.y + 260);
    }
    for (const s of stars) {
      minX = Math.min(minX, s.x - 80);
      maxX = Math.max(maxX, s.x + 80);
      minY = Math.min(minY, s.y - 80);
      maxY = Math.max(maxY, s.y + 220);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const padW = this.w * 0.88;
    const padH = this.h * 0.72; // leave room for hud / whispers
    const sx = padW / Math.max(400, maxX - minX);
    const sy = padH / Math.max(400, maxY - minY);
    const scale = clamp(Math.min(sx, sy), 0.18, 0.7);
    this.flyTo(cx, cy + 40, scale, 900);
  },

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    const loop = (ts) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      this._tick(dt, ts);
      this._draw(ts);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  _tick(dt, ts) {
    this.satAngle += dt * 0.7;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.birth > 0) this.birth = Math.max(0, this.birth - dt);

    if (this.target) {
      const t = ease(clamp((ts - this.target.t0) / this.target.ms, 0, 1));
      this.cam.x = lerp(this.target.x0, this.target.x1, t);
      this.cam.y = lerp(this.target.y0, this.target.y1, t);
      this.cam.scale = lerp(this.target.s0, this.target.s1, t);
      if (t >= 1) this.target = null;
    } else if (!this.dragging && (this.inertia.vx || this.inertia.vy)) {
      this.cam.x += this.inertia.vx / this.cam.scale;
      this.cam.y += this.inertia.vy / this.cam.scale;
      this.inertia.vx *= 0.9;
      this.inertia.vy *= 0.9;
      if (Math.abs(this.inertia.vx) < 0.05) this.inertia.vx = 0;
      if (Math.abs(this.inertia.vy) < 0.05) this.inertia.vy = 0;
    }
    this.cam.scale = clamp(this.cam.scale, 0.16, 3.2);
  },

  _draw(ts) {
    const ctx = this.ctx;
    const { w, h } = this;
    ctx.fillStyle = "#07080c";
    ctx.fillRect(0, 0, w, h);

    // dust
    for (const d of this.dust) {
      const p = this.worldToScreen(d.x, d.y);
      if (p.x < -10 || p.y < -10 || p.x > w + 10 || p.y > h + 10) continue;
      ctx.fillStyle = `rgba(230,228,220,${d.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const stars = this.state.allStars();
    const clusters = this.state.clusters();
    const scale = this.cam.scale;

    // cluster nebulae + names
    for (const c of clusters) {
      const p = this.worldToScreen(c.x, c.y);
      const r = 220 * scale;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      const [cr, cg, cb] = c.tint;
      g.addColorStop(0, `rgba(${cr},${cg},${cb},0.13)`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      if (scale < 0.95) {
        ctx.save();
        ctx.globalAlpha = clamp(0.55 + scale * 0.3, 0.45, 0.8);
        ctx.fillStyle = "#c8c4b8";
        ctx.font = '12px "IBM Plex Sans JP", sans-serif';
        ctx.textAlign = "center";
        ctx.fillText(c.name, p.x, p.y - r * 0.55 - 10);
        ctx.restore();
      }
    }

    // merge bridges
    for (const m of this.state.data.mergesDone || []) {
      const [a, b] = m.split(":");
      const sa = stars.find((s) => s.id === a);
      const sb = stars.find((s) => s.id === b);
      if (!sa || !sb) continue;
      const pa = this.worldToScreen(sa.x, sa.y);
      const pb = this.worldToScreen(sb.x, sb.y);
      ctx.strokeStyle = "rgba(226,200,120,0.55)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // follow highlights
    const following = new Set(this.state.data.player.following || []);
    const cheering = new Set(this.state.data.player.cheering || []);

    // routes then stars (painter)
    for (const s of stars) this._drawRoute(ctx, s, following.has(s.id));
    for (const s of stars) this._drawStar(ctx, s, ts, following.has(s.id), cheering.has(s.id));

    // labels at closer zoom
    if (scale > 0.7) {
      ctx.font = "12px \"IBM Plex Sans JP\", sans-serif";
      ctx.textAlign = "center";
      for (const s of stars) {
        const p = this.worldToScreen(s.x, s.y);
        ctx.fillStyle = s.isPlayer ? "rgba(232,230,224,0.95)" : "rgba(200,198,188,0.75)";
        const label = s.isPlayer ? (s.title || "あなたの星") : s.name;
        ctx.fillText(label, p.x, p.y + 18 + this._radius(s) * scale);
      }
    }

    if (this.birth > 0) {
      const p = this.state.data.player;
      const sp = this.worldToScreen(p.x, p.y);
      const a = this.birth / 1.6;
      const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 260 * a);
      g.addColorStop(0, `rgba(255,244,214,${0.45 * a})`);
      g.addColorStop(1, "rgba(255,244,214,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  },

  _radius(s) {
    const acc = (s.steps?.length || 0) + (s.treasures?.length || 0) * 2 + (s.points?.length || 0);
    const base = s.isPlayer ? 8.5 : s.doer ? 6 : 4;
    return base + Math.min(10, acc * 0.35);
  },

  _drawRoute(ctx, star, followed) {
    const pts = routePoints(star);
    if (!pts.length) return;
    const origin = this.worldToScreen(star.x, star.y);
    const screens = pts.map((p) => ({ ...this.worldToScreen(p.x, p.y), step: p.step, wp: p }));
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    for (const p of screens) ctx.lineTo(p.x, p.y);
    const vague = !!star.vague;
    ctx.strokeStyle = followed
      ? "rgba(226,200,120,0.85)"
      : star.doer
        ? (vague ? "rgba(200,200,210,0.28)" : "rgba(226,200,120,0.5)")
        : "rgba(160,160,160,0.22)";
    ctx.lineWidth = followed ? 2.2 : 1.4;
    if (vague) ctx.setLineDash([3, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    const treasures = star.treasures || [];
    const points = star.points || [];
    for (let i = 0; i < screens.length; i++) {
      const p = screens[i];
      const step = p.step;
      const isVerified = step.seal === "verified";
      const isSelf = step.seal === "self";
      const tr = treasures.find((t) => t.atStep === step.id);
      const pt = points.find((pt) => pt.after === step.id);

      if (pt && this.cam.scale > 0.6) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(226,200,120,0.25)";
        ctx.fill();
        ctx.strokeStyle = "rgba(226,200,120,0.8)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      if (isVerified) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#7ec8c0";
        ctx.fill();
      } else if (isSelf) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(180,176,168,0.85)";
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }

      if (tr) {
        ctx.save();
        ctx.translate(p.x, p.y + 9);
        ctx.rotate(Math.PI / 4);
        const sale = tr.forSale && !this.state.hasPurchased(tr.id);
        ctx.fillStyle = sale ? "#d4a574" : "#c8b89a";
        ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
        ctx.restore();
      }
    }
  },

  _drawStar(ctx, s, ts, followed, cheered) {
    const p = this.worldToScreen(s.x, s.y);
    const r = this._radius(s) * Math.min(1.4, 0.55 + this.cam.scale * 0.6);
    const dim = !s.doer;
    const core = s.isPlayer ? "255,244,214" : dim ? "150,148,142" : "236,230,214";
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4.2);
    const a = dim ? 0.28 : s.isPlayer ? 0.95 : 0.7;
    g.addColorStop(0, `rgba(${core},${a})`);
    g.addColorStop(0.22, `rgba(${core},${0.35 * a})`);
    g.addColorStop(1, `rgba(${core},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${core},${dim ? 0.45 : 0.95})`;
    ctx.fill();

    if (this.selected === s.id) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(226,200,120,0.85)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    if (followed) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 11, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(226,200,120,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (cheered) {
      const pulse = 0.5 + 0.5 * Math.sin(ts / 500);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 15 + pulse * 2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(226,200,120,${0.2 + pulse * 0.15})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (s.isPlayer) this._drawSatellite(ctx, p, r, ts);
  },

  _drawSatellite(ctx, origin, starR, ts) {
    const waiting = this.state.data.satellite.pendingReport;
    const ang = this.satAngle;
    const orbit = starR + 16 + 6 * this.cam.scale;
    const x = origin.x + Math.cos(ang) * orbit;
    const y = origin.y + Math.sin(ang) * orbit * 0.72;
    ctx.beginPath();
    ctx.ellipse(origin.x, origin.y, orbit, orbit * 0.72, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(180,200,210,0.28)";
    ctx.lineWidth = 1;
    ctx.stroke();
    const pr = waiting ? 3.6 + Math.sin(ts / 200) * 0.8 : 2.6;
    const g = ctx.createRadialGradient(x, y, 0, x, y, pr * 4);
    g.addColorStop(0, waiting ? "rgba(170,230,220,0.95)" : "rgba(200,220,230,0.9)");
    g.addColorStop(1, "rgba(170,230,220,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, pr * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, pr, 0, Math.PI * 2);
    ctx.fillStyle = waiting ? "#b8efe6" : "#d4e4ec";
    ctx.fill();
    this._satScreen = { x, y, r: 16 };
  },

  satelliteHit() {
    return this._satScreen;
  },

  hitTest(sx, sy) {
    const sat = this._satScreen;
    if (sat && Math.hypot(sx - sat.x, sy - sat.y) < sat.r) {
      return { type: "satellite" };
    }
    const stars = this.state.allStars();
    // treasures first (smaller)
    for (const s of stars) {
      const pts = routePoints(s);
      for (const p of pts) {
        const tr = (s.treasures || []).find((t) => t.atStep === p.step.id);
        if (!tr) continue;
        const sc = this.worldToScreen(p.x, p.y);
        if (Math.hypot(sx - sc.x, sy - (sc.y + 9)) < 16) {
          return { type: "treasure", star: s, treasure: tr };
        }
      }
    }
    let best = null;
    let bestD = 28;
    for (const s of stars) {
      const sc = this.worldToScreen(s.x, s.y);
      const d = Math.hypot(sx - sc.x, sy - sc.y);
      const th = Math.max(22, this._radius(s) * 2.2);
      if (d < th && d < bestD + 8) {
        best = { type: "star", star: s };
        bestD = d;
      }
    }
    return best;
  },

  _bind() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => this._onDown(e));
    c.addEventListener("pointermove", (e) => this._onMove(e));
    c.addEventListener("pointerup", (e) => this._onUp(e));
    c.addEventListener("pointercancel", (e) => this._onUp(e));
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.target = null;
      const factor = Math.exp(-e.deltaY * 0.0012);
      const before = this.screenToWorld(e.offsetX, e.offsetY);
      this.cam.scale = clamp(this.cam.scale * factor, 0.16, 3.2);
      const after = this.screenToWorld(e.offsetX, e.offsetY);
      this.cam.x += before.x - after.x;
      this.cam.y += before.y - after.y;
    }, { passive: false });
    c.addEventListener("contextmenu", (e) => e.preventDefault());
  },

  _pt(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId };
  },

  _onDown(e) {
    this.canvas.setPointerCapture(e.pointerId);
    const p = this._pt(e);
    this.pointers.set(e.pointerId, p);
    this.moved = false;
    this.downAt = performance.now();
    this.downPos = p;
    this.target = null;
    this.inertia.vx = this.inertia.vy = 0;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale: this.cam.scale,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        world: this.screenToWorld((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
    } else {
      this.dragging = true;
      this.canvas.classList.add("dragging");
    }
  },

  _onMove(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this._pt(e);
    const prev = this.pointers.get(e.pointerId);
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.cam.scale = clamp(this.pinch.scale * (dist / this.pinch.dist), 0.16, 3.2);
      const after = this.screenToWorld(mid.x, mid.y);
      this.cam.x += this.pinch.world.x - after.x;
      this.cam.y += this.pinch.world.y - after.y;
      this.moved = true;
      return;
    }
    if (this.dragging && this.pointers.size === 1) {
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      if (Math.hypot(p.x - this.downPos.x, p.y - this.downPos.y) > 6) this.moved = true;
      this.cam.x -= dx / this.cam.scale;
      this.cam.y -= dy / this.cam.scale;
      this.inertia.vx = -dx;
      this.inertia.vy = -dy;
    }
  },

  _onUp(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0) {
      this.dragging = false;
      this.canvas.classList.remove("dragging");
      const dt = performance.now() - this.downAt;
      if (!this.moved && dt < 600 && this.downPos) {
        const hit = this.hitTest(this.downPos.x, this.downPos.y);
        if (hit) {
          if (hit.type === "star") this.selected = hit.star.id;
          if (this.onSelect) this.onSelect(hit);
        } else if (this.onEmpty) {
          this.selected = null;
          this.onEmpty();
        }
      }
    }
    try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  },

  playBirth() {
    this.birth = 1.6;
  },
};
