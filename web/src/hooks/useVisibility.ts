/**
 * useVisibility — evaluates widget visibility conditions.
 *
 * Accepts:
 *  • A plain JS expression string — runs with `entities` map and `state()` helper
 *    e.g. `entities['light.hall'].state == 'on'`
 *         `state('input_boolean.dark_mode') != 'on'`
 *  • A VisibilityConfig object with typed Condition array
 *  • undefined / null / '' — widget is always visible
 */
import { useHAEntities } from '../context/HAEntitiesContext';
import type { VisibilityConfig, Condition } from '../types';

function testCondition(cond: Condition, getState: (id: string) => string | null): boolean {
  switch (cond.type) {
    case 'state': {
      const actual = getState(cond.source) ?? '';
      switch (cond.operator) {
        case '==': return actual === cond.value;
        case '!=': return actual !== cond.value;
        case 'contains': return actual.includes(cond.value);
        case 'starts_with': return actual.startsWith(cond.value);
        case 'ends_with': return actual.endsWith(cond.value);
        default: return false;
      }
    }
    case 'numeric_state': {
      const n = parseFloat(getState(cond.source) ?? 'NaN');
      if (isNaN(n)) return false;
      switch (cond.operator) {
        case '>': return n > cond.value;
        case '>=': return n >= cond.value;
        case '<': return n < cond.value;
        case '<=': return n <= cond.value;
        case '==': return n === cond.value;
        case '!=': return n !== cond.value;
        default: return false;
      }
    }
    case 'time': {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const hhmm = `${hh}:${mm}`;
      if (cond.after && hhmm < cond.after) return false;
      if (cond.before && hhmm >= cond.before) return false;
      if (cond.weekdays && !cond.weekdays.includes(now.getDay())) return false;
      return true;
    }
    case 'screen': {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (cond.min_width  !== undefined && w < cond.min_width)  return false;
      if (cond.max_width  !== undefined && w > cond.max_width)  return false;
      if (cond.min_height !== undefined && h < cond.min_height) return false;
      if (cond.max_height !== undefined && h > cond.max_height) return false;
      return true;
    }
    case 'and': return cond.conditions.every((c) => testCondition(c, getState));
    case 'or':  return cond.conditions.some( (c) => testCondition(c, getState));
    case 'not': return !testCondition(cond.conditions[0], getState);
    default: return true;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useVisibility(config: string | VisibilityConfig | undefined | null | any): boolean {
  const { entities, getState } = useHAEntities();

  if (!config || config === '') return true;

  if (typeof config === 'string') {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('entities', 'state', `"use strict"; return Boolean(${config});`);
      return fn(entities, (id: string) => getState(id) ?? '');
    } catch {
      return true; // on error, default to visible
    }
  }

  // VisibilityConfig object
  const { conditions = [], logic = 'and', defaultVisible = true } = config as VisibilityConfig;
  if (conditions.length === 0) return defaultVisible;
  return logic === 'and'
    ? conditions.every((c) => testCondition(c, getState))
    : conditions.some( (c) => testCondition(c, getState));
}
