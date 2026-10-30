// ============================================================
//  ITEMS - every color and cosmetic you can collect, and how rare each one is.
//  Shared by the game (browser) and the account server (api/account.js), so prizes are rolled
//  on the server from the same list the game shows.
// ============================================================
const ITEMS = (() => {
  const TIERS = [
    { id: 'common', name: 'Common', color: '#b4bdcc', weight: 50 },
    { id: 'uncommon', name: 'Uncommon', color: '#7ed6a0', weight: 27 },
    { id: 'rare', name: 'Rare', color: '#6fa8ff', weight: 14 },
    { id: 'epic', name: 'Epic', color: '#b57bff', weight: 6 },
    { id: 'legendary', name: 'Legendary', color: '#ffc23d', weight: 2.5 },
    { id: 'mythic', name: 'Mythic', color: '#ff5fa2', weight: 0.5 },
  ];
  const C = (tier, list) => list.map(([id, name, hex]) => ({ id, name, hex, tier, kind: 'color' }));
  const COLORS = [].concat(
    C('common', [
      ['blush', 'Blush', '#ffb3c6'], ['bubblegum', 'Bubblegum', '#ff8fa3'], ['peach', 'Peach', '#ffc8a2'], ['apricot', 'Apricot', '#ffb37a'],
      ['butter', 'Butter', '#ffe599'], ['lemon', 'Lemon', '#fff0a0'], ['pistachio', 'Pistachio', '#c8e6a0'], ['mint', 'Mint', '#9be3a8'],
      ['seafoam', 'Seafoam', '#7ed6c8'], ['sky', 'Sky', '#a8dcef'], ['cornflower', 'Cornflower', '#8fb4ff'], ['periwinkle', 'Periwinkle', '#b8c0ff'],
      ['lilac', 'Lilac', '#c3a6ff'], ['lavender', 'Lavender', '#e0b0ff'], ['orchid', 'Orchid', '#f4a6ff'], ['sand', 'Sand', '#d9c2a7'],
      ['fog', 'Fog', '#c9ced6'], ['cream', 'Cream', '#f7f3ea'], ['rose', 'Rose', '#ff9b9b'], ['sage', 'Sage', '#b5cfa8'],
    ]),
    C('uncommon', [
      ['coral', 'Coral', '#ff7f7f'], ['tangerine', 'Tangerine', '#ff9f5a'], ['sunflower', 'Sunflower', '#ffd23f'], ['lime', 'Lime', '#b6f27a'],
      ['jade', 'Jade', '#5fd3a0'], ['aqua', 'Aqua', '#5fd6e0'], ['azure', 'Azure', '#6fa8ff'], ['iris', 'Iris', '#9a8cff'],
      ['grape', 'Grape', '#b57bff'], ['fuchsia', 'Fuchsia', '#ff7ad9'], ['cherry', 'Cherry', '#ff6b8a'], ['caramel', 'Caramel', '#d9a066'],
      ['moss', 'Moss', '#9cba6a'], ['slate', 'Slate', '#8f9bb3'], ['teal', 'Teal', '#4fb3a9'], ['plum', 'Plum', '#c97fb5'],
    ]),
    C('rare', [
      ['ruby', 'Ruby', '#e8455a'], ['amber', 'Amber', '#ffb000'], ['emerald', 'Emerald', '#2fbf71'], ['sapphire', 'Sapphire', '#3d6fe0'],
      ['amethyst', 'Amethyst', '#8a4fd8'], ['magenta', 'Magenta', '#e33bb0'], ['turquoise', 'Turquoise', '#20c4c4'], ['tomato', 'Tomato', '#ff5a36'],
      ['forest', 'Forest', '#3f8f5a'], ['navy', 'Navy', '#2f4a8f'], ['chocolate', 'Chocolate', '#7a4a2e'], ['mauve', 'Mauve', '#a77b9a'],
      ['steel', 'Steel', '#5f7085'], ['sunset', 'Sunset', '#ff8566'],
    ]),
    C('epic', [
      ['neonpink', 'Neon Pink', '#ff2fa8'], ['neongreen', 'Neon Green', '#39ff6a'], ['electric', 'Electric Blue', '#1fa2ff'], ['laser', 'Laser Lemon', '#f5ff3a'],
      ['hotorange', 'Hot Orange', '#ff6a00'], ['ultraviolet', 'Ultraviolet', '#7a2cff'], ['cyber', 'Cyber Teal', '#00ffd5'], ['blood', 'Blood Red', '#b3001b'],
      ['deepsea', 'Deep Sea', '#0b4f6c'], ['royal', 'Royal Purple', '#4b1d9e'],
    ]),
    C('legendary', [
      ['gold', 'Gold', '#d4af37'], ['silver', 'Silver', '#c0c6cc'], ['bronze', 'Bronze', '#b06d2c'], ['rosegold', 'Rose Gold', '#e8a598'],
      ['midnight', 'Midnight', '#13203b'], ['crimson', 'Crimson', '#8b0018'], ['pearl', 'Pearl', '#f3eee4'], ['graphite', 'Graphite', '#3a3d44'],
    ]),
    C('mythic', [['black', 'Black', '#111111'], ['white', 'White', '#ffffff']]),
  );
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
      const left = ALL.filter((it) => it.tier === TIERS[i].id && !have.has(it.id));
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
