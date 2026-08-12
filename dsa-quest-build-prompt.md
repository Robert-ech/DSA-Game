# Build Prompt: DSA Quest (paste into Claude Code)

You are building **DSA Quest**, a 2D 8-bit browser game that teaches Data Structures and Algorithms through exploration, quizzes, and coding battles. Build it incrementally in phases (defined at the bottom). Do not skip ahead. After each phase, run the dev server and confirm it works before moving on.

---

## 1. Tech Stack

- **Phaser 3** (game engine) + **TypeScript** + **Vite**
- **Monaco Editor** (@monaco-editor/loader) embedded in a DOM overlay, configured with **Python** language mode (syntax highlighting, 4-space indent)
- **Pyodide** (Python compiled to WebAssembly) running inside a **Web Worker** to execute the player's Python solutions against test cases. Load Pyodide once at boot with a loading screen ("Summoning the Python spirits..."), keep the worker warm across battles. Enforce a per-run timeout by terminating and respawning the worker if execution exceeds 5 seconds (Pyodide can't be interrupted mid-execution, so worker termination is the timeout mechanism). Capture stdout/stderr and surface Python tracebacks in the results panel.
- **localStorage** for save data (coins, unlocked skins, level progress, swords earned)
- Zero backend. Everything runs client-side. `npm run dev` should be the only command needed.

Project structure:

```
/src
  /scenes        # Phaser scenes: Boot, Overworld, WizardTraining, CastleMap, Battle, Shop, MasterMode, BossBattle
  /systems       # SaveManager, EconomyManager, TestRunner (worker wrapper), DialogueBox, InputController
  /data          # problems/ (one JSON file per category), quizzes.json, skins.json, castles.json
  /entities      # Player, NPC, Dragon, Boss
  /ui            # HUD (coin counter, sword inventory), Monaco overlay, results panel
/public/assets   # spritesheets, tilesets, audio
```

## 2. Art & Assets

- **I am providing pre-made sprites** as transparent PNGs in `/public/assets/`, organized as `/characters`, `/enemies`, `/items`, `/buildings`.
- **Default player character (already made, 4 files):** `player_front.png`, `player_back.png`, `player_left.png`, `player_right.png`. One frame per direction, no separate walk frames: animate walking with a small vertical bob (1 to 2 px oscillation) plus a subtle 2-3 degree rock, which reads as an 8-bit walk cycle. Do not mirror left/right; both files exist.
- **Future skins follow the same pattern** with a different prefix: `{prefix}_front/back/left/right.png` (prefixes: `scientist`, `sidekick`, `webhero`, `warrior`, `master`). `skins.json` entries are `{ id, name, price, prefix }`; the loader builds the four texture keys from the prefix. Only `player` exists right now, so every other skin falls back to a generated placeholder until its files are added.
- **Dragons: one sprite set, tinted per castle. No additional dragon art will be provided.** The canonical set from existing files:
  - Small dragon (nodes 1 to 3): `ice_dragon_small.png` (base), `ice_dragon_small_defeated.png`
  - Medium dragon (nodes 4 to 9): `ice_dragon_medium.png` (base), `ice_dragon_medium_defeated.png`
  - Boss (node 10): `dragon_base.png` (idle), `dragon_attack.png`, `fire_dragon_boss_defeated.png`
  - Missing attack states (small/medium) fall back to the base sprite with a forward lunge tween.
