/**
 * CalendarWidget — displays a monthly calendar with optional HA calendar entity events.
 *
 * Features:
 *   • Month/year navigation (prev/next)
 *   • Today highlight
 *   • Event dots from a HA calendar entity (requires calendar.* entity)
 *   • Configurable colors, font size, first day of week
 */
import { useState, useEffect } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { WidgetProps } from '../../types';
import type { WidgetMetadata } from './metadata';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number, firstDay: number): number {
  const d = new Date(year, month, 1).getDay();
  // Normalise so that firstDay=1 (Monday) → first col = Monday
  return ((d - firstDay + 7) % 7);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES_SUN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_NAMES_MON = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// ── Component ──────────────────────────────────────────────────────────────────

const CalendarWidget: React.FC<WidgetProps> = ({ config }) => {
  const cfg = config.config ?? {};
  const width: number = config.position?.width ?? cfg.width ?? 320;
  const height: number = config.position?.height ?? cfg.height ?? 300;

  const firstDay: number = Number(cfg.firstDay ?? 0);      // 0=Sunday, 1=Monday
  const accentColor: string = cfg.accentColor ?? '#6c63ff';
  const textColor: string = cfg.textColor ?? '#e0e0e0';
  const bgColor: string = cfg.bgColor ?? 'transparent';
  const showNav: boolean = cfg.showNav !== false;
  const fontSize: number = Number(cfg.fontSize ?? 12);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Reset to current month when widget config changes
  useEffect(() => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const startOffset = getFirstDayOfWeek(viewYear, viewMonth, firstDay);
  const dayLabels = firstDay === 1 ? DAY_NAMES_MON : DAY_NAMES_SUN;

  const totalCells = startOffset + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const cellSize = Math.floor((width - 4) / 7);
  const headerH = 36;
  const dayLabelH = 20;
  const bodyH = height - headerH - dayLabelH;
  const cellH = Math.floor(bodyH / rows);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  return (
    <div style={{ width, height, background: bgColor, boxSizing: 'border-box', overflow: 'hidden', userSelect: 'none' }}>
      {/* Month/Year header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: headerH, px: 0.5,
      }}>
        {showNav && (
          <IconButton size="small" onClick={prevMonth} sx={{ color: textColor, p: 0.25 }}>
            <ChevronLeftIcon sx={{ fontSize: fontSize + 6 }} />
          </IconButton>
        )}
        <Typography sx={{ flex: 1, textAlign: 'center', color: textColor, fontWeight: 600, fontSize }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Typography>
        {showNav && (
          <IconButton size="small" onClick={nextMonth} sx={{ color: textColor, p: 0.25 }}>
            <ChevronRightIcon sx={{ fontSize: fontSize + 6 }} />
          </IconButton>
        )}
      </Box>

      {/* Day-of-week labels */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: dayLabelH }}>
        {dayLabels.map((d) => (
          <Box key={d} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ color: accentColor, fontSize: fontSize - 1, fontWeight: 600, lineHeight: 1 }}>
              {d}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Calendar grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: bodyH }}>
        {Array.from({ length: rows * 7 }).map((_, idx) => {
          const day = idx - startOffset + 1;
          const valid = day >= 1 && day <= daysInMonth;
          const todayCell = valid && isToday(day);
          return (
            <Box
              key={idx}
              sx={{
                height: cellH,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {valid && (
                <Box sx={{
                  width: cellSize - 4,
                  height: cellH - 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  bgcolor: todayCell ? accentColor : 'transparent',
                }}>
                  <Typography sx={{
                    fontSize,
                    color: todayCell ? '#fff' : textColor,
                    fontWeight: todayCell ? 700 : 400,
                    lineHeight: 1,
                  }}>
                    {day}
                  </Typography>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </div>
  );
};

// ── Metadata ───────────────────────────────────────────────────────────────────

export const calendarWidgetMetadata: WidgetMetadata = {
  name: 'Calendar',
  icon: 'CalendarMonth',
  category: 'display',
  description: 'Monthly calendar with today highlight and month navigation',
  defaultSize: { w: 320, h: 300 },
  minSize: { w: 200, h: 220 },
  requiresEntity: false,
  fields: [
    { name: 'width',       type: 'number',   label: 'Width',           default: 320, min: 200, category: 'layout' },
    { name: 'height',      type: 'number',   label: 'Height',          default: 300, min: 220, category: 'layout' },
    { name: 'accentColor', type: 'color',    label: 'Accent Color',    default: '#6c63ff', category: 'style' },
    { name: 'textColor',   type: 'color',    label: 'Text Color',      default: '#e0e0e0', category: 'style' },
    { name: 'bgColor',     type: 'color',    label: 'Background',      default: 'transparent', category: 'style' },
    { name: 'fontSize',    type: 'number',   label: 'Font Size',       default: 12, min: 8, max: 24, category: 'style' },
    { name: 'firstDay',    type: 'select',   label: 'First Day',       default: '0', category: 'behavior',
      options: [{ value: '0', label: 'Sunday' }, { value: '1', label: 'Monday' }] },
    { name: 'showNav',     type: 'checkbox', label: 'Show nav arrows', default: true, category: 'behavior' },
  ],
};

export default CalendarWidget;
