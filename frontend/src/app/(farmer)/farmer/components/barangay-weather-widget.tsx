"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  ExternalLink,
  MapPin,
  Navigation,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Wind,
} from "lucide-react";

// --- Padre Garcia 18 Barangay Centroid Coordinates ---
export const PADRE_GARCIA_CENTROIDS: Record<string, [number, number]> = {
  Banaba: [13.887, 121.2395],
  Banaybanay: [13.891, 121.222],
  Bawi: [13.886, 121.251],
  Bukal: [13.885, 121.264],
  Castillo: [13.881, 121.221],
  Cawongan: [13.896, 121.2],
  Manggas: [13.901, 121.218],
  "Maugat East": [13.856, 121.228],
  "Maugat West": [13.859, 121.206],
  Pansol: [13.8785, 121.2438],
  Payapa: [13.87, 121.219],
  Poblacion: [13.872, 121.201],
  "Quilo-quilo North": [13.88, 121.193],
  "Quilo-quilo South": [13.876, 121.181],
  "San Felipe": [13.853, 121.251],
  "San Miguel": [13.846, 121.226],
  Tamak: [13.851, 121.194],
  Tangob: [13.871, 121.172],
};

const MUNICIPAL_FALLBACK: { name: string; coords: [number, number] } = {
  name: "Poblacion",
  coords: [13.872, 121.201],
};

export function resolveBarangayCentroid(rawName?: string | null): {
  normalizedName: string;
  lat: number;
  lon: number;
  isExact: boolean;
} {
  if (!rawName || !rawName.trim()) {
    return {
      normalizedName: MUNICIPAL_FALLBACK.name,
      lat: MUNICIPAL_FALLBACK.coords[0],
      lon: MUNICIPAL_FALLBACK.coords[1],
      isExact: false,
    };
  }

  const clean = rawName
    .replace(/^(brgy\.?|barangay)\s*/i, "")
    .replace(/,\s*padre\s*garcia.*$/i, "")
    .trim()
    .toLowerCase();

  for (const [name, coords] of Object.entries(PADRE_GARCIA_CENTROIDS)) {
    const keyLower = name.toLowerCase();
    if (
      keyLower === clean ||
      keyLower.replace(/-/g, " ") === clean.replace(/-/g, " ") ||
      clean.includes(keyLower) ||
      keyLower.includes(clean)
    ) {
      return {
        normalizedName: name,
        lat: coords[0],
        lon: coords[1],
        isExact: true,
      };
    }
  }

  return {
    normalizedName: rawName.trim(),
    lat: MUNICIPAL_FALLBACK.coords[0],
    lon: MUNICIPAL_FALLBACK.coords[1],
    isExact: false,
  };
}

