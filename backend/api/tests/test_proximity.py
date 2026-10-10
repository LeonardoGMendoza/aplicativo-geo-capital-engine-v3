import ast
import math
from pathlib import Path
import unittest
from unittest.mock import patch
from datetime import datetime, timezone
import httpx
from backend.api.geography import haversine_km, within_threshold
from backend.api.proximity import ASSETS, analyze_proximity
from backend.api.models import EventsResponse
from backend.api.nasa import normalize_events, NasaService
from backend.api.main import create_app

NOW = datetime(2026, 10, 9, 12, tzinfo=timezone.utc)
ROOT = Path(__file__).resolve().parents[3]

def raw(id='one', lon=-51.3, lat=-29.9, geometry=None):
    return dict(id=id, title=id, categories=[{'id':'floods','title':'Floods'}], geometry=geometry if geometry is not None else [{'type':'Point','coordinates':[lon,lat],'date':NOW.isoformat()}])

def envelope(rows, state=None):
    return EventsResponse(state=state or ('success' if rows else 'empty'), query={}, queriedAt=NOW, fetchedAt=NOW,
                          dataQuality='complete', events=normalize_events({'events':rows}, NOW, 86400))

def legacy_namespace():
    tree = ast.parse((ROOT / 'frontend/painel_ceo.py').read_text(encoding='utf-8-sig'))
    nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in ('calcular_distancia','ponto_evento','calcular_alertas_ativos') or isinstance(n, ast.Assign) and any(isinstance(t,ast.Name) and t.id=='mapa_dados' for t in n.targets)]
    namespace = {'math':math}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), '<isolated legacy functions>', 'exec'), namespace)
    return namespace

class GeographyTests(unittest.TestCase):
    def test_known_distances_and_invalid_coordinates(self):
        self.assertEqual(haversine_km(0,0,0,0), 0)
        self.assertAlmostEqual(haversine_km(0,0,0,1), 111.19492664, places=7)
        self.assertAlmostEqual(haversine_km(0,0,0,180), math.pi*6371)
        for coords in [(91,0,0,0),(0,181,0,0),(True,0,0,0),(math.nan,0,0,0),('1',0,0,0)]:
            with self.assertRaises(ValueError): haversine_km(*coords)

    def test_strict_500_600_boundaries(self):
        for radius in (500,600):
            self.assertFalse(within_threshold(radius,radius))
            self.assertTrue(within_threshold(math.nextafter(radius,0),radius))
            self.assertFalse(within_threshold(math.nextafter(radius,math.inf),radius))
        for distance, matches in [(500,1),(599.999,1),(600,0)]:
            with patch('backend.api.proximity.haversine_km',return_value=distance):
                self.assertEqual(len(analyze_proximity(envelope([raw()]), [ASSETS[-1]], NOW)['matches']),matches)

    def test_catalog_and_distance_selection_parity(self):
        old = legacy_namespace()
        self.assertEqual([(a['name'],a['coordinates']['latitude'],a['coordinates']['longitude'],a['communityDescription']) for a in ASSETS],[(a['ativo'],a['lat'],a['lon'],a['comunidade_vizinha']) for a in old['mapa_dados']])
        rows=[raw('far',lat=-28),raw('near'),raw('tie'),raw('polygon',geometry=[{'type':'Polygon','coordinates':[[[-120.5,36.1],[-120,36.1],[-120.5,36.1]]],'date':NOW.isoformat()}])]
        expected=old['calcular_alertas_ativos'](old['mapa_dados'],rows)
        actual=analyze_proximity(envelope(rows),ASSETS,NOW)
        self.assertEqual([(m['asset']['name'],m['event']['id']) for m in actual['matches']],[(m['ativo']['ativo'],m['evento']['id']) for m in expected])
        for a,e in zip(actual['matches'],expected): self.assertAlmostEqual(a['distanceKm'], e['dist'], places=9)
        self.assertFalse(actual['riskConfirmed'])

    def test_multiple_geometries_last_not_latest_date(self):
        rows=[raw(geometry=[{'type':'Point','coordinates':[0,0],'date':NOW.isoformat()},{'type':'Point','coordinates':[-51.3,-29.9],'date':'2020-01-01T00:00:00Z'}])]
        result=analyze_proximity(envelope(rows),[ASSETS[-1]],NOW)
        self.assertEqual(result['matches'][0]['distanceKm'],0)
        self.assertEqual(result['state'],'partial')

    def test_missing_unsupported_and_approximate(self):
        rows=[raw('missing',geometry=[]),raw('unsupported',geometry=[{'type':'LineString','coordinates':[[1,2],[3,4]]}]),raw('invalid',lat=999)]
        result=analyze_proximity(envelope(rows),ASSETS,NOW)
        self.assertEqual(result['state'],'blocked')
        self.assertEqual(result['evaluatedPairCount'],0)
        self.assertEqual({s['reason'] for s in result['skipped']},{'missing','unsupported','invalid'})
        data=envelope(rows+[raw('poly',geometry=[{'type':'Polygon','coordinates':[[[-51.3,-29.9],[-51,-29.9],[-51.3,-29.9]]],'date':NOW.isoformat()}])])
        self.assertTrue(analyze_proximity(data,[ASSETS[-1]],NOW)['matches'][0]['geometryApproximate'])

    def test_empty_far_unavailable_stale_and_mismatch(self):
        self.assertEqual(analyze_proximity(envelope([]),ASSETS,NOW)['state'],'empty')
        self.assertEqual(analyze_proximity(envelope([raw(lon=0,lat=0)]),[ASSETS[-1]],NOW)['state'],'empty')
        for state in ('unavailable','error','stale'):
            self.assertEqual(analyze_proximity(envelope([],state),ASSETS,NOW)['state'], 'blocked' if state=='stale' else 'unavailable')
        self.assertEqual(analyze_proximity(envelope([]),ASSETS,NOW.replace(year=2025))['state'],'blocked')

