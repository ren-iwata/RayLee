/**
 * RayLee 世界の種データ。
 * パッケージの利用者像に基づく模擬。最初のマップ領域は未決定のまま、
 * 複数の星図を並置する（どれも「公式の最初」ではない）。
 */

const DAY = 24 * 60 * 60 * 1000;

export const STORAGE_KEY = "raylee-game-v1";
export const STATE_VERSION = 1;

/** 仲介手数料。課金設計は未決定。試作の仮の率。 */
export const BROKERAGE = {
  rate: 0.1,
  label: "仲介",
  note: "手数料の率と課金の形は未決定です。これは試作の仮の数字です。",
};

/** 開始時の星屑。本物の決済は無い。 */
export const STARTING_CURRENCY = 180000;

export const CURRENCY_NAME = "星屑";

export function daysAgo(n, hour = 12, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.getTime() - n * DAY;
}

/**
 * 聞き取りの言葉から、仮の近くの星図へ寄せる。
 * 最初の領域は未決定。これは配置の便宜で、領域の決定ではない。
 */
export function suggestCluster(text) {
  const t = (text || "").toLowerCase();
  const rules = [
    { id: "shrine", keys: ["神社", "祈り", "手を合わせ", "社"] },
    { id: "manga", keys: ["漫画", "マンガ", "絵", "物語", "作画", "原作"] },
    { id: "ai", keys: ["ai", "ａｉ", "アプリ", "m&a", "ｍ＆ａ", "億", "買収", "起業"] },
    { id: "us", keys: ["アメリカ", "米国", "シリコン", "海外"] },
    { id: "income", keys: ["副", "収入", "十万", "10万", "手放し", "稼", "金"] },
    { id: "life", keys: ["旅行", "服", "忙しい", "主婦", "暮らし"] },
    { id: "sense", keys: ["インスタ", "感度", "センス", "影響力", "モデル", "世界観"] },
  ];
  for (const r of rules) {
    if (r.keys.some((k) => t.includes(k))) return r.id;
  }
  return "open";
}

export const CLUSTERS = [
  {
    id: "sense",
    name: "感度の星図",
    x: -420,
    y: -680,
    tint: [180, 150, 110],
    blurb: "表に出なくても、感度で場をつくる営み。",
  },
  {
    id: "income",
    name: "副のある暮らし",
    x: 420,
    y: -680,
    tint: [120, 150, 160],
    blurb: "本業の横で、条件から道が結晶していく営み。",
  },
  {
    id: "ai",
    name: "つくって、渡す",
    x: 0,
    y: 200,
    tint: [140, 130, 180],
    blurb: "同じ出発点から、届いた人と、まだの人が並ぶ。",
  },
  {
    id: "manga",
    name: "二人の物語",
    x: -420,
    y: 820,
    tint: [170, 110, 120],
    blurb: "絵を持つ人と、話を持つ人。合流し得る。",
  },
  {
    id: "us",
    name: "海の向こう",
    x: 450,
    y: 800,
    tint: [100, 130, 170],
    blurb: "始めたいのに、道が一本に霞んでいる。",
  },
  {
    id: "life",
    name: "日常のすきま",
    x: 80,
    y: 1180,
    tint: [160, 140, 120],
    blurb: "理由が曖昧なまま、止まっている営み。",
  },
  {
    id: "shrine",
    name: "朝の社",
    x: -620,
    y: -140,
    tint: [200, 180, 140],
    blurb: "毎朝、近所の神社で1分、手を合わせる。",
  },
  {
    id: "open",
    name: "まだ名のないあたり",
    x: 250,
    y: -280,
    tint: [140, 140, 145],
    blurb: "どの星図にも属さない営みが、まず置かれる場所。",
  },
];

/**
 * NPC の星。doer: 歩いている / いない。
 * sealed steps: verified = 外の事実, self = 自己の記録（自己申告の設計は未決定。見た目の区別だけ）。
 */
