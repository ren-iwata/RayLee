import {
  STORAGE_KEY,
  STATE_VERSION,
  STARTING_CURRENCY,
  BROKERAGE,
  CLUSTERS,
  buildStars,
  suggestCluster,
  clusterById,
} from "./data.js";

function emptyPlayer() {
  return {
    id: "player",
    name: "あなた",
    title: "",
    origin: "",
    hearing: { want: "", how: "", completed: false, at: 0 },
    cluster: "open",
    x: 250,
    y: -140,
    doer: true,
    cheer: 0,
    steps: [],
    points: [],
    treasures: [],
    currency: STARTING_CURRENCY,
    following: [],
    cheering: [],
    merges: [],
    purchases: [],
    crystallizationCount: 0,
  };
}

function defaultState() {
  return {
    version: STATE_VERSION,
    player: emptyPlayer(),
    npcExtras: {},
    exclusiveTaken: {},
    mergesDone: [],
    satellite: {
      lastWorkAt: 0,
      lastVisitAt: 0,
      pendingReport: null,
      history: [],
    },
    flags: {
      mapAuthorship: "undecided",
      seenBirth: false,
      firstReturnDone: false,
    },
    visits: { first: 0, last: 0, count: 0 },
  };
}

export const State = {
  data: defaultState(),
  worldStars: [],

  load() {
    let loaded = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) loaded = JSON.parse(raw);
    } catch (e) {
      console.warn("RayLee: 記録を読めませんでした", e);
    }
    if (loaded && loaded.version === STATE_VERSION) {
      this.data = { ...defaultState(), ...loaded };
      this.data.player = { ...emptyPlayer(), ...(loaded.player || {}) };
    } else {
      this.data = defaultState();
    }
    this.worldStars = buildStars();
    this._applyVisit();
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn("RayLee: 記録を書けませんでした", e);
    }
  },

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.data = defaultState();
    this.worldStars = buildStars();
    this.save();
  },

  _applyVisit() {
    const now = Date.now();
    const v = this.data.visits;
    if (!v.first) v.first = now;
    v.last = now;
    v.count = (v.count || 0) + 1;
    this.save();
  },

  completeHearing(want, how) {
    const p = this.data.player;
    p.hearing = { want: want || "", how: how || "", completed: true, at: Date.now() };
    p.title = want && want.trim() ? want.trim() : "まだ、言葉になっていない";
    p.origin = [want, how].filter(Boolean).join("　");
    const clusterId = suggestCluster(`${want} ${how}`);
    p.cluster = clusterId;
    const c = clusterById(clusterId);
    const jitter = () => (Math.random() - 0.5) * 180;
    p.x = c.x + jitter();
    p.y = c.y + 140 + jitter() * 0.5;
    this.data.satellite.lastVisitAt = Date.now();
    this.data.satellite.lastWorkAt = Date.now();
    this.data.flags.seenBirth = false;
    this.save();
  },

  addStep(text) {
    const p = this.data.player;
    const id = "pl-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const step = {
      id,
      t: Date.now(),
      text: text.trim(),
      seal: "self",
    };
    p.steps.push(step);
    const point = this._maybeCrystallize();
    this.save();
    return { step, point };
  },

  _maybeCrystallize() {
    const p = this.data.player;
    const used = new Set(p.points.flatMap((pt) => pt.crystallizedFrom || []));
    const unused = p.steps.filter((s) => !used.has(s.id));
    if (unused.length < 3) return null;
    const group = unused.slice(-3);
    const last = group[group.length - 1];
    const title = this._pointTitle(group, p.points.length);
    const point = {
      id: "pt-" + Date.now().toString(36),
      after: last.id,
      title,
      crystallizedFrom: group.map((s) => s.id),
      at: Date.now(),
    };
    p.points.push(point);
    p.crystallizationCount = (p.crystallizationCount || 0) + 1;
    if (p.crystallizationCount === 1 && !p.treasures.some((t) => t.id === "pl-first-byproduct")) {
      p.treasures.push({
        id: "pl-first-byproduct",
        name: "最初の副産物",
        kind: "メモ",
        atStep: last.id,
        desc: "歩程が積もったところで、自然に残ったもの。あらかじめ置かれた課題ではない。",
        owner: "player",
        provenance: [{ at: Date.now(), event: "営みの副産物として生まれた" }],
        forSale: false,
        antiResale: true,
      });
    }
    return point;
  },

  _pointTitle(group, index) {
    const words = group.map((s) => s.text).join(" ");
    if (words.length < 18) return words.replace(/。/g, "") || `地点 ${index + 1}`;
    return `積もってできた地点`;
  },

  cheer(starId) {
    const p = this.data.player;
    if (p.cheering.includes(starId)) return false;
    p.cheering.push(starId);
    this.save();
    return true;
  },

  follow(starId) {
    const p = this.data.player;
    if (p.following.includes(starId)) return false;
    p.following.push(starId);
    this.save();
    return true;
  },

  unfollow(starId) {
    const p = this.data.player;
    p.following = p.following.filter((id) => id !== starId);
    this.save();
  },

  merge(a, b) {
    const key = [a, b].sort().join(":");
    if (this.data.mergesDone.includes(key)) return false;
    this.data.mergesDone.push(key);
    this.data.player.merges.push({ a, b, at: Date.now() });
    this.save();
    return true;
  },

  isMerged(a, b) {
    const key = [a, b].sort().join(":");
    return this.data.mergesDone.includes(key);
  },

  totalCost(price) {
    const fee = Math.round(price * BROKERAGE.rate);
    return { price, fee, total: price + fee };
  },

  canBuy(price) {
    const { total } = this.totalCost(price);
    return this.data.player.currency >= total;
  },

  isExclusiveTaken(treasureId) {
    return !!this.data.exclusiveTaken[treasureId];
  },

  hasPurchased(treasureId) {
    return this.data.player.purchases.some((p) => p.treasureId === treasureId);
  },

  purchase(star, treasure, exclusive) {
    if (this.hasPurchased(treasure.id)) {
      return { ok: false, reason: "already" };
    }
    if (exclusive && this.isExclusiveTaken(treasure.id)) {
      return { ok: false, reason: "taken" };
    }
    const price = exclusive ? treasure.exclusive : treasure.shared;
    const { fee, total } = this.totalCost(price);
    if (this.data.player.currency < total) {
      return { ok: false, reason: "funds" };
    }
    this.data.player.currency -= total;
    if (exclusive) this.data.exclusiveTaken[treasure.id] = this.data.player.id;
    const item = {
      id: "own-" + treasure.id,
      sourceId: treasure.id,
      name: treasure.name,
      kind: treasure.kind,
      desc: treasure.desc,
      bundle: treasure.bundle || [],
      fromStar: star.id,
      fromStarName: star.name,
      exclusive,
      antiResale: true,
      owner: "player",
      boughtAt: Date.now(),
      price,
      fee,
      total,
      midpoint: treasure.fromMidpoint || null,
      provenance: [
        { at: star.steps?.find((s) => s.id === treasure.atStep)?.t || 0, event: `${star.name}の営みから生まれた` },
        { at: Date.now(), event: exclusive ? "独占として、あなたが受け取った" : "非独占として、あなたが受け取った" },
        { at: Date.now(), event: "転売できないものとして、保証されている" },
      ],
    };
    this.data.player.treasures.push(item);
    this.data.player.purchases.push({
      treasureId: treasure.id,
      exclusive,
      at: Date.now(),
      fee,
      total,
    });
    if (treasure.fromMidpoint) {
      this.data.player.steps.push({
        id: "from-" + treasure.id,
        t: Date.now(),
        text: `${star.name}の「${treasure.name}」を、途中の地点から受け取った。ここから、歩ける。`,
        seal: "self",
        fromPurchase: treasure.id,
      });
    }
    this.save();
    return { ok: true, item, fee, total, exclusive };
  },

  consumeReport() {
    const r = this.data.satellite.pendingReport;
    this.data.satellite.pendingReport = null;
    this.data.satellite.lastVisitAt = Date.now();
    this.save();
    return r;
  },

  setPendingReport(report) {
    this.data.satellite.pendingReport = report;
    if (report) {
      this.data.satellite.history = [report, ...(this.data.satellite.history || [])].slice(0, 12);
      this.data.satellite.lastWorkAt = Date.now();
    }
    this.save();
  },

  applySatelliteArtifacts(report) {
    if (!report || !report.items) return;
    const p = this.data.player;
    for (const it of report.items) {
      if (it.artifact) {
        p.treasures.push({
          id: "sat-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          name: it.artifact.name,
          kind: it.artifact.kind || "メモ",
          desc: it.artifact.desc,
          owner: "player",
          antiResale: true,
          fromSatellite: true,
          provenance: [
            { at: Date.now(), event: "あなたがいないあいだに、衛星が残した" },
          ],
        });
      }
      if (it.stepText) {
        p.steps.push({
          id: "satstep-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          t: Date.now(),
          text: it.stepText,
          seal: "self",
          fromSatellite: true,
        });
      }
    }
    this.save();
  },

  skipTime(ms) {
    const last = this.data.satellite.lastVisitAt || Date.now();
    this.data.satellite.lastVisitAt = last - ms;
    this.save();
  },

  setMapAuthorship(v) {
    this.data.flags.mapAuthorship = v;
    this.save();
  },

  playerStar() {
    const p = this.data.player;
    return {
      id: "player",
      cluster: p.cluster,
      name: p.name,
      title: p.title,
      origin: p.origin,
      x: p.x,
      y: p.y,
      doer: true,
      cheer: p.cheer + p.cheering.length,
      steps: p.steps,
      points: p.points,
      treasures: p.treasures,
      isPlayer: true,
      following: p.following,
    };
  },

  allStars() {
    const extras = this.data.npcExtras || {};
    const npcs = this.worldStars.map((s) => {
      const ex = extras[s.id];
      const cheerBonus = this.data.player.cheering.includes(s.id) ? 1 : 0;
      return {
        ...s,
        steps: [...s.steps, ...(ex?.steps || [])],
        cheer: (s.cheer || 0) + cheerBonus,
      };
    });
    if (this.data.player.hearing.completed) {
      return [...npcs, this.playerStar()];
    }
    return npcs;
  },

  starById(id) {
    return this.allStars().find((s) => s.id === id);
  },

  findTreasure(treasureId) {
    for (const s of this.allStars()) {
      const t = (s.treasures || []).find((x) => x.id === treasureId || x.sourceId === treasureId);
      if (t) return { star: s, treasure: t };
    }
    return null;
  },

  clusters() {
    return CLUSTERS;
  },
};
