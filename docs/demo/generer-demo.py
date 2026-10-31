"""Bibliothèque de démonstration pour les captures du README (modèles générés, aucun fichier tiers)."""
import json
import math
import os
import shutil
import struct
import sys
import zipfile

import numpy as np

OUT = sys.argv[1]


def write_stl(path, tris):
    tris = np.asarray(tris, dtype=np.float32)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(b'Printshelf demo'.ljust(80, b' '))
        f.write(struct.pack('<I', len(tris)))
        for t in tris:
            n = np.cross(t[1] - t[0], t[2] - t[0])
            n = n / (np.linalg.norm(n) or 1)
            f.write(struct.pack('<12fH', *n, *t[0], *t[1], *t[2], 0))


def grid_mesh(P, closed_u=True):
    """P[i, j] : anneaux i le long de l'axe, j autour. Renvoie des triangles orientés vers l'extérieur."""
    tris = []
    rings, seg = P.shape[0], P.shape[1]
    for i in range(rings - 1):
        for j in range(seg if closed_u else seg - 1):
            a, b = P[i, j], P[i, (j + 1) % seg]
            c, d = P[i + 1, j], P[i + 1, (j + 1) % seg]
            tris += [[a, b, d], [a, d, c]]
    return tris


def cap(ring, center, flip):
    tris = []
    for j in range(len(ring)):
        a, b = ring[j], ring[(j + 1) % len(ring)]
        tris.append([center, b, a] if flip else [center, a, b])
    return tris


def lathe(profile, seg=96, twist=0.0, ribs=0, rib_depth=0.0):
    """Révolution d'un profil [(r, z)] ; torsion (radians sur la hauteur) et nervures optionnelles."""
    profile = np.asarray(profile, dtype=float)
    zmax = profile[:, 1].max()
    P = np.zeros((len(profile), seg, 3))
    for i, (r, z) in enumerate(profile):
        for j in range(seg):
            a = 2 * math.pi * j / seg + twist * z / zmax
            rr = r * (1 + (rib_depth * math.cos(ribs * (2 * math.pi * j / seg)) if ribs else 0))
            P[i, j] = [rr * math.cos(a), rr * math.sin(a), z]
    tris = grid_mesh(P)
    tris += cap(P[0], np.array([0, 0, profile[0, 1]]), flip=True)
    tris += cap(P[-1], np.array([0, 0, profile[-1, 1]]), flip=False)
    return tris


def extrude(outline, height):
    outline = np.asarray(outline, dtype=float)
    bottom = np.c_[outline, np.zeros(len(outline))]
    top = np.c_[outline, np.full(len(outline), height)]
    tris = grid_mesh(np.stack([bottom, top]))
    center = np.r_[outline.mean(axis=0), 0.0]
    tris += cap(bottom, center, flip=True)
    tris += cap(top, center + [0, 0, height], flip=False)
    return tris


def gear(teeth=24, module=2.5, height=8):
    r_pitch = teeth * module / 2
    pts = []
    for k in range(teeth):
        base = 2 * math.pi * k / teeth
        step = 2 * math.pi / teeth
        for frac, r in [(0.0, r_pitch - 1.25 * module), (0.18, r_pitch - 1.25 * module), (0.32, r_pitch + module),
                        (0.68, r_pitch + module), (0.82, r_pitch - 1.25 * module)]:
            a = base + frac * step
            pts.append((r * math.cos(a), r * math.sin(a)))
    return extrude(pts, height)


def torus_knot(p=2, q=3, R=28, r=10, tube=5, n=360, m=24):
    t = np.linspace(0, 2 * math.pi, n, endpoint=False)
    c = np.stack([(R + r * np.cos(q * t)) * np.cos(p * t), (R + r * np.cos(q * t)) * np.sin(p * t), r * np.sin(q * t)], 1)
    T = np.roll(c, -1, 0) - np.roll(c, 1, 0)
    T /= np.linalg.norm(T, axis=1)[:, None]
    N = np.cross(T, [0, 0, 1])
    N /= np.linalg.norm(N, axis=1)[:, None]
    B = np.cross(T, N)
    P = np.zeros((n, m, 3))
    for j in range(m):
        a = 2 * math.pi * j / m
        P[:, j] = c + tube * (math.cos(a) * N + math.sin(a) * B)
    P[:, :, 2] -= P[:, :, 2].min()
    tris = []
    for i in range(n):
        for j in range(m):
            a, b = P[i, j], P[i, (j + 1) % m]
            cc, d = P[(i + 1) % n, j], P[(i + 1) % n, (j + 1) % m]
            tris += [[a, d, b], [a, cc, d]]
    return tris