export function buildStars() {
  return [
    // —— 感度 ——
    {
      id: "yui",
      cluster: "sense",
      name: "結衣",
      title: "表に出ずに、感度で場をつくる",
      origin: "モデルになることには抵抗がある。センスには自信がある。",
      x: -440,
      y: -660,
      doer: true,
      cheer: 14,
      steps: [
        { id: "yui-1", t: daysAgo(420, 22), text: "自分は写らなくていい、という条件だけを書いた。", seal: "self" },
        { id: "yui-2", t: daysAgo(390, 21), text: "色と間の収集を始めた。手足は自分、組み立ては衛星へ。", seal: "self" },
        { id: "yui-3", t: daysAgo(300, 19), text: "最初の並びを、静かに置いた。", seal: "verified", fact: "公開された並びが、外に残っている。" },
        { id: "yui-4", t: daysAgo(210, 23), text: "忘れていた二ヶ月のあいだ、衛星が候補を貯めていた。戻って選んだ。", seal: "self" },
        { id: "yui-5", t: daysAgo(40, 20), text: "同じ出発の人が、どこまで行ったか、星図で見た。", seal: "self" },
      ],
      points: [
        { id: "yui-p1", after: "yui-3", title: "最初の並び", crystallizedFrom: ["yui-1", "yui-2", "yui-3"] },
      ],
      treasures: [
        {
          id: "yui-t1",
          name: "方向の手帖",
          kind: "メモ",
          atStep: "yui-2",
          desc: "自分が写らない前提で、感度だけを残した初期の手帖。",
          forSale: true,
          exclusive: 28000,
          shared: 6000,
          antiResale: true,
        },
      ],
    },
    {
      id: "sense-peer",
      cluster: "sense",
      name: "直樹",
      title: "同じところから、まだ半ば",
      origin: "結衣と同じ出発。表に出たくない。",
      x: -320,
      y: -760,
      doer: true,
      cheer: 3,
      steps: [
        { id: "sp-1", t: daysAgo(400, 21), text: "始めたいと書いた。", seal: "self" },
        { id: "sp-2", t: daysAgo(200, 22), text: "いくつか集めたまま、止まっている。", seal: "self" },
      ],
      points: [],
      treasures: [],
    },
    {
      id: "sense-idle",
      cluster: "sense",
      name: "未歩",
      title: "感度はある、と言ったきり",
      origin: "同じ出発点。星はある。まだ歩いていない。",
      x: -540,
      y: -580,
      doer: false,
      cheer: 0,
      steps: [],
      points: [],
      treasures: [],
    },

    // —— 副収入 ——
    {
      id: "kenta",
      cluster: "income",
      name: "健太",
      title: "ほぼ手放しで、月に十万円",
      origin: "面倒。今のままでもいい。FXもアフィリも簡単ではないと知っている。特にやりたいことはない。条件だけがあった。",
      x: 440,
      y: -660,
      doer: true,
      cheer: 9,
      steps: [
        { id: "ke-1", t: daysAgo(180, 8, 12), text: "条件だけを置いた。月に十万円。ほぼ手放し。", seal: "self" },
        { id: "ke-2", t: daysAgo(170, 12, 30), text: "通勤の中で、衛星が選んだ道の、最初の確認をした。", seal: "self" },
        { id: "ke-3", t: daysAgo(90, 12, 5), text: "昼休みに、入金の画面を見た。", seal: "verified", fact: "口座への着金記録がある。" },
        { id: "ke-4", t: daysAgo(20, 19, 40), text: "夜、他人の歩程を見て、まだまだいける、と感じた。", seal: "self" },
      ],
      points: [
        { id: "ke-p1", after: "ke-3", title: "条件が、地点になった", crystallizedFrom: ["ke-1", "ke-2", "ke-3"] },
      ],
      treasures: [
        {
          id: "ke-t1",
          name: "条件から結晶した道の記録",
          kind: "道程",
          atStep: "ke-3",
          desc: "やりたいことが無い状態から、条件だけで地点が後から生まれた記録。",
          forSale: false,
        },
      ],
    },
    {
      id: "income-idle",
      cluster: "income",
      name: "淳",
      title: "条件は書いた",
      origin: "月に十万円、とだけ置いて、そのあと開いていない。",
      x: 320,
      y: -780,
      doer: false,
      cheer: 1,
      steps: [
        { id: "ii-1", t: daysAgo(200, 21), text: "月に十万円、と書いた。", seal: "self" },
      ],
      points: [],
      treasures: [],
    },

    // —— AI・事業。同じ出発点の分布。先達が宝を出している ——
    {
      id: "kaito",
      cluster: "ai",
      name: "海斗",
      title: "五度目に、届いた人",
      origin: "プログラミング経験は無かった。AIは触っていた。五億円で、事業を渡すことが夢だった。",
      x: -20,
      y: 160,
      doer: true,
      cheer: 47,
      steps: [
        { id: "ka-0", t: daysAgo(1460, 23), text: "五億円で渡す、とだけ書いた。作り方は、何も知らなかった。", seal: "self" },
        { id: "ka-1", t: daysAgo(1280, 2), text: "一度目の試作。誰にも使われなかった。", seal: "self" },
        { id: "ka-1r", t: daysAgo(1260, 22), text: "失敗の理由を残した。課題を、一人で決めていた。", seal: "self" },
        { id: "ka-2", t: daysAgo(1100, 18), text: "二度目。知人も使ったが、続かなかった。", seal: "self" },
        { id: "ka-2s", t: daysAgo(1088, 11), text: "小さな公開の跡が、外に残った。", seal: "verified", fact: "公開ページのアーカイブが存在する。" },
        { id: "ka-3", t: daysAgo(820, 3), text: "三度目。良いところまでいった。資金が尽きた。", seal: "self" },
        { id: "ka-3r", t: daysAgo(800, 21), text: "検証と道具と、失敗の理由を、一式として残した。", seal: "self" },
        { id: "ka-4", t: daysAgo(520, 1), text: "四度目。方向を間違え、止まった。", seal: "self" },
        { id: "ka-5", t: daysAgo(120, 10), text: "五度目。前の失敗を重ねて、届いた。", seal: "verified", fact: "譲渡の事実が、外の記録として存在する。" },
      ],
      points: [
        { id: "ka-p1", after: "ka-1r", title: "一度目の終わり", crystallizedFrom: ["ka-1", "ka-1r"] },
        { id: "ka-p2", after: "ka-2s", title: "二度目の終わり", crystallizedFrom: ["ka-2", "ka-2s"] },
        { id: "ka-p3", after: "ka-3r", title: "三度目の地点", crystallizedFrom: ["ka-3", "ka-3r"] },
        { id: "ka-p4", after: "ka-4", title: "四度目の終わり", crystallizedFrom: ["ka-4"] },
        { id: "ka-p5", after: "ka-5", title: "届いた地点", crystallizedFrom: ["ka-5"] },
      ],
      treasures: [
        {
          id: "kaito-third",
          name: "三度目の一式",
          kind: "道程と宝",
          atStep: "ka-3r",
          desc: "試作、検証結果、メモ、使っていた道具、ここまでの道程。三度目の地点から先を、途中から歩ける。",
          forSale: true,
          exclusive: 500000,
          shared: 100000,
          antiResale: true,
          fromMidpoint: "ka-p3",
          bundle: [
            "三度目の試作そのもの",
            "検証の結果",
            "当時のメモ",
            "使っていた道具の一式",
            "ここまでの道程",
            "失敗の理由（資金が尽きた経緯）",
          ],
        },
      ],
    },
    {
      id: "shota",
      cluster: "ai",
      name: "翔太",
      title: "同じ出発点に、いまいる人",
      origin: "二十歳。プログラミングは未経験。AIは触っている。自信とやる気はある。五億円が夢。",
      x: -120,
      y: 300,
      doer: true,
      cheer: 2,
      steps: [
        { id: "sh-1", t: daysAgo(40, 23), text: "世界の星図と、いまの位置を見た。", seal: "self" },
        { id: "sh-2", t: daysAgo(38, 1), text: "五度目に届いた人の、四つの失敗を読んだ。三度目で、自分ならいける、と感じた。", seal: "self" },
      ],
      points: [],
      treasures: [],
    },
    {
      id: "ai-failed",
      cluster: "ai",
      name: "理",
      title: "二度目で、置いた",
      origin: "同じ出発点。二度失敗し、星は残しているが、歩いていない。",
      x: 120,
      y: 320,
      doer: false,
      cheer: 4,
      steps: [
        { id: "af-1", t: daysAgo(700, 20), text: "一度目。動かなかった。", seal: "self" },
        { id: "af-2", t: daysAgo(500, 20), text: "二度目も、同じ理由で止まった。ここから先は、歩いていない。", seal: "self" },
      ],
      points: [],
      treasures: [],
    },
    {
      id: "ai-idle",
      cluster: "ai",
      name: "蒼",
      title: "夢だけ置いた人",
      origin: "同じ出発点。星はある。歩程は無い。",
      x: 100,
      y: 80,
      doer: false,
      cheer: 0,
      steps: [],
      points: [],
      treasures: [],
    },

    // —— 漫画 ——
    {
      id: "misaki",
      cluster: "manga",
      name: "美咲",
      title: "絵は描ける。話が、作れない",
      origin: "二十代。画力はある。物語が組めていない。",
      x: -480,
      y: 800,
      doer: true,
      cheer: 6,
      complementary: "ren",
      steps: [
        { id: "mi-1", t: daysAgo(250, 19), text: "短編の絵だけを、何枚も置いた。話は、空のまま。", seal: "self" },
        { id: "mi-2", t: daysAgo(90, 21), text: "同じ星図に、話を持つ人がいることに気づいた。", seal: "self" },
      ],
      points: [],
      treasures: [
        {
          id: "mi-t1",
          name: "話の無い絵の束",
          kind: "試作品",
          atStep: "mi-1",
          desc: "人物と場の絵。物語はまだ乗っていない。",
          forSale: true,
          exclusive: 18000,
          shared: 4000,
          antiResale: true,
        },
      ],
    },
    {
      id: "ren",
      cluster: "manga",
      name: "蓮",
      title: "話は作れる。絵が、描けない",
      origin: "構想と台詞は長い。画面にできない。",
      x: -340,
      y: 880,
      doer: true,
      cheer: 5,
      complementary: "misaki",
      steps: [
        { id: "re-1", t: daysAgo(260, 0), text: "三幕の骨格を、何度も書き直した。", seal: "self" },
        { id: "re-2", t: daysAgo(88, 22), text: "絵を持つ人の星が、すぐそばにある。", seal: "self" },
      ],
      points: [],
      treasures: [
        {
          id: "re-t1",
          name: "絵の乗っていない話",
          kind: "試作品",
          atStep: "re-1",
          desc: "骨格と台詞。画面がまだ無い。",
          forSale: true,
          exclusive: 18000,
          shared: 4000,
          antiResale: true,
        },
      ],
    },

    // —— 28歳・アメリカ ——
    {
      id: "naoto",
      cluster: "us",
      name: "直人",
      title: "アメリカで始めたい。金は、無い",
      origin: "二十八歳。漠然とした一本道しか見えていない。それが、詰まりそのもの。",
      x: 450,
      y: 820,
      doer: true,
      cheer: 2,
      vague: true,
      steps: [
        { id: "na-1", t: daysAgo(300, 23), text: "アメリカで起業したい、とだけ書いた。", seal: "self" },
        { id: "na-2", t: daysAgo(200, 23), text: "visa、金、仲間。全部が、同じ一本の線の上に乗って、霞んでいる。", seal: "self" },
        { id: "na-3", t: daysAgo(30, 23), text: "線は伸びていない。同じ場所を、見ている。", seal: "self" },
      ],
      points: [],
      treasures: [],
    },

    // —— 主婦 ——
    {
      id: "yoko",
      cluster: "life",
      name: "陽子",
      title: "旅をしたい。服を買いたい",
      origin: "お金がない、忙しい、という曖昧な理由のまま、暮らしが続いている。",
      x: 70,
      y: 1180,
      doer: false,
      cheer: 1,
      steps: [
        { id: "yo-1", t: daysAgo(500, 21), text: "旅行したい、と書いた。", seal: "self" },
        { id: "yo-2", t: daysAgo(490, 21), text: "忙しい、金が無い、で止まった。それ以上の理由は、まだない。", seal: "self" },
      ],
      points: [],
      treasures: [],
    },
    {
      id: "life-doer",
      cluster: "life",
      name: "咲",
      title: "すきまから、小さく始めた人",
      origin: "同じ「忙しい」から、短い歩程を重ねた。",
      x: 180,
      y: 1080,
      doer: true,
      cheer: 7,
      steps: [
        { id: "ld-1", t: daysAgo(200, 14), text: "忙しい、の中身を一日だけ書き出した。", seal: "self" },
        { id: "ld-2", t: daysAgo(120, 14), text: "週に一度、三十分配った。", seal: "self" },
        { id: "ld-3", t: daysAgo(20, 15), text: "最初の短い旅をした。", seal: "verified", fact: "移動の記録が、外に残っている。" },
      ],
      points: [
        { id: "ld-p1", after: "ld-3", title: "すきまの地点", crystallizedFrom: ["ld-1", "ld-2", "ld-3"] },
      ],
      treasures: [],
    },

    // —— 朝の社（ニッチな営みの星図） ——
    {
      id: "kon",
      cluster: "shrine",
      name: "紺",
      title: "二百日、通っている人",
      strideLabel: "二百日",
      origin: "毎朝、近所の神社で1分、手を合わせる。",
      x: -640,
      y: -150,
      doer: true,
      cheer: 22,
      steps: shrineSteps("kon", 200),
      points: [
        { id: "kon-p1", after: "kon-s29", title: "三十日", crystallizedFrom: ["kon-s0"] },
        { id: "kon-p2", after: "kon-s99", title: "百日", crystallizedFrom: ["kon-s30"] },
        { id: "kon-p3", after: "kon-s199", title: "二百日", crystallizedFrom: ["kon-s100"] },
      ],
      treasures: [
        {
          id: "kon-t1",
          name: "二百日の手記",
          kind: "道程",
          atStep: "kon-s199",
          desc: "季節と、短い言葉だけが積もった手記。営みそのものが宝になっている。",
          forSale: true,
          exclusive: 12000,
          shared: 2500,
          antiResale: true,
        },
      ],
    },
    {
      id: "shrine-mid",
      cluster: "shrine",
      name: "春",
      title: "十二日まで、通った人",
      strideLabel: "十二日",
      origin: "同じ社。同じ一分。",
      x: -520,
      y: -50,
      doer: true,
      cheer: 4,
      steps: shrineSteps("haru", 12),
      points: [],
      treasures: [],
    },
    {
      id: "shrine-idle",
      cluster: "shrine",
      name: "夕",
      title: "始めようとした人",
      origin: "近所の社へ、と思った。星はある。まだ、通っていない。",
      x: -560,
      y: -230,
      doer: false,
      cheer: 0,
      steps: [],
      points: [],
      treasures: [],
    },
    {
      id: "shrine-peer",
      cluster: "shrine",
      name: "麦",
      title: "三日で、途切れた人",
      strideLabel: "三日",
      origin: "同じ一分。三日のあと、途切れている。星は残っている。",
      x: -720,
      y: -40,
      doer: false,
      cheer: 1,
      steps: shrineSteps("mugi", 3),
      points: [],
      treasures: [],
    },
  ];
}