- **Tinting implementation detail (important):** Phaser's tint is multiplicative, so tinting the blue ice dragons red or yellow directly will look muddy. At load time, create a desaturated (grayscale) copy of each dragon texture via a canvas texture, then apply the castle's theme tint color to the grayscale copy. This produces clean recolors in any hue. Keep the original fire boss untinted for castle 1.
- **`castles.json` gives each of the 15 castles a `themeColor` hex value** (medieval red, dino green, alien magenta, ranger pink, pirate brown-gold, ice blue, volcano orange, cyber teal, haunted violet, desert sand, sky white-blue, ocean deep blue, candy pink, samurai crimson, obsidian dark purple). All three dragon sizes in a castle share its theme color, and the castle's Enchanted Sword tint matches it.
- **Started skins:** `morty_front.png` exists (skin prefix `morty`). A skin becomes equippable only when all four direction frames exist; until then, show it in the shop with a "coming soon" ribbon and keep it unbuyable. Skin prefixes are now `player` (default), `rick`, `morty`, `spiderman`, `goku`, `master`, following `{prefix}_front/back/left/right.png`.
- **Overworld background (already made):** `grass_area.png`, a large top-down grassy field image. Use it as the Overworld scene background scaled to a world of roughly 1280x960, camera follows the player with `pixelArt: true`. Define an invisible collision border ~40px inside the image edges so the player can't walk into the tree line, and give each placed building its own collision body. Do NOT generate tile-based terrain for the overworld; this image replaces it. (Programmatic tiles are still fine for castle map interiors.)
- **Overworld buildings (already made, placed as separate sprites on top of the background):**
  - `castle_grey.png`: the Castle Gate (level selection), placed center-top
  - `training_hut.png`: the Training Hut (wizard quiz), placed left
  - `store_coins.png`: the Skin Shop, placed bottom
  - `castle_master_purple.png`: the Master Tower, placed right side
  Each gets a floating name label and a "Press E to enter" prompt when the player stands adjacent.
- **Wizard (already made, 1 frame):** `wizard_front.png` is his idle sprite in the Training Hut scene. No talk frame exists yet: during dialogue, animate the idle sprite with a subtle bounce synced to the typewriter text. If `wizard_talk.png` appears later, use it for talking automatically.
- **Items and Master Mode enemy (already made):**
  - `coin.png`: the DSA Gold Coin, used in the HUD counter, coin-award popups, and shop pricing.
  - `blue_glowing_sword.png`: the Enchanted Sword. Use it in the boss victory cutscene, castle map completion badges, and the HUD sword inventory. Tint it per castle theme so one sprite covers all 15 castle swords, and tint it in the 6 infinity colors for Master Mode infinity sword drops (until a dedicated `sword_infinity.png` exists).
  - `shadow_knight.png`: the Master Mode enemy's idle sprite. No attack/defeated frames yet: attack falls back to a forward lunge tween with a purple flash, defeated falls back to fading the sprite out with rising smoke particles.
- **Sword-wielding player (already made, 2 frames):** `player_sword_front.png` and `player_sword_back.png` show the player holding a sword. Once the player has earned at least one Enchanted Sword, use these in place of the normal front/back frames (overworld and battle scene). Left/right movement still uses the regular `player_left/right.png` until sword side frames exist. In the Battle scene, always show the sword-wielding frame if owned; it should feel like a visible power-up.
- **Castle level map background (provided):** `castle_map.png`, a top-down map with a winding path, 9 empty stone node pads, and a castle with a dragon at the end (the castle is node 10). Use it as the CastleMap scene background, hue-tinted per castle theme like the dragons. Node screen coordinates are defined once in `castles.json` as a `nodePositions` array of 10 {x, y} points (9 pads + castle door), and the scene overlays interactive markers at those points: node number, flag on completed, pulse on current, dim on locked. Make `nodePositions` easy to tweak by hand so I can align them to the drawn pads after seeing it rendered.
- **Files not yet made (use the missing-file fallback for these):** `knight_attack/defeated` states, `wizard_talk.png`, `chest_closed.png`, `chest_open.png`, remaining skin frames, sword-wielding side frames.
- **Load provided files; never generate replacements for files that exist.** If an expected file is missing at load time, log a clear warning and fall back to a programmatically drawn 8-bit placeholder so the game never crashes on a missing asset. Recolor the boss dragon and swords per theme/color with Phaser tinting on the single base sprite.
- Sprites may come in at large dimensions; scale them down to render at roughly 32x48 on screen with nearest-neighbor filtering (`pixelArt: true` in the Phaser config, and `roundPixels: true`).
- Tilesets and terrain (grass, trees, paths, water, castle map interiors) are NOT provided; generate those programmatically in the same NES-style limited palette, 16x16 tiles.
- Structure `skins.json` so each skin is data-driven: `{ id, name, price, prefix }`, mapping to the file naming convention above.
- Simple chiptune-style SFX using the Web Audio API (coin pickup, hit, victory fanfare, wrong answer buzz). No external audio files needed.

