# Santa Sofía House – Spline Starter Guide (FIXX My Home)

## What's in this folder
- `santa-sofia-house.glb` – the 3D house (open this in Spline)
- `generate_house.py` – the script that builds it (Dexter can rebuild it any time)
- `preview-front-34.png`, `preview-back-34.png`, `preview-top.png` – what it should look like

## 1. Import into Spline
1. Go to https://spline.design, sign in, click **New File** → blank scene.
2. Delete the default cube/light if present.
3. Drag `santa-sofia-house.glb` onto the canvas (or **File → Import** → pick the file).
4. It appears at real size (about 6.5 m wide, 6.4 m tall). If it looks tiny/huge, that's just zoom – **don't resize it**.

## 2. How the model is organized (left panel)
`SantaSofia_House` → `Ground` (Walls, Openings, Glass, Slab), `Upper` (same), `Roof`, `Site`, `Details`
(balcony, minisplit, pergola, side fins). Hide a group with the eye icon to see inside.

Materials (keep these names): `Wall_Grey` #E5E7EB, `Trim_Charcoal` #374151, `Glass` translucent grey,
`Site_Light` #F3F4F6, `Accent_Lime` #DFFF32 (unused – save it for highlights like an active-job room).

## 3. Recommended scene setup (the "grey blueprint" look)
- **Camera:** Orthographic, or Perspective with ~35 mm focal length. Level 3/4 view: rotate around Y only, camera height ~5 m, looking at the house center. No tilted/rolled camera.
- **Light:** one soft directional light from upper-left (soft shadows on), plus ambient/environment light ~40–60%. Background white or #F3F4F6.
- **Material:** set walls to a **Matte/Lambert** layer (no gloss). For blueprint lines, add an **Outline** layer (charcoal #374151, thin) or a **Wireframe** layer at low opacity on top.
- **Spin:** if you add a rotate animation, rotate `SantaSofia_House` around **Y only**.

## 4. Do NOT change
- **Scale** (it's in real meters) – if you need it bigger in the view, move the camera.
- **Origin / position** of `SantaSofia_House` – it sits at 0,0,0 so it spins dead center.
- **Up axis** – keep Y up; don't rotate the root object on X or Z.
- Object and material **names** – the app looks for them.

## 5. Budget for phones/tablets
- Under **50,000 triangles** total (it starts at ~2,700, so you have lots of room).
- Avoid textures; if you must, max 1024×1024 PNG/JPG, few of them. Final GLB ideally under 2–3 MB.
- Avoid heavy bevels on many objects, text in 3D, and particle effects.

## 6. Send it back
- **Preferred:** Export → **GLTF/GLB** → GLB, then send the file to Dexter.
- Or: **Export → Public URL / Code** (scene link) and send the link.
- File naming: `santa-sofia-house_v02_YYYY-MM-DD.glb` (bump the version each time). New objects: `Floor_Category_Name`, e.g. `Upper_Details_Planter`.
