// ============================================================
//  ITEMS - every color and cosmetic you can collect, and how rare each one is.
//  Shared by the game (browser) and the account server (api/account.js), so prizes are rolled
//  on the server from the same list the game shows.
// ============================================================
const ITEMS = (() => {
  // each rarity has its own color: common light gray, uncommon green, rare blue, epic red,
  // legendary gold, mythic black. Weights are percent: black or white turns up 1 time in 100.
  const TIERS = [
    { id: 'common', name: 'Common', color: '#c9ced6', weight: 52 },
    { id: 'uncommon', name: 'Uncommon', color: '#5cc96b', weight: 26 },
    { id: 'rare', name: 'Rare', color: '#4a8cff', weight: 13 },
    { id: 'epic', name: 'Epic', color: '#ff4d4d', weight: 6 },
    { id: 'legendary', name: 'Legendary', color: '#ffc23d', weight: 2 },
    { id: 'mythic', name: 'Mythic', color: '#111111', weight: 1 },
  ];
  // 50 colors, from least to most cool, fewer in every step up:
  //   common (16) soft pastels -> uncommon (12) candy brights -> rare (11) loud neons + earthy tones ->
  //   epic (5) rich jewel tones -> legendary (4) one-of-a-kind statement colors -> mythic (2) pure black + white.
  // Nothing below mythic is pale or dark enough to pass for white or black.
  const hueKey = (hex) => {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 0.12) return 10 - mx;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return ((h * 60 + 360 + 15) % 360) / 360;   // rainbow order (pinkish reds sort with the reds)
  };
  const C = (tier, list) => list.map(([id, name, hex]) => ({ id, name, hex, tier, kind: 'color' })).sort((a, b) => hueKey(a.hex) - hueKey(b.hex));
  const COLORS = [].concat(
    C('common', [
      ['blush', 'Cotton Candy', '#ffb0c8'], ['bubblegum', 'Strawberry Milk', '#ff9eb0'], ['rose', 'Salmon', '#ff9a8a'], ['peach', 'Peach Fuzz', '#ffbc94'],
      ['apricot', 'Apricot', '#ffb070'], ['sand', 'Biscuit', '#dcbc93'], ['butter', 'Custard', '#ffdb7a'], ['pistachio', 'Pistachio', '#c3df8e'],
      ['sage', 'Matcha', '#a3c98a'], ['mint', 'Spearmint', '#8fdca3'], ['seafoam', 'Sea Glass', '#7fd3c4'], ['sky', 'Powder Blue', '#9cceee'],
      ['cornflower', 'Cornflower', '#8eaefc'], ['periwinkle', 'Periwinkle', '#aab2ff'], ['lilac', 'Wisteria', '#c1a3fb'], ['orchid', 'Lilac Dream', '#e6a3f5'],
    ]),
    C('uncommon', [
      ['cherry', 'Watermelon', '#ff5a7e'], ['coral', 'Grapefruit', '#ff7663'], ['tangerine', 'Mango', '#ff9a3c'], ['sunflower', 'Lemon Drop', '#ffc928'],
      ['lime', 'Kiwi', '#9ee34f'], ['jade', 'Clover', '#3ccb7f'], ['teal', 'Lagoon', '#22bdb0'], ['aqua', 'Splash', '#33c7e8'],
      ['azure', 'Blue Raspberry', '#3f8cff'], ['iris', 'Bluebell', '#7f78ff'], ['grape', 'Grape Soda', '#a45cf5'], ['fuchsia', 'Bubble Pink', '#ff63c8'],
    ]),
    // rare = loud or muddy; epic = the rich, classy ones (picked by looks, not by brightness)
    C('rare', [
      ['tomato', 'Slate', '#5d6b7a'], ['hotorange', 'Blaze', '#ff6a00'], ['amber', 'Mustard', '#c9a227'], ['chocolate', 'Cocoa', '#8f5530'],
      ['laser', 'Highlighter', '#e6f52e'], ['forest', 'Olive', '#7d8a2a'], ['neongreen', 'Radioactive', '#2bf05a'], ['cyber', 'Hyper Cyan', '#00d9f0'],
      ['turquoise', 'Denim', '#3d5f9e'], ['magenta', 'Plum', '#8e3b78'], ['neonpink', 'Hot Pink', '#ff1f9e'],
    ]),
    C('epic', [
      ['ruby', 'Ruby', '#d4143d'], ['copper', 'Copper', '#c8692c'], ['emerald', 'Emerald', '#0f8a4f'],
      ['sapphire', 'Royal Blue', '#1d3fc4'], ['amethyst', 'Orchid Bloom', '#b5179e'],
    ]),
    C('legendary', [
      ['gold', '24K Gold', '#f2b300'], ['ultraviolet', 'Ultraviolet', '#6a1aff'], ['bloodmoon', 'Blood Moon', '#b0002c'], ['abyss', 'Abyss', '#00727e'],
    ]),
    C('mythic', [['white', 'Pure White', '#ffffff'], ['black', 'Void Black', '#111111']]),
  );
  // cosmetics are developer-only: never in crates, only in developer mode
  const COSMETICS = [
    { id: 'neon', name: 'Neon Outline', tier: 'epic', kind: 'cos' },
    { id: 'ghost', name: 'Ghost', tier: 'legendary', kind: 'cos' },
    { id: 'glint', name: 'Glint', tier: 'legendary', kind: 'cos' },
    { id: 'rainbow', name: 'Rainbow', tier: 'mythic', kind: 'cos' },
  ];
  const ALL = COLORS.concat(COSMETICS);
  const byId = Object.fromEntries(ALL.map((it) => [it.id, it]));
  const colorByHex = Object.fromEntries(COLORS.map((it) => [it.hex, it]));
  const tier = (id) => TIERS.find((t) => t.id === id);

  // no account: everyone looks the same, with a cute name
  const GUEST = { body: '#8fb4ff', eye: '#1f2433' };
  const GUEST_NAMES = ['bobo', 'kiki', 'momo', 'lulu', 'fifi', 'gigi', 'nono', 'zuzu', 'coco', 'mimi', 'bubu', 'riri', 'lolo', 'jojo',
    'keke', 'popo', 'toto', 'yoyo', 'nini', 'bibi', 'wawa', 'didi', 'tutu', 'sisi', 'vivi', 'zaza', 'bebe', 'mumu', 'pepe', 'lala',
    'fufu', 'gugu', 'koko', 'nunu', 'rara', 'tata', 'zizi', 'dada', 'hoho', 'juju', 'meme', 'yaya', 'boba', 'kiko', 'lumi', 'pobo'];

  // a prize: pick a rarity by weight, then something from it you don't have yet
  // (if you have that whole tier, it looks one tier down, then up). rnd() returns 0..1
  function roll(owned, rnd) {
    const have = new Set(owned);
    const total = TIERS.reduce((s, t) => s + t.weight, 0);
    let r = rnd() * total, ti = 0;
    for (; ti < TIERS.length - 1; ti++) { r -= TIERS[ti].weight; if (r < 0) break; }
    const order = [ti];
    for (let d = 1; d < TIERS.length; d++) { if (ti - d >= 0) order.push(ti - d); if (ti + d < TIERS.length) order.push(ti + d); }
    for (const i of order) {
      const left = COLORS.filter((it) => it.tier === TIERS[i].id && !have.has(it.id));
      if (left.length) return left[Math.floor(rnd() * left.length)];
    }
    return null;
  }
  // two different common colors to start an account with
  function starter(rnd) {
    const commons = COLORS.filter((c) => c.tier === 'common');
    const a = commons[Math.floor(rnd() * commons.length)];
    let b = a;
    while (b === a) b = commons[Math.floor(rnd() * commons.length)];
    return [a.id, b.id];
  }

  // names: a-z, 0-9 and _ only ; 3-14 long; no swears (also caught with l33t spelling and
  // letters stretched out like "fuuuck"), and not one of the guest names
  const BAD = ['fuck', 'fuk', 'fck', 'shit', 'sht', 'bitch', 'btch', 'cunt', 'dick', 'cock', 'penis', 'vagina', 'pussy', 'whore', 'slut',
    'nigg', 'nig', 'niga', 'fag', 'retard', 'rape', 'rapist', 'nazi', 'hitler', 'porn', 'sex', 'cum', 'jizz', 'tits', 'boob', 'anal',
    'dildo', 'twat', 'wank', 'bastard', 'damn', 'crap', 'piss', 'asshole', 'arse', 'kys', 'killyourself', 'pedo', 'molest', 'kkk',
    'chink', 'spic', 'kike', 'tranny', 'homo', 'dyke', 'hoe', 'nude', 'naked', 'horny', 'milf', 'butthole', 'poop', 'pee'];
  // short or common-inside-other-words ones only count as the whole name (+ numbers), so names like
  // "grapes", "night", "spicy", "peacock" or "shoe" are fine
  const WHOLE = new Set(['cum', 'nig', 'niga', 'sex', 'hoe', 'pee', 'fag', 'kkk', 'kys', 'fck', 'fuk', 'sht', 'homo', 'arse', 'anal', 'tits', 'nude',
    'poop', 'rape', 'spic', 'kike', 'cock', 'dick', 'damn', 'crap', 'piss', 'boob', 'dyke', 'naked', 'horny', 'milf', 'porn', 'twat']);
  function nameProblem(name) {
    const n = String(name || '');
    if (!/^[a-z0-9_]{3,14}$/.test(n)) return /[A-Z]/.test(n) && /^[A-Za-z0-9_]{3,14}$/.test(n) ? 'Names are lowercase' : 'Names are 3-14 of a-z, 0-9 or _ (no spaces or symbols)';
    if (GUEST_NAMES.includes(n.toLowerCase())) return 'That name is saved for guests';
    const leet = (x) => x.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/8/g, 'b').replace(/9/g, 'g');
    const low = n.toLowerCase(), bare = low.replace(/[0-9_]+$/, '').replace(/^[0-9_]+/, '').replace(/_/g, '');
    const forms = new Set();
    for (const x of [low.replace(/_/g, ''), leet(low).replace(/_/g, ''), bare, leet(bare)]) { forms.add(x); forms.add(x.replace(/(.)\1+/g, '$1')); }
    for (const w of BAD) {
      for (const f of forms) if (WHOLE.has(w) ? f === w : f.includes(w)) return 'Pick a different name';
    }
    return '';
  }

  return { TIERS, COLORS, COSMETICS, ALL, byId, colorByHex, tier, GUEST, GUEST_NAMES, roll, starter, nameProblem };
})();
if (typeof module !== 'undefined') module.exports = ITEMS;
