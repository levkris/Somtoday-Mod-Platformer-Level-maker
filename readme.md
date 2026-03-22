# Level Builder

A browser-based level editor for the **[Somtoday Mod](https://github.com/Jona-Zwetsloot/Somtoday-Mod) Platformer**. Build custom levels, place objects, set up triggers and portals, and export them as XML files ready to load into the game.

Open `index.html` in any modern browser — no server or install needed.



---

## Getting started

1. Open `index.html`
2. Pick an object type from the left panel
3. Click **Place** (or press `P`) to enter place mode, then click on the canvas to drop objects
4. Select objects with **Select** (`V`) to move, resize, and edit their properties in the right panel
5. Export with **Export XML** when you're done

Your work is auto-saved to browser storage. On next open you'll be asked if you want to restore the session.

---

## Tools

| Tool | Key | What it does |
|---|---|---|
| Select | `V` | Click to select, drag to move, drag handles to resize |
| Place | `P` | Click canvas to place the active object type |
| Pan | `H` | Click and drag to pan the viewport |

Hold `Space` while using any tool to temporarily pan.

---

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` |
| Duplicate | `Ctrl+D` |
| Copy / Paste | `Ctrl+C` / `Ctrl+V` |
| Group / Ungroup | `Ctrl+G` |
| Delete | `Del` |
| Deselect | `Esc` |
| Nudge 1px | Arrow keys |
| Nudge 10px | `Shift` + Arrow keys |
| Fit view | `Ctrl+0` |
| Focus selection | `F` |
| Zoom | Scroll wheel |
| Move layer up/down | `]` / `[` |
| Multi-select | `Shift` + click |
| Box select | `Shift` + drag |

---

## Object types

### Terrain
- **Floor** - Basic solid platform. Supports `oneWay` (pass through from below) and `ghost` (no collision).
- **Wall** - Solid wall. Can be configured as a door that requires a key to open (`keyId`). Supports rising behavior with `riseWithId`.
- **Lava** - Kills the player on contact. Can flow upward with `flowUp` and `flowSpeed`.

### Platforms
- **Trampoline** - Bounces the player. Set `strength` to control how high.
- **MP Up** - Moving platform that travels vertically between `startY` and `endY`. Can be trigger-activated.
- **MP Right** - Moving platform that travels horizontally between `startX` and `endX`.

### Collectibles
- **Coin** - Collectible coin. Set `blue: true` for a blue coin variant.
- **Key** - Collectible key. Give it a `keyId` and set the same ID on a wall's `keyId` to link them.
- **Orb** - Jump orb. Launches the player upward when touched. Set `strength` to control power.

### Enemies
- **Enemy** - Patrols between `min` and `max` X positions. `detectionRadius` controls how close the player needs to be before it activates. Set `stuck: true` to make it stationary.
- **Enemy Spawner** - Spawns enemies inside a defined area. Linked to an area via `areaId`.
- **Despawn Enemies** - Trigger zone that despawns enemies from a linked spawner area.

### Triggers & zones
- **Area** - Invisible zone identified by `id`. Used by cameras, music triggers, spawners, etc. to know when the player is in range. Can store a checkpoint position.
- **Camera** - Links to an `areaId`. When the player enters that area, the camera locks to this position.
- **Music Trigger** - Links to an `areaId`. Plays a song when the player enters the area.
- **Checkpoint** - Saves the player's respawn position when touched.
- **End** - The level exit. Touching this completes the level.

### Other
- **Text** - Displays text in the level. Supports basic tags: `<b>` bold, `<y>` yellow, `<r>` red, `<g>` green, `<bl>` blue.
- **Portal** - Teleports the player. Each portal has a `portal-id` and a `to-portal-id` pointing to its destination portal.

---

## Properties panel

Click any object to open its properties on the right. Fields vary by type.

**Textures** - Set a `texture` path on an object. If you upload a texture file with a matching filename, it will be auto-assigned. You can also manually select from the Textures tab.

**Texture modes:**
- `tile` - repeats the image at its natural size
- `stretch` - stretches the image to fill the object

**Pick buttons** (`+`) - For fields like `keyId`, `areaId`, and portal links, click the `+` button then click an object on the canvas to grab its ID automatically.

---

## Groups

Select 2 or more objects and press `Ctrl+G` to group them. Groups are shown in the Hierarchy panel and export as `<group>` tags in the XML. Click the pencil icon on a group to rename it.

---

## Textures

Go to the **Textures** tab in the right panel to upload images. Drop one or multiple files at once. Textures are saved to browser storage alongside your level.

If a texture's filename matches an object's `texture` path (or the last segment of it), it gets auto-assigned. The storage bar shows how much browser storage is in use.

---

## Import & Export

**Export XML** - Generates the level XML. Copy it or download it as a `.xml` file.

**Export ZIP** - Packages the level XML and all loaded textures into a single `.zip` file.

**Import** - Load a `.xml` or `.zip` file by dragging it onto the drop zone, or paste XML directly.

---

## File structure

```
index.html    - app shell and HTML
style.css     - all styles
data.js       - static config (object types, field definitions, shortcuts)
state.js      - app state, object helpers, coordinate transforms, undo/redo
storage.js    - localStorage persistence, texture loading, ZIP export
canvas.js     - mouse/keyboard input, hit testing, resize handles
draw.js       - canvas rendering and minimap
ui.js         - panels, hierarchy, context menu, groups, toasts
props.js      - properties panel and field builders
xml.js        - XML import and export
main.js       - app init and session restore
```