class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_endpoints_validation_cors_and_failure(self):
        async def upstream(request): return httpx.Response(200,json={'events':[raw()]})
        async with httpx.AsyncClient(transport=httpx.MockTransport(upstream)) as nasa:
            app=create_app(NasaService(nasa,utcnow=lambda:NOW))
            async with app.router.lifespan_context(app), httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
                catalog=await client.get('/api/v1/assets')
                self.assertEqual(len(catalog.json()['assets']),11)
                body={'targetIds':[ASSETS[-1]['id']],'expectedFetchedAt':NOW.isoformat()}
                self.assertEqual((await client.post('/api/v1/geography/proximity',json=body)).json()['matches'][0]['distanceKm'],0)
                for extra in ({'targetIds':['unknown']},{'policyId':'arbitrary-500'},{'radiusKm':100}):
                    self.assertEqual((await client.post('/api/v1/geography/proximity',json=body|extra)).status_code,422)
                self.assertEqual((await client.post('/api/v1/geography/proximity',json=body|{'expectedFetchedAt':'2025-01-01T00:00:00Z'})).status_code,409)
                preflight=await client.options('/api/v1/geography/proximity',headers={'Origin':'http://127.0.0.1:5173','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'})
                self.assertEqual(preflight.status_code,200)
                self.assertEqual((await client.get('/api/v1/communities')).status_code,404)
        async def fail(request): raise httpx.ReadTimeout('fixture')
        async with httpx.AsyncClient(transport=httpx.MockTransport(fail)) as nasa:
            app=create_app(NasaService(nasa,utcnow=lambda:NOW))
            async with app.router.lifespan_context(app), httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
                response=await client.post('/api/v1/geography/proximity',json=body)
                self.assertEqual(response.status_code,503)
                self.assertEqual(response.json()['state'],'unavailable')
