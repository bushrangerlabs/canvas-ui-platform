/**
 * Radio Button Widget - Single selection from multiple options
 */
import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import React from 'react';
import { useHAEntities } from '../../context/HAEntitiesContext';
import type { WidgetProps } from '../../types';
import type { WidgetMetadata } from './metadata';

export const RadioButtonWidgetMetadata: WidgetMetadata = {
  name: 'Radio Button',
  icon: 'RadioButtonChecked',
  category: 'control',
  description: 'Single selection from multiple options',
  defaultSize: { w: 200, h: 150 },
  fields: [
    { name: 'width', type: 'number', label: 'Width', default: 200, min: 100, category: 'layout' },
    { name: 'height', type: 'number', label: 'Height', default: 150, min: 80, category: 'layout' },
    { name: 'entity_id', type: 'entity', label: 'Entity ID', default: '', category: 'behavior' },
    { name: 'options', type: 'text', label: 'Options (comma-separated)', default: 'Option 1,Option 2,Option 3', category: 'behavior' },
    { name: 'values', type: 'text', label: 'Values (comma-separated)', default: '', category: 'behavior' },
    { name: 'orientation', type: 'select', label: 'Orientation', default: 'vertical', category: 'behavior',
      options: [{ value: 'vertical', label: 'Vertical' }, { value: 'horizontal', label: 'Horizontal' }] },
    { name: 'fontSize', type: 'number', label: 'Font Size', default: 14, min: 8, max: 24, category: 'style' },
    { name: 'textColor', type: 'color', label: 'Text Color', default: '#ffffff', category: 'style' },
    { name: 'activeColor', type: 'color', label: 'Active Color', default: '#2196f3', category: 'style' },
    { name: 'backgroundColor', type: 'color', label: 'Background Color', default: 'transparent', category: 'style' },
  ],
};

const RadioButtonWidget: React.FC<WidgetProps> = ({ config }) => {
  const {
    entity_id = '',
    options = 'Option 1,Option 2,Option 3',
    values = '',
    orientation = 'vertical',
    fontSize = 14,
    textColor = '#ffffff',
    activeColor = '#2196f3',
    backgroundColor = 'transparent',
  } = config.config;

  const { getEntity } = useHAEntities();
  const entity = entity_id ? getEntity(entity_id) : null;

  const optionsList = options.split(',').map((o: string) => o.trim());
  const valuesList = values ? values.split(',').map((v: string) => v.trim()) : optionsList;
  const currentValue = entity?.state ?? valuesList[0];

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    if (!entity_id) return;
    const domain = entity_id.split('.')[0];
    const service = domain === 'input_select' ? 'select_option' : 'set_value';
    const field = domain === 'input_select' ? 'option' : 'value';
    try {
      await fetch(`/api/ha/services/${domain}/${service}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id, [field]: newValue }),
      });
    } catch (e) {
      console.warn('[RadioButtonWidget] Service call failed:', e);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-start',
      padding: 8, backgroundColor, boxSizing: 'border-box' }}>
      <FormControl component="fieldset">
        <RadioGroup value={currentValue} onChange={handleChange} row={orientation === 'horizontal'}>
          {optionsList.map((option: string, index: number) => (
            <FormControlLabel
              key={valuesList[index]}
              value={valuesList[index]}
              control={<Radio sx={{ color: textColor, '&.Mui-checked': { color: activeColor }, p: 0.5 }} />}
              label={option}
              sx={{
                color: textColor,
                '& .MuiFormControlLabel-label': { fontFamily: 'inherit', fontSize: fontSize },
              }}
            />
          ))}
        </RadioGroup>
      </FormControl>
    </div>
  );
};

export default RadioButtonWidget;