def translate(tris, dx=0, dy=0, dz=0):
    return (np.asarray(tris) + np.array([dx, dy, dz])).tolist()


PAWN = [(0, 0), (16, 0), (16, 4), (13, 6), (13, 8), (9, 11), (7, 22), (6, 30), (10, 32), (10, 34), (6, 35), (9, 40), (10, 45), (8, 51), (4, 54), (0, 55)]
ROOK = [(0, 0), (17, 0), (17, 4), (14, 6), (14, 8), (10, 12), (9, 34), (13, 36), (13, 48), (11, 48), (11, 44), (0, 44)]
VASE = [(0, 0), (30, 0), (38, 20), (42, 50), (34, 95), (24, 125), (26, 140), (30, 150), (28, 150), (0, 150)]
PLANTER = [(0, 0), (34, 0), (38, 4), (46, 70), (48, 74), (0, 74)]
BOWL = [(0, 0), (22, 0), (40, 12), (58, 34), (62, 46), (0, 46)]
TOWER = [(0, 0), (60, 0), (55, 120), (48, 320), (0, 320)]  # 320 mm : trop haute pour une A1 mini

models = {
    'Déco/Vase spirale.stl': lathe(VASE, seg=120, twist=math.pi * 0.9, ribs=12, rib_depth=0.06),
    'Déco/Pot à plantes nervuré.stl': lathe(PLANTER, seg=144, ribs=24, rib_depth=0.05),
    'Déco/Coupelle vide-poche.stl': lathe(BOWL, seg=120, twist=math.pi / 2, ribs=8, rib_depth=0.08),
    'Déco/Nœud torique.stl': torus_knot(),
    'Atelier/Engrenage 24 dents.stl': gear(24, 2.5, 8),
    'Atelier/Engrenage 12 dents.stl': gear(12, 2.5, 10),
    'Atelier/Phare de jardin XXL.stl': lathe(TOWER, seg=48, ribs=6, rib_depth=0.04),
    'Jeux/Échecs/Pion.stl': lathe(PAWN),
    'Jeux/Échecs/Tour.stl': lathe(ROOK, ribs=0),
}
for rel, tris in models.items():
    write_stl(os.path.join(OUT, rel), tris)

# Copies pour le détecteur de doublons : même contenu ailleurs, et un téléchargement renommé.
shutil.copy(os.path.join(OUT, 'Déco/Vase spirale.stl'), os.path.join(OUT, 'Déco/Vase spirale (1).stl'))
os.makedirs(os.path.join(OUT, 'Téléchargements'), exist_ok=True)
shutil.copy(os.path.join(OUT, 'Atelier/Engrenage 24 dents.stl'), os.path.join(OUT, 'Téléchargements/gear_24t_final.stl'))


# Pack ZIP (comme un pack Patreon) avec readme : parcouru sans extraction.
def stl_bytes(tris):
    path = os.path.join(OUT, '.tmp.stl')
    write_stl(path, tris)
    data = open(path, 'rb').read()
    os.remove(path)
    return data


