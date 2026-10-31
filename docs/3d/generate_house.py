"""FIXX - Santa Sofia Residencial rowhouse, Spline starter model.
Run:  blender -b -P generate_house.py -- [outdir]
Units: meters. Blender Z-up -> exported glTF Y-up. Origin = footprint center on ground.
Front of house faces glTF +Z (Blender -Y)."""
import bpy, sys, os, math, bmesh
OUT = sys.argv[sys.argv.index("--")+1] if "--" in sys.argv else os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene

W, D = 6.5, 8.0            # footprint
X0, X1, Y0, Y1 = -W/2, W/2, -D/2, D/2   # Y0 = front
FF, SL, T = 2.7, 0.15, 0.15  # floor-to-floor, slab, wall thickness
PAR = 0.9                  # parapet

def mat(name, hexc, alpha=1.0, rough=0.8):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    h = hexc.lstrip("#"); c = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    c = [x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
    b.inputs["Base Color"].default_value = (*c, 1); b.inputs["Roughness"].default_value = rough
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha; m.blend_method = "BLEND"
    return m
M = dict(wall=mat("Wall_Grey","#E5E7EB"), trim=mat("Trim_Charcoal","#374151",rough=0.5),
         glass=mat("Glass","#9CA3AF",alpha=0.35,rough=0.05), site=mat("Site_Light","#F3F4F6"),
         lime=mat("Accent_Lime","#DFFF32"))
# keep the unused lime material in the export via a tiny hidden-in-plain-sight swatch? -> no; use fake user
M["lime"].use_fake_user = True

def empty(name, parent=None):
    e = bpy.data.objects.new(name, None); S.collection.objects.link(e); e.parent = parent; return e
ROOT = empty("SantaSofia_House")
G = {k: empty(k, ROOT) for k in ("Ground","Upper","Roof","Site","Details")}
for fl in ("Ground","Upper"):
    for sub in ("Walls","Openings","Glass","Slab"):
        G[f"{fl}_{sub}"] = empty(f"{fl}_{sub}", G[fl])

def box(name, a, b, m, parent, bevel=0.0):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co.x = a[0] if v.co.x<0 else b[0]; v.co.y = a[1] if v.co.y<0 else b[1]; v.co.z = a[2] if v.co.z<0 else b[2]
    if bevel: bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect="EDGES")
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); S.collection.objects.link(o); o.parent = parent
    me.materials.append(m); return o

CUTS = {}
def cut(wall, a, b): CUTS.setdefault(wall, []).append((a, b))

def window(tag, wall, axis, pos, z0, z1, u0, u1, parentO, parentG, mull=1, sill=True, door=False):
    """axis 'y': wall in XZ plane at y=pos (front/back), u = x. axis 'x': wall at x=pos, u = y."""
    out = -1 if (axis=='y' and pos<0) or (axis=='x' and pos<0) else 1
    def P(u, d, z): return (u, pos+d, z) if axis=='y' else (pos+d, u, z)
    cut(wall, P(u0, -0.3, z0), P(u1, 0.3, z1))
    f, fd = 0.06, 0.08         # frame width, depth
    dm = out*(T/2-0.04)         # frame set near outer face
    def fb(n, ua, ub, za, zb, d0, d1, m=M["trim"], par=parentO):
        a = P(ua, min(d0,d1), za); b = P(ub, max(d0,d1), zb)
        return box(f"{tag}_{n}", tuple(min(a[i],b[i]) for i in range(3)), tuple(max(a[i],b[i]) for i in range(3)), m, par)
    fb("FrameL", u0, u0+f, z0, z1, dm-fd/2, dm+fd/2); fb("FrameR", u1-f, u1, z0, z1, dm-fd/2, dm+fd/2)
    fb("FrameT", u0, u1, z1-f, z1, dm-fd/2, dm+fd/2)
    if not door: fb("FrameB", u0, u1, z0, z0+f, dm-fd/2, dm+fd/2)
    for i in range(1, mull+1):
        uc = u0 + (u1-u0)*i/(mull+1); fb(f"Mullion{i}", uc-0.025, uc+0.025, z0, z1, dm-fd/2, dm+fd/2)
    if not door and (z1-z0) > 1.0:
        zt = z1-0.45; fb("Transom", u0, u1, zt-0.02, zt+0.02, dm-fd/2, dm+fd/2)
    fb("Glass", u0+f, u1-f, z0+(0 if door else f), z1-f, dm-0.006, dm+0.006, M["glass"], parentG)
    if sill and not door: fb("Sill", u0-0.08, u1+0.08, z0-0.05, z0, out*(T/2-0.02), out*(T/2+0.06))