// --- WMO Weather Code Mapper ---
export function getWeatherDetails(code: number, isDay: boolean = true) {
  switch (code) {
    case 0:
      return {
        label: isDay ? "Clear Sky" : "Clear Night",
        icon: Sun,
        iconColor: "text-amber-500 fill-amber-400/30",
        badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
      };
    case 1:
      return {
        label: isDay ? "Mainly Clear" : "Clear Sky",
        icon: Sun,
        iconColor: "text-amber-500 fill-amber-400/20",
        badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
      };
    case 2:
      return {
        label: "Partly Cloudy",
        icon: CloudSun,
        iconColor: "text-sky-500 fill-sky-300/30",
        badgeColor: "bg-sky-50 text-sky-800 border-sky-200",
      };
    case 3:
      return {
        label: "Overcast",
        icon: Cloud,
        iconColor: "text-slate-500 fill-slate-300/40",
        badgeColor: "bg-slate-100 text-slate-800 border-slate-200",
      };
    case 45:
    case 48:
      return {
        label: "Foggy",
        icon: CloudFog,
        iconColor: "text-slate-400",
        badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
      };
    case 51:
      return {
        label: "Light Drizzle",
        icon: CloudDrizzle,
        iconColor: "text-sky-600",
        badgeColor: "bg-sky-50 text-sky-800 border-sky-200",
      };
    case 53:
      return {
        label: "Moderate Drizzle",
        icon: CloudDrizzle,
        iconColor: "text-sky-600",
        badgeColor: "bg-sky-50 text-sky-800 border-sky-200",
      };
    case 55:
      return {
        label: "Dense Drizzle",
        icon: CloudDrizzle,
        iconColor: "text-blue-600",
        badgeColor: "bg-blue-50 text-blue-800 border-blue-200",
      };
    case 61:
      return {
        label: "Slight Rain",
        icon: CloudRain,
        iconColor: "text-blue-500 fill-blue-300/20",
        badgeColor: "bg-blue-50 text-blue-800 border-blue-200",
      };
    case 63:
      return {
        label: "Moderate Rain",
        icon: CloudRain,
        iconColor: "text-blue-600 fill-blue-400/20",
        badgeColor: "bg-blue-50 text-blue-800 border-blue-200",
      };
    case 65:
      return {
        label: "Heavy Rain",
        icon: CloudRain,
        iconColor: "text-indigo-600 fill-indigo-400/20",
        badgeColor: "bg-indigo-50 text-indigo-800 border-indigo-200",
      };
    case 80:
    case 81:
    case 82:
      return {
        label: "Rain Showers",
        icon: CloudRain,
        iconColor: "text-blue-600",
        badgeColor: "bg-blue-50 text-blue-800 border-blue-200",
      };
    case 95:
    case 96:
    case 99:
      return {
        label: "Thunderstorm",
        icon: CloudLightning,
        iconColor: "text-amber-600 fill-amber-300/30",
        badgeColor: "bg-amber-50 text-amber-900 border-amber-300",
      };
    default:
      return {
        label: "Variable",
        icon: CloudSun,
        iconColor: "text-sky-500",
        badgeColor: "bg-slate-50 text-slate-700 border-slate-200",
      };
  }
}

// --- Open-Meteo Response Interface ---
interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    cloud_cover: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
  };
}

interface BarangayWeatherWidgetProps {
  barangayName?: string | null;
}