## 3. Overworld (Pokemon-style hub)

- The overworld uses the provided `grass_area.png` background (see Art & Assets) with the four provided building sprites placed on top. Arrow keys / WASD to move; smooth movement is fine (grid-lock optional), direction swaps between the four player frames with the bob walk animation.
- Four interactable structures, each with a floating label and "Press E to enter" prompt when the player is adjacent:
  1. **Training Hut** (left): leads to the Wizard quiz scene
  2. **Castle Gate** (center-top): leads to castle/level selection
  3. **Skin Shop** (bottom): exchange DSA Gold Coins for skins
  4. **Master Tower** (right side, ominous purple): Master Mode, LeetCode-hard tier
- HUD always visible: coin count, current skin, infinity swords collected (0 to 5), enchanted swords per category.

## 4. Training: The Wizard Quiz

- Wizard NPC with a dialogue box (typewriter text effect). He presents a **problem scenario** and 4 multiple-choice **approaches** (e.g. "Given a sorted array, find if two numbers sum to a target" with options: Hash Map / Two Pointers / BFS / Heap).
- Correct answer: +10 DSA Gold Coins, brief explanation of *why* that approach fits, including time/space complexity.
- Wrong answer: no coins, wizard explains the correct approach. No penalty, encourage retry with a new question.
- Build a bank of **at least 60 quiz questions** in `quizzes.json` covering all 15 categories (schema: `{ id, category, prompt, choices[4], correctIndex, explanation }`). Questions should test *pattern recognition*, not code.
- Streak bonus: 5 correct in a row doubles the next reward.

## 5. Castles & Levels (the core loop)

- **15 castles, one per problem category**, ordered easy to medium, following the NeetCode roadmap ordering:
  1. Arrays & Hashing, 2. Two Pointers, 3. Sliding Window, 4. Stack, 5. Binary Search, 6. Linked Lists, 7. Trees, 8. Tries, 9. Heaps / Priority Queue, 10. Backtracking, 11. Graphs, 12. 1D Dynamic Programming, 13. 2D Dynamic Programming, 14. Greedy, 15. Intervals
- Castle selection screen: a scrolling world map. Each castle has a unique theme (castle 1: classic medieval; then dino jungle, alien planet, ranger dojo, pirate cove, ice fortress, volcano keep, cyber city, haunted manor, desert temple, sky citadel, ocean depths, candy kingdom, samurai village, final obsidian spire). Locked castles are greyed out with a padlock; a castle unlocks when you earn the previous castle's Enchanted Sword.
- Inside a castle: the provided `castle_map.png` background with a **Mario-style level path**, 10 nodes overlaid on the drawn stone pads (node 10 is the castle door under the perched dragon): completed nodes show a flag, current node pulses, future nodes are dim.

### Battle system (nodes 1 to 9)

- Each node is one coding problem (easy difficulty, scaling slightly). Nodes 1 to 3 spawn the small dragon, nodes 4 to 9 the medium dragon, all tinted to the castle's theme color. On defeat, swap to the defeated sprite for a beat before the victory panel. Screen layout: left half shows the 8-bit battle scene (your character vs the dragon with an HP bar), right half is the Monaco editor with a function stub, problem statement, constraints, and 1 visible example.
- Each problem has **4 to 6 hidden test cases (edge cases)**. Player writes **Python**, hits "Attack" to run. Each newly passed test case fires an attack animation and deals proportional damage to the dragon. All tests passing = dragon defeated, node cleared, +25 coins.
- Failed tests show which case failed with input/expected/actual (reveal the input only after a failure, LeetCode-style).
- Include a "Hint" button (costs 5 coins) that reveals the intended approach.

### Node 10: Castle Boss