# ---------------- structure ----------------
def walls(fl, z0, z1):
    p = G[f"{fl}_Walls"]
    return dict(front=box(f"{fl}_Wall_Front", (X0, Y0, z0), (X1, Y0+T, z1), M["wall"], p),
                back=box(f"{fl}_Wall_Back", (X0, Y1-T, z0), (X1, Y1, z1), M["wall"], p),
                left=box(f"{fl}_Wall_Party_L", (X0, Y0+T, z0), (X0+T, Y1-T, z1), M["wall"], p),
                right=box(f"{fl}_Wall_Party_R", (X1-T, Y0+T, z0), (X1, Y1-T, z1), M["wall"], p))
gw = walls("Ground", 0.15, FF); uw = walls("Upper", FF+SL, 2*FF)
box("Ground_Slab", (X0, Y0, 0), (X1, Y1, 0.15), M["wall"], G["Ground_Slab"])
box("Upper_Slab", (X0-0.05, Y0-0.12, FF), (X1+0.05, Y1+0.05, FF+SL), M["wall"], G["Upper_Slab"], 0.01)
box("Roof_Slab", (X0-0.05, Y0-0.12, 2*FF), (X1+0.05, Y1+0.05, 2*FF+SL), M["wall"], G["Roof"], 0.01)
# party-wall fins (rowhouse dividers) frame the facade
for s, x in (("L", X0-0.12), ("R", X1)):
    box(f"Facade_Fin_{s}", (x, Y0-0.35, 0.15), (x+0.12, Y1, 2*FF+SL+PAR+0.1), M["wall"], G["Details"], 0.01)
# interior partitions (visible through glass)
box("Ground_Wall_Interior_Kitchen", (X0+T, 1.2, 0.15), (X0+2.6, 1.3, FF), M["wall"], G["Ground_Walls"])
box("Ground_Wall_Interior_Bath", (0.9, 1.2, 0.15), (1.0, Y1-T, FF), M["wall"], G["Ground_Walls"])
box("Ground_Wall_Interior_Garage", (X0+T, -1.2, 0.15), (0.2, -1.1, FF), M["wall"], G["Ground_Walls"])
box("Upper_Wall_Interior_Hall", (X0+T, -0.6, FF+SL), (X1-T, -0.5, 2*FF), M["wall"], G["Upper_Walls"])
box("Upper_Wall_Interior_Bed23", (0.0, 1.3, FF+SL), (0.1, Y1-T, 2*FF), M["wall"], G["Upper_Walls"])
box("Upper_Wall_Interior_Bath", (X0+T, 1.3, FF+SL), (X1-T, 1.4, 2*FF), M["wall"], G["Upper_Walls"])
box("Stair_Stringer", (X1-1.1, -0.4, 0.15), (X1-T, 1.1, FF), M["wall"], G["Details"])

# ---------------- ground openings ----------------
GO, GG = G["Ground_Openings"], G["Ground_Glass"]
# garage opening + sectional door
cut(gw["front"], (X0+0.35, Y0-0.3, 0.15), (0.15, Y0+0.3, 2.35))
for i in range(6):
    z = 0.17 + i*0.36
    box(f"GarageDoor_Panel_{i+1}", (X0+0.38, Y0+0.05, z), (0.12, Y0+0.09, z+0.34), M["trim"], GO, 0.008)
box("GarageDoor_Header", (X0+0.25, Y0-0.04, 2.35), (0.25, Y0+0.02, 2.47), M["trim"], GO, 0.01)
# front door
window("Ground_FrontDoor", gw["front"], 'y', Y0, 0.15, 2.3, 0.55, 1.5, GO, GO, mull=0, door=True)
GO.children[-1].data.materials[0] = M["trim"]  # solid door leaf (replaces glass)
box("Ground_FrontDoor_Handle", (1.35, Y0-0.05, 1.05), (1.38, Y0-0.01, 1.35), M["wall"], GO)
box("Ground_DoorCanopy", (0.35, Y0-0.85, 2.42), (1.75, Y0, 2.5), M["trim"], GO, 0.01)
window("Ground_Window_Front", gw["front"], 'y', Y0, 1.0, 2.3, 1.9, X1-0.3, GO, GG, mull=1)
# back: sliding patio door + kitchen window
window("Ground_PatioDoor", gw["back"], 'y', Y1, 0.15, 2.3, -1.2, 1.3, GO, GG, mull=1, door=True)
window("Ground_Window_Kitchen", gw["back"], 'y', Y1, 1.2, 2.2, X0+0.4, -1.6, GO, GG, mull=0)
window("Ground_Window_Laundry", gw["back"], 'y', Y1, 1.7, 2.3, 1.8, 2.8, GO, GG, mull=0)