export default function BarangayWeatherWidget({
  barangayName,
}: BarangayWeatherWidgetProps) {
  // State for user-selected barangay override (defaults to farmer's registered barangay)
  const initialResolved = useMemo(
    () => resolveBarangayCentroid(barangayName),
    [barangayName]
  );
  const [selectedBarangay, setSelectedBarangay] = useState<string>(
    initialResolved.normalizedName
  );

  // Active view tab: Hourly vs Daily
  const [forecastTab, setForecastTab] = useState<"hourly" | "daily">("hourly");

  // Temperature unit toggle (°C vs °F)
  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");

  // Advisory banner "Read more" toggle
  const [isAlertExpanded, setIsAlertExpanded] = useState(false);

  // Resolved coordinates for selected barangay
  const activeCentroid = useMemo(
    () => resolveBarangayCentroid(selectedBarangay),
    [selectedBarangay]
  );

  // Fetch Open-Meteo forecast directly using the barangay centroid coordinates
  const {
    data: weather,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<OpenMeteoResponse>({
    queryKey: [
      "open_meteo_barangay_weather",
      activeCentroid.normalizedName,
      activeCentroid.lat,
      activeCentroid.lon,
    ],
    queryFn: async () => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${activeCentroid.lat}&longitude=${activeCentroid.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FManila&forecast_days=7`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Open-Meteo responded with status ${res.status}`);
      }
      return (await res.json()) as OpenMeteoResponse;
    },
    staleTime: 12 * 60 * 1000, // 12 minutes
    refetchOnWindowFocus: false,
  });

  // Temperature formatting helper
  const formatTemp = (celsius?: number | null) => {
    if (celsius == null) return "—";
    if (tempUnit === "F") {
      const f = (celsius * 9) / 5 + 32;
      return `${Math.round(f)}°F`;
    }
    return `${Math.round(celsius)}°C`;
  };

  const formatTempValOnly = (celsius?: number | null) => {
    if (celsius == null) return "—";
    if (tempUnit === "F") {
      const f = (celsius * 9) / 5 + 32;
      return `${Math.round(f)}°`;
    }
    return `${Math.round(celsius)}°`;
  };

  // Wind speed formatting helper
  const formatWind = (kmh?: number | null) => {
    if (kmh == null) return "—";
    if (tempUnit === "F") {
      const mph = kmh * 0.621371;
      return `${Math.round(mph)} mph`;
    }
    return `${Math.round(kmh)} km/h`;
  };

  // Format ISO time to 12-hour AM/PM string
  const formatTimeStr = (isoString?: string) => {
    if (!isoString) return "—";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  // Format ISO time to short hour label for forecast strip (e.g. "2PM")
  const formatHourLabel = (isoString: string, isCurrentHour: boolean) => {
    if (isCurrentHour) return "Now";
    try {
      const date = new Date(isoString);
      const hour = date.getHours();
      const ampm = hour >= 12 ? "PM" : "AM";
      const h12 = hour % 12 || 12;
      return `${h12}${ampm}`;
    } catch {
      return isoString;
    }
  };

  // Format ISO date to day label (e.g. "Today", "Thu")
  const formatDayLabel = (isoDateStr: string, index: number) => {
    if (index === 0) return "Today";
    try {
      const parts = isoDateStr.split("-");
      const d = new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10)
      );
      return d.toLocaleDateString("en-US", { weekday: "short" });
    } catch {
      return isoDateStr;
    }
  };

  // Extract current values
  const current = weather?.current;
  const daily = weather?.daily;
  const hourly = weather?.hourly;

  const currentDetails = getWeatherDetails(
    current?.weather_code ?? 0,
    current?.is_day !== 0
  );
  const CurrentIcon = currentDetails.icon;

  const highToday = daily?.temperature_2m_max?.[0];
  const lowToday = daily?.temperature_2m_min?.[0];
  const sunsetToday = daily?.sunset?.[0];

  // Dynamic Agricultural / Livestock Alert generation based on real data
  const advisory = useMemo(() => {
    const apparent = current?.apparent_temperature ?? 28;
    const precipProb = daily?.precipitation_probability_max?.[0] ?? 0;
    const windSpeed = current?.wind_speed_10m ?? 0;
    const weatherCode = current?.weather_code ?? 0;

    // Severe thunderstorm or violent rain
    if (weatherCode >= 95 || weatherCode === 65 || weatherCode === 82) {
      return {
        level: "danger" as const,
        badgeText: "SEVERE WEATHER & THUNDERSTORM ALERT",
        source: "PAGASA Synoptic Warning · Padre Garcia Municipal Command",
        shortText: `Active thunderstorm and heavy downpour recorded near Brgy. ${activeCentroid.normalizedName}.`,
        fullText: `Keep cattle, carabaos, and small ruminants indoors in sturdy, elevated barns. Verify that lightning arrestors and drainage canals are unimpeded. Do not tether animals under tall isolated trees or near water bodies during active lightning.`,
      };
    }

    // High Heat Stress / THI
    if (apparent >= 33) {
      return {
        level: "warning" as const,
        badgeText: "LIVESTOCK THERMAL STRESS ADVISORY",
        source: "PAGASA Batangas / Open-Meteo Agro-Climatic Feed · Padre Garcia MAO",
        shortText: `Extreme heat index detected (apparent temperature ${Math.round(
          apparent
        )}°C) at the barangay centroid.`,
        fullText: `Dairy cows and young calves are vulnerable to acute heat load. Provide constant clean cool water, operate barn misting/ventilation fans, and suspend midday grazing between 11:00 AM and 3:30 PM to preserve milk yield and prevent thermal exhaustion.`,
      };
    }

    // Elevated Rainfall / Flooding Watch
    if (precipProb >= 70 || (current?.precipitation ?? 0) > 3) {
      return {
        level: "warning" as const,
        badgeText: "HIGH PRECIPITATION & WET GROUND WATCH",
        source: "PAGASA Regional Agro-Meteorology · Padre Garcia Agricultural Office",
        shortText: `High rain probability (${precipProb}%) expected over Brgy. ${activeCentroid.normalizedName}.`,
        fullText: `Ensure paddock runoffs are clear and keep animal bedding dry with fresh rice straw or wood shavings to prevent foot rot, mastitis, and respiratory distress. Elevate stored concentrate feed bags off ground pallets.`,
      };
    }

    // High Wind
    if (windSpeed >= 25) {
      return {
        level: "warning" as const,
        badgeText: "STRONG WIND & GUST ADVISORY",
        source: "Open-Meteo High-Resolution Surface Wind Index",
        shortText: `Brisk to gusty winds (${Math.round(
          windSpeed
        )} km/h) detected across Brgy. ${activeCentroid.normalizedName}.`,
        fullText: `Inspect roofing fasteners, tarpaulins, and feed troughs on open-sided livestock sheds. Ensure windbreaks shield nursery pens from cold drafts.`,
      };
    }

    // Favorable conditions
    return {
      level: "normal" as const,
      badgeText: "FAVORABLE LIVESTOCK GRAZING CONDITIONS",
      source: "PAGASA Batangas & Open-Meteo Synoptic Forecast · Padre Garcia MAO",
      shortText: `Weather conditions across Brgy. ${activeCentroid.normalizedName} are favorable for farm routines.`,
      fullText: `Safe for pasture turnout, rotational paddock grazing, green forage cutting, and outdoor livestock herd movements. Maintain standard clean water provisions throughout the day.`,
    };
  }, [current, daily, activeCentroid.normalizedName]);

  // Hourly slots: find next upcoming 6 hours
  const hourlySlots = useMemo(() => {
    if (!hourly || !hourly.time || hourly.time.length === 0) return [];
    const now = new Date();
    const currentHourIndex = hourly.time.findIndex((t) => {
      const d = new Date(t);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate() &&
        d.getHours() === now.getHours()
      );
    });

    const startIdx = currentHourIndex >= 0 ? currentHourIndex : 0;
    // Show next 6 hours
    return hourly.time.slice(startIdx, startIdx + 6).map((time, idx) => {
      const realIdx = startIdx + idx;
      const code = hourly.weather_code[realIdx] ?? 0;
      const d = new Date(time);
      const isDayHour = d.getHours() >= 6 && d.getHours() < 18;
      const details = getWeatherDetails(code, isDayHour);
      return {
        time,
        isCurrent: idx === 0,
        temp: hourly.temperature_2m[realIdx],
        precipProb: hourly.precipitation_probability[realIdx] ?? 0,
        windSpeed: hourly.wind_speed_10m[realIdx],
        windDir: hourly.wind_direction_10m[realIdx] ?? 0,
        weatherCode: code,
        details,
      };
    });
  }, [hourly]);

  // Daily slots: 6 to 7 days
  const dailySlots = useMemo(() => {
    if (!daily || !daily.time || daily.time.length === 0) return [];
    return daily.time.slice(0, 6).map((time, idx) => {
      const code = daily.weather_code[idx] ?? 0;
      const details = getWeatherDetails(code, true);
      return {
        time,
        index: idx,
        tempMax: daily.temperature_2m_max[idx],
        tempMin: daily.temperature_2m_min[idx],
        precipProb: daily.precipitation_probability_max[idx] ?? 0,
        windSpeed: daily.wind_speed_10m_max[idx],
        weatherCode: code,
        details,
      };
    });
  }, [daily]);

  return (
    <section
      aria-label="Barangay Weather Forecast"
      className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-holo-card transition-all"
    >
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] sm:text-[11px] font-bold tracking-widest uppercase text-slate-500">
              WEATHER FOR
            </span>
            {/* Barangay selector dropdown for instant centroid switching */}
            <div className="relative inline-flex items-center">
              <select
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="appearance-none cursor-pointer bg-emerald-50/80 hover:bg-emerald-100/70 border border-emerald-300 text-emerald-900 font-display font-bold text-xs sm:text-sm px-2.5 py-1 pr-6 rounded-lg outline-none focus:ring-2 focus:ring-emerald-600 transition-colors"
                title="Select barangay centroid"
                aria-label="Select Barangay Centroid"
              >
                {Object.keys(PADRE_GARCIA_CENTROIDS).map((b) => (
                  <option key={b} value={b}>
                    Brgy. {b}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-3 text-emerald-700 pointer-events-none absolute right-1.5" />
            </div>
            <span className="hidden sm:inline font-mono text-[11px] font-semibold text-slate-400">
              · Padre Garcia Centroid
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5">
            <MapPin className="size-3 text-emerald-600 shrink-0" />
            <span className="font-mono text-[11px] text-slate-600">
              Centroid: {activeCentroid.lat.toFixed(4)}°N,{" "}
              {activeCentroid.lon.toFixed(4)}°E
            </span>
          </p>
        </div>

        {/* Right side controls: °C/°F toggle and refresh */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Unit Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setTempUnit("C")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                tempUnit === "C"
                  ? "bg-white text-emerald-800 shadow-xs border border-slate-200/80"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              °C
            </button>
            <button
              type="button"
              onClick={() => setTempUnit("F")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                tempUnit === "F"
                  ? "bg-white text-emerald-800 shadow-xs border border-slate-200/80"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              °F
            </button>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-semibold shadow-xs cursor-pointer active:scale-95 transition-all"
            title="Refresh Open-Meteo weather data"
          >
            <RefreshCw
              className={`size-3.5 text-slate-500 ${
                isFetching ? "animate-spin text-emerald-600" : ""
              }`}
            />
            <span className="hidden md:inline text-[11px]">Sync</span>
          </button>
        </div>
      </div>

      {/* ── ALERT BANNER ── */}
      <div
        className={`mt-4 rounded-2xl border p-3.5 sm:p-4 transition-all ${
          advisory.level === "danger"
            ? "border-red-300 bg-red-50/90 text-red-950"
            : advisory.level === "warning"
            ? "border-amber-300 bg-amber-50/90 text-amber-950"
            : "border-emerald-200 bg-emerald-50/70 text-emerald-950"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <AlertTriangle
            className={`size-5 shrink-0 mt-0.5 ${
              advisory.level === "danger"
                ? "text-red-600"
                : advisory.level === "warning"
                ? "text-amber-600"
                : "text-emerald-600"
            }`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <h3 className="font-display text-xs sm:text-sm font-black tracking-wide uppercase">
                {advisory.badgeText}
              </h3>
              <span className="font-mono text-[10px] text-slate-500">
                Open-Meteo Synoptic Feed
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[11px] font-semibold text-slate-600">
              {advisory.source}
            </p>
            <p className="mt-1 text-xs text-slate-700 leading-relaxed">
              {advisory.shortText}{" "}
              {isAlertExpanded ? (
                <span className="block mt-1 pt-1 border-t border-slate-200/60 font-medium">
                  {advisory.fullText}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => setIsAlertExpanded(!isAlertExpanded)}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline decoration-dotted cursor-pointer"
            >
              <span>{isAlertExpanded ? "Read less" : "Read more"}</span>
              {isAlertExpanded ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── LOADING / ERROR / MAIN WEATHER BODY ── */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 font-mono text-xs">
          <RefreshCw className="size-5 animate-spin text-emerald-600" />
          <span>Fetching weather at {activeCentroid.normalizedName} centroid…</span>
        </div>
      ) : isError || !weather ? (
        <div className="py-8 text-center">
          <p className="text-sm font-semibold text-red-700">
            Unable to load Open-Meteo forecast.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Please check internet connection or retry in a moment.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
          >
            Retry Weather
          </button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* ── LEFT COLUMN: CURRENT WEATHER SNAPSHOT (Mockup Left Side) ── */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            {/* Big Temperature and Condition Graphic */}
            <div className="flex items-center gap-4">
              <span className="font-display font-black text-5xl sm:text-6xl tracking-tight text-slate-900">
                {formatTemp(current?.temperature_2m)}
              </span>
              <div className="size-14 sm:size-16 rounded-2xl flex items-center justify-center p-1">
                <CurrentIcon className={`size-12 sm:size-14 ${currentDetails.iconColor}`} />
              </div>
            </div>

            {/* Condition Summary and Metrics Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
              {/* Column 1 */}
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-900 truncate">
                  {currentDetails.label} · H {formatTempValOnly(highToday)} L{" "}
                  {formatTempValOnly(lowToday)}
                </p>
                <p className="flex items-center gap-1.5 text-slate-600 text-[11px] font-mono">
                  <Sunset className="size-3.5 text-amber-500" />
                  <span>Sunset: {formatTimeStr(sunsetToday)}</span>
                </p>
                <p className="flex items-center gap-1.5 text-slate-600 text-[11px] font-mono">
                  <Wind className="size-3.5 text-slate-400" />
                  <span>Wind: {formatWind(current?.wind_speed_10m)}</span>
                  <span
                    className="inline-flex items-center"
                    title={`Direction: ${current?.wind_direction_10m ?? 0}°`}
                  >
                    <Navigation
                      className="size-3 text-emerald-700 transition-transform"
                      style={{
                        transform: `rotate(${current?.wind_direction_10m ?? 0}deg)`,
                      }}
                    />
                  </span>
                </p>
                <p className="flex items-center gap-1.5 text-slate-600 text-[11px] font-mono">
                  <Droplets className="size-3.5 text-sky-500" />
                  <span>Humidity: {current?.relative_humidity_2m ?? 0}%</span>
                </p>
              </div>

              {/* Column 2 */}
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-900 flex items-center gap-1">
                  <Thermometer className="size-3.5 text-orange-500" />
                  <span>Feels like {formatTemp(current?.apparent_temperature)}</span>
                </p>
                <p className="flex items-center gap-1.5 text-slate-600 text-[11px] font-mono">
                  <Cloud className="size-3.5 text-slate-400" />
                  <span>Sky Cover: {current?.cloud_cover ?? 0}%</span>
                </p>
                <p className="flex items-center gap-1.5 text-slate-600 text-[11px] font-mono">
                  <CloudRain className="size-3.5 text-blue-500" />
                  <span>1-Hr Precip: {current?.precipitation ?? 0} mm</span>
                </p>
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  Padre Garcia Batangas
                </p>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: FORECAST STRIP WITH HOURLY / DAILY TABS ── */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            {/* Tab switchers: Hourly | Daily with active green underline */}
            <div className="flex items-center justify-end gap-6 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setForecastTab("hourly")}
                className={`relative pb-2 font-display text-sm font-bold transition-colors cursor-pointer ${
                  forecastTab === "hourly"
                    ? "text-slate-900"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                Hourly
                {forecastTab === "hourly" && (
                  <span className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setForecastTab("daily")}
                className={`relative pb-2 font-display text-sm font-bold transition-colors cursor-pointer ${
                  forecastTab === "daily"
                    ? "text-slate-900"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                Daily
                {forecastTab === "daily" && (
                  <span className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
                )}
              </button>
            </div>

            {/* Forecast Strip Items (6 Slots) */}
            <div className="mt-4 flex items-center justify-between gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {forecastTab === "hourly" ? (
                hourlySlots.map((slot, idx) => {
                  const SlotIcon = slot.details.icon;
                  return (
                    <div
                      key={slot.time}
                      className={`flex flex-col items-center justify-between min-w-[70px] sm:min-w-[80px] flex-1 py-2 px-1.5 rounded-2xl border transition-all text-center ${
                        slot.isCurrent
                          ? "bg-emerald-50/60 border-emerald-200"
                          : "bg-slate-50/50 border-transparent hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {/* Time Header */}
                      <span className="font-mono text-[11px] font-bold text-slate-700">
                        {formatHourLabel(slot.time, slot.isCurrent)}
                      </span>

                      {/* Icon */}
                      <div className="my-2 size-7 flex items-center justify-center">
                        <SlotIcon className={`size-6 ${slot.details.iconColor}`} />
                      </div>

                      {/* Temperature */}
                      <span className="font-display font-bold text-xs sm:text-sm text-slate-900">
                        {formatTempValOnly(slot.temp)}
                      </span>

                      {/* Wind Speed and Direction Arrow */}
                      <div className="mt-1.5 flex items-center justify-center gap-0.5 text-[10px] font-mono text-slate-500">
                        <span>{formatWind(slot.windSpeed)}</span>
                        <Navigation
                          className="size-2.5 text-emerald-700 inline-block"
                          style={{
                            transform: `rotate(${slot.windDir}deg)`,
                          }}
                        />
                      </div>

                      {/* Precipitation Probability */}
                      <div className="mt-1 flex items-center justify-center gap-0.5 text-[10px] font-mono text-sky-600 font-semibold">
                        <span>{slot.precipProb}%</span>
                        <span className="text-[9px]">💧</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                dailySlots.map((slot) => {
                  const SlotIcon = slot.details.icon;
                  return (
                    <div
                      key={slot.time}
                      className={`flex flex-col items-center justify-between min-w-[70px] sm:min-w-[80px] flex-1 py-2 px-1.5 rounded-2xl border transition-all text-center ${
                        slot.index === 0
                          ? "bg-emerald-50/60 border-emerald-200"
                          : "bg-slate-50/50 border-transparent hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {/* Day Label */}
                      <span className="font-mono text-[11px] font-bold text-slate-700">
                        {formatDayLabel(slot.time, slot.index)}
                      </span>

                      {/* Icon */}
                      <div className="my-2 size-7 flex items-center justify-center">
                        <SlotIcon className={`size-6 ${slot.details.iconColor}`} />
                      </div>

                      {/* Temperature Range (High / Low) */}
                      <div className="font-display text-xs sm:text-sm text-slate-900">
                        <span className="font-bold">
                          {formatTempValOnly(slot.tempMax)}
                        </span>
                        <span className="text-slate-400 text-[10px] sm:text-xs ml-1 font-normal">
                          {formatTempValOnly(slot.tempMin)}
                        </span>
                      </div>

                      {/* Max Wind */}
                      <div className="mt-1.5 text-[10px] font-mono text-slate-500 truncate">
                        <span>{formatWind(slot.windSpeed)}</span>
                      </div>

                      {/* Max Precip Prob */}
                      <div className="mt-1 flex items-center justify-center gap-0.5 text-[10px] font-mono text-sky-600 font-semibold">
                        <span>{slot.precipProb}%</span>
                        <span className="text-[9px]">💧</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Subtle disclaimer & attribution */}
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-400 px-1">
              <span>
                Coordinates from verified Brgy. {activeCentroid.normalizedName} centroid
              </span>
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-emerald-700 inline-flex items-center gap-0.5 underline decoration-dotted"
              >
                <span>Open-Meteo Weather API</span>
                <ExternalLink className="size-2.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
