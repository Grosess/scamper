# Scamper

A first-person parkour tag game for the browser. You play as a little eraser-block person with stick limbs. Run, slide, wall-kick, and play with friends using a 4-letter join code.

## Play

1. Open `index.html` in Chrome, Edge, or Firefox. Double-clicking the file works fine.
2. Pick a name, a body color and an eye color. One person clicks **Host game** and reads out the 4-letter code.
3. Everyone else types the code and clicks **Join game**.
4. The host presses **Esc** and goes to **Lobby**, picks a map and mode, then clicks **Start round**. Pressing Enter in-game also starts a round.

Each friend needs their own copy of the files, or you can put the folder online (see below) and send everyone the link.
A link like `index.html?code=MOKU` pre-fills the code.

Settings (sensitivity, FOV, volume, invert Y...) and rebindable controls are on the main menu and in the Esc menu. Resolution adjusts itself when frames run slow; turn on **Performance mode** in Settings on slower computers (lower resolution, no shadows).

### Default controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Shift | Run (no stamina) |
| Space | Jump. In the air next to a wall, it's a wall kick toward where you're looking |
| C / Right click | Slide (when running fast) or crouch |
| (contact) | Run into someone to tag them (pass the bomb, steal the crown, catch the runner) |
| F | Talk (your head flaps open; everyone sees it) |
| Tab | Big leaderboard (a small one is always on the right) |
| R (hold) | Look behind you |
| Esc | Pause menu |

### Modes
- **Bomb Tag**: one player gets the bomb. Run into someone to pass it on (no instant pass-backs). When the fuse runs out, whoever holds it is out and spectates as a ghost; a new bomb drops on someone else. Last one standing wins. The fuse scales with the player count so a game takes 1.5-3.5 minutes; with 2 players each has 2 lives. The holder runs a little faster.
- **King of the Tag**: the king scores a point every second. Run into the king to steal the crown (a new king is safe for 2s). If the king falls off, the crown drops in the middle for anyone to grab. Most points wins. Chasers run a little faster.
- **Duel (1v1)**: exactly 2 players taking turns to chase. Catch the runner before the timer ends to score, survive to score; falling off scores for your opponent. First to 3/5/7 wins. The chaser sees the runner's outline through walls and runs a little faster.
- **Race**: everyone starts together on a race course. Get to the finish first. No checkpoints - fall off and you're back at the start. The leaderboard shows meters to go. After the first finisher, everyone else has 60 seconds.

Your stats (games, wins, tags, best race times...) are saved in your browser - see **Stats** in the main menu.

### Maps

Floors are 4m apart everywhere, and jumps under low ceilings are capped, so you never bump your head.
Orange walls are wall-kick routes.

| Map | Setting | What it is |
| --- | --- | --- |
| Rooftops | void | City roofs 4-24m over the void with 3m alleys you can kick up (even after falling in), fire escapes, orange kick signs, penthouses, sky bridges, pads |
| Container Yard | sky + sea | Container piles up to 18m, container bridges you can run through or over, skewed containers, a solid crane with kick towers |
| The Corridors | indoor | Two floors of looping 3m hallways drawn from ASCII grids in the map file: vents to slide through, vault walls, kick shafts and stairwells between floors |
| Fog | fog | A suburban street lost in thick drifting fog: gable roofs, kick alleys, fences, a treehouse, a park with a merry-go-round |
| The Playhouse | indoor | A three-storey padded play structure on a 3m grid: crawl tunnels, nets, rope bridges, trampolines, and a room full of balloons that dodge you |
| Moon Base | space | Low gravity. Habitat modules and tubes on a floating rock split by a rift, a comm tower, a lander, a hangar |
| Cloud Spire | race | A 3-lap spiral climb around a spire high over the sea: ferries, sweepers, pistons, chimneys, a cannon to the top |
| The Gauntlet | race | A winding course over a violet haze: spinner plaza, slide tunnel, kick tower, crossing ferries, lifts and a kick-shaft shortcut |

Level features: **jump pads** (glowing squares), **moving platforms** you can ride, **spinning bars** that shove you, and **kick walls** (always bright orange-red).

## Put it online (optional)

Every file is static, so any static host will work: GitHub Pages, itch.io (upload a zip as an HTML game), or Netlify Drop.

## Make it yours

| File | What's in it |
| --- | --- |
| `js/config.js` | Every movement number (speed, air control, slide, wall kick, gravity), tag rules, default keys |
| `js/map.js` | The map kit: `box` (can be rotated), `ramp`, `pad`, `stairs`, `slab`, `bridge`, `tower` (multi-floor buildings), `kickShaft`, `enclose` (indoor box), `pile` / `container` (shipping containers). `mover` (moving/spinning boxes), `balloons`, `wall` (invisible). Maps pick `env: 'void' / 'indoor' / 'sky' / 'fog' / 'space'`, can override movement (`move: { gravity }`), and race courses set `kind: 'race'` |
| `js/maps/*.js` | One file per map. Copy one to make your own, then add a `<script>` line for it in `index.html`. A map can list its own `spots` (spotlights) |
| `js/character.js` | The block character (body + hinged head, stick limbs) and its animation |
| `js/player.js` | Movement code |
| `js/world.js` | Collision, moving platforms, balloons, level features |
| `js/game.js` | Camera, HUD, menus, sounds, stats, and the rules for every mode |
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
