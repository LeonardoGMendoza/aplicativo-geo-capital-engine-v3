import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_ALERT_ID, demoIndicators, demoMapShelters, demoShelters, demoSnapshot, demoWater, getDemoAlert, priorityAlerts, recommendationTitle, waterTimelineDescription } from '../src/features/operations/data/demo.ts'
import { visualDemo } from '../src/features/operations/data/visual-demo.ts'

test('alert context survives reordering: locality, recommendation, time and SVG position belong to the ID', () => {
  const expected = [
    ['demo-01', 'Região Central', '14:28', '25%', '35%', 'Revisar o cenário'],
    ['demo-02', 'Morro do Sol', '13:50', '17%', '56%', 'Revisar as condições operacionais'],
    ['demo-03', 'Rio Verde', '12:16', '56%', '47%', 'Conferir canais oficiais'],
  ]
  for (const catalog of [demoSnapshot.alerts, [...demoSnapshot.alerts].reverse()]) {
    for (const [id, location, time, left, top, recommendation] of expected) {
      const alert = getDemoAlert(id, catalog)
      assert.equal(alert.location.split(' · ')[0], location)
      assert.equal(recommendationTitle(alert), `Revisar aviso para ${location}`)
      assert.equal(alert.displayTime, time)
      assert.equal(alert.mapPosition.left, left)
      assert.equal(alert.mapPosition.top, top)
      assert.ok(alert.recommendation.startsWith(recommendation))
    }
  }
})

test('every central alert is selectable from the same catalog, with no fallback to the previous alert', () => {
  assert.equal(new Set(demoSnapshot.alerts.map(alert => alert.id)).size, demoSnapshot.alerts.length)
  assert.equal(getDemoAlert(DEFAULT_ALERT_ID).id, 'demo-01')
  for (const alert of demoSnapshot.alerts) {
    assert.equal(getDemoAlert(alert.id), alert)
    assert.ok(recommendationTitle(alert).includes(alert.location.split(' · ')[0]))
    assert.equal(alert.isSimulation, true)
  }
  assert.throws(() => getDemoAlert('missing'), /desconhecido/)
  assert.equal(getDemoAlert('demo-06').location, 'Vila Nova · fictícia')
  assert.equal(getDemoAlert('demo-06').mapPosition, undefined)
})

test('total alerts, priority subset and severity counters reconcile across the dashboard', () => {
  assert.equal(demoIndicators.totalAlerts, 6)
  assert.deepEqual(priorityAlerts.map(alert => alert.id), ['demo-01', 'demo-02', 'demo-03'])
  assert.equal(demoIndicators.criticalAlerts, 1)
  assert.equal(demoIndicators.attentionAlerts, 5)
  assert.equal(demoIndicators.criticalAlerts + demoIndicators.attentionAlerts, demoIndicators.totalAlerts)
  assert.equal(demoIndicators.priorityAlerts, priorityAlerts.length)
  assert.equal(demoIndicators.corporate.recommendations, priorityAlerts.length)
  assert.equal(visualDemo.criticalAreas, demoIndicators.criticalAlerts)
  assert.equal(visualDemo.attentionAreas, demoIndicators.attentionAlerts)
})

test('shelter and population scopes reconcile without claiming occupancy equals total population', () => {
  assert.equal(demoSnapshot.shelters, demoShelters.length)
  assert.equal(visualDemo.shelters, demoIndicators.shelters)
  assert.equal(visualDemo.sheltersList, demoShelters)
  assert.equal(demoMapShelters.length, 3)
  for (const shelter of demoMapShelters) assert.ok(demoShelters.includes(shelter))
  assert.equal(demoIndicators.shelterOccupancy, 1240)
  assert.equal(demoIndicators.people, 1800)
  assert.equal(demoIndicators.people, demoSnapshot.people)
  assert.equal(visualDemo.people, demoSnapshot.people.toLocaleString('pt-BR'))
  assert.equal(new Set(demoShelters.map(shelter => shelter.id)).size, demoShelters.length)
  for (const shelter of demoShelters) assert.ok(shelter.used >= 0 && shelter.used <= shelter.capacity)
  assert.ok(demoIndicators.shelterOccupancy <= demoIndicators.people)
  assert.equal(demoIndicators.realActions, 0)
  assert.equal(demoSnapshot.isSimulation, true)
})

test('camera, chart and accessible description share the same current water level and locality', () => {
  const now = demoWater.timeline.find(point => point.hour === 'Agora')
  assert.equal(now.level, 1.2)
  assert.equal(visualDemo.waterLevel, now.level)
  assert.equal(visualDemo.timeline, demoWater.timeline)
  assert.ok(waterTimelineDescription().includes('Rio Verde: Agora 1,2 m'))
  for (const point of demoWater.timeline) assert.ok(waterTimelineDescription().includes(`${point.hour} ${point.level.toLocaleString('pt-BR')} m`))
})