/** 毎日の一分を、間引いて歩程にする（全部描くと多すぎるので代表点）。 */
function shrineSteps(prefix, days) {
  const steps = [];
  const show = new Set([0, 1, 2, 6, 29, 49, 99, 149, 199]);
  for (let i = 0; i < days; i++) {
    if (days <= 15 || show.has(i) || i === days - 1) {
      const n = i + 1;
      let text = `近所の社で、一分。${n}日。`;
      if (n === 30) text = "三十日。季節が、一つ変わっていた。";
      if (n === 100) text = "百日。手を合わせることが、もう考えではなくなっていた。";
      if (n === 200) text = "二百日。手記が、一冊になった。";
      const seal = n === 200 || n === 100 ? "self" : "self";
      steps.push({
        id: `${prefix}-s${i}`,
        t: daysAgo(days - i, 6, 12),
        text,
        seal,
      });
    }
  }
  return steps;
}

export function clusterById(id) {
  return CLUSTERS.find((c) => c.id === id);
}

export function formatMoney(n) {
  return Number(n).toLocaleString("ja-JP");
}

export function formatDate(t) {
  const d = new Date(t);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}年${m}月${day}日 ${hh}:${mm}`;
}

export function formatRelative(t, now = Date.now()) {
  const d = now - t;
  if (d < 60 * 1000) return "いま";
  if (d < 60 * 60 * 1000) return `${Math.floor(d / 60000)}分前`;
  if (d < DAY) return `${Math.floor(d / 3600000)}時間前`;
  if (d < 30 * DAY) return `${Math.floor(d / DAY)}日前`;
  if (d < 365 * DAY) return `${Math.floor(d / (30 * DAY))}ヶ月前`;
  return `${Math.floor(d / (365 * DAY))}年前`;
}
