"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Loader2, Cloud, Wind, Sunrise, Sunset, Droplets, 
  Eye, Gauge, Thermometer, CloudRain,
  Sun, Moon, AlertTriangle,
 Activity, CloudSnow
} from "lucide-react";
import Image from "next/image";


type WeatherCode =
  | 0 | 1 | 2 | 3
  | 45 | 48
  | 51 | 53 | 55
  | 56 | 57
  | 61 | 63 | 65
  | 66 | 67
  | 71 | 73 | 75
  | 77
  | 80 | 81 | 82
  | 85 | 86
  | 95 | 96 | 99;

interface CurrentWeather {
  temp: number;
  humidity: number;
  wind: number;
  code: WeatherCode;
  sunrise?: string;
  sunset?: string;
  feelsLike: number;
  pressure: number;
  visibility: number;
  dewPoint: number;
  cloudCover: number;
  uvIndex: number;
  windDirection: number;
  precipitation: number;
  snowfall: number;
  isDay: number;
}

interface HourPoint {
  time: string;
  temp: number;
  humidity: number;
  pop: number;
  code: WeatherCode;
  windSpeed: number;
}

interface DayForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  code: WeatherCode;
  pop: number;
  sunrise: string;
  sunset: string;
  uvMax: number;
}

interface AirQuality {
  aqi: number;
  pm10: number;
  pm2_5: number;
  no2: number;
  o3: number;
  co: number;
}

const DTU = { lat: 28.748635, lon: 77.119972 };
const tz = "auto";

const codeToText: Record<WeatherCode, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  56: "Freezing drizzle", 57: "Dense freezing drizzle",
  61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Heavy freezing rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Light showers", 81: "Moderate showers", 82: "Violent showers",
  85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm with hail",
};

function codeToEmoji(code: WeatherCode) {
  if ([0].includes(code)) return "☀️";
  if ([1, 2].includes(code)) return "⛅";
  if ([3].includes(code)) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "🌨️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  if ([56, 57, 66, 67].includes(code)) return "🌧️❄️";
  return "🌡️";
}

function getAQILevel(aqi: number) {
  if (aqi <= 50) return { label: "Good", color: "text-green-600", bg: "bg-green-100" };
  if (aqi <= 100) return { label: "Moderate", color: "text-yellow-600", bg: "bg-yellow-100" };
  if (aqi <= 150) return { label: "Unhealthy (Sensitive)", color: "text-orange-600", bg: "bg-orange-100" };
  if (aqi <= 200) return { label: "Unhealthy", color: "text-red-600", bg: "bg-red-100" };
  if (aqi <= 300) return { label: "Very Unhealthy", color: "text-purple-600", bg: "bg-purple-100" };
  return { label: "Hazardous", color: "text-red-900", bg: "bg-red-200" };
}

function getUVLevel(uv: number) {
  if (uv <= 2) return { label: "Low", color: "text-green-600" };
  if (uv <= 5) return { label: "Moderate", color: "text-yellow-600" };
  if (uv <= 7) return { label: "High", color: "text-orange-600" };
  if (uv <= 10) return { label: "Very High", color: "text-red-600" };
  return { label: "Extreme", color: "text-purple-600" };
}

