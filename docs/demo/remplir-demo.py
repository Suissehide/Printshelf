"""Remplit une instance Printshelf (http://localhost:4747) avec la démo : tags, collections, file, imprimantes,
plus un faux second ordinateur dans le dossier de synchro. Usage : python3 remplir-demo.py <bibliothèque> <dossier cloud>"""
import json, sys, time, urllib.request, os
LIB, CLOUD = sys.argv[1], sys.argv[2]
B = 'http://localhost:4747/api'
def call(method, path, body=None):
    req = urllib.request.Request(B + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json'} if body is not None else {})
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else None
call('POST', '/sources', {'path': LIB})
time.sleep(0.5)
while call('GET', '/scan')['running']:
    time.sleep(0.3)
by = {f['name']: f for f in call('GET', '/files')}
tags = {
    'Vase spirale.stl': ['déco', 'vase', 'mode vase'], 'Pot à plantes nervuré.stl': ['déco', 'jardin'],
    'Coupelle vide-poche.stl': ['déco', 'cadeau'], 'Nœud torique.stl': ['déco', 'cadeau'],
    'Engrenage 24 dents.stl': ['mécanique', 'pla'], 'Engrenage 12 dents.stl': ['mécanique', 'pla'],
    'Phare de jardin XXL.stl': ['jardin'], 'Pion.stl': ['jeu', 'échecs'], 'Tour.stl': ['jeu', 'échecs'],
    'Kit échecs bicolore.3mf': ['jeu', 'échecs', 'multicolore'],
}
for name, t in tags.items():
    call('PATCH', f"/metas/{by[name]['hash']}", {'tags': t})
for name in ['Vase spirale.stl', 'Kit échecs bicolore.3mf', 'Nœud torique.stl']:
    call('PATCH', f"/metas/{by[name]['hash']}", {'favorite': True})
call('PATCH', f"/metas/{by['Kit échecs bicolore.3mf']['hash']}", {'notes': 'Pièces en PLA blanc et bleu nuit, 0,16 mm. Brim de 3 mm pour les tours.'})
cols = [('Cadeaux de Noël', '#ff8a3d', ['Coupelle vide-poche.stl', 'Nœud torique.stl', 'Kit échecs bicolore.3mf']),
        ('Marché de printemps', '#4ade80', ['Vase spirale.stl', 'Pot à plantes nervuré.stl']),
        ('Réparations maison', '#60a5fa', ['Engrenage 24 dents.stl', 'Engrenage 12 dents.stl'])]
for name, color, models in cols:
    c = call('POST', '/collections', {'name': name, 'color': color})
    call('PUT', f"/collections/{c['id']}/models", {'hashes': [by[n]['hash'] for n in models], 'included': True})
for name, qty in [('Kit échecs bicolore.3mf', 2), ('Vase spirale.stl', 4), ('Pot à plantes nervuré.stl', 3), ('Nœud torique.stl', 1)]:
    call('POST', '/queue', {'hash': by[name]['hash'], 'name': name.rsplit('.', 1)[0], 'quantity': qty})
q = call('GET', '/queue')
call('PATCH', f"/queue/{q[0]['id']}", {'status': 'PRINTING'})
call('PATCH', f"/queue/{q[-1]['id']}", {'status': 'DONE'})
call('PUT', '/preferences/printers', [
    {'id': 'a1mini', 'name': 'Bambu Lab A1 mini', 'x': 180, 'y': 180, 'z': 180},
    {'id': 'p1s', 'name': 'Bambu Lab P1S', 'x': 256, 'y': 256, 'z': 256}])
call('PUT', '/preferences/slicers', {'defaultSlicerId': 'bambu-studio', 'tagRules': [{'tag': 'résine', 'slicerId': 'lychee-slicer'}]})
# Un second ordinateur qui a déjà envoyé deux modèles au slicer.
now = int(time.time() * 1000)
rows = []
for i, name in enumerate(['Kit échecs bicolore.3mf', 'Engrenage 24 dents.stl']):
    m = next(x for x in call('GET', '/metas') if x['hash'] == by[name]['hash'])
    rows.append({'id': m['hash'], 'tags': json.dumps(m['tags']), 'notes': m['notes'], 'favorite': int(m['favorite']),
                 'sent_at': now - i * 3_600_000, 'sent_count': 2 - i, 'updated_at': now + 1000, 'deleted': 0})
os.makedirs(os.path.join(CLOUD, 'printshelf-sync'), exist_ok=True)
json.dump({'version': 1, 'deviceId': 'pc-atelier', 'deviceName': 'PC-ATELIER', 'exportedAt': now,
           'tables': {'model_meta': rows}}, open(os.path.join(CLOUD, 'printshelf-sync', 'pc-atelier.json'), 'w'))
call('PUT', '/sync', {'folder': CLOUD})
time.sleep(1)
while call('GET', '/scan')['measuring']:
    time.sleep(0.3)
print(len(by), 'fichiers', len(call('GET', '/dimensions')), 'mesurés', sum(1 for m in call('GET', '/metas') if m['sentAt']), 'envoyés')
