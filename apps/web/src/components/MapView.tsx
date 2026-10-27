import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl';
import { CATEGORIES, type IssueGeoJson } from '@eco/shared';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Coordinates { longitude: number; latitude: number }
interface FlyTo extends Coordinates { nonce: number }
interface Props {
  features: IssueGeoJson;
  picking: boolean;
  pinPosition: Coordinates | null;
  flyTo: FlyTo | null;
  onPick: (point: Coordinates) => void;
  onBounds: (bbox: string) => void;
  onIssueClick: (id: string) => void;
}

const empty: IssueGeoJson = { type: 'FeatureCollection', features: [] };
const mapStyle = import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

export default function MapView({ features, picking, pinPosition, flyTo, onPick, onBounds, onIssueClick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const pickRef = useRef(picking);
  const onPickRef = useRef(onPick);
  const onBoundsRef = useRef(onBounds);
  const onIssueClickRef = useRef(onIssueClick);
  const [mapError, setMapError] = useState(false);

  useEffect(() => { pickRef.current = picking; }, [picking]);
  useEffect(() => { onPickRef.current = onPick; }, [onPick]);
  useEffect(() => { onBoundsRef.current = onBounds; }, [onBounds]);
  useEffect(() => { onIssueClickRef.current = onIssueClick; }, [onIssueClick]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: mapStyle,
      center: [-46.633, -23.55],
      zoom: 11.8,
      minZoom: 3,
      maxZoom: 18,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    const notifyBounds = () => {
      const b = map.getBounds();
      if (!b) return;
      const w = Math.max(-180, b.getWest());
      const e = Math.min(180, b.getEast());
      const s = Math.max(-90, b.getSouth());
      const n = Math.min(90, b.getNorth());
      if (w < e && s < n) onBoundsRef.current([w, s, e, n].map(x => x.toFixed(5)).join(','));
    };

    map.on('load', () => {
      map.addSource('issues', { type: 'geojson', data: empty, cluster: true, clusterMaxZoom: 13, clusterRadius: 48 });
      map.addLayer({
        id: 'clusters', type: 'circle', source: 'issues', filter: ['has', 'point_count'],
        paint: { 'circle-color': '#174b44', 'circle-radius': ['step', ['get', 'point_count'], 22, 10, 29, 50, 37],
          'circle-opacity': 0.93, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 },
      });
      map.addLayer({
        id: 'cluster-label', type: 'symbol', source: 'issues', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13 },
        paint: { 'text-color': '#ffffff' },
      });
      const categoryColors: unknown[] = ['match', ['get', 'category']];
      for (const category of CATEGORIES) categoryColors.push(category.id, category.color);
      categoryColors.push('#607d8b');
      map.addLayer({
        id: 'issue-circles', type: 'circle', source: 'issues', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['case',['==',['get','lifecycleStatus'],'resolved'],'#718278',categoryColors] as never,
          'circle-radius': ['interpolate', ['linear'], ['get', 'reportsCount'], 1, 9, 5, 14, 20, 20, 50, 27],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.97,
        },
      });
      map.addLayer({
        id: 'issue-labels', type: 'symbol', source: 'issues', filter: ['!', ['has', 'point_count']],
        layout: { 'text-field': ['case',['==',['get','lifecycleStatus'],'resolved'],'✓',['to-string', ['get', 'reportsCount']]], 'text-size': 11,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'] },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#1e293b', 'text-halo-width': 0.35 },
      });
      notifyBounds();
    });
    map.on('moveend', notifyBounds);
    map.on('error', (evt) => { if (evt.error) setMapError(true); });
    map.on('click', 'issue-circles', e => {
      if (pickRef.current) return;
      const id = e.features?.[0]?.properties?.id;
      if (id) onIssueClickRef.current(String(id));
    });
    map.on('click', 'clusters', async e => {
      if (pickRef.current) return;
      const clusterId = e.features?.[0]?.properties?.cluster_id;
      if (!Number.isInteger(clusterId)) return;
      const source = map.getSource('issues') as GeoJSONSource;
      const center = (e.features?.[0]?.geometry as { type: 'Point'; coordinates: number[] })?.coordinates;
      if (!center) return;
      try {
        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({ center: [center[0]!, center[1]!], zoom });
      } catch { /* source may be replaced during zoom */ }
    });
    map.on('click', (e: MapMouseEvent) => {
      if (pickRef.current) onPickRef.current({ longitude: e.lngLat.lng, latitude: e.lngLat.lat });
    });
    for (const name of ['clusters', 'issue-circles', 'cluster-label', 'issue-labels']) {
      map.on('mouseenter', name, () => { map.getCanvas().style.cursor = pickRef.current ? 'crosshair' : 'pointer'; });
      map.on('mouseleave', name, () => { map.getCanvas().style.cursor = pickRef.current ? 'crosshair' : ''; });
    }
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => { const source = map.getSource('issues') as GeoJSONSource | undefined; if (source) void source.setData(features); };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [features]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = picking ? 'crosshair' : '';
  }, [picking]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.remove();
    markerRef.current = null;
    if (pinPosition) {
      const marker = document.createElement('div');
      marker.className = 'map-pick-marker';
      markerRef.current = new maplibregl.Marker({ element: marker, anchor: 'bottom' })
        .setLngLat([pinPosition.longitude, pinPosition.latitude]).addTo(map);
    }
  }, [pinPosition]);

  useEffect(() => {
    if (flyTo) mapRef.current?.flyTo({ center: [flyTo.longitude, flyTo.latitude], zoom: 15, speed: 1.2 });
  }, [flyTo]);

  return <>
    <div ref={container} className="map-canvas" role="application" aria-label="Mapa interativo de ocorrências ambientais" />
    {mapError && <div className="map-error">Não foi possível carregar uma parte do mapa. Verifique sua conexão e o provedor de tiles.</div>}
  </>;
}
