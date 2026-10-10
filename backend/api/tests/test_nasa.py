import asyncio
import sys
import unittest
from datetime import datetime, timezone

import httpx

from backend.api.main import create_app
from backend.api.nasa import NASA_QUERY, NasaService, Settings, normalize_events

NOW = datetime(2026, 10, 9, 12, tzinfo=timezone.utc)


def event(geometry=None):
    return {"id": "EONET-test", "title": "Evento de teste", "categories": [{"id": "floods", "title": "Floods"}],
            "geometry": geometry if geometry is not None else [{"type": "Point", "coordinates": [-51.3, -29.9], "date": "2026-10-09T11:00:00Z"}]}


class NormalizationTests(unittest.TestCase):
    def normalize(self, raw):
        return normalize_events({"events": [raw]}, NOW, 86400)[0]

    def test_point_preserves_lon_lat_order_and_fields(self):
        value = self.normalize(event())
        self.assertEqual((value.coordinates.latitude, value.coordinates.longitude), (-29.9, -51.3))
        self.assertEqual(value.categories[0].id, "floods")
        self.assertEqual(value.source, "NASA EONET")
        self.assertFalse(value.isSimulation)
        self.assertEqual(value.observationState, "recent")

    def test_polygon_uses_original_first_vertex_convention_not_centroid(self):
        value = self.normalize(event([{"type": "Polygon", "coordinates": [[[10, 20], [11, 20], [10, 20]]], "date": "2026-10-09T11:00:00Z"}]))
        self.assertEqual(value.coordinates.method, "first_polygon_vertex")
        self.assertEqual(value.coordinates.longitude, 10)

    def test_missing_geometries_and_coordinates_keep_event(self):
        for geometry in ([], [{}], [{"type": "Point"}], [{"type": "Point", "coordinates": None}]):
            with self.subTest(geometry=geometry):
                value = self.normalize(event(geometry))
                self.assertEqual(value.id, "EONET-test")
                self.assertIsNone(value.coordinates)
                self.assertEqual(value.coordinateState, "missing")

    def test_bad_coordinates_and_unknown_geometry(self):
        for coords in ([], [999, 30], [10, 100], [float("nan"), 20], [True, 30], ["10", "20"]):
            with self.subTest(coords=coords):
                value = self.normalize(event([{"type": "Point", "coordinates": coords}]))
                self.assertEqual(value.coordinateState, "invalid")
                self.assertIsNone(value.coordinates)
        for kind in ("LineString", "MultiPolygon", "MultiPoint"):
            self.assertEqual(self.normalize(event([{"type": kind, "coordinates": [[1, 2], [3, 4]]}])).coordinateState, "unsupported")

    def test_last_geometry_and_old_unknown_dates(self):
        raw = event([{"type": "Point", "coordinates": [1, 2]}, {"type": "Point", "coordinates": [3, 4], "date": "2020-01-01T00:00:00Z"}])
        value = self.normalize(raw)
        self.assertEqual(value.coordinates.longitude, 3)
        self.assertEqual(value.observationState, "outdated")
        for date in ("bad", "2026-10-09T10:00:00", "2099-01-01T00:00:00Z", None):
            self.assertEqual(self.normalize(event([{"date": date}])).observationState, "unknown")

    def test_invalid_envelope_is_not_empty_success(self):
        for payload in ({}, {"events": None}, {"events": [{}]}, [], {"events": [None]}):
            with self.assertRaises(ValueError):
                normalize_events(payload, NOW, 86400)
        self.assertEqual(normalize_events({"events": []}, NOW, 86400), [])


class ServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tick = 0
        self.calls = 0
        self.payload = {"events": [event()]}
        self.failure = None
        self.status = 200

        async def handler(request):
            self.calls += 1
            self.assertEqual(dict(request.url.params), NASA_QUERY)
            if self.failure:
                raise self.failure("fixture", request=request)
            return httpx.Response(self.status, json=self.payload)
        self.client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        self.service = NasaService(self.client, monotonic=lambda: self.tick, utcnow=lambda: NOW)

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_success_cache_and_concurrent_requests(self):
        results = await asyncio.gather(*(self.service.get_events() for _ in range(5)))
        self.assertEqual(self.calls, 1)
        self.assertEqual(results[0].cache, "miss")
        self.assertTrue(all(r.state == "success" for r in results))
        self.assertEqual(results[-1].cache, "fresh")

    async def test_empty_is_success_and_cached(self):
        self.payload = {"events": []}
        self.assertEqual((await self.service.get_events()).state, "empty")
        self.assertEqual((await self.service.get_events()).state, "empty")
        self.assertEqual(self.calls, 1)

    async def test_timeout_is_unavailable_and_retry_throttled(self):
        self.failure = httpx.ReadTimeout
        response = await self.service.get_events()
        self.assertEqual(response.state, "unavailable")
        self.assertEqual(response.error.code, "timeout")
        await self.service.get_events()
        self.assertEqual(self.calls, 1)
        self.tick = 31
        self.failure = None
        self.assertEqual((await self.service.get_events()).state, "success")

    async def test_http_and_network_errors_not_empty(self):
        self.status = 500
        self.assertEqual((await self.service.get_events()).state, "error")
        self.tick = 31
        self.failure = httpx.ConnectError
        response = await self.service.get_events()
        self.assertEqual(response.state, "unavailable")
        self.assertEqual(response.error.code, "network")

    async def test_invalid_response_is_error(self):
        self.payload = {"wrong": []}
        self.assertEqual((await self.service.get_events()).error.code, "invalid_response")

    async def test_invalid_json_is_not_empty(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, content=b"bad json"))) as client:
            self.assertEqual((await NasaService(client).get_events()).error.code, "invalid_response")

    async def test_total_timeout_is_bounded(self):
        async def slow(_):
            await asyncio.sleep(0.1)
            return httpx.Response(200, json={"events": []})
        async with httpx.AsyncClient(transport=httpx.MockTransport(slow)) as client:
            self.assertEqual((await NasaService(client, Settings(timeout_seconds=0.01)).get_events()).error.code, "timeout")

    async def test_stale_cache_on_failure_then_expired_data_withheld(self):
        await self.service.get_events()
        self.tick = 601
        self.failure = httpx.ReadTimeout
        response = await self.service.get_events()
        self.assertEqual(response.state, "stale")
        self.assertEqual(len(response.events), 1)
        self.assertEqual(response.ageSeconds, 601)
        self.assertEqual(response.error.code, "timeout")
        self.tick = 3601
        response = await self.service.get_events()
        self.assertEqual(response.state, "unavailable")
        self.assertEqual(response.events, [])
        self.assertIsNotNone(response.fetchedAt)

    async def test_stale_empty_cache_never_claims_empty_success(self):
        self.payload = {"events": []}
        await self.service.get_events()
        self.tick = 601
        self.failure = httpx.ReadTimeout
        self.assertEqual((await self.service.get_events()).state, "stale")

    async def test_partial_event_is_preserved(self):
        self.payload = {"events": [event([])]}
        response = await self.service.get_events()
        self.assertEqual(response.state, "success")
        self.assertEqual(response.dataQuality, "partial")
        self.assertEqual(len(response.events), 1)

    async def test_disabled_does_not_request_nasa(self):
        service = NasaService(self.client, Settings(enabled=False))
        self.assertEqual((await service.get_events()).error.code, "disabled")
        self.assertEqual(self.calls, 0)


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_endpoint_contracts_and_cors(self):
        calls = []
        async def handler(request):
            calls.append(request)
            return httpx.Response(200, json={"events": [event()]})
        upstream = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        service = NasaService(upstream, utcnow=lambda: NOW)
        app = create_app(service)
        async with app.router.lifespan_context(app), httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
            status = await client.get("/api/v1/status")
            self.assertEqual(status.status_code, 200)
            self.assertEqual(status.json()["nasa"]["state"], "unavailable")
            self.assertEqual(calls, [])
            response = await client.get("/api/v1/events", headers={"Origin": "http://127.0.0.1:5173"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["events"][0]["coordinates"]["latitude"], -29.9)
            self.assertEqual(response.headers["access-control-allow-origin"], "http://127.0.0.1:5173")
            self.assertNotIn("access-control-allow-origin", (await client.get("/api/v1/events", headers={"Origin": "https://untrusted.example"})).headers)
            self.assertFalse(response.json()["riskCalculated"])
            self.assertEqual((await client.get("/api/v1/status")).json()["nasa"]["state"], "success")
            preflight = await client.options("/api/v1/events", headers={"Origin": "http://127.0.0.1:5173", "Access-Control-Request-Method": "GET"})
            self.assertEqual(preflight.status_code, 200)
        await upstream.aclose()
        self.assertNotIn("streamlit", sys.modules)

    async def test_failed_queries_use_non_success_http_status(self):
        for code, expected in ((503, "error"), (200, "empty")):
            upstream = httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(code, json={"events": []})))
            app = create_app(NasaService(upstream))
            async with app.router.lifespan_context(app), httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
                response = await client.get("/api/v1/events")
                self.assertEqual(response.status_code, 502 if code == 503 else 200)
                self.assertEqual(response.json()["state"], expected)
            await upstream.aclose()
        upstream = httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200)))
        app = create_app(NasaService(upstream, Settings(enabled=False)))
        async with app.router.lifespan_context(app), httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
            self.assertEqual((await client.get("/api/v1/events")).status_code, 503)
        await upstream.aclose()


if __name__ == "__main__":
    unittest.main()