function getWindDirection(deg: number) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export default function Home() {
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
const [, setHours] = useState<HourPoint[]>([]);
const [, setDays] = useState<DayForecast[]>([]);
  const [airQuality, setAirQuality] = useState<AirQuality | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      
      // Main weather data
      const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
      weatherUrl.searchParams.set("latitude", String(DTU.lat));
      weatherUrl.searchParams.set("longitude", String(DTU.lon));
      weatherUrl.searchParams.set("timezone", tz);
      weatherUrl.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,is_day");
      weatherUrl.searchParams.set("hourly", "temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,dew_point_2m,visibility");
      weatherUrl.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max");
      weatherUrl.searchParams.set("forecast_days", "7");

      const weatherRes = await fetch(weatherUrl.toString(), { cache: "no-store" });
      const weatherData = await weatherRes.json();

      // Air quality data
      const aqUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
      aqUrl.searchParams.set("latitude", String(DTU.lat));
      aqUrl.searchParams.set("longitude", String(DTU.lon));
      aqUrl.searchParams.set("current", "us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,carbon_monoxide");

      const aqRes = await fetch(aqUrl.toString(), { cache: "no-store" });
      const aqData = await aqRes.json();

      // Process current weather
      if (weatherData.current) {
        const c = weatherData.current;
        const h = weatherData.hourly;
        const currentHourIndex = 0;
        
        setCurrent({
          temp: Math.round(c.temperature_2m),
          humidity: c.relative_humidity_2m,
          wind: Math.round(c.wind_speed_10m),
          code: c.weather_code as WeatherCode,
          feelsLike: Math.round(c.apparent_temperature),
          pressure: Math.round(c.pressure_msl),
          visibility: Math.round(h.visibility?.[currentHourIndex] / 1000) || 10,
          dewPoint: Math.round(h.dew_point_2m?.[currentHourIndex]) || 0,
          cloudCover: c.cloud_cover,
          uvIndex: weatherData.daily?.uv_index_max?.[0] || 0,
          windDirection: c.wind_direction_10m,
          precipitation: c.precipitation || 0,
          snowfall: c.snowfall || 0,
          isDay: c.is_day,
          sunrise: weatherData.daily?.sunrise?.[0],
          sunset: weatherData.daily?.sunset?.[0],
        });
      }

      // Process hourly forecast
      if (weatherData.hourly?.time) {
        const H: HourPoint[] = weatherData.hourly.time.slice(0, 24).map((t: string, i: number) => ({
          time: t,
          temp: Math.round(weatherData.hourly.temperature_2m[i]),
          humidity: weatherData.hourly.relative_humidity_2m[i],
          pop: weatherData.hourly.precipitation_probability?.[i] ?? 0,
          code: weatherData.hourly.weather_code[i] as WeatherCode,
          windSpeed: Math.round(weatherData.hourly.wind_speed_10m[i]),
        }));
        setHours(H);
      }

      // Process daily forecast
      if (weatherData.daily?.time) {
        const D: DayForecast[] = weatherData.daily.time.map((t: string, i: number) => ({
          date: t,
          tempMax: Math.round(weatherData.daily.temperature_2m_max[i]),
          tempMin: Math.round(weatherData.daily.temperature_2m_min[i]),
          code: weatherData.daily.weather_code[i] as WeatherCode,
          pop: weatherData.daily.precipitation_probability_max[i] ?? 0,
          sunrise: weatherData.daily.sunrise[i],
          sunset: weatherData.daily.sunset[i],
          uvMax: weatherData.daily.uv_index_max[i],
        }));
        setDays(D);
      }

      // Process air quality
      if (aqData.current) {
        setAirQuality({
          aqi: aqData.current.us_aqi || 0,
          pm10: Math.round(aqData.current.pm10 || 0),
          pm2_5: Math.round(aqData.current.pm2_5 || 0),
          no2: Math.round(aqData.current.nitrogen_dioxide || 0),
          o3: Math.round(aqData.current.ozone || 0),
          co: Math.round(aqData.current.carbon_monoxide || 0),
        });
      }

      setLastUpdate(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    const id = setInterval(fetchWeather, 300000); // 5 minutes
    return () => clearInterval(id);
  }, []);

  const formattedTime = useMemo(
    () => lastUpdate?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) ?? "",
    [lastUpdate]
  );

  const isDaytime = current?.isDay === 1;

  if (loading && !current) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading environmental data...</p>
        </div>
      </main>
    );
  }

  if (!current) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardContent className="pt-8 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
            <p className="text-white">Unable to load weather data</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const aqiLevel = airQuality ? getAQILevel(airQuality.aqi) : null;
  const uvLevel = getUVLevel(current.uvIndex);

  return (
    <main className={`min-h-screen bg-gray- py-8 px-4`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Card */}
        <Card className="bg-white/90 backdrop-blur-xl border-0 shadow-2xl">
<CardHeader className="text-center pb-4">

  <div className="flex justify-center items-center gap-4 mb-4">
    {isDaytime ? <Sun className="h-12 w-12 text-yellow-500" /> : <Moon className="h-12 w-12 text-blue-400" />}
    <Cloud className="h-12 w-12 text-blue-500" />
  </div>

  {/* Big Centered Logo */}
  <div className="flex justify-center mb-4">
    <Image
      src="./dtuLogo.png" 
      alt="DTU Logo" 
      className="h-28 w-auto object-contain drop-shadow-sm"
    />
  </div>

  <CardTitle className="text-4xl font-light">Delhi Technological University</CardTitle>
  <p className="text-lg text-muted-foreground">Rohini, New Delhi</p>
  <p className="text-sm text-muted-foreground mt-1">Last updated: {formattedTime}</p>
</CardHeader>


          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              {/* Main Temperature */}
              <div className="text-center space-y-4">
                <div className="text-8xl font-extralight text-blue-600">{current.temp}°</div>
                <div className="text-3xl">{codeToEmoji(current.code)}</div>
                <p className="text-xl text-muted-foreground">{codeToText[current.code]}</p>
                <p className="text-lg text-muted-foreground">Feels like {current.feelsLike}°C</p>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Droplets className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-muted-foreground">Humidity</span>
                  </div>
                  <p className="text-3xl font-light">{current.humidity}%</p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Wind className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-muted-foreground">Wind</span>
                  </div>
                  <p className="text-3xl font-light">{current.wind} <span className="text-base">km/h</span></p>
                  <p className="text-xs text-muted-foreground">{getWindDirection(current.windDirection)}</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Gauge className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-medium text-muted-foreground">Pressure</span>
                  </div>
                  <p className="text-3xl font-light">{current.pressure} <span className="text-base">hPa</span></p>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-5 w-5 text-orange-600" />
                    <span className="text-sm font-medium text-muted-foreground">Visibility</span>
                  </div>
                  <p className="text-3xl font-light">{current.visibility} <span className="text-base">km</span></p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Air Quality Card */}
          {airQuality && aqiLevel && (
            <Card className="bg-white/90 backdrop-blur-xl border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Air Quality Index
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className={`inline-block px-6 py-3 rounded-full ${aqiLevel.bg} ${aqiLevel.color} mb-2`}>
                    <span className="text-4xl font-light">{airQuality.aqi}</span>
                  </div>
                  <p className={`text-lg font-semibold ${aqiLevel.color}`}>{aqiLevel.label}</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PM2.5</span>
                    <span className="font-medium">{airQuality.pm2_5} µg/m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PM10</span>
                    <span className="font-medium">{airQuality.pm10} µg/m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NO₂</span>
                    <span className="font-medium">{airQuality.no2} µg/m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">O₃</span>
                    <span className="font-medium">{airQuality.o3} µg/m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CO</span>
                    <span className="font-medium">{airQuality.co} µg/m³</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Additional Metrics Card */}
          <Card className="bg-white/90 backdrop-blur-xl border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Thermometer className="h-5 w-5" />
                Detailed Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Dew Point</span>
                </div>
                <span className="font-semibold">{current.dewPoint}°C</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm">UV Index</span>
                </div>
                <span className={`font-semibold ${uvLevel.color}`}>{current.uvIndex} ({uvLevel.label})</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-gray-600" />
                  <span className="text-sm">Cloud Cover</span>
                </div>
                <span className="font-semibold">{current.cloudCover}%</span>
              </div>

              {current.precipitation > 0 && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CloudRain className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Precipitation</span>
                  </div>
                  <span className="font-semibold">{current.precipitation} mm</span>
                </div>
              )}

              {current.snowfall > 0 && (
                <div className="flex items-center justify-between p-3 bg-cyan-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CloudSnow className="h-4 w-4 text-cyan-600" />
                    <span className="text-sm">Snowfall</span>
                  </div>
                  <span className="font-semibold">{current.snowfall} cm</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sun Times Card */}
          <Card className="bg-white/90 backdrop-blur-xl border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sunrise className="h-5 w-5" />
                Sun & Moon
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Sunrise className="h-6 w-6 text-orange-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Sunrise</p>
                      <p className="text-lg font-semibold">
                        {current.sunrise ? new Date(current.sunrise).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Sunset className="h-6 w-6 text-indigo-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Sunset</p>
                      <p className="text-lg font-semibold">
                        {current.sunset ? new Date(current.sunset).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                      </p>
                    </div>
                  </div>
                </div>

                {current.sunrise && current.sunset && (
                  <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">Daylight Duration</p>
                    <p className="text-lg font-semibold text-blue-600">
                      {Math.round((new Date(current.sunset).getTime() - new Date(current.sunrise).getTime()) / 3600000)} hours
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </main>
  );
}
