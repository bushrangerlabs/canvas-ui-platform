/**
 * Graph Widget - Display sensor history as line, bar, or area charts
 */
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import React, { useEffect, useState } from 'react';
import { useHAEntities } from '../../context/HAEntitiesContext';
import { useVisibility } from '../../hooks/useVisibility';
import type { WidgetProps } from '../../types';
import type { WidgetMetadata } from './metadata';

export const GraphWidgetMetadata: WidgetMetadata = {
  name: 'Graph',
  icon: 'ShowChart',
  category: 'display',
  description: 'Display sensor history as line, bar, or area chart',
  defaultSize: { w: 400, h: 250 },
  fields: [
    { name: 'width', type: 'number', label: 'Width', default: 400, min: 200, category: 'layout' },
    { name: 'height', type: 'number', label: 'Height', default: 250, min: 150, category: 'layout' },
    { name: 'entity_id', type: 'entity', label: 'Entity ID', default: '', category: 'behavior' },
    { name: 'chartType', type: 'select', label: 'Chart Type', default: 'line', category: 'behavior',
      options: [
        { value: 'line', label: 'Line' },
        { value: 'bar', label: 'Bar' },
        { value: 'area', label: 'Area' },
      ]},
    { name: 'dataPoints', type: 'number', label: 'Max Data Points', default: 50, min: 5, max: 200, category: 'behavior' },
    { name: 'smooth', type: 'checkbox', label: 'Smooth Lines', default: true, category: 'behavior' },
    { name: 'showLegend', type: 'checkbox', label: 'Show Legend', default: true, category: 'behavior' },
    { name: 'showGrid', type: 'checkbox', label: 'Show Grid', default: true, category: 'behavior' },
    { name: 'lineColor', type: 'color', label: 'Line/Bar Color', default: '#2196f3', category: 'style' },
    { name: 'backgroundColor', type: 'color', label: 'Background', default: 'transparent', category: 'style' },
    { name: 'textColor', type: 'color', label: 'Text Color', default: '#ffffff', category: 'style' },
  ],
};

const GraphWidget: React.FC<WidgetProps> = ({ config }) => {
  const {
    entity_id = '',
    chartType = 'line',
    dataPoints = 50,
    smooth = true,
    showLegend = true,
    showGrid = true,
    lineColor = '#2196f3',
    backgroundColor = 'transparent',
    textColor = '#ffffff',
  } = config.config;

  const { getEntity } = useHAEntities();
  const entity = entity_id ? getEntity(entity_id) : null;
  const currentValue = entity ? parseFloat(entity.state) : NaN;
  const isVisible = useVisibility(config.config.visibilityCondition);

  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    if (!isNaN(currentValue)) {
      setHistory((prev) => [...prev, currentValue].slice(-dataPoints));
    }
  }, [currentValue, dataPoints]);

  const entityName = entity_id ? entity_id.split('.')[1]?.replace(/_/g, ' ') : 'Sensor';
  const unit = entity?.attributes?.unit_of_measurement ?? '';
  const xData = history.map((_, i) => i);

  const chartSx = {
    '& .MuiChartsAxis-line': { stroke: textColor },
    '& .MuiChartsAxis-tick': { stroke: textColor },
    '& .MuiChartsAxis-tickLabel': { fill: textColor },
    '& .MuiChartsGrid-line': { stroke: textColor, strokeOpacity: 0.15 },
    '& .MuiChartsLegend-mark': { fill: lineColor },
    '& .MuiChartsLegend-label': { fill: textColor },
  };

  const w = config.position.width ?? 400;
  const h = (config.position.height ?? 250) - 16;

  const empty = history.length === 0;

  if (!isVisible) return null;

  return (
    <div style={{
      width: '100%', height: '100%', backgroundColor,
      padding: 8, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
    }}>
      {empty ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textColor, opacity: 0.5, fontSize: 13 }}>
          {entity_id ? 'Waiting for data…' : 'Select an entity'}
        </div>
      ) : chartType === 'bar' ? (
        <BarChart width={w} height={h}
          series={[{ data: history, label: showLegend ? `${entityName} ${unit}`.trim() : undefined, color: lineColor }]}
          xAxis={[{ data: xData, scaleType: 'band' }]}
          grid={showGrid ? { horizontal: true } : undefined}
          slotProps={{ legend: showLegend ? { position: { vertical: 'top', horizontal: 'end' } } : undefined }}
          sx={chartSx}
        />
      ) : (
        <LineChart width={w} height={h}
          series={[{
            data: history,
            label: showLegend ? `${entityName} ${unit}`.trim() : undefined,
            color: lineColor,
            curve: smooth ? 'natural' : 'linear',
            area: chartType === 'area',
            showMark: history.length < 20,
          }]}
          xAxis={[{ data: xData, scaleType: 'point' }]}
          grid={showGrid ? { horizontal: true } : undefined}
          slotProps={{ legend: showLegend ? { position: { vertical: 'top', horizontal: 'end' } } : undefined }}
          sx={chartSx}
        />
      )}
    </div>
  );
};

export default GraphWidget;
