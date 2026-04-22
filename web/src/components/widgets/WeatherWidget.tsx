/**
 * Weather Widget - Display current weather and forecast
 */
import React from 'react';
import { useHAEntities } from '../../context/HAEntitiesContext';
import { useVisibility } from '../../hooks/useVisibility';
import type { WidgetProps } from '../../types';
import type { WidgetMetadata } from './metadata';

const WEATHER_ICONS: Record<string, string> = {
  'clear-night': '🌙', 'cloudy': '☁️', 'fog': '🌫️', 'hail': '🌨️',
  'lightning': '⛈️', 'lightning-rainy': '⛈️', 'partlycloudy': '⛅',
  'pouring': '🌧️', 'rainy': '🌧️', 'snowy': '❄️', 'snowy-rainy': '🌨️',
  'sunny': '☀️', 'windy': '💨', 'windy-variant': '💨', 'exceptional': '⚠️',
};

function getIcon(condition: string) { return WEATHER_ICONS[condition] || '❓'; }
function fmt(s: string) { return s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); }

export const WeatherWidgetMetadata: WidgetMetadata = {
  name: 'Weather',
  icon: 'WbSunny',
  category: 'display',
  description: 'Display current weather conditions and forecast',
  defaultSize: { w: 320, h: 220 },
  fields: [
    { name: 'width', type: 'number', label: 'Width', default: 320, min: 120, category: 'layout' },
    { name: 'height', type: 'number', label: 'Height', default: 220, min: 100, category: 'layout' },
    { name: 'entity_id', type: 'entity', label: 'Weather Entity', default: '', category: 'behavior' },
    { name: 'compactMode', type: 'checkbox', label: 'Compact Mode', default: false, category: 'behavior' },
    { name: 'showForecast', type: 'checkbox', label: 'Show Forecast', default: true, category: 'behavior' },
    { name: 'forecastDays', type: 'number', label: 'Forecast Days', default: 5, min: 2, max: 7, category: 'behavior' },
    { name: 'showHumidity', type: 'checkbox', label: 'Show Humidity', default: true, category: 'behavior' },
    { name: 'showWind', type: 'checkbox', label: 'Show Wind', default: true, category: 'behavior' },
    { name: 'showPressure', type: 'checkbox', label: 'Show Pressure', default: false, category: 'behavior' },
    { name: 'temperatureColor', type: 'color', label: 'Temperature Color', default: '#ffffff', category: 'style' },
    { name: 'conditionColor', type: 'color', label: 'Text Color', default: '#cccccc', category: 'style' },
  ],
};

const WeatherWidget: React.FC<WidgetProps> = ({ config }) => {
  const {
    entity_id = '',
    showForecast = true,
    forecastDays = 5,
    showHumidity = true,
    showWind = true,
    showPressure = false,
    compactMode = false,
    temperatureColor = '#ffffff',
    conditionColor = '#cccccc',
  } = config.config;

  const { getEntity } = useHAEntities();
  const entity = entity_id ? getEntity(entity_id) : null;
  const attrs = entity?.attributes ?? {};
  const isVisible = useVisibility(config.config.visibilityCondition);

  if (!isVisible) return null;

  const condition = entity?.state ?? 'sunny';
  const temp = attrs.temperature ?? '--';
  const tempUnit = attrs.temperature_unit || '°C';
  const humidity = attrs.humidity ?? '--';
  const windSpeed = attrs.wind_speed ?? '--';
  const windUnit = attrs.wind_speed_unit || 'm/s';
  const pressure = attrs.pressure ?? '--';
  const forecast: any[] = (attrs.forecast ?? []).slice(0, forecastDays);

  const base: React.CSSProperties = { width: '100%', height: '100%', boxSizing: 'border-box', userSelect: 'none' };

  if (compactMode) {
    return (
      <div style={{ ...base, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
        <div style={{ fontSize: 40 }}>{getIcon(condition)}</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: temperatureColor }}>{temp}{tempUnit}</div>
      </div>
    );
  }

  if (!showForecast) {
    return (
      <div style={{ ...base, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>{getIcon(condition)}</div>
        <div style={{ fontSize: 32, fontWeight: 'bold', color: temperatureColor, marginBottom: 4 }}>{temp}{tempUnit}</div>
        <div style={{ fontSize: 15, color: conditionColor, marginBottom: 10 }}>{fmt(condition)}</div>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: conditionColor }}>
          {showHumidity && <span>💧 {humidity}%</span>}
          {showWind && <span>💨 {windSpeed} {windUnit}</span>}
          {showPressure && <span>🌡️ {pressure} hPa</span>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...base, display: 'flex', padding: 10, gap: 10, overflow: 'hidden' }}>
      {/* Current */}
      <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 44 }}>{getIcon(condition)}</div>
        <div style={{ fontSize: 28, fontWeight: 'bold', color: temperatureColor, marginBottom: 2 }}>{temp}{tempUnit}</div>
        <div style={{ fontSize: 13, color: conditionColor, textAlign: 'center', marginBottom: 8 }}>{fmt(condition)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: conditionColor }}>
          {showHumidity && <span>💧 Humidity: {humidity}%</span>}
          {showWind && <span>💨 Wind: {windSpeed} {windUnit}</span>}
          {showPressure && <span>🌡️ Pressure: {pressure} hPa</span>}
        </div>
      </div>
      {/* Forecast */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto' }}>
        {forecast.map((item: any, i: number) => {
          const day = new Date(item.datetime).toLocaleDateString('en-US', { weekday: 'short' });
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '5px 8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, fontSize: 12,
            }}>
              <span style={{ flex: '0 0 34px', color: conditionColor }}>{day}</span>
              <span style={{ fontSize: 18 }}>{getIcon(item.condition)}</span>
              <span style={{ color: temperatureColor }}>{item.temperature}{tempUnit}</span>
              {item.templow !== undefined && (
                <span style={{ color: conditionColor, opacity: 0.7 }}>{item.templow}{tempUnit}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeatherWidget;