# ---------------- upper openings ----------------
UO, UG = G["Upper_Openings"], G["Upper_Glass"]
z0u = FF+SL
window("Upper_MainBed_BalconyDoor", uw["front"], 'y', Y0, z0u, z0u+2.2, X0+0.5, 0.6, UO, UG, mull=2, door=True)
window("Upper_Bed2_Window", uw["front"], 'y', Y0, z0u+0.9, z0u+2.2, 1.3, X1-0.45, UO, UG, mull=1)
window("Upper_Bed3_Window", uw["back"], 'y', Y1, z0u+0.9, z0u+2.2, -2.6, -0.6, UO, UG, mull=1)
window("Upper_Bed2b_Window", uw["back"], 'y', Y1, z0u+0.9, z0u+2.2, 0.6, 2.6, UO, UG, mull=1)
window("Upper_Bath_Window", uw["right"], 'x', X1, z0u+1.6, z0u+2.2, 1.6, 2.6, UO, UG, mull=0, sill=False) if False else None
# balcony
B = G["Details"]
box("Balcony_Slab", (X0+0.1, Y0-0.95, FF), (0.9, Y0, FF+SL), M["wall"], B, 0.01)
box("Balcony_Rail_Top", (X0+0.1, Y0-0.95, FF+SL+0.95), (0.9, Y0-0.9, FF+SL+1.0), M["trim"], B)
box("Balcony_Rail_SideR", (0.85, Y0-0.95, FF+SL+0.95), (0.9, Y0, FF+SL+1.0), M["trim"], B)
for i in range(17):
    x = X0+0.15 + i*(0.9-(X0+0.15))/16
    box(f"Balcony_Baluster_{i+1:02d}", (x-0.012, Y0-0.935, FF+SL), (x+0.012, Y0-0.91, FF+SL+0.95), M["trim"], B)
# minisplit: indoor unit inside main bedroom (seen through glass) + condenser on balcony
box("Minisplit_Indoor_MainBed", (X0+0.6, Y0+1.5, z0u+2.0), (X0+1.5, Y0+1.72, z0u+2.3), M["wall"], B, 0.03)
box("Minisplit_Indoor_Vent", (X0+0.65, Y0+1.49, z0u+2.03), (X0+1.45, Y0+1.5, z0u+2.07), M["trim"], B)
box("Minisplit_Condenser", (0.15, Y0-0.85, FF+SL+0.05), (0.8, Y0-0.55, FF+SL+0.6), M["wall"], B, 0.02)
box("Minisplit_Condenser_Grille", (0.2, Y0-0.86, FF+SL+0.12), (0.62, Y0-0.85, FF+SL+0.54), M["trim"], B)

# ---------------- roof ----------------
R = G["Roof"]; zr = 2*FF+SL
for n, a, b in (("Front", (X0, Y0-0.12, zr), (X1, Y0+0.03, zr+PAR)), ("Back", (X0, Y1-0.1, zr), (X1, Y1+0.05, zr+PAR)),
                ("L", (X0, Y0, zr), (X0+0.12, Y1, zr+PAR)), ("R", (X1-0.12, Y0, zr), (X1, Y1, zr+PAR))):
    box(f"Roof_Parapet_{n}", a, b, M["wall"], R)
box("Roof_Coping_Front", (X0-0.12, Y0-0.17, zr+PAR), (X1+0.12, Y0+0.06, zr+PAR+0.05), M["trim"], R)
box("Roof_Tinaco_Base", (1.4, 2.0, zr), (2.6, 3.2, zr+0.25), M["wall"], R)
bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.55, depth=1.25, location=(2.0, 2.6, zr+0.25+0.625))
tk = bpy.context.object; tk.name = "Roof_Tinaco_WaterTank"; tk.parent = R; tk.data.materials.append(M["trim"])
box("Roof_Stair_Hatch", (X1-1.2, -0.4, zr), (X1-0.15, 1.1, zr+1.0), M["wall"], R, 0.01)

# ---------------- site ----------------
St = G["Site"]; LF, LB = Y0-4.5, Y1+2.5    # lot 6.5 x 15
box("Site_Lot", (X0-0.12, LF, -0.06), (X1+0.12, LB, 0.0), M["site"], St)
box("Site_Driveway", (X0+0.25, LF, 0.0), (0.25, Y0, 0.02), M["wall"], St)
box("Site_Path", (0.55, LF+0.9, 0.0), (1.5, Y0-0.85, 0.02), M["wall"], St)
for i in range(2):
    box(f"Site_EntryStep_{i+1}", (0.4, Y0-0.85+i*0.3, 0.0), (1.65, Y0, 0.075*(i+1)), M["wall"], St, 0.005)