with zipfile.ZipFile(os.path.join(OUT, 'Téléchargements/Pack Jeu de société.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('Pack Jeu de société/STL/Pion.stl', stl_bytes(lathe(PAWN, seg=64)))
    z.writestr('Pack Jeu de société/STL/Dé à jouer.stl', stl_bytes(lathe([(0, 0), (12, 0), (12, 24), (0, 24)], seg=4)))
    z.writestr('Pack Jeu de société/LISEZMOI.md', '# Pack jeu de société\n\nImprimer en 0,16 mm, sans supports.\n')


# Projet Bambu Studio à deux plateaux, deux filaments, plateau 1 tranché.
def mesh_xml(tris):
    verts, index, faces = [], {}, []
    for t in tris:
        ids = []
        for v in t:
            key = tuple(round(c, 4) for c in v)
            if key not in index:
                index[key] = len(verts)
                verts.append(key)
            ids.append(index[key])
        faces.append(ids)
    return ('<mesh><vertices>' + ''.join(f'<vertex x="{x}" y="{y}" z="{z}"/>' for x, y, z in verts)
            + '</vertices><triangles>' + ''.join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in faces)
            + '</triangles></mesh>')


NS = ('xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
      'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"')
pawn, rook = lathe(PAWN, seg=64), lathe(ROOK, seg=64)
board = extrude([(-60, -60), (60, -60), (60, 60), (-60, 60)], 4)
squares = []
for i in range(4):
    for j in range(4):
        if (i + j) % 2 == 0:
            x0, y0 = -60 + i * 30, -60 + j * 30
            squares += translate(extrude([(x0, y0), (x0 + 30, y0), (x0 + 30, y0 + 30), (x0, y0 + 30)], 1.2), dz=4)
with zipfile.ZipFile(os.path.join(OUT, 'Jeux/Échecs/Kit échecs bicolore.3mf'), 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('3D/Objects/object_1.model', f'<model {NS}><resources>'
               f'<object id="1" type="model">{mesh_xml(pawn)}</object>'
               f'<object id="3" type="model">{mesh_xml(rook)}</object>'
               f'<object id="5" type="model">{mesh_xml(board)}</object>'
               f'<object id="6" type="model">{mesh_xml(squares)}</object></resources></model>')
    items = []
    for k, x in enumerate([60, 100, 140, 180]):
        items.append(f'<item objectid="{10 + k}" transform="1 0 0 0 1 0 0 0 1 {x} 90 0"/>')
    items.append('<item objectid="20" transform="1 0 0 0 1 0 0 0 1 100 170 0"/>')
    items.append('<item objectid="21" transform="1 0 0 0 1 0 0 0 1 160 170 0"/>')
    items.append('<item objectid="30" transform="1 0 0 0 1 0 0 0 1 470 128 0"/>')
    objs = ''.join(f'<object id="{10 + k}" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="1"/></components></object>' for k in range(4))
    objs += ''.join(f'<object id="{i}" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="3"/></components></object>' for i in (20, 21))
    objs += ('<object id="30" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="5"/>'
             '<component p:path="/3D/Objects/object_1.model" objectid="6"/></components></object>')
    z.writestr('3D/3dmodel.model', f'<model {NS}><resources>{objs}</resources><build>{"".join(items)}</build></model>')
    settings = ['<?xml version="1.0" encoding="UTF-8"?>\n<config>']
    for k in range(4):
        settings.append(f'<object id="{10 + k}"><metadata key="name" value="Pion {k + 1}"/><metadata key="extruder" value="{1 + k % 2}"/></object>')
    for n, i in enumerate((20, 21)):
        settings.append(f'<object id="{i}"><metadata key="name" value="Tour {n + 1}"/><metadata key="extruder" value="{1 + n % 2}"/></object>')
    settings.append('<object id="30"><metadata key="name" value="Plateau de jeu"/><metadata key="extruder" value="1"/>'
                    '<part id="5" subtype="normal_part"><metadata key="name" value="Base"/></part>'
                    '<part id="6" subtype="normal_part"><metadata key="name" value="Cases"/><metadata key="extruder" value="2"/></part></object>')
    inst = lambda oid: f'<model_instance><metadata key="object_id" value="{oid}"/><metadata key="instance_id" value="0"/></model_instance>'
    settings.append('<plate><metadata key="plater_id" value="1"/><metadata key="plater_name" value="Pièces"/>'
                    + ''.join(inst(o) for o in (10, 11, 12, 13, 20, 21)) + '</plate>')
    settings.append('<plate><metadata key="plater_id" value="2"/><metadata key="plater_name" value="Plateau"/>' + inst(30) + '</plate>')
    settings.append('</config>')
    z.writestr('Metadata/model_settings.config', '\n'.join(settings))
    z.writestr('Metadata/project_settings.config', json.dumps({
        'filament_colour': ['#F2EFE9', '#2B2D42'], 'filament_type': ['PLA', 'PLA'],
        'printer_model': 'Bambu Lab P1S', 'layer_height': '0.16'}))
    z.writestr('Metadata/slice_info.config', '<?xml version="1.0" encoding="UTF-8"?><config>'
               '<plate><metadata key="index" value="1"/><metadata key="prediction" value="9420"/><metadata key="weight" value="41.7"/>'
               '<filament id="1" type="PLA" color="#F2EFE9" used_m="7.1" used_g="21.3"/>'
               '<filament id="2" type="PLA" color="#2B2D42" used_m="6.8" used_g="20.4"/></plate>'
               '<plate><metadata key="index" value="2"/><metadata key="prediction" value="6180"/><metadata key="weight" value="58.2"/>'
               '<filament id="1" type="PLA" color="#F2EFE9" used_m="12.9" used_g="38.6"/>'
               '<filament id="2" type="PLA" color="#2B2D42" used_m="6.5" used_g="19.6"/></plate></config>')

print('ok', sum(len(files) for _, _, files in os.walk(OUT)), 'fichiers')
