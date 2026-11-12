import { State } from "./state.js";
import { Universe } from "./universe.js";
import { SatelliteAgent } from "./satellite.js";
import { BROKERAGE, CURRENCY_NAME, formatMoney, formatDate, formatRelative, clusterById } from "./data.js";

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const Game = {
  sheetKind: null,
  sheetPayload: null,

  async init() {
    State.load();
    const canvas = $("universe");
    Universe.init(canvas, State);
    Universe.onSelect = (hit) => this.handleHit(hit);
    Universe.onEmpty = () => this.closeSheet();
    Universe.start();
    this._bind();
    this._renderHud();

    if (!State.data.player.hearing.completed) {
      this.startHearing();
    } else {
      this.enterUniverse({ returning: true });
    }
  },

  _bind() {
    $("hearing-submit").addEventListener("click", () => this._hearingAnswer(false));
    $("hearing-skip").addEventListener("click", () => this._hearingAnswer(true));
    $("hearing-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this._hearingAnswer(false);
      }
    });
    $("sheet-close").addEventListener("click", () => this.closeSheet());
    this._bindSheetSwipe();
    $("btn-zoom-out").addEventListener("click", () => {
      Universe.overview();
      this.closeSheet();
    });
    $("btn-my-star").addEventListener("click", () => {
      const s = State.playerStar();
      Universe.lookAtStar(s, true);
      this.openStar(s);
    });
    $("btn-proto").addEventListener("click", () => this.openProto());
    $("proto-close").addEventListener("click", () => this.closeProto());
    $("proto-skip-time").addEventListener("click", () => this.skipNight());
    $("proto-reset").addEventListener("click", () => {
      if (confirm("記録を消して、はじめからにしますか。")) {
        State.reset();
        location.reload();
      }
    });
    $("proto-map-auth").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-value]");
      if (!b) return;
      State.setMapAuthorship(b.dataset.value);
      this._syncProto();
      this.whisper("マップの起こし方は、未決定のままの仮のスイッチです。");
    });
    $("cinematic").addEventListener("click", (e) => {
      if (e.target.id === "cinematic-continue" || e.target.closest("#cinematic-continue")) {
        this.closeCinematic();
      }
    });
    $("sheet-body").addEventListener("click", (e) => this._onSheetClick(e));
  },

  _bindSheetSwipe() {
    const sheet = $("sheet");
    let y0 = 0, open = false;
    sheet.addEventListener("touchstart", (e) => {
      if (window.innerWidth >= 800) return;
      if (e.touches.length !== 1) return;
      const body = $("sheet-body");
      if (body.scrollTop > 0 && e.target !== sheet.querySelector(".sheet-handle")) return;
      y0 = e.touches[0].clientY;
      open = true;
    }, { passive: true });
    sheet.addEventListener("touchend", (e) => {
      if (!open) return;
      open = false;
      const y = e.changedTouches[0].clientY;
      if (y - y0 > 80) this.closeSheet();
    });
  },

  /* —— Hearing —— */
  _hearingStep: 0,
  _hearingWant: "",
  _hearingHow: "",

  startHearing() {
    $("hud").hidden = true;
    $("hearing").hidden = false;
    $("hearing-input-wrap").hidden = true;
    this._hearingStep = 0;
    this._typeLine("はじめに、ひとつだけ聴かせてください。", () => {
      setTimeout(() => {
        this._typeLine("いま、あなたが始めたいことは、なんですか。", () => {
          const ta = $("hearing-input");
          ta.placeholder = "言葉にできる範囲で、それでいいです。";
          $("hearing-input-wrap").hidden = false;
          this._hearingStep = 1;
          ta.focus();
        });
      }, 500);
    });
  },

  _typeLine(text, done) {
    const el = $("hearing-line");
    el.textContent = "";
    let i = 0;
    const tick = () => {
      i += 1;
      el.textContent = text.slice(0, i);
      if (i < text.length) setTimeout(tick, 36);
      else if (done) done();
    };
    tick();
  },

  _hearingAnswer(skip) {
    const ta = $("hearing-input");
    const val = skip ? "" : ta.value.trim();
    if (this._hearingStep === 1) {
      this._hearingWant = val;
      ta.value = "";
      $("hearing-input-wrap").hidden = true;
      this._typeLine("どんなふうに進めたいですか。条件があれば、それでいいです。", () => {
        ta.placeholder = "例：月に十万円、ほぼ手放しで。気が向いたときに。";
        $("hearing-input-wrap").hidden = false;
        this._hearingStep = 2;
        $("hearing-skip").textContent = "条件は、いまは置かない";
        ta.focus();
      });
      return;
    }
    if (this._hearingStep === 2) {
      this._hearingHow = val;
      $("hearing-input-wrap").hidden = true;
      State.completeHearing(this._hearingWant, this._hearingHow);
      this._typeLine("ここから。", () => {
        setTimeout(() => {
          $("hearing").hidden = true;
          this.enterUniverse({ birth: true });
        }, 700);
      });
    }
  },

  async enterUniverse({ birth = false, returning = false } = {}) {
    $("hud").hidden = false;
    this._renderHud();
    const player = State.playerStar();
    if (birth) {
      Universe.cam.x = player.x;
      Universe.cam.y = player.y;
      Universe.cam.scale = 2.1;
      Universe.playBirth();
      Universe.flyTo(player.x, player.y, 1.5, 400);
      this.whisper("星が、生まれた。");
      setTimeout(() => {
        Universe.overview();
        this.whisper("同じ宇宙に、ほかの星もある。");
      }, 2200);
    } else if (returning) {
      Universe.cam.x = player.x;
      Universe.cam.y = player.y;
      Universe.cam.scale = 1.1;
      setTimeout(() => Universe.overview(), 500);
      await this._checkSatelliteReturn();
    }
  },

  async _checkSatelliteReturn(force = false) {
    const last = State.data.satellite.lastVisitAt || State.data.player.hearing.at || Date.now();
    const elapsed = Date.now() - last;
    if (State.data.satellite.pendingReport && !force) {
      this.openSatelliteReport(State.data.satellite.pendingReport);
      return;
    }
    const ctx = SatelliteAgent.buildContext(State, elapsed, force);
    const report = await SatelliteAgent.work(ctx);
    State.data.satellite.lastVisitAt = Date.now();
    State.save();
    if (report && report.items && report.items.length) {
      State.setPendingReport(report);
      this.openSatelliteReport(report);
    } else if (force) {
      this.whisper("衛星は、まだ周回の途中です。");
    }
  },

  /* —— Hits —— */
  handleHit(hit) {
    if (hit.type === "satellite") {
      this.openSatellite();
      return;
    }
    if (hit.type === "treasure") {
      Universe.lookAtStar(hit.star, true);
      this.openTreasure(hit.star, hit.treasure);
      return;
    }
    if (hit.type === "star") {
      Universe.lookAtStar(hit.star, true);
      this.openStar(hit.star);
    }
  },

  /* —— Sheet —— */
  openSheet(html) {
    const sheet = $("sheet");
    const body = $("sheet-body");
    body.innerHTML = html;
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add("open"));
    body.scrollTop = 0;
  },

  closeSheet() {
    const sheet = $("sheet");
    sheet.classList.remove("open");
    Universe.selected = null;
    setTimeout(() => {
      if (!sheet.classList.contains("open")) sheet.hidden = true;
    }, 420);
  },

  openStar(star) {
    const isPlayer = !!star.isPlayer;
    const cluster = clusterById(star.cluster);
    const authorship = State.data.flags.mapAuthorship;
    const authorshipNote =
      authorship === "individual"
        ? "（試作：この星図は個人が開いた、という仮の表示）"
        : authorship === "operated"
          ? "（試作：この星図は運営が開いた、という仮の表示）"
          : "";
    const doer = star.doer && (star.steps || []).length > 0;
    const sameOrigin = this._sameOriginPeers(star);

    const stepsHtml = (star.steps || []).length
      ? `<div class="route-timeline">${star.steps.map((st) => this._stepHtml(star, st)).join("")}</div>`
      : `<p class="dim-star-note">まだ、歩いていない。星だけが、ここにある。</p>`;

    const treasures = star.treasures || [];
    const tHtml = treasures.length
      ? `<div class="kicker">航路に残った宝</div>${treasures.map((t) => this._treasureBrief(star, t)).join("")}`
      : "";

    const points = star.points || [];
    const pHtml = points.length
      ? `<p class="lead">地点は、あらかじめ置かれたものではない。歩程が積もったあとで、結晶している。</p>`
      : "";

    const vague = star.vague
      ? `<p class="lead">航路は一本で、霞んでいる。分岐が見えていないこと自体が、いまの詰まりです。</p>`
      : "";

    const owned = isPlayer
      ? `<div class="owned-banner">この歩程も、この宝も、あなたのもの。</div>`
      : "";

    const actions = this._starActions(star);
    const stride = star.strideLabel
      ? `<span>歩いた日 <b>${esc(star.strideLabel)}</b></span>`
      : `<span>歩程 <b>${(star.steps || []).length}</b></span>`;
    const originText = isPlayer
      ? (State.data.player.hearing.how
          ? `進め方：${State.data.player.hearing.how}`
          : "")
      : (star.origin || "");

    this.openSheet(`
      <div class="kicker">${esc(cluster ? cluster.name : "")} ${esc(authorshipNote)}</div>
      <h2>${esc(isPlayer ? (star.title || "あなたの星") : star.title)}</h2>
      <p class="lead">${esc(originText)}</p>
      ${owned}
      ${vague}
      <div class="meta-row">
        ${isPlayer ? "" : `<span><b>${esc(star.name)}</b></span>`}
        <span>${doer ? "歩いている" : "まだ、歩いていない"}</span>
        ${stride}
        <span>地点 <b>${points.length}</b></span>
        <span>宝 <b>${treasures.length}</b></span>
        <span>見守り <b>${star.cheer || 0}</b></span>
      </div>
      ${pHtml}
      ${sameOrigin}
      ${actions}
      <div class="kicker">歩程</div>
      ${stepsHtml}
      ${tHtml}
    `);
  },

  _sameOriginPeers(star) {
    if (star.isPlayer) return "";
    const peers = State.allStars().filter(
      (s) => s.cluster === star.cluster && s.id !== star.id && !s.isPlayer
    );
    if (!peers.length) return "";
    const rows = peers
      .map((s) => {
        const n = (s.steps || []).length;
        const flag = s.doer && n > 0 ? `歩程 ${n}` : "まだ、歩いていない";
        return `<span>${esc(s.name)}　${flag}</span>`;
      })
      .join("");
    return `<div class="kicker">同じ出発点の、ほかの星</div><div class="meta-row">${rows}</div>`;
  },

  _stepHtml(star, st) {
    const tr = (star.treasures || []).find((t) => t.atStep === st.id);
    const pt = (star.points || []).find((p) => p.after === st.id);
    const cls = [
      "step",
      st.seal === "verified" ? "sealed" : "self",
      tr ? "treasure-step" : "",
    ].join(" ");
    const tags = [];
    if (st.seal === "verified") tags.push(`<span class="tag seal">刻印　外の事実</span>`);
    else tags.push(`<span class="tag self">本人の記録</span>`);
    if (pt) tags.push(`<span class="tag">地点「${esc(pt.title)}」が結晶</span>`);
    if (tr) tags.push(`<span class="tag treasure">宝　${esc(tr.name)}</span>`);
    if (st.fromSatellite) tags.push(`<span class="tag">衛星が置いた</span>`);
    const fact = st.fact ? `<p class="lead" style="margin:4px 0 0">${esc(st.fact)}</p>` : "";
    const trBtn = tr
      ? `<button type="button" class="act" style="margin-top:8px" data-act="open-treasure" data-star="${esc(star.id)}" data-treasure="${esc(tr.id)}">この宝を見る</button>`
      : "";
    return `<div class="${cls}">
      <time>${esc(formatDate(st.t))}　${esc(formatRelative(st.t))}</time>
      <p>${esc(st.text)}</p>
      ${fact}
      <div class="tag-row">${tags.join("")}</div>
      ${trBtn}
    </div>`;
  },

  _treasureBrief(star, t) {
    const owned = star.isPlayer || State.hasPurchased(t.id);
    const taken = State.isExclusiveTaken(t.id);
    const sale = t.forSale && !owned && !taken;
    return `<button type="button" class="treasure-card" data-act="open-treasure" data-star="${esc(star.id)}" data-treasure="${esc(t.id)}">
      <div class="tag-row">
        <span class="tag treasure">${esc(t.kind || "宝")}</span>
        ${sale ? `<span class="tag sale">受け渡せる</span>` : ""}
        ${owned ? `<span class="tag owned">あなたのものである</span>` : ""}
        ${t.antiResale ? `<span class="tag warn">転売できない</span>` : ""}
      </div>
      <h3>${esc(t.name)}</h3>
      <p>${esc(t.desc)}</p>
    </button>`;
  },

  _starActions(star) {
    if (star.isPlayer) {
      return `<div class="actions">
        <button type="button" class="act primary" data-act="record">今日の歩みを、残す</button>
        <button type="button" class="act" data-act="open-sat">衛星に、近づく</button>
      </div>`;
    }
    const cheered = State.data.player.cheering.includes(star.id);
    const followed = State.data.player.following.includes(star.id);
    let merge = "";
    if (star.complementary) {
      const other = State.starById(star.complementary);
      const done = other && State.isMerged(star.id, other.id);
      if (done) {
        merge = `<div class="owned-banner">絵の側と、話の側が、合流している。役割は、自然に分かれた。</div>`;
      } else if (other) {
        merge = `<button type="button" class="act primary" data-act="merge" data-a="${esc(star.id)}" data-b="${esc(other.id)}">
          ${esc(other.name)}と、合流を申し出る
          <span class="sub">絵を持つ人と、話を持つ人。中で続けるか外でやるかは、あとから選べる（試作）</span>
        </button>`;
      }
    }
    return `<div class="actions">
      <button type="button" class="act ${cheered ? "" : "primary"}" data-act="cheer" data-id="${esc(star.id)}" ${cheered ? "disabled" : ""}>
        ${cheered ? "見守りの光は、もう届いている" : "見守る"}
        <span class="sub">${cheered ? "星のそばに、光が残っています" : "応援は、星のそばに光として残る"}</span>
      </button>
      <button type="button" class="act" data-act="follow" data-id="${esc(star.id)}">
        ${followed ? "この航路を、追うのをやめる" : "この航路を、追う"}
        <span class="sub">${followed ? "衛星は、もうこの航路の変化を見ています" : "衛星が、いないあいだもこの航路を見る"}</span>
      </button>
      ${merge}
    </div>`;
  },

  openTreasure(star, treasure) {
    const isOwn = star.isPlayer || treasure.owner === "player" || State.hasPurchased(treasure.id);
    const taken = State.isExclusiveTaken(treasure.id) && !State.hasPurchased(treasure.id);
    const purchase = State.data.player.purchases.find((p) => p.treasureId === treasure.id || p.treasureId === treasure.sourceId);
    const prov = (treasure.provenance || []).length
      ? treasure.provenance
      : [
          { at: star.steps?.find((s) => s.id === treasure.atStep)?.t, event: `${star.name}の営みから生まれた` },
          { at: Date.now(), event: "所有者は、いまの星の主" },
        ];

    const bundle = (treasure.bundle || []).length
      ? `<div class="provenance"><div>含まれているもの</div><ol>${treasure.bundle.map((b) => `<li>${esc(b)}</li>`).join("")}</ol></div>`
      : "";

    let market = "";
    if (isOwn) {
      const how = purchase
        ? purchase.exclusive
          ? "独占として、あなたが受け取った。"
          : "非独占として、あなたが受け取った。"
        : "あなたの営みから生まれた。";
      market = `
        <div class="owned-banner">この宝は、あなたのもの。${how} 転売はできないようになっている。</div>
      `;
    } else if (taken) {
      market = `<div class="owned-banner" style="color:var(--ink-dim)">独占として、すでに誰かが受け取っている。いまは、受け取れない。</div>`;
    } else if (treasure.forSale) {
      const ex = this._offerHtml(star, treasure, true);
      const sh = this._offerHtml(star, treasure, false);
      market = `
        <div class="kicker">途中から、受け取る</div>
        <p class="lead">先の人の軌跡を、この地点から自分の営みへ移せる。独占は高く、分かちは低い。</p>
        ${ex}
        ${sh}
        <p class="placeholder-note">${esc(BROKERAGE.note)}　星屑は試作の通貨で、実際の支払いは発生しません。</p>
      `;
    }

    this.openSheet(`
      <div class="kicker">${esc(star.name)}の航路にある宝</div>
      <h2>${esc(treasure.name)}</h2>
      <div class="tag-row" style="margin-bottom:8px">
        <span class="tag treasure">${esc(treasure.kind || "宝")}</span>
        ${treasure.antiResale !== false ? `<span class="tag warn">転売できない</span>` : ""}
      </div>
      <p class="lead">${esc(treasure.desc)}</p>
      ${market}
      ${bundle}
      <div class="provenance">
        <div>来歴</div>
        <ol>${prov.map((p) => `<li>${p.at ? esc(formatDate(p.at)) + "　" : ""}${esc(p.event)}</li>`).join("")}</ol>
      </div>
      <div class="actions">
        <button type="button" class="act" data-act="open-star" data-id="${esc(star.id)}">星の航路へ戻る</button>
      </div>
    `);
  },

  _offerHtml(star, treasure, exclusive) {
    const price = exclusive ? treasure.exclusive : treasure.shared;
    const { fee, total } = State.totalCost(price);
    const enough = State.canBuy(price);
    const title = exclusive ? "独占して、持つ" : "分けてもらう";
    const sub = exclusive
      ? "あなただけが、この先を歩ける。値は高い。"
      : "同じ宝を、ほかの人も持てる。値は低い。";
    return `<div class="offer-card">
      <h3>${title}</h3>
      <p>${sub}</p>
      <div class="price-line"><span>値</span><span>${formatMoney(price)} ${CURRENCY_NAME}</span></div>
      <div class="price-line"><span>${BROKERAGE.label}（試作の仮の率 ${Math.round(BROKERAGE.rate * 100)}%）</span><span>${formatMoney(fee)}</span></div>
      <div class="price-line total"><span>あわせて</span><span>${formatMoney(total)} ${CURRENCY_NAME}</span></div>
      <button type="button" class="act primary" style="margin-top:12px"
        data-act="buy" data-star="${esc(star.id)}" data-treasure="${esc(treasure.id)}" data-exclusive="${exclusive ? "1" : "0"}"
        ${enough ? "" : "disabled"}>
        ${enough ? "この条件で、受け取る" : "いまの星屑では、届かない"}
      </button>
    </div>`;
  },

  openRecord() {
    this.openSheet(`
      <div class="kicker">あなたの航路</div>
      <h2>今日の歩みを、残す</h2>
      <p class="lead">時刻が付いて、星から伸びる航路に残ります。地点は、あらかじめ決めません。積もったあとで、結晶します。</p>
      <div class="step-form">
        <textarea id="step-text" rows="4" maxlength="240" placeholder="やったこと、残したいことを、短く。"></textarea>
        <button type="button" class="act primary" data-act="submit-step">航路に、残す</button>
      </div>
    `);
    setTimeout(() => $("step-text")?.focus(), 300);
  },

  submitStep() {
    const ta = $("step-text");
    const text = (ta?.value || "").trim();
    if (!text) {
      this.whisper("言葉を、ひとつ残してください。");
      return;
    }
    const { step, point } = State.addStep(text);
    this._renderHud();
    this.whisper("歩程は、あなたのものとして残った。");
    if (point) {
      setTimeout(() => {
        this.whisper(`地点「${point.title}」が、結晶した。あらかじめ置かれたものではない。`);
      }, 900);
    }
    Universe.lookAtStar(State.playerStar(), true);
    this.openStar(State.playerStar());
    return step;
  },

  async openSatellite() {
    const pending = State.data.satellite.pendingReport;
    if (pending && pending.items?.length) {
      this.openSatelliteReport(pending);
      return;
    }
    const last = State.data.satellite.lastVisitAt || Date.now();
    const elapsed = Date.now() - last;
    const ctx = SatelliteAgent.buildContext(State, Math.max(elapsed, 20 * 60 * 1000), false);
    const report = await SatelliteAgent.work({ ...ctx, elapsedMs: Math.max(elapsed, 20 * 60 * 1000) });
    if (report.items?.length) {
      State.setPendingReport(report);
      this.openSatelliteReport(report);
    } else {
      this.openSheet(`
        <div class="kicker">衛星</div>
        <h2>あなたの星を、周回している</h2>
        <p class="lead">あなたがいないあいだも、選ぶ・調べる・回すを、こちらが引き受ける。戻ったときに、ここで報告する。</p>
        <p class="placeholder-note">いまは模擬です。本物のエージェントは、衛星の差し替え点からつなげます。</p>
        <div class="actions">
          <button type="button" class="act" data-act="skip-night">夜を越えて、報告を見る</button>
        </div>
      `);
    }
  },

  openSatelliteReport(report) {
    const hours = (report.elapsedMs || 0) / 3600000;
    const timeLabel = hours >= 24
      ? `${Math.round(hours / 24)}日のあいだ`
      : hours >= 1
        ? `${Math.max(1, Math.round(hours))}時間のあいだ`
        : "短いあいだ";
    const items = (report.items || []).map((it) => `
      <div class="work-item">
        <div class="kind">${esc(SatelliteAgent.kindLabel[it.kind] || it.kind)}</div>
        <h3>${esc(it.title)}</h3>
        <p>${esc(it.body)}</p>
        ${it.artifact ? `<p><span class="tag owned">宝として残す　${esc(it.artifact.name)}</span></p>` : ""}
      </div>
    `).join("");
    $("hud").hidden = true;
    $("cinematic").hidden = false;
    $("cinematic-body").innerHTML = `
      <div class="kicker">衛星の周回</div>
      <h2>あなたがいない${esc(timeLabel)}に、衛星は周回していました。</h2>
      ${items}
      <button type="button" id="cinematic-continue" class="act primary">星に、戻す</button>
      <p class="placeholder-note" style="margin-top:14px">${report.simulated ? "この報告は模擬です。本物のエージェントは後から差し込めます。" : ""}</p>
    `;
  },

  closeCinematic() {
    const report = State.data.satellite.pendingReport;
    if (report) {
      State.applySatelliteArtifacts(report);
      State.consumeReport();
      this._renderHud();
      this.whisper("衛星が残したものは、あなたの星に積まれた。");
    }
    $("cinematic").hidden = true;
    $("hud").hidden = false;
  },

  async skipNight() {
    this.closeProto();
    State.skipTime(36 * 60 * 60 * 1000);
    this.whisper("夜を越えた。");
    await this._checkSatelliteReturn(true);
  },

  doCheer(id) {
    if (State.cheer(id)) {
      this.whisper("見守りの光を、送った。");
      const s = State.starById(id);
      if (s) this.openStar(s);
    }
  },

  doFollow(id) {
    const already = State.data.player.following.includes(id);
    if (already) {
      State.unfollow(id);
      this.whisper("この航路を、追うのをやめた。");
    } else {
      State.follow(id);
      this.whisper("この航路を、追う。いないあいだも、衛星が見ておく。");
    }
    const s = State.starById(id);
    if (s) this.openStar(s);
  },

  doMerge(a, b) {
    if (State.merge(a, b)) {
      this.whisper("二つの星が、合流した。");
      const s = State.starById(a);
      if (s) this.openStar(s);
    }
  },

  doBuy(starId, treasureId, exclusive) {
    const star = State.starById(starId);
    const treasure = (star?.treasures || []).find((t) => t.id === treasureId);
    if (!star || !treasure) return;
    const res = State.purchase(star, treasure, exclusive);
    this._renderHud();
    if (!res.ok) {
      const msg = {
        funds: "いまの星屑では、届かない。",
        taken: "独占は、すでに受け取られている。",
        already: "すでに、あなたのものになっている。",
      }[res.reason] || "受け取れなかった。";
      this.whisper(msg);
      return;
    }
    this.whisper(
      exclusive
        ? "独占として、受け取った。転売はできない。この地点から、歩ける。"
        : "分けてもらい、受け取った。転売はできない。この地点から、歩ける。"
    );
    Universe.lookAtStar(State.playerStar(), true);
    this.openTreasure(State.playerStar(), res.item);
  },

  _onSheetClick(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "open-treasure") {
      const star = State.starById(btn.dataset.star);
      const t = (star?.treasures || []).find((x) => x.id === btn.dataset.treasure);
      if (star && t) this.openTreasure(star, t);
    } else if (act === "open-star") {
      const star = State.starById(btn.dataset.id);
      if (star) this.openStar(star);
    } else if (act === "record") this.openRecord();
    else if (act === "submit-step") this.submitStep();
    else if (act === "open-sat") this.openSatellite();
    else if (act === "cheer") this.doCheer(btn.dataset.id);
    else if (act === "follow") this.doFollow(btn.dataset.id);
    else if (act === "merge") this.doMerge(btn.dataset.a, btn.dataset.b);
    else if (act === "buy") this.doBuy(btn.dataset.star, btn.dataset.treasure, btn.dataset.exclusive === "1");
    else if (act === "skip-night") this.skipNight();
  },

  openProto() {
    $("proto").hidden = false;
    this._syncProto();
  },
  closeProto() {
    $("proto").hidden = true;
  },
  _syncProto() {
    const v = State.data.flags.mapAuthorship;
    $("proto-map-auth").querySelectorAll("button").forEach((b) => {
      b.classList.toggle("on", b.dataset.value === v);
    });
  },

  _renderHud() {
    const n = State.data.player.currency;
    $("currency").innerHTML = `${formatMoney(n)} <small>${CURRENCY_NAME}</small>`;
  },

  whisper(text) {
    const wrap = $("whispers");
    const el = document.createElement("div");
    el.className = "whisper";
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  },
};

// 試作・検証・スクリーンショット用
window.RayLee = {
  State,
  Universe,
  Game,
  SatelliteAgent,
  async goto(id) {
    const s = State.starById(id);
    if (!s) return null;
    Universe.lookAtStar(s, true);
    Game.openStar(s);
    return s;
  },
  treasure(starId, tid) {
    const s = State.starById(starId);
    const t = (s?.treasures || []).find((x) => x.id === tid);
    if (s && t) {
      Universe.lookAtStar(s, true);
      Game.openTreasure(s, t);
    }
  },
  async night() {
    await Game.skipNight();
  },
  overview() {
    Game.closeSheet();
    Universe.overview();
  },
};
