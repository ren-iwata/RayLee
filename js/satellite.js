/**
 * AI衛星。
 *
 * いまは模擬（LLMは使わない）。本物のエージェントを後からつなぐときは、
 * SatelliteAgent.adapter に関数を渡すだけでよい。
 *
 *   SatelliteAgent.adapter = async (context) => {
 *     const res = await fetch("/api/satellite", {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify(context),
 *     });
 *     return res.json();
 *     // 期待する形: { elapsedMs, items: [{ kind, title, body, artifact?, stepText? }] }
 *     // kind は "select" | "research" | "run"
 *   };
 *
 * work() 以外の呼び出し口から直接模擬を書かないこと。差し替え点はここだけ。
 */

const KIND_LABEL = {
  select: "選ぶ",
  research: "調べる",
  run: "回す",
};

export const SatelliteAgent = {
  adapter: null,
  kindLabel: KIND_LABEL,

  /**
   * @param {object} context
   * @param {number} context.elapsedMs  不在だった時間
   * @param {object} context.player
   * @param {string[]} context.following
   * @param {object[]} context.followedStars
   * @param {object[]} context.nearbyStars
   * @param {object[]} context.marketOffers
   */
  async work(context) {
    if (typeof this.adapter === "function") {
      return this.adapter(context);
    }
    return this.simulate(context);
  },

  simulate(context) {
    const hours = (context.elapsedMs || 0) / 3600000;
    const items = [];
    const want = context.player?.title || context.player?.hearing?.want || "";
    const how = context.player?.hearing?.how || "";
    const following = context.followedStars || [];
    const offers = context.marketOffers || [];
    const nearby = context.nearbyStars || [];

    if (hours < 0.08 && !context.force) {
      return { elapsedMs: context.elapsedMs, items: [], quiet: true };
    }

    // 調べる
    if (following.length) {
      const s = following[0];
      const last = (s.steps || [])[s.steps.length - 1];
      items.push({
        kind: "research",
        title: `${s.name}の航路を、見ておいた`,
        body: last
          ? `追っている航路の、いちばん先は「${last.text}」。`
          : `${s.name}の星は、まだ短い。変化があれば、また残す。`,
      });
    } else if (nearby.length) {
      const s = nearby.find((n) => n.doer) || nearby[0];
      items.push({
        kind: "research",
        title: "近くの星を、一つ拾った",
        body: s
          ? `「${s.title}」。同じ宇宙に、すでに歩いている人がいる。`
          : "近くの星図を、ひと通り掃いた。",
      });
    }

    // 選ぶ
    if (want || how) {
      items.push({
        kind: "select",
        title: "次の一歩の候補を、三つに絞った",
        body: how
          ? `「${how}」という進め方を条件に、手を動かさなくていいものと、あなたが触るものを分けておいた。`
          : `「${want || "まだ言葉になっていない営み"}」のまわりで、今やることを小さく分けた。`,
        artifact: {
          name: "次の一歩の候補",
          kind: "メモ",
          desc: "衛星が、不在のあいだに選んで残したもの。採用するかどうかは、あなたのもの。",
        },
      });
    } else {
      items.push({
        kind: "select",
        title: "営みの輪郭を、仮に置いてみた",
        body: "言葉がまだ薄いので、決め打ちはしていない。戻ってきたら、捨ててもいい。",
      });
    }

    // 回す
    if (hours >= 8 || context.force) {
      items.push({
        kind: "run",
        title: "周回のあいだ、手元を回しておいた",
        body: "調べたものと選んだものを、紛失しない形で星の側に置いた。あなたが触るまで、待っている。",
        stepText: "いないあいだに、衛星が周回し、手元を回して置いていった。",
      });
    }

    // 市場の気配（柱の一つなので、追っている先や近くに売り物があれば知らせる）
    const sale = offers[0];
    if (sale && hours >= 0.5) {
      items.push({
        kind: "research",
        title: "受け渡せる宝を、見つけておいた",
        body: `${sale.starName}の「${sale.name}」が、いま受け取れる。独占と、分かちと、両方の値が付いている。`,
      });
    }

    // 長く空けると厚くなる
    if (hours >= 48) {
      items.push({
        kind: "run",
        title: "長い不在のあいだに、星は少し厚くなった",
        body: "副産物は蒸発させず、星の側に積んである。市場に出さなくても、これはあなたの資産。",
        artifact: {
          name: "不在のあいだの堆積",
          kind: "データ",
          desc: "長く空けた周回の記録。年数とともに、複利で厚くなる側のもの。",
        },
      });
    }

    return {
      elapsedMs: context.elapsedMs,
      items: items.slice(0, hours >= 24 ? 5 : 4),
      generatedAt: Date.now(),
      simulated: true,
    };
  },

  buildContext(State, elapsedMs, force = false) {
    const player = State.data.player;
    const stars = State.allStars();
    const following = player.following
      .map((id) => stars.find((s) => s.id === id))
      .filter(Boolean);
    const nearby = stars
      .filter((s) => s.id !== "player")
      .map((s) => ({
        ...s,
        d: (s.x - player.x) ** 2 + (s.y - player.y) ** 2,
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);
    const marketOffers = [];
    for (const s of stars) {
      if (s.id === "player") continue;
      for (const t of s.treasures || []) {
        if (t.forSale && !State.hasPurchased(t.id) && !State.isExclusiveTaken(t.id)) {
          marketOffers.push({
            id: t.id,
            name: t.name,
            starName: s.name,
            exclusive: t.exclusive,
            shared: t.shared,
          });
        }
      }
    }
    return {
      elapsedMs,
      force,
      player: {
        title: player.title,
        hearing: player.hearing,
        steps: player.steps.slice(-5),
        treasureCount: player.treasures.length,
      },
      following: player.following,
      followedStars: following.map((s) => ({
        id: s.id,
        name: s.name,
        title: s.title,
        steps: (s.steps || []).slice(-3),
      })),
      nearbyStars: nearby.map((s) => ({ id: s.id, name: s.name, title: s.title, doer: s.doer })),
      marketOffers,
    };
  },
};
