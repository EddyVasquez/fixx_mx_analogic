# Santa Sofía 3D model

The My Home hero loads one GLB. The file in the repo is the starter house (real meters, Y-up, origin on the ground at the footprint center, front facing +Z, about 2,700 triangles).

## Swap in a new export

1. Export GLB from Spline (see [docs/3d/SPLINE_GUIDE.md](3d/SPLINE_GUIDE.md)). Keep the scale, the origin, Y-up, and the material names (`Wall_Grey`, `Trim_Charcoal`, `Glass`, `Site_Light`). Leave `Accent_Lime` for a later highlight. The hero and the stat cards are the only lime in the hub.
2. Put the file in `public/models/`.
   - Same name (`santa-sofia-house.glb`): replace the file. No code change.
   - Versioned name (`santa-sofia-house_vNN.glb`): change `HOUSE_MODEL_FILE` in `src/features/customer/blueprint/houseModel.ts` to that name. That constant is the only path the app reads. The URL is `import.meta.env.BASE_URL` plus `models/` plus the file name, so the GitHub Pages base `/fixx_mx_analogic/` stays correct.
3. Replace the static image the hero shows when WebGL is missing or the model is still loading. It must sit next to the GLB and use the same stem with a `.png` extension (`santa-sofia-house.png`, or `santa-sofia-house_vNN.png` if you versioned the GLB). Use a front 3/4 render on the light grey surface (`paper` in `src/ui/tokens.ts`).

The view spins the model around the vertical axis through the footprint center. The camera stays a level 3/4 and refits to the bounding box, so a larger export still fits the hero. Outlines, the soft ground shadow, and the fading grid are added in the app. Glass stays the translucent grey from the file.

`docs/3d/generate_house.py` is the Blender script that built the starter GLB. It is there so the mesh can be rebuilt; Spline exports do not need it.