box("Site_FrontWall_R", (1.5+0.3, LF, 0.0), (X1, LF+0.15, 0.9), M["wall"], St, 0.01)
box("Site_FrontWall_Cap_R", (1.75, LF-0.02, 0.9), (X1+0.02, LF+0.17, 0.94), M["trim"], St)
box("Site_Planter", (1.8, LF+0.15, 0.0), (X1-T, Y0-1.2, 0.35), M["wall"], St, 0.01)
for s, x in (("L", X0-0.12), ("R", X1)):
    box(f"Site_PerimeterWall_{s}_Front", (x, LF, 0.0), (x+0.12, Y0-0.36, 0.9), M["wall"], St)
    box(f"Site_PerimeterWall_{s}_Back", (x, Y1+0.01, 0.0), (x+0.12, LB-0.12, 1.6), M["wall"], St)
box("Site_BackWall", (X0-0.12, LB-0.12, 0.0), (X1+0.12, LB, 1.6), M["wall"], St)
box("Site_Patio_Floor", (X0, Y1, 0.0), (X1, Y1+2.38, 0.05), M["wall"], St)
# pergola
P = G["Details"]
for i, x in enumerate((X0+0.25, X1-0.35)):
    box(f"Pergola_Post_{i+1}", (x, Y1+2.0, 0.05), (x+0.1, Y1+2.1, 2.45), M["trim"], P)
box("Pergola_Beam", (X0+0.15, Y1+1.98, 2.45), (X1-0.15, Y1+2.12, 2.6), M["trim"], P)
box("Pergola_Ledger", (X0+0.15, Y1+0.0, 2.45), (X1-0.15, Y1+0.1, 2.6), M["trim"], P)
for i in range(13):
    x = X0+0.3 + i*(W-0.6)/12
    box(f"Pergola_Slat_{i+1:02d}", (x-0.025, Y1, 2.6), (x+0.025, Y1+2.3, 2.7), M["trim"], P)

# ---------------- booleans ----------------
for wall, cs in CUTS.items():
    for i, (a, b) in enumerate(cs):
        c = box(f"_cut{i}", tuple(min(a[k],b[k]) for k in range(3)), tuple(max(a[k],b[k]) for k in range(3)), M["wall"], None)
        md = wall.modifiers.new("cut", "BOOLEAN"); md.object = c; md.solver = "EXACT"
        bpy.context.view_layer.objects.active = wall; bpy.ops.object.modifier_apply(modifier="cut")
        bpy.data.objects.remove(c)
for o in list(S.objects):
    if o.type == "MESH":
        me = o.data; bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.dissolve_limit(bm, angle_limit=0.001, verts=bm.verts, edges=bm.edges)
        bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = False

tris = sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in S.objects if o.type=="MESH")
print("TRIANGLES", tris, "OBJECTS", sum(o.type=="MESH" for o in S.objects))
glb = os.path.join(OUT, "santa-sofia-house.glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", export_yup=True, export_apply=True)
print("GLB", glb, os.path.getsize(glb))

# ---------------- previews ----------------
if "--no-render" not in sys.argv:
    S.render.engine = "CYCLES"; S.cycles.samples = 48; S.cycles.use_denoising = True
    S.render.resolution_x, S.render.resolution_y = 1400, 1000
    S.render.film_transparent = False
    w = bpy.data.worlds.new("W"); S.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN")); S.collection.objects.link(sun)
    sun.data.energy = 2.2; sun.data.angle = 0.5; sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam")); S.collection.objects.link(cam); S.camera = cam
    cam.data.lens = 35
    tgt = bpy.data.objects.new("T", None); S.collection.objects.link(tgt); tgt.location = (0, 0, 3.0)
    tc = cam.constraints.new("TRACK_TO"); tc.target = tgt
    S.view_settings.view_transform = "AgX"; S.view_settings.look = "AgX - Medium High Contrast"
    for name, loc, ortho in (("preview-front-34", (-13, -17, 7), 0), ("preview-back-34", (13, 19, 8), 0), ("preview-top", (0, -1.01, 30), 22)):
        cam.location = loc
        cam.data.type = "ORTHO" if ortho else "PERSP"; cam.data.ortho_scale = ortho or 1
        tgt.location = (0, -1.0, 0) if ortho else (0, 0, 3.0)
        S.render.filepath = os.path.join(OUT, name + ".png"); bpy.ops.render.render(write_still=True)
