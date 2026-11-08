import { forwardRef, type SVGProps, type ComponentType } from "react";
import {
  Grid20Regular as WinGrid2x2,
  Grid20Filled as WinGrid2x2Filled,
} from "@fluentui/react-icons";
import {
  TextBulletListLtr20Regular as WinList,
  TextBulletListLtr20Filled as WinListFilled,
} from "@fluentui/react-icons";
import {
  DataBarVertical20Regular as WinBarChart2,
  DataBarVertical20Filled as WinBarChart2Filled,
} from "@fluentui/react-icons";
import { Add20Regular as WinPlus, Add20Filled as WinPlusFilled } from "@fluentui/react-icons";
import {
  Games20Regular as WinGamepad2,
  Games20Filled as WinGamepad2Filled,
} from "@fluentui/react-icons";
import {
  Sparkle20Regular as WinSparkles,
  Sparkle20Filled as WinSparklesFilled,
} from "@fluentui/react-icons";
import {
  Settings20Regular as WinSettings,
  Settings20Filled as WinSettingsFilled,
} from "@fluentui/react-icons";
import {
  People20Regular as WinUsers,
  People20Filled as WinUsersFilled,
} from "@fluentui/react-icons";
import {
  CalendarLtr20Regular as WinCalendar,
  CalendarLtr20Filled as WinCalendarFilled,
} from "@fluentui/react-icons";
import {
  CheckmarkCircle20Regular as WinCheckCircle2,
  CheckmarkCircle20Filled as WinCheckCircle2Filled,
} from "@fluentui/react-icons";
import {
  Info20Regular as WinAlertCircle,
  Info20Filled as WinAlertCircleFilled,
} from "@fluentui/react-icons";
import {
  SpinnerIos20Regular as WinLoader2,
  SpinnerIos20Filled as WinLoader2Filled,
} from "@fluentui/react-icons";
import { Clock20Regular as WinClock, Clock20Filled as WinClockFilled } from "@fluentui/react-icons";
import {
  ArrowSync20Regular as WinRefreshCw,
  ArrowSync20Filled as WinRefreshCwFilled,
} from "@fluentui/react-icons";
import { Play20Regular as WinPlay, Play20Filled as WinPlayFilled } from "@fluentui/react-icons";
import {
  ChevronDown20Regular as WinChevronDown,
  ChevronDown20Filled as WinChevronDownFilled,
} from "@fluentui/react-icons";
import {
  ChevronRight20Regular as WinChevronRight,
  ChevronRight20Filled as WinChevronRightFilled,
} from "@fluentui/react-icons";
import {
  BookOpen20Regular as WinBookOpen,
  BookOpen20Filled as WinBookOpenFilled,
} from "@fluentui/react-icons";
import { Flash20Regular as WinZap, Flash20Filled as WinZapFilled } from "@fluentui/react-icons";
import {
  BrainCircuit20Regular as WinBrain,
  BrainCircuit20Filled as WinBrainFilled,
} from "@fluentui/react-icons";
import { Star20Regular as WinStar, Star20Filled as WinStarFilled } from "@fluentui/react-icons";
import { Cube20Regular as WinDices, Cube20Filled as WinDicesFilled } from "@fluentui/react-icons";
import { Eye20Regular as WinEye, Eye20Filled as WinEyeFilled } from "@fluentui/react-icons";
import {
  Trophy20Regular as WinTrophy,
  Trophy20Filled as WinTrophyFilled,
} from "@fluentui/react-icons";
import {
  Search20Regular as WinSearch,
  Search20Filled as WinSearchFilled,
} from "@fluentui/react-icons";
import {
  ChevronLeft20Regular as WinChevronLeft,
  ChevronLeft20Filled as WinChevronLeftFilled,
} from "@fluentui/react-icons";
import {
  MoreHorizontal20Regular as WinMoreHorizontal,
  MoreHorizontal20Filled as WinMoreHorizontalFilled,
} from "@fluentui/react-icons";
import {
  ReOrderDotsVertical20Regular as WinGripVertical,
  ReOrderDotsVertical20Filled as WinGripVerticalFilled,
} from "@fluentui/react-icons";
import {
  Delete20Regular as WinTrash2,
  Delete20Filled as WinTrash2Filled,
} from "@fluentui/react-icons";
import {
  Share20Regular as WinShare2,
  Share20Filled as WinShare2Filled,
} from "@fluentui/react-icons";
import {
  Checkmark20Regular as WinCheck,
  Checkmark20Filled as WinCheckFilled,
} from "@fluentui/react-icons";
import { Edit20Regular as WinEdit3, Edit20Filled as WinEdit3Filled } from "@fluentui/react-icons";
import {
  ArrowSort20Regular as WinArrowUpDown,
  ArrowSort20Filled as WinArrowUpDownFilled,
} from "@fluentui/react-icons";
import { Dismiss20Regular as WinX, Dismiss20Filled as WinXFilled } from "@fluentui/react-icons";
import { Flag20Regular as WinFlag, Flag20Filled as WinFlagFilled } from "@fluentui/react-icons";
import {
  Open20Regular as WinExternalLink,
  Open20Filled as WinExternalLinkFilled,
} from "@fluentui/react-icons";
import {
  Filter20Regular as WinFilter,
  Filter20Filled as WinFilterFilled,
} from "@fluentui/react-icons";
import {
  CheckboxChecked20Regular as WinCheckSquare,
  CheckboxChecked20Filled as WinCheckSquareFilled,
} from "@fluentui/react-icons";
import {
  Pulse20Regular as WinActivity,
  Pulse20Filled as WinActivityFilled,
} from "@fluentui/react-icons";
import {
  NumberSymbol20Regular as WinHash,
  NumberSymbol20Filled as WinHashFilled,
} from "@fluentui/react-icons";
import {
  Layer20Regular as WinLayers,
  Layer20Filled as WinLayersFilled,
} from "@fluentui/react-icons";
import {
  ArrowUpload20Regular as WinUpload,
  ArrowUpload20Filled as WinUploadFilled,
} from "@fluentui/react-icons";
import { Fire20Regular as WinFlame, Fire20Filled as WinFlameFilled } from "@fluentui/react-icons";
import {
  AddCircle20Regular as WinPlusCircle,
  AddCircle20Filled as WinPlusCircleFilled,
} from "@fluentui/react-icons";
import {
  ArrowRight20Regular as WinArrowRight,
  ArrowRight20Filled as WinArrowRightFilled,
} from "@fluentui/react-icons";
import {
  Ribbon20Regular as WinAward,
  Ribbon20Filled as WinAwardFilled,
} from "@fluentui/react-icons";
import {
  Library20Regular as WinLibrary,
  Library20Filled as WinLibraryFilled,
} from "@fluentui/react-icons";
import {
  Shield20Regular as WinSword,
  Shield20Filled as WinSwordFilled,
} from "@fluentui/react-icons";
import {
  CompassNorthwest20Regular as WinCompass,
  CompassNorthwest20Filled as WinCompassFilled,
} from "@fluentui/react-icons";
import {
  Desktop20Regular as WinMonitor,
  Desktop20Filled as WinMonitorFilled,
} from "@fluentui/react-icons";
import {
  LockClosed20Regular as WinLock,
  LockClosed20Filled as WinLockFilled,
} from "@fluentui/react-icons";
import {
  Color20Regular as WinPalette,
  Color20Filled as WinPaletteFilled,
} from "@fluentui/react-icons";
import {
  WeatherSunny20Regular as WinSun,
  WeatherSunny20Filled as WinSunFilled,
} from "@fluentui/react-icons";
import {
  WeatherMoon20Regular as WinMoon,
  WeatherMoon20Filled as WinMoonFilled,
} from "@fluentui/react-icons";
import {
  ArrowDownload20Regular as WinDownload,
  ArrowDownload20Filled as WinDownloadFilled,
} from "@fluentui/react-icons";
import {
  Warning20Regular as WinAlertTriangle,
  Warning20Filled as WinAlertTriangleFilled,
} from "@fluentui/react-icons";
import {
  Database20Regular as WinDatabase,
  Database20Filled as WinDatabaseFilled,
} from "@fluentui/react-icons";
import {
  PlayCircle20Regular as WinPlayCircle,
  PlayCircle20Filled as WinPlayCircleFilled,
} from "@fluentui/react-icons";
import {
  StarHalf20Regular as WinStarHalf,
  StarHalf20Filled as WinStarHalfFilled,
} from "@fluentui/react-icons";
import {
  Keyboard20Regular as WinCommand,
  Keyboard20Filled as WinCommandFilled,
} from "@fluentui/react-icons";
import {
  Circle20Regular as WinCircle,
  Circle20Filled as WinCircleFilled,
} from "@fluentui/react-icons";
import { Heart20Regular as WinHeart, Heart20Filled as WinHeartFilled } from "@fluentui/react-icons";
import { Copy20Regular as WinCopy, Copy20Filled as WinCopyFilled } from "@fluentui/react-icons";
import {
  DocumentText20Regular as WinFileText,
  DocumentText20Filled as WinFileTextFilled,
} from "@fluentui/react-icons";
import { Image20Regular as WinImage, Image20Filled as WinImageFilled } from "@fluentui/react-icons";
type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  absoluteStrokeWidth?: boolean;
};
function fluentIcon(
  WindowsIcon: ComponentType<SVGProps<SVGSVGElement>>,
  FilledIcon?: ComponentType<SVGProps<SVGSVGElement>>
) {
  return forwardRef<SVGSVGElement, IconProps>(function FluentIcon(
    {
      size = 20,
      strokeWidth: _strokeWidth,
      absoluteStrokeWidth: _absoluteStrokeWidth,
      style,
      fill,
      ...props
    },
    ref
  ) {
    const Icon = fill && fill !== "none" && FilledIcon ? FilledIcon : WindowsIcon;
    return (
      <Icon {...props} ref={ref} style={{ width: size, height: size, flexShrink: 0, ...style }} />
    );
  });
}
export const Grid2x2 = /*#__PURE__*/ fluentIcon(WinGrid2x2, WinGrid2x2Filled);
export const List = /*#__PURE__*/ fluentIcon(WinList, WinListFilled);
export const BarChart2 = /*#__PURE__*/ fluentIcon(WinBarChart2, WinBarChart2Filled);
export const Plus = /*#__PURE__*/ fluentIcon(WinPlus, WinPlusFilled);
export const Gamepad2 = /*#__PURE__*/ fluentIcon(WinGamepad2, WinGamepad2Filled);
export const Sparkles = /*#__PURE__*/ fluentIcon(WinSparkles, WinSparklesFilled);
export const Settings = /*#__PURE__*/ fluentIcon(WinSettings, WinSettingsFilled);
export const Users = /*#__PURE__*/ fluentIcon(WinUsers, WinUsersFilled);
export const Calendar = /*#__PURE__*/ fluentIcon(WinCalendar, WinCalendarFilled);
export const CheckCircle2 = /*#__PURE__*/ fluentIcon(WinCheckCircle2, WinCheckCircle2Filled);
export const AlertCircle = /*#__PURE__*/ fluentIcon(WinAlertCircle, WinAlertCircleFilled);
export const Loader2 = /*#__PURE__*/ fluentIcon(WinLoader2, WinLoader2Filled);
export const Clock = /*#__PURE__*/ fluentIcon(WinClock, WinClockFilled);
export const RefreshCw = /*#__PURE__*/ fluentIcon(WinRefreshCw, WinRefreshCwFilled);
export const Play = /*#__PURE__*/ fluentIcon(WinPlay, WinPlayFilled);
export const ChevronDown = /*#__PURE__*/ fluentIcon(WinChevronDown, WinChevronDownFilled);
export const ChevronRight = /*#__PURE__*/ fluentIcon(WinChevronRight, WinChevronRightFilled);
export const BookOpen = /*#__PURE__*/ fluentIcon(WinBookOpen, WinBookOpenFilled);
export const Zap = /*#__PURE__*/ fluentIcon(WinZap, WinZapFilled);
export const Brain = /*#__PURE__*/ fluentIcon(WinBrain, WinBrainFilled);
export const Star = /*#__PURE__*/ fluentIcon(WinStar, WinStarFilled);
export const Dices = /*#__PURE__*/ fluentIcon(WinDices, WinDicesFilled);
export const Eye = /*#__PURE__*/ fluentIcon(WinEye, WinEyeFilled);
export const Trophy = /*#__PURE__*/ fluentIcon(WinTrophy, WinTrophyFilled);
export const Search = /*#__PURE__*/ fluentIcon(WinSearch, WinSearchFilled);
export const ChevronLeft = /*#__PURE__*/ fluentIcon(WinChevronLeft, WinChevronLeftFilled);
export const MoreHorizontal = /*#__PURE__*/ fluentIcon(WinMoreHorizontal, WinMoreHorizontalFilled);
export const GripVertical = /*#__PURE__*/ fluentIcon(WinGripVertical, WinGripVerticalFilled);
export const Trash2 = /*#__PURE__*/ fluentIcon(WinTrash2, WinTrash2Filled);
export const Share2 = /*#__PURE__*/ fluentIcon(WinShare2, WinShare2Filled);
export const Check = /*#__PURE__*/ fluentIcon(WinCheck, WinCheckFilled);
export const Edit3 = /*#__PURE__*/ fluentIcon(WinEdit3, WinEdit3Filled);
export const ArrowUpDown = /*#__PURE__*/ fluentIcon(WinArrowUpDown, WinArrowUpDownFilled);
export const X = /*#__PURE__*/ fluentIcon(WinX, WinXFilled);
export const Flag = /*#__PURE__*/ fluentIcon(WinFlag, WinFlagFilled);
export const ExternalLink = /*#__PURE__*/ fluentIcon(WinExternalLink, WinExternalLinkFilled);
export const Filter = /*#__PURE__*/ fluentIcon(WinFilter, WinFilterFilled);
export const CheckSquare = /*#__PURE__*/ fluentIcon(WinCheckSquare, WinCheckSquareFilled);
export const Activity = /*#__PURE__*/ fluentIcon(WinActivity, WinActivityFilled);
export const Hash = /*#__PURE__*/ fluentIcon(WinHash, WinHashFilled);
export const Layers = /*#__PURE__*/ fluentIcon(WinLayers, WinLayersFilled);
export const Upload = /*#__PURE__*/ fluentIcon(WinUpload, WinUploadFilled);
export const Flame = /*#__PURE__*/ fluentIcon(WinFlame, WinFlameFilled);
export const PlusCircle = /*#__PURE__*/ fluentIcon(WinPlusCircle, WinPlusCircleFilled);
export const ArrowRight = /*#__PURE__*/ fluentIcon(WinArrowRight, WinArrowRightFilled);
export const Award = /*#__PURE__*/ fluentIcon(WinAward, WinAwardFilled);
export const Library = /*#__PURE__*/ fluentIcon(WinLibrary, WinLibraryFilled);
export const Sword = /*#__PURE__*/ fluentIcon(WinSword, WinSwordFilled);
export const Compass = /*#__PURE__*/ fluentIcon(WinCompass, WinCompassFilled);
export const Monitor = /*#__PURE__*/ fluentIcon(WinMonitor, WinMonitorFilled);
export const Lock = /*#__PURE__*/ fluentIcon(WinLock, WinLockFilled);
export const Palette = /*#__PURE__*/ fluentIcon(WinPalette, WinPaletteFilled);
export const Sun = /*#__PURE__*/ fluentIcon(WinSun, WinSunFilled);
export const Moon = /*#__PURE__*/ fluentIcon(WinMoon, WinMoonFilled);
export const Download = /*#__PURE__*/ fluentIcon(WinDownload, WinDownloadFilled);
export const AlertTriangle = /*#__PURE__*/ fluentIcon(WinAlertTriangle, WinAlertTriangleFilled);
export const Database = /*#__PURE__*/ fluentIcon(WinDatabase, WinDatabaseFilled);
export const PlayCircle = /*#__PURE__*/ fluentIcon(WinPlayCircle, WinPlayCircleFilled);
export const StarHalf = /*#__PURE__*/ fluentIcon(WinStarHalf, WinStarHalfFilled);
export const Command = /*#__PURE__*/ fluentIcon(WinCommand, WinCommandFilled);
export const Circle = /*#__PURE__*/ fluentIcon(WinCircle, WinCircleFilled);
export const Heart = /*#__PURE__*/ fluentIcon(WinHeart, WinHeartFilled);
export const Copy = /*#__PURE__*/ fluentIcon(WinCopy, WinCopyFilled);
export const FileText = /*#__PURE__*/ fluentIcon(WinFileText, WinFileTextFilled);
export const Image = /*#__PURE__*/ fluentIcon(WinImage, WinImageFilled);
