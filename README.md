# Catenaries

A first-person parkour tag game for the browser. You play as a Scamp (a masked raccoon). Run, slide, wall-kick, and play with friends using a 4-letter join code.

## Play

1. Open `index.html` in Chrome, Edge, or Firefox. Double-clicking the file works fine.
2. Pick a name and fur color. One person clicks **Host game** and reads out the 4-letter code (e.g. `MOKU`).
3. Everyone else types the code and clicks **Join game**.
4. The host presses **Esc** and goes to **Lobby**, picks a map and mode, then clicks **Start round**. Pressing Enter in-game also starts a round.

Each friend needs their own copy of the files, or you can put the folder online (see below) and send everyone the link.
A link like `index.html?code=MOKU` pre-fills the code.

Settings (sensitivity, FOV, volume, invert Y...) and rebindable controls are on the main menu and in the Esc menu.

### Default controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Shift | Run (no stamina) |
| Space | Jump. In the air next to a wall, it's a wall kick toward where you're looking |
| C / Right click | Slide (when running fast) or crouch |
| (contact) | Run into someone to tag them. New seekers have a 1.5s cooldown |
| Tab | Scoreboard |
| P / Esc | Pause menu |

### Maps

Floors are 4m apart everywhere, and jumps under low ceilings are capped, so you never bump your head.
Striped walls are wall-kick routes.

| Map | Setting | What it is |
| --- | --- | --- |
| Hotel Lobby | indoor | Four-storey atrium: galleries at 4/8/12, escalators, grand staircase, sky bridges, striped elevator shafts and column pairs to kick up |
| Container Yard | sky + sea | Container piles up to 18m, container bridges you can run through or over, skewed containers, a crane |
| The Poolrooms | indoor | Tiled bathhouse in a tiled box: bath houses, balcony/gallery/roof bridges, fountain, slides, kick shafts |
| Fun Zone | indoor | Nine pastel play towers, enclosed tube bridges, kick shafts, slides, ball pits, trampolines |
| The Liner | sky + sea | Cabin decks, a bridge house, a striped 22m funnel chimney, cargo piles, bouncy lifeboats, a crow's nest |
| Rooftops | void | Roofs 4-24m, penthouses, sky bridges, striped billboard kick chimneys, a water tower |

Level features: **jump pads** (glowing rings), **water slides** (striped ramps that always make you slide), **bouncy surfaces**, and **kick walls** (bold diagonal stripes).

### Modes
- **Classic tag**: one person is IT. Tag someone to pass it on, and they can't tag you straight back. Whoever spends the least time as IT wins. Falling off makes you IT.
- **Infection**: tagged players become seekers too. Runners win if anyone survives until the timer runs out. Falling off infects you.
- **Duel (1v1)**: needs exactly 2 players. One chases and one evades, with a short countdown per chase (20s to 1:30, default 30s). A tag scores for the chaser, surviving scores for the evader, and falling off scores for your opponent. Whoever wins a chase evades next. First to 10 (or 5 or 7) wins.

### Playing with 2 people
- With exactly 2 players the lobby picks **Duel** for you (the host can still change it).
- An arrow at the screen edge (or a marker over their head) always shows where the other player is and how far.
- The duel chaser also sees the evader as a green outline through walls, runs a bit faster and tags from a bit farther.
- A heartbeat speeds up as the seeker closes in; near-misses get a "CLOSE CALL!".

## Put it online (optional)

Every file is static, so any static host will work: GitHub Pages, itch.io (upload a zip as an HTML game), or Netlify Drop.

## Make it yours

| File | What's in it |
| --- | --- |
| `js/config.js` | Every movement number (speed, air control, slide, wall kick, gravity), tag rules, default keys |
| `js/map.js` | The map kit: `box` (can be rotated), `ramp`, `pad`, `stairs`, `slab`, `bridge`, `tower` (multi-floor buildings), `kickShaft`, `enclose` (indoor box), `pile` / `container` (shipping containers). Maps pick `env: 'void' / 'indoor' / 'sky'` |
| `js/maps/*.js` | One file per map. Copy one to make your own, then add a `<script>` line for it in `index.html`. A map can list its own `spots` (spotlights) |
| `js/character.js` | The Scamp character model and its animation |
| `js/player.js` | Movement code |
| `js/world.js` | Collision, level features, textures |
| `js/game.js` | Camera, HUD, menus, sounds, and the tag rules |
| `js/net.js` | Lobbies and join codes |
| `style.css` | How the menus and HUD look |

Some easy changes to try:
- More or less air control: `airTurn` in `config.js`.
- Longer slides: lower `slideFriction`.
- A stronger jump pad: raise its power. Height is roughly power² ÷ 52 meters.

## How multiplayer works

The game uses [PeerJS](https://peerjs.com) (WebRTC), so browsers connect to each other directly. The host's browser runs the rules: timer, who's IT, duel scores, falls, map changes, and checking tags. If the host leaves, the game ends.

- Keep the host's tab in the foreground. Background tabs get slowed down.
- Some strict networks (like some school or work Wi-Fi) block WebRTC. A phone hotspot usually works.
- To run your own PeerJS server, set `peerServer` in `config.js`.
