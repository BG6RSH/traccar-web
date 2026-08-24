import { useSelector } from 'react-redux';
import useMapLayer from './core/useMapLayer';
import getSpeedColor from '../common/util/colors';
import { useAttributePreference } from '../common/util/preferences';
import { toMapCoordinates, toMapCoordinatesFrom } from './core/mapUtil';

const MapRoutePath = ({
  positions, lineDash, sourceCoordinateSystem, color, lineWidth, lineOpacity,
}) => {
  const reportColor = useSelector((state) => {
    const position = positions?.find(() => true);
    if (position) {
      const attributes = state.devices.items[position.deviceId]?.attributes;
      if (attributes) {
        const color = attributes['web.reportColor'];
        if (color) {
          return color;
        }
      }
    }
    return null;
  });

  const convert = sourceCoordinateSystem
    ? (lng, lat) => toMapCoordinatesFrom(lng, lat, sourceCoordinateSystem)
    : toMapCoordinates;

  const mapLineWidth = useAttributePreference('mapLineWidth', 2);
  const mapLineOpacity = useAttributePreference('mapLineOpacity', 1);

  const minSpeed = positions.map((p) => p.speed).reduce((a, b) => Math.min(a, b), Infinity);
  const maxSpeed = positions.map((p) => p.speed).reduce((a, b) => Math.max(a, b), -Infinity);
  const features = [];
  for (let i = 0; i < positions.length - 1; i += 1) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          convert(positions[i].longitude, positions[i].latitude),
          convert(positions[i + 1].longitude, positions[i + 1].latitude),
        ],
      },
      properties: {
        color: color || reportColor || getSpeedColor(positions[i + 1].speed, minSpeed, maxSpeed),
        width: lineWidth || mapLineWidth,
        opacity: lineOpacity || mapLineOpacity,
      },
    });
  }

  useMapLayer({
    layers: [
      {
        type: 'line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
          'line-opacity': ['get', 'opacity'],
          ...(lineDash ? { 'line-dasharray': lineDash } : {}),
        },
      },
    ],
    layersDeps: [],
    data: {
      type: 'FeatureCollection',
      features,
    },
    dataDeps: [positions, reportColor, mapLineWidth, mapLineOpacity, color, lineWidth, lineOpacity],
  });

  return null;
};

export default MapRoutePath;
