"""Read-only geographic screening; panel's nearest rule, never risk classification."""
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from .geography import haversine_km, valid_coordinates, within_threshold, PANEL_RADIUS_KM
from .models import EventsResponse

DATASET_VERSION = 'panel-assets-v1'
ASSETS = json.loads(Path(__file__).with_name('assets.json').read_text(encoding='utf-8'))
POLICY = {'id': 'legacy-panel-assets-600-nearest', 'version': '1', 'radiusKm': PANEL_RADIUS_KM,
          'operator': 'lt', 'selection': 'nearest_per_target', 'sourceFile': 'frontend/painel_ceo.py'}


class ProximityRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    targetIds: list[str] = Field(min_length=1, max_length=11)
    policyId: Literal['legacy-panel-assets-600-nearest'] = 'legacy-panel-assets-600-nearest'
    expectedFetchedAt: datetime  # Guards against analyzing a different NASA response.


def analyze_proximity(data: EventsResponse, targets: list[dict], expected: datetime):
    result = dict(state='success', policy=POLICY, method='haversine_sphere_6371km', source=data.source,
                  sourceUrl=data.sourceUrl, eventsFetchedAt=data.fetchedAt, analyzedAt=datetime.now(timezone.utc),
                  datasetVersion=DATASET_VERSION, targetsAreReferenceData=True, isSimulation=False,
                  riskConfirmed=False, requiresHumanConfirmation=True, evaluatedPairCount=0,
                  integrationState=data.state, cache=data.cache, ageSeconds=data.ageSeconds,
                  matches=[], skipped=[], warnings=['Triagem geográfica não confirma risco ou segurança; não define rotas.'])
    if data.state in ('unavailable', 'error'):
        result.update(state='unavailable', warnings=result['warnings'] + ['Fonte NASA indisponível. Não significa ausência de proximidade.'])
        return result
    if data.state == 'stale' or expected.tzinfo is None or data.fetchedAt != expected:
        result.update(state='blocked', warnings=result['warnings'] + ['Cache desatualizado ou consulta diferente. Atualize o catálogo NASA antes de analisar.'])
        return result
    candidates = []
    for event in data.events:
        c = event.coordinates
        if event.coordinateState != 'available' or c is None or not valid_coordinates(c.latitude, c.longitude):
            result['skipped'].append({'eventId': event.id, 'reason': event.coordinateState if c is None else 'invalid'})
        else:
            candidates.append(event)
    for asset in targets:
        best = None
        for event in candidates:
            c, a = event.coordinates, asset['coordinates']
            distance = haversine_km(a['latitude'], a['longitude'], c.latitude, c.longitude)
            result['evaluatedPairCount'] += 1
            if within_threshold(distance, PANEL_RADIUS_KM) and (best is None or distance < best['distanceKm']):
                best = dict(asset=asset, event=event.model_dump(mode='json'), distanceKm=distance,
                            geometryApproximate=c.method == 'first_polygon_vertex', withinThreshold=True)
        if best is not None:
            result['matches'].append(best)
    result['matches'].sort(key=lambda match: match['distanceKm'])
    if any(e.observationState != 'recent' or not e.categories or e.coordinates.method != 'point' for e in candidates):
        result['warnings'].append('Há observações antigas/desconhecidas, categorias ausentes ou polígonos aproximados; a regra legada mantém esses eventos.')
    if data.events and not candidates:
        result['state'] = 'blocked'
    elif result['skipped'] or len(result['warnings']) > 1:
        result['state'] = 'partial'
    elif not result['matches']:
        result['state'] = 'empty'
    return result
