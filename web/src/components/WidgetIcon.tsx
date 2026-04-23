/**
 * WidgetIcon — renders the MUI icon named in widget metadata.
 * Falls back to WidgetsIcon for unknown names.
 */
import type { SvgIconProps } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AlarmIcon from '@mui/icons-material/Alarm';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import BarChartIcon from '@mui/icons-material/BarChart';
import BorderOuterIcon from '@mui/icons-material/BorderOuter';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import DialpadOutlinedIcon from '@mui/icons-material/DialpadOutlined';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import HexagonOutlinedIcon from '@mui/icons-material/HexagonOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import LinearScaleOutlinedIcon from '@mui/icons-material/LinearScaleOutlined';
import MonitorOutlinedIcon from '@mui/icons-material/MonitorOutlined';
import PaletteIcon from '@mui/icons-material/Palette';
import PinIcon from '@mui/icons-material/Pin';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SpeedIcon from '@mui/icons-material/Speed';
import StarOutlinedIcon from '@mui/icons-material/StarOutlined';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import TextRotationNoneIcon from '@mui/icons-material/TextRotationNone';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import VideocamIcon from '@mui/icons-material/Videocam';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import WebIcon from '@mui/icons-material/Web';
import WidgetsIcon from '@mui/icons-material/Widgets';

const ICON_MAP: Record<string, React.ComponentType<SvgIconProps>> = {
  AccessTime: AccessTimeIcon,
  Alarm: AlarmIcon,
  AspectRatio: AspectRatioIcon,
  BarChart: BarChartIcon,
  BorderOuter: BorderOuterIcon,
  CodeOutlined: CodeOutlinedIcon,
  ColorLens: ColorLensIcon,
  DialpadOutlined: DialpadOutlinedIcon,
  DigitalClock: AlarmIcon,          // no MUI match → Alarm
  DonutLarge: DonutLargeIcon,
  FlipClock: AccessTimeIcon,        // no MUI match → AccessTime
  HexagonOutlined: HexagonOutlinedIcon,
  ImageOutlined: ImageOutlinedIcon,
  LinearScaleOutlined: LinearScaleOutlinedIcon,
  MonitorOutlined: MonitorOutlinedIcon,
  Palette: PaletteIcon,
  Pin: PinIcon,
  RadioButtonChecked: RadioButtonCheckedIcon,
  Schedule: ScheduleIcon,
  ShowChart: ShowChartIcon,
  Speed: SpeedIcon,
  StarOutlined: StarOutlinedIcon,
  TextFields: TextFieldsIcon,
  TextRotationNone: TextRotationNoneIcon,
  ToggleOnOutlined: ToggleOnOutlinedIcon,
  TouchApp: TouchAppIcon,
  TuneOutlined: TuneOutlinedIcon,
  Videocam: VideocamIcon,
  WbSunny: WbSunnyIcon,
  Web: WebIcon,
};

interface Props extends SvgIconProps {
  name: string;
}

export default function WidgetIcon({ name, ...props }: Props) {
  const Icon = ICON_MAP[name] ?? WidgetsIcon;
  return <Icon {...props} />;
}
