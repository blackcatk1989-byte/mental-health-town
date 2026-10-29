"""用 Blender 產生 3D 版的人物與陪伴小動物模型（參考いらすとや畫風的原創造型）。

執行（在專案根目錄）：
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" --background --python assets/models/build_models.py
    加上 `-- --preview <png路徑>` 會另外渲染一張全部模型的預覽圖。

輸出：assets/models/person.glb、cat.glb、dog.glb、hedgehog.glb、otter.glb

模型約定（遊戲端 src/three/characters.js 依此替換材質與切換髮型）：
- 座標沿用 Three.js 的單位，角色高約 1.3，面向 +Z（Blender 的 -Y）。
- 材質名稱代表用途：Skin、Outfit、Pants、Hair、Shoe、White、Fur、Accent、Belly、
  Eye、Highlight、Blush、Mouth、Nose、Outline（描邊，用反轉外殼法）。
- 人物的頭髮物件以 Hair_ 開頭：Hair_common_* 一定顯示，Hair_short_*、Hair_long_*、Hair_bun_*、Hair_spiky_* 依髮型切換。
- 依造型切換的其他物件：Legwear_long_*（長褲）／Legwear_shorts_*（短褲、小腿、襪子）、
  Jersey_*（羽球衣的潑墨圖案、護腕、球拍）、Glasses_*（眼鏡）。
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUTLINE = 0.012
SEG = (24, 12)  # 球體細分：手機也跑得動

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = argv[argv.index("--preview") + 1] if "--preview" in argv else None


def P(x, y, z):
    """Three.js 座標（y 朝上、+z 朝前）轉成 Blender 座標（z 朝上、-y 朝前）。"""
    return Vector((x, -z, y))


def srgb(hex_color):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    h = hex_color.lstrip("#")
    return tuple(lin(int(h[i:i + 2], 16)) for i in (0, 2, 4)) + (1.0,)


# 預覽用顏色；遊戲裡會依玩家選擇重新上色
PREVIEW_COLORS = {
    "Skin": "#f1d3b8", "Outfit": "#c98a6b", "Pants": "#91634d", "Hair": "#4a3a32", "Shoe": "#8a6450",
    "White": "#fffaf2", "Eye": "#2f2622", "Highlight": "#ffffff", "Blush": "#f59a9a", "Mouth": "#c0504a",
    "Nose": "#2f2622", "Outline": "#4f3c33",
    "Mint": "#8fd6c0", "Navy": "#34426b", "Frame": "#2a2a2a", "Band": "#26262a", "Racket": "#e9e9ee",
    "Strings": "#f6f6f6",
}
MATS = {}


def mat(name, color=None):
    key = name if color is None else f"{name}"
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(name)
    if hasattr(m, "use_nodes") and not m.use_nodes:
        m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = srgb(color or PREVIEW_COLORS.get(name, "#cccccc"))
    bsdf.inputs["Roughness"].default_value = 0.9
    MATS[key] = m
    return m


def finish(name, bm, material, collection, outline=True):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    if outline:
        obj.data.materials.append(MATS["Outline"])
        mod = obj.modifiers.new("描邊", "SOLIDIFY")
        mod.thickness = OUTLINE
        mod.offset = 1
        mod.use_flip_normals = True
        mod.use_rim = False
        mod.material_offset = 1
    return obj


def transform(bm, loc, scale=(1, 1, 1), rot=None):
    m = Matrix.Diagonal((*scale, 1))
    if rot is not None:
        m = rot.to_4x4() @ m
    m = Matrix.Translation(loc) @ m
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)


def ellipsoid(coll, name, material, center, radii, rot=None, outline=True, seg=SEG):
    """center 用 Three.js 座標；radii 為 (x, y, z) 半徑（Three.js 軸向）。"""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=1)
    rx, ry, rz = radii
    transform(bm, Vector((0, 0, 0)), (rx, rz, ry), rot)
    transform(bm, P(*center))
    return finish(name, bm, material, coll, outline)


def surface_basis(normal):
    """以球面法線為 Z 軸的區域座標（X 朝右、Y 朝上）。"""
    n = normal.normalized()
    right = Vector((0, 0, 1)).cross(n)
    if right.length < 1e-6:
        right = Vector((1, 0, 0))
    right.normalize()
    up = n.cross(right).normalized()
    return Matrix((right, up, n)).transposed()


def on_head(coll, name, material, head_center, radius, direction, size, tilt=0.0, depth=0.03, lift=1.0):
    """在頭（球）表面放一個扁扁的小物件：眼睛、眉毛、腮紅等。direction 為 Three.js 座標方向。"""
    d = P(*direction).normalized()
    basis = surface_basis(d) @ Matrix.Rotation(tilt, 3, "Z")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=1)
    transform(bm, Vector((0, 0, 0)), (size[0], size[1], depth), basis)
    transform(bm, P(*head_center) + d * radius * lift)
    return finish(name, bm, material, coll, outline=False)


def half_disc(coll, name, material, head_center, radius, direction, r, squash=0.8):
    """張口微笑：下半圓。"""
    d = P(*direction).normalized()
    bm = bmesh.new()
    center = bm.verts.new((0, 0, 0))
    pts = [bm.verts.new((math.cos(a) * r, math.sin(a) * r * squash, 0))
           for a in (math.pi + i * math.pi / 12 for i in range(13))]
    for a, b in zip(pts, pts[1:]):
        bm.faces.new((center, a, b))
    transform(bm, Vector((0, 0, 0)), rot=surface_basis(d))
    transform(bm, P(*head_center) + d * radius * 1.01)
    return finish(name, bm, material, coll, outline=False)


def face(coll, prefix, head_center, R, spread=0.3, eye_y=-0.04, brows=True, mouth=True, eye_scale=1.0):
    for s in (-1, 1):
        on_head(coll, f"{prefix}_eye", MATS["Eye"], head_center, R, (s * spread, eye_y, 0.93),
                (R * 0.085 * eye_scale, R * 0.11 * eye_scale), depth=R * 0.05)
        on_head(coll, f"{prefix}_highlight", MATS["Highlight"], head_center, R, (s * spread + 0.035, eye_y + 0.05, 0.93),
                (R * 0.035 * eye_scale, R * 0.035 * eye_scale), depth=R * 0.03, lift=1.04)
        if brows:
            on_head(coll, f"{prefix}_brow", MATS["Eye"], head_center, R, (s * spread, eye_y + 0.25, 0.93),
                    (R * 0.075, R * 0.018), tilt=-s * 0.12, depth=R * 0.02)
        on_head(coll, f"{prefix}_blush", MATS["Blush"], head_center, R, (s * (spread + 0.2), eye_y - 0.17, 0.87),
                (R * 0.11, R * 0.06), depth=R * 0.02, lift=1.005)
    if mouth:
        half_disc(coll, f"{prefix}_mouth", MATS["Mouth"], head_center, R, (0, eye_y - 0.2, 1), R * 0.09)


def cone(coll, name, material, base, direction, radius, height, outline=False):
    d = P(*direction).normalized()
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=radius, radius2=0, depth=height)
    transform(bm, Vector((0, 0, height / 2)))
    transform(bm, Vector((0, 0, 0)), rot=d.to_track_quat("Z", "Y").to_matrix())
    transform(bm, P(*base))
    return finish(name, bm, material, coll, outline)


def on_ellipsoid(coll, name, material, center, radii, direction, size, tilt=0.0, depth=0.012):
    """貼在橢球表面的扁平色塊（衣服圖案）。direction 為 Three.js 座標方向。"""
    rx, ry, rz = radii
    d = Vector(direction).normalized()
    surf = Vector((center[0] + rx * d.x, center[1] + ry * d.y, center[2] + rz * d.z))
    normal = P(d.x / rx, d.y / ry, d.z / rz).normalized()
    basis = surface_basis(normal) @ Matrix.Rotation(tilt, 3, "Z")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=1)
    transform(bm, Vector((0, 0, 0)), (size[0], size[1], depth), basis)
    transform(bm, P(*surf))
    return finish(name, bm, material, coll, outline=False)


def rod(coll, name, material, a, b, radius, outline=False):
    """兩點之間的細圓柱（眼鏡架、球拍握把）。a、b 為 Three.js 座標。"""
    pa, pb = P(*a), P(*b)
    axis = pb - pa
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=radius, radius2=radius, depth=axis.length)
    transform(bm, Vector((0, 0, 0)), rot=axis.normalized().to_track_quat("Z", "Y").to_matrix())
    transform(bm, (pa + pb) / 2)
    return finish(name, bm, material, coll, outline)


def ring(coll, name, material, center, normal, radius, tube, squash=1.0):
    """圓環（眼鏡框、球拍框、護腕）。center、normal 為 Three.js 座標。"""
    bm = bmesh.new()
    seg, tseg = 28, 6
    rings = []
    for i in range(seg):
        a = i / seg * math.tau
        c = Vector((math.cos(a) * radius, math.sin(a) * radius * squash, 0))
        out = Vector((math.cos(a), math.sin(a) * squash, 0)).normalized()
        rings.append([bm.verts.new(c + out * math.cos(b) * tube + Vector((0, 0, math.sin(b) * tube)))
                      for b in (j / tseg * math.tau for j in range(tseg))])
    for i in range(seg):
        r0, r1 = rings[i], rings[(i + 1) % seg]
        for j in range(tseg):
            bm.faces.new((r0[j], r1[j], r1[(j + 1) % tseg], r0[(j + 1) % tseg]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    transform(bm, Vector((0, 0, 0)), rot=surface_basis(P(*normal)))
    transform(bm, P(*center))
    return finish(name, bm, material, coll, outline=False)


# ---------------------------------------------------------------- 人物
def build_person(coll):
    skin, outfit, pants, hair, shoe, white = (MATS[k] for k in ("Skin", "Outfit", "Pants", "Hair", "Shoe", "White"))
    for s in (-1, 1):
        ellipsoid(coll, "shoe", shoe, (s * 0.09, 0.05, 0.04), (0.08, 0.055, 0.1))
        ellipsoid(coll, "Legwear_long_leg", pants, (s * 0.085, 0.18, 0), (0.07, 0.13, 0.07))
        ellipsoid(coll, "Legwear_shorts_short", white, (s * 0.09, 0.25, 0), (0.085, 0.075, 0.085))
        ellipsoid(coll, "Legwear_shorts_shin", skin, (s * 0.085, 0.15, 0), (0.05, 0.08, 0.05))
        ellipsoid(coll, "Legwear_shorts_sock", white, (s * 0.088, 0.085, 0.01), (0.055, 0.04, 0.055), outline=False)
        arm_rot = Matrix.Rotation(s * 0.2, 3, "Y")  # 手臂微微張開（Blender 的 Y 軸為前後）
        ellipsoid(coll, "arm", outfit, (s * 0.24, 0.45, 0), (0.06, 0.13, 0.06), rot=arm_rot)
        ellipsoid(coll, "hand", skin, (s * 0.28, 0.3, 0.01), (0.058, 0.058, 0.058))
        ellipsoid(coll, "ear", skin, (s * 0.33, 0.93, 0), (0.035, 0.06, 0.05))
    ellipsoid(coll, "torso", outfit, (0, 0.45, 0), (0.22, 0.23, 0.18))
    ellipsoid(coll, "collar", white, (0, 0.635, 0.01), (0.13, 0.035, 0.11), outline=False)

    head_c, R = (0, 0.95, 0), 0.34
    ellipsoid(coll, "head", skin, head_c, (R, R * 0.95, R * 0.97))

    # 頭髮：髮帽（前額較高、後腦較低）
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1)
    # 以 Three.js 方向判斷：保留 y > -0.2 + 0.48 * z 的部分（z 為前方），前額留一點瀏海感
    doomed = [v for v in bm.verts if v.co.z < -0.2 + 0.48 * (-v.co.y)]
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    transform(bm, Vector((0, 0, 0)), (R * 1.07, R * 1.07, R * 1.04))
    transform(bm, P(*head_c))
    finish("Hair_common_cap", bm, hair, coll)

    for s in (-1, 1):
        ellipsoid(coll, "Hair_short_side", hair, (s * 0.31, 0.98, 0.04), (0.07, 0.13, 0.1))
        ellipsoid(coll, "Hair_long_side", hair, (s * 0.31, 0.8, 0.04), (0.08, 0.26, 0.09))
    ellipsoid(coll, "Hair_long_back", hair, (0, 0.8, -0.1), (0.37, 0.45, 0.28))
    ellipsoid(coll, "Hair_bun_ball", hair, (0, 1.33, -0.08), (0.12, 0.12, 0.12))

    # 刺刺短髮：頭頂一圈短短的髮束，自然蓬鬆
    for i in range(22):
        a = i / 22 * math.tau * 2.0
        up = 0.45 + 0.5 * (i / 22)
        d = Vector((math.sin(a) * (1 - up * 0.6), up, math.cos(a) * (1 - up * 0.6) - 0.15)).normalized()
        base = (head_c[0] + d.x * R * 0.98, head_c[1] + d.y * R * 0.98, head_c[2] + d.z * R * 0.98)
        cone(coll, "Hair_spiky_tuft", hair, base, (d.x, d.y + 0.35, d.z - 0.15), 0.06, 0.075, outline=True)
    for x in (-0.15, -0.04, 0.07, 0.17):
        cone(coll, "Hair_spiky_fringe", hair, (x, 1.13, 0.24), (x * 0.4, -0.5, 0.85), 0.05, 0.07, outline=True)
    face(coll, "face", head_c, R)

    # 黑框眼鏡
    frame = MATS["Frame"]
    rims = []
    for s in (-1, 1):
        d = Vector((s * 0.3, -0.05, 0.93)).normalized()
        c = (head_c[0] + d.x * R * 1.07, head_c[1] + d.y * R * 1.07, head_c[2] + d.z * R * 1.07)
        ring(coll, "Glasses_rim", frame, c, tuple(d), R * 0.2, 0.012, squash=0.8)
        rims.append(c)
        ear = (s * 0.32, 0.93, 0.02)
        rod(coll, "Glasses_temple", frame, (c[0] + s * R * 0.2, c[1], c[2] - 0.02), ear, 0.008)
    rod(coll, "Glasses_bridge", frame, (rims[0][0] + R * 0.2, rims[0][1] + 0.01, rims[0][2]),
        (rims[1][0] - R * 0.2, rims[1][1] + 0.01, rims[1][2]), 0.008)

    # 羽球衣：黑底上薄荷綠與深藍的潑墨色塊、胸前白色小標
    mint, navy = MATS["Mint"], MATS["Navy"]
    tc, tr = (0, 0.45, 0), (0.22, 0.23, 0.18)
    patches = [  # 細長的筆刷感色塊
        (mint, (-0.45, 0.4, 0.8), (0.16, 0.035), 0.55), (mint, (-0.2, 0.1, 1), (0.13, 0.025), 0.35),
        (mint, (0.05, -0.2, 1), (0.09, 0.02), 0.6), (navy, (-0.3, -0.25, 0.95), (0.1, 0.025), 0.2),
        (navy, (0.25, 0.3, 0.95), (0.07, 0.02), -0.5), (mint, (0.5, -0.4, 0.75), (0.08, 0.018), 0.7),
        (mint, (0.35, 0.45, -0.82), (0.15, 0.03), -0.45), (navy, (-0.3, -0.05, -0.95), (0.12, 0.025), 0.3),
        (mint, (-0.1, -0.35, -0.95), (0.1, 0.02), -0.2), (mint, (-0.95, 0.25, 0.15), (0.08, 0.025), 1.2),
        (mint, (0.95, 0.3, -0.1), (0.07, 0.02), -1.0),
    ]
    for m, d, size, tilt in patches:
        on_ellipsoid(coll, "Jersey_patch", m, tc, tr, d, size, tilt)
    on_ellipsoid(coll, "Jersey_logo", white, tc, tr, (0.4, 0.2, 0.9), (0.025, 0.03), 0.0)
    for s in (-1, 1):
        on_ellipsoid(coll, "Jersey_sleeve", mint, (s * 0.24, 0.45, 0), (0.06, 0.13, 0.06), (s * 0.6, 0.5, 0.6), (0.035, 0.03), 0.5)
        ring(coll, "Jersey_band", MATS["Band"], (s * 0.275, 0.335, 0.01), (s * 0.15, 1, 0), 0.05, 0.018)

    # 右手拿的羽球拍：往上斜靠在肩膀旁
    hand = (0.28, 0.3, 0.01)
    grip_end = (0.31, 0.46, -0.05)
    shaft_end = (0.33, 0.6, -0.1)
    head_center = (0.34, 0.76, -0.14)
    rod(coll, "Jersey_racket_grip", frame, (hand[0], hand[1] - 0.03, hand[2] + 0.02), grip_end, 0.018)
    rod(coll, "Jersey_racket_shaft", MATS["Racket"], grip_end, shaft_end, 0.009)
    ring(coll, "Jersey_racket_head", MATS["Racket"], head_center, (1, 0.05, 0.3), 0.11, 0.011, squash=1.3)
    ellipsoid(coll, "Jersey_racket_strings", MATS["Strings"], head_center, (0.004, 0.14, 0.105),
              rot=Matrix.Rotation(-0.3, 3, "Z"), outline=False)


# ---------------------------------------------------------------- 小動物
PETS = {
    "cat": {"Fur": "#f3b56e", "Accent": "#d98a45", "Belly": "#fff4e4"},
    "dog": {"Fur": "#e9a25b", "Accent": "#d38a45", "Belly": "#fff4e1"},
    "hedgehog": {"Fur": "#f6e3c8", "Accent": "#8d6a52", "Belly": "#f6e3c8"},
    "otter": {"Fur": "#a47450", "Accent": "#7d553a", "Belly": "#f1e0c8"},
}


def build_pet(coll, kind):
    fur, accent, belly = (MATS[f"{kind}_{k}"] for k in ("Fur", "Accent", "Belly"))
    body_mat = accent if kind == "hedgehog" else fur
    ellipsoid(coll, "torso", body_mat, (0, 0.2, -0.06), (0.2, 0.17, 0.25))
    ellipsoid(coll, "chest", belly, (0, 0.2, 0.11), (0.12, 0.12, 0.08), outline=False)
    for x, z in ((-0.1, 0.1), (0.1, 0.1), (-0.1, -0.2), (0.1, -0.2)):
        ellipsoid(coll, "paw", belly if kind == "hedgehog" else fur, (x, 0.05, z), (0.055, 0.05, 0.06))

    head_c, R = (0, 0.4, 0.13), 0.18
    head_r = (R * 1.12, R * 0.85, R) if kind == "otter" else (R, R * 0.95, R)  # 水獺的頭扁扁寬寬
    ellipsoid(coll, "head", fur, head_c, head_r)

    if kind in ("cat", "dog"):
        for s in (-1, 1):
            rot = Matrix.Rotation(s * 0.35, 3, "Y")
            ellipsoid(coll, "ear", fur, (head_c[0] + s * 0.1, head_c[1] + 0.15, head_c[2] - 0.01), (0.05, 0.08, 0.03), rot=rot)
            if kind == "cat":
                ellipsoid(coll, "ear_inner", MATS["Blush"], (head_c[0] + s * 0.1, head_c[1] + 0.15, head_c[2] + 0.015),
                          (0.028, 0.05, 0.012), rot=rot, outline=False)
    if kind == "hedgehog":
        for s in (-1, 1):
            ellipsoid(coll, "ear", belly, (s * 0.12, head_c[1] + 0.13, head_c[2] - 0.02), (0.035, 0.035, 0.025))
    if kind == "otter":
        for s in (-1, 1):
            ellipsoid(coll, "ear", accent, (s * 0.17, head_c[1] + 0.06, head_c[2] - 0.03), (0.03, 0.03, 0.02))

    if kind == "cat":
        for z in (-0.18, -0.06, 0.04):  # 背上的虎斑
            ellipsoid(coll, "stripe", accent, (0, 0.355, z), (0.12, 0.02, 0.03), outline=False)
        ellipsoid(coll, "stripe", accent, (0, head_c[1] + 0.165, head_c[2] + 0.04), (0.05, 0.015, 0.04), outline=False)
        ellipsoid(coll, "tail", fur, (0, 0.33, -0.36), (0.04, 0.16, 0.04), rot=Matrix.Rotation(-0.6, 3, "X"))
    if kind == "dog":
        for i in range(6):  # 捲捲的柴犬尾巴
            a = i / 5 * math.pi * 1.4
            ellipsoid(coll, "tail", fur, (0, 0.36 + math.sin(a) * 0.07, -0.28 - math.cos(a) * 0.07 + 0.07),
                      (0.04, 0.04, 0.04), outline=(i in (0, 5)))
    if kind == "otter":
        ellipsoid(coll, "tail", fur, (0, 0.1, -0.38), (0.06, 0.045, 0.17))
    if kind == "hedgehog":
        for i in range(34):
            a = (i / 34) * math.pi * 2 * 3.1
            d = Vector((math.cos(a) * 0.8, 0.45 + (i % 3) * 0.2, -0.3 - (i / 34) * 0.75)).normalized()
            base = (d.x * 0.18, 0.2 + d.y * 0.15, -0.06 + d.z * 0.22)
            cone(coll, "spike", accent, base, tuple(d), 0.045, 0.13)

    if kind == "hedgehog":
        # 頭頂和後腦也有刺
        for i in range(16):
            a = (i / 16) * math.pi * 2 * 1.6
            d = Vector((math.cos(a) * 0.75, 0.55 + (i % 2) * 0.25, -0.2 - (i / 16) * 0.6)).normalized()
            base = (head_c[0] + d.x * R * 0.9, head_c[1] + d.y * R * 0.9, head_c[2] + d.z * R * 0.9)
            cone(coll, "spike", accent, base, tuple(d), 0.04, 0.11)
        ellipsoid(coll, "muzzle", belly, (head_c[0], head_c[1] - 0.05, head_c[2] + 0.16), (0.06, 0.05, 0.09))
    elif kind == "otter":
        for s in (-1, 1):  # 兩團鬍鬚肉墊
            ellipsoid(coll, "muzzle", belly, (s * 0.04, head_c[1] - 0.06, head_c[2] + 0.15), (0.05, 0.04, 0.04), outline=False)
    elif kind == "dog":
        ellipsoid(coll, "muzzle", belly, (head_c[0], head_c[1] - 0.07, head_c[2] + 0.13), (0.075, 0.06, 0.06), outline=False)
    face(coll, "face", head_c, R, spread=0.38, eye_y=0.04, brows=False, mouth=False)
    nose_lift = {"cat": 1.02, "dog": 1.12, "hedgehog": 1.42, "otter": 1.08}[kind]
    on_head(coll, "nose", MATS["Nose"], head_c, R, (0, -0.12, 1), (0.022, 0.016), depth=0.016, lift=nose_lift)


# ---------------------------------------------------------------- 匯出
def export(coll, filename):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in coll.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = coll.objects[0]
    path = os.path.join(HERE, filename)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_materials="EXPORT", export_normals=True)
    print(f"已匯出 {path}")


bpy.ops.wm.read_factory_settings(use_empty=True)
for name in PREVIEW_COLORS:
    mat(name)
for kind, colors in PETS.items():
    for part, hex_color in colors.items():
        m = bpy.data.materials.new(part)  # 遊戲端依名稱辨識，同名材質在 glb 內各自獨立
        if hasattr(m, "use_nodes") and not m.use_nodes:
            m.use_nodes = True
        m.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = srgb(hex_color)
        MATS[f"{kind}_{part}"] = m

collections = {}
for name in ("person", *PETS):
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    collections[name] = coll
build_person(collections["person"])
for kind in PETS:
    build_pet(collections[kind], kind)

for name, coll in collections.items():
    export(coll, f"{name}.glb")

# ---------------------------------------------------------------- 預覽圖（選用）
if PREVIEW:
    scene = bpy.context.scene
    # Cycles 不剔除背面：描邊外殼朝向鏡頭的那面改成透明，才看得到裡面的顏色（只影響預覽，模型已匯出）
    nt = MATS["Outline"].node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    dark = nt.nodes.new("ShaderNodeEmission")
    dark.inputs["Color"].default_value = srgb(PREVIEW_COLORS["Outline"])
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    path = nt.nodes.new("ShaderNodeLightPath")
    either = nt.nodes.new("ShaderNodeMath")
    either.operation = "MAXIMUM"
    nt.links.new(geo.outputs["Backfacing"], either.inputs[0])
    nt.links.new(path.outputs["Is Shadow Ray"], either.inputs[1])  # 描邊不擋光
    nt.links.new(either.outputs["Value"], mix.inputs["Fac"])
    nt.links.new(dark.outputs["Emission"], mix.inputs[1])
    nt.links.new(clear.outputs["BSDF"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    offsets = {"person": -1.6, "cat": -0.5, "dog": 0.3, "hedgehog": 1.1, "otter": 1.9}
    for name, coll in collections.items():
        for obj in coll.objects:
            obj.location.x += offsets[name]
    # 預覽人物用「羽球愛好者」造型：刺刺短髮、眼鏡、羽球衣、白短褲白鞋
    for obj in collections["person"].objects:
        if obj.name.startswith(("Hair_short", "Hair_long", "Hair_bun", "Legwear_long")):
            obj.hide_render = True
    for name, hex_color in (("Outfit", "#2a2a30"), ("Shoe", "#f2f2f2"), ("Hair", "#1f1b1a")):
        MATS[name].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb(hex_color)
    bpy.ops.mesh.primitive_plane_add(size=20)
    bpy.context.object.data.materials.append(mat("Ground", "#d9e7c8"))
    sun = bpy.data.objects.new("太陽", bpy.data.lights.new("太陽", "SUN"))
    sun.data.energy = 3
    sun.data.angle = math.radians(15)
    sun.rotation_euler = (math.radians(45), 0, math.radians(30))
    scene.collection.objects.link(sun)
    world = bpy.data.worlds.new("天空")
    scene.world = world
    if hasattr(world, "use_nodes") and not world.use_nodes:
        world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = srgb("#f6efe4")
    cam = bpy.data.objects.new("攝影機", bpy.data.cameras.new("攝影機"))
    cam.location = (0.15, -6.5, 1.5)
    cam.rotation_euler = (math.radians(82), 0, 0)
    cam.data.lens = 38
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1600, 800
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    print(f"預覽圖：{PREVIEW}")