- The boss uses `dragon_base.png` as its standing/idle sprite throughout the battle (tinted to match the castle theme). The problem is easy+ difficulty with a **10-minute countdown timer** shown prominently; it turns red and pulses under 60 seconds.
- **If the timer expires, the player loses:** freeze the editor, swap the boss to `dragon_attack.png`, play the attack lunging toward the player character with screen shake and a red flash, show a "DEFEATED" banner, then return to the castle map. The attempt resets (fresh starter code on re-entry).
- Victory (all tests passed before time runs out) awards the **Blue Enchanted Sword** for that category (each castle's sword gets the theme's color/name), unlocking the next castle, +100 coins, and a victory cutscene (sword rises out of a chest, sparkle particles).

### Problem content

- Author **150 original problems** (10 per category) in `/src/data/problems/*.json`. Write original problem statements in classic algorithmic style; do not copy LeetCode text verbatim. Schema:

```json
{
  "id": "arrays-03",
  "category": "arrays-hashing",
  "title": "Duplicate Scanner",
  "difficulty": "easy",
  "statement": "...",
  "functionName": "solve",
  "starterCode": "def solve(nums: list[int]) -> bool:\n    # your code here\n    pass",
  "examples": [{ "input": "[1,2,3,1]", "output": "True" }],
  "testCases": [{ "args": [[1,2,3,1]], "expected": true }],
  "hint": "...",
  "timeLimitMs": 5000
}
```

- The TestRunner passes `args` from JSON into the Python function via Pyodide, calls `functionName`, and compares the return value against `expected` after converting Python results to JS (handle lists, dicts, booleans, and None; for problems where output order doesn't matter, add an `"unordered": true` flag and sort before comparing).
- Starter code uses type hints and LeetCode-style signatures. Standard library only (`collections`, `heapq`, `bisect`, `math` all work out of the box in Pyodide).

- For Phase 1 you may author only castles 1 to 3 fully (30 problems) plus stubs for the rest; complete all 150 in a later phase.

## 6. Shop

- Grid of skin cards with pixel preview, name, and price (500 to 2000 coins). Buy, then equip/unequip. Owned skins persist. Equipping instantly changes the overworld and battle sprites.
- The **Master Skin** is displayed but unbuyable: "Legends say only a true Master may wear this."

## 7. Master Mode

- Master Tower interior: dark theme, 10+ hard-difficulty problems presented one at a time (random order, no map). Same battle UI but the enemy is a shadow knight, 20-minute timer, no hints.
- Each hard solved drops an **Infinity Sword of a random color** (red, orange, yellow, green, blue, purple; no duplicates until all colors seen). Collect 5 = **Master title**: the HUD shows "MASTER" in gold, the Master Skin auto-unlocks, and a full-screen celebration plays.
- Gate Master Mode behind earning at least 3 Enchanted Swords.

## 8. Save System

- `SaveManager` serializes: coins, ownedSkins, equippedSkin, per-node completion per castle, swords, master progress, quiz streak. Autosave on every state change. Add "Reset Save" in a pause menu (Esc).

## 9. Build Phases

- **Phase 1**: Vite + Phaser + TS scaffold, overworld with movement and the 4 buildings, HUD, SaveManager.
- **Phase 2**: Wizard quiz scene with 20 questions, coin economy.
- **Phase 3**: Castle map, level path UI, Battle scene with Monaco + Web Worker test runner, castle 1 fully playable (10 problems incl. boss + timer + sword reward).
- **Phase 4**: Shop, skins, sprite swapping.
- **Phase 5**: Castles 2 and 3, themes, castle unlock chain.
- **Phase 6**: Master Mode, infinity swords, Master title.
- **Phase 7**: Fill out all 150 problems and 60 quiz questions, remaining 12 castle themes, SFX, polish (particles, screen shake on hits, transitions).

## 10. Acceptance Criteria

- `npm run dev` boots to the overworld with no console errors.
- Player Python code runs through Pyodide in a worker; an infinite loop (`while True: pass`) triggers the timeout, kills and respawns the worker, and the game stays responsive.
- Python tracebacks render readably in the results panel (e.g. an IndexError shows the line number in the player's code).
- Passing tests visibly damage the dragon one hit per newly passed case.
- Progress survives a page refresh.
- Swapping a skin PNG in `/public/assets` and one line in `skins.json` changes a character with no code edits.