"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import axios from "axios";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Stars,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";

import WeatherCard from "../components/WeatherCard";
import WeatherChart from "../components/WeatherChart";

interface WeatherData {
  city: string;
  country: string;
  current_temp: number;
  humidity: number;
  rain_prediction: string;
  description: string;
  future_temp: number[];
  future_humidity: number[];
}

interface LocationData {
  displayName: string;
  latitude: number;
  longitude: number;
  country: string;
}

const EARTH_RADIUS = 2;
const EARTH_SCALE = 0.92;

const EARTH_SURFACE_RADIUS =
  EARTH_RADIUS * EARTH_SCALE;

const MARKER_RADIUS =
  EARTH_SURFACE_RADIUS + 0.09;

const WEATHER_API =
  "https://globe-weather-backend.onrender.com";

const FRONT_OFFSET = -Math.PI / 2;

/* ================================================= */
/* Weather emoji                                     */
/* ================================================= */

function getWeatherEmoji(
  description: string
) {
  const text = description.toLowerCase();

  if (
    text.includes("thunder") ||
    text.includes("storm")
  ) {
    return "⛈️";
  }

  if (
    text.includes("snow") ||
    text.includes("sleet") ||
    text.includes("ice")
  ) {
    return "❄️";
  }

  if (
    text.includes("rain") ||
    text.includes("drizzle") ||
    text.includes("shower")
  ) {
    return "🌧️";
  }

  if (
    text.includes("cloud") ||
    text.includes("overcast")
  ) {
    return "☁️";
  }

  if (
    text.includes("fog") ||
    text.includes("mist")
  ) {
    return "🌫️";
  }

  if (
    text.includes("clear") ||
    text.includes("sun")
  ) {
    return "☀️";
  }

  return "🌤️";
}

/* ================================================= */
/* Coordinate helpers                                */
/* ================================================= */

function latLonToVector3(
  latitude: number,
  longitude: number,
  radius: number
) {
  const lat =
    THREE.MathUtils.degToRad(latitude);

  const lon =
    THREE.MathUtils.degToRad(longitude);

  const x =
    radius *
    Math.cos(lat) *
    Math.cos(lon);

  const y =
    radius *
    Math.sin(lat);

  const z =
    -radius *
    Math.cos(lat) *
    Math.sin(lon);

  return new THREE.Vector3(
    x,
    y,
    z
  );
}

function getEarthRotation(
  longitude: number
) {
  return (
    THREE.MathUtils.degToRad(-longitude) +
    FRONT_OFFSET
  );
}

/* ================================================= */
/* Solar calculations                                */
/* ================================================= */

function getSolarInfo(
  latitude: number,
  longitude: number
) {
  const now = new Date();

  const startOfYear = Date.UTC(
    now.getUTCFullYear(),
    0,
    0
  );

  const currentDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  const dayOfYear = Math.floor(
    (currentDay - startOfYear) /
      86400000
  );

  const hour =
    now.getUTCHours() +
    now.getUTCMinutes() / 60 +
    now.getUTCSeconds() / 3600;

  const declination =
    23.44 *
    Math.sin(
      THREE.MathUtils.degToRad(
        (360 / 365) *
          (dayOfYear - 81)
      )
    );

  const solarTime =
    ((hour + longitude / 15) % 24 + 24) %
    24;

  const hourAngle =
    (solarTime - 12) * 15;

  const latRad =
    THREE.MathUtils.degToRad(
      latitude
    );

  const declRad =
    THREE.MathUtils.degToRad(
      declination
    );

  const hourRad =
    THREE.MathUtils.degToRad(
      hourAngle
    );

  const altitude = Math.asin(
    Math.sin(latRad) *
      Math.sin(declRad) +
      Math.cos(latRad) *
        Math.cos(declRad) *
        Math.cos(hourRad)
  );

  const isDay =
    altitude > 0;

  const cosHourAngle =
    -Math.tan(latRad) *
    Math.tan(declRad);

  let sunrise = 6;
  let sunset = 18;

  if (cosHourAngle >= 1) {
    sunrise = 12;
    sunset = 12;
  } else if (cosHourAngle <= -1) {
    sunrise = 0;
    sunset = 24;
  } else {
    const sunriseHourAngle =
      Math.acos(cosHourAngle) *
      (180 / Math.PI) /
      15;

    sunrise =
      12 - sunriseHourAngle;

    sunset =
      12 + sunriseHourAngle;
  }

  return {
    solarTime,
    altitude,
    isDay,
    sunrise,
    sunset,
  };
}

function formatSolarTime(
  hours: number
) {
  const normalized =
    ((hours % 24) + 24) % 24;

  const hour =
    Math.floor(normalized);

  const minutes =
    Math.floor(
      (normalized - hour) * 60
    );

  const displayHour =
    hour % 12 || 12;

  const suffix =
    hour >= 12 ? "PM" : "AM";

  return `${displayHour}:${String(
    minutes
  ).padStart(2, "0")} ${suffix}`;
}

function formatHour(
  hours: number
) {
  const normalized =
    ((hours % 24) + 24) % 24;

  const hour =
    Math.floor(normalized);

  const displayHour =
    hour % 12 || 12;

  const suffix =
    hour >= 12 ? "PM" : "AM";

  return `${displayHour} ${suffix}`;
}

/* ================================================= */
/* Sun direction                                     */
/* ================================================= */

function getSunDirection() {
  const now = new Date();

  const startOfYear = Date.UTC(
    now.getUTCFullYear(),
    0,
    0
  );

  const currentDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  const dayOfYear = Math.floor(
    (currentDay - startOfYear) /
      86400000
  );

  const utcHours =
    now.getUTCHours() +
    now.getUTCMinutes() / 60;

  const declination =
    23.44 *
    Math.sin(
      THREE.MathUtils.degToRad(
        (360 / 365) *
          (dayOfYear - 81)
      )
    );

  const solarAngle =
    ((utcHours / 24) * 360 -
      180 +
      declination) *
    (Math.PI / 180);

  const declinationRad =
    THREE.MathUtils.degToRad(
      declination
    );

  const direction =
    new THREE.Vector3(
      Math.cos(solarAngle),
      Math.sin(
        declinationRad
      ),
      Math.sin(solarAngle)
    );

  return direction.normalize();
}

/* ================================================= */
/* Weather particles                                 */
/* ================================================= */

function WeatherParticles({
  weather,
}: {
  weather: WeatherData | null;
}) {
  const pointsRef =
    useRef<THREE.Points>(null);

  const elapsedRef =
    useRef(0);

  const particles = useMemo(() => {
    if (!weather) {
      return null;
    }

    const text = (
      weather.description +
      " " +
      weather.rain_prediction
    ).toLowerCase();

    const isRain =
      text.includes("rain") ||
      text.includes("drizzle") ||
      text.includes("storm") ||
      text.includes("shower");

    const isSnow =
      text.includes("snow") ||
      text.includes("sleet");

    if (!isRain && !isSnow) {
      return null;
    }

    const count =
      isSnow ? 450 : 650;

    const positions =
      new Float32Array(
        count * 3
      );

    const velocities =
      new Float32Array(count);

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const radius =
        1.4 +
        Math.random() * 2.2;

      const angle =
        Math.random() *
        Math.PI *
        2;

      const height =
        -1 +
        Math.random() * 2;

      positions[i * 3] =
        Math.cos(angle) *
        radius;

      positions[i * 3 + 1] =
        height;

      positions[i * 3 + 2] =
        Math.sin(angle) *
        radius;

      velocities[i] =
        isSnow
          ? 0.08 +
            Math.random() * 0.08
          : 0.18 +
            Math.random() * 0.18;
    }

    return {
      positions,
      velocities,
      count,
      isSnow,
    };
  }, [weather]);

  useFrame((_, delta) => {
    if (
      !pointsRef.current ||
      !particles
    ) {
      return;
    }

    elapsedRef.current += delta;

    const positionAttribute =
      pointsRef.current.geometry
        .attributes
        .position;

    const array =
      positionAttribute.array as Float32Array;

    for (
      let i = 0;
      i < particles.count;
      i++
    ) {
      const index = i * 3;

      array[index + 1] -=
        particles.velocities[i] *
        delta;

      if (
        array[index + 1] <
        -1.2
      ) {
        array[index + 1] = 1.2;
      }

      if (particles.isSnow) {
        array[index] +=
          Math.sin(
            elapsedRef.current * 1.5 +
              i
          ) *
          delta *
          0.03;
      }
    }

    positionAttribute.needsUpdate =
      true;
  });

  if (!particles) {
    return null;
  }

  const geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      particles.positions,
      3
    )
  );

  return (
    <points ref={pointsRef}>
      <primitive
        object={geometry}
        attach="geometry"
      />

      <pointsMaterial
        color={
          particles.isSnow
            ? "#e0f2fe"
            : "#38bdf8"
        }
        size={
          particles.isSnow
            ? 0.035
            : 0.018
        }
        transparent
        opacity={
          particles.isSnow
            ? 0.7
            : 0.45
        }
        depthWrite={false}
      />
    </points>
  );
}

/* ================================================= */
/* Location marker                                   */
/* ================================================= */

function LocationMarker({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const groupRef =
    useRef<THREE.Group>(null);

  const pulseRef =
    useRef<THREE.Mesh>(null);

  const elapsedRef =
    useRef(0);

  const position = useMemo(
    () =>
      latLonToVector3(
        latitude,
        longitude,
        MARKER_RADIUS
      ),
    [latitude, longitude]
  );

  const normal = useMemo(
    () =>
      position
        .clone()
        .normalize(),
    [position]
  );

  const quaternion = useMemo(() => {
    const q =
      new THREE.Quaternion();

    q.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normal
    );

    return q;
  }, [normal]);

  useFrame((_, delta) => {
    elapsedRef.current += delta;

    const elapsed =
      elapsedRef.current;

    if (groupRef.current) {
      groupRef.current.position.copy(
        position
      );
    }

    if (pulseRef.current) {
      const pulse =
        1 +
        Math.sin(
          elapsed * 3.5
        ) *
          0.15;

      pulseRef.current.scale.setScalar(
        pulse
      );

      const material =
        pulseRef.current
          .material as THREE.MeshBasicMaterial;

      material.opacity =
        0.25 +
        (Math.sin(
          elapsed * 3.5
        ) +
          1) *
          0.15;
    }
  });

  return (
    <group
      ref={groupRef}
      quaternion={quaternion}
    >
      {/* Large outer glow */}
      <mesh
        ref={pulseRef}
        position={[0, 0.035, 0]}
      >
        <sphereGeometry
          args={[
            0.14,
            32,
            32,
          ]}
        />

        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.45}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      {/* Marker stem */}
      <mesh
        position={[0, -0.055, 0]}
      >
        <cylinderGeometry
          args={[
            0.018,
            0.018,
            0.16,
            16,
          ]}
        />

        <meshStandardMaterial
          color="#67e8f9"
          emissive="#06b6d4"
          emissiveIntensity={3}
          depthTest={false}
        />
      </mesh>

      {/* Bright marker core */}
      <mesh
        position={[0, 0.045, 0]}
      >
        <sphereGeometry
          args={[
            0.075,
            32,
            32,
          ]}
        />

        <meshStandardMaterial
          color="#ffffff"
          emissive="#22d3ee"
          emissiveIntensity={5}
          roughness={0.1}
          metalness={0.1}
          depthTest={false}
        />
      </mesh>

      {/* Marker ring */}
      <mesh
        rotation={[
          Math.PI / 2,
          0,
          0,
        ]}
        position={[0, 0.015, 0]}
      >
        <torusGeometry
          args={[
            0.13,
            0.014,
            16,
            64,
          ]}
        />

        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.95}
          depthTest={false}
        />
      </mesh>

      {/* Extra glow */}
      <pointLight
        color="#22d3ee"
        intensity={3}
        distance={1}
        decay={2}
      />
    </group>
  );
}

/* ================================================= */
/* Earth                                             */
/* ================================================= */

function Earth({
  location,
  weather,
}: {
  location: LocationData | null;
  weather: WeatherData | null;
}) {
  const texture = useTexture(
    "/textures/earth-day.jpg"
  );

  const earthGroupRef =
    useRef<THREE.Group>(null);

  const currentRotation =
    useRef(FRONT_OFFSET);

  const targetRotation =
    useMemo(() => {
      if (!location) {
        return FRONT_OFFSET;
      }

      return getEarthRotation(
        location.longitude
      );
    }, [location]);

  const sunDirection =
    useMemo(
      () => getSunDirection(),
      []
    );

  useFrame((_, delta) => {
    if (!earthGroupRef.current) {
      return;
    }

    if (!location) {
      currentRotation.current +=
        delta * 0.035;
    } else {
      const current =
        currentRotation.current;

      const target =
        targetRotation;

      const difference =
        THREE.MathUtils.euclideanModulo(
          target - current + Math.PI,
          Math.PI * 2
        ) - Math.PI;

      currentRotation.current +=
        difference *
        Math.min(
          delta * 2.5,
          1
        );
    }

    earthGroupRef.current.rotation.y =
      currentRotation.current;
  });

  return (
    <group ref={earthGroupRef}>

      {/* EARTH */}

      <mesh
        scale={EARTH_SCALE}
        renderOrder={0}
      >
        <sphereGeometry
          args={[
            EARTH_RADIUS,
            96,
            96,
          ]}
        />

        <meshStandardMaterial
          map={texture}
          roughness={0.82}
          metalness={0.02}
        />
      </mesh>

      {/* SELECTED LOCATION */}

      {location && (
        <LocationMarker
          latitude={
            location.latitude
          }
          longitude={
            location.longitude
          }
        />
      )}

      {/* ATMOSPHERE */}

      <mesh
        scale={2.08}
        renderOrder={2}
      >
        <sphereGeometry
          args={[1, 64, 64]}
        />

        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.045}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      <mesh
        scale={2.015}
        renderOrder={2}
      >
        <sphereGeometry
          args={[1, 64, 64]}
        />

        <meshBasicMaterial
          color="#60a5fa"
          transparent
          opacity={0.035}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* SUNLIGHT */}

      <directionalLight
        position={[
          sunDirection.x * 8,
          sunDirection.y * 8,
          sunDirection.z * 8,
        ]}
        intensity={3.2}
        color="#fff4d6"
      />
    </group>
  );
}

/* ================================================= */
/* Globe scene                                       */
/* ================================================= */

function EarthScene({
  location,
  weather,
}: {
  location: LocationData | null;
  weather: WeatherData | null;
}) {
  return (
    <Canvas
      camera={{
        position: [0, 0, 6.5],
        fov: 40,
      }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: true,
      }}
    >
      <ambientLight
        intensity={0.35}
      />

      <directionalLight
        position={[4, 3, 5]}
        intensity={1.5}
      />

      <pointLight
        position={[
          -4,
          -2,
          3,
        ]}
        intensity={0.7}
        color="#38bdf8"
      />

      <Stars
        radius={80}
        depth={45}
        count={4500}
        factor={2}
        saturation={0}
        fade
        speed={0.35}
      />

      <Earth
        location={location}
        weather={weather}
      />

      <WeatherParticles
        weather={weather}
      />

      <OrbitControls
        enablePan={false}
        enableZoom
        enableDamping
        dampingFactor={0.06}
        minDistance={4.5}
        maxDistance={9}
        rotateSpeed={0.55}
      />
    </Canvas>
  );
}

/* ================================================= */
/* Loading spinner                                   */
/* ================================================= */

function LoadingSpinner() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />

      <span className="text-sm text-slate-300">
        Searching the globe...
      </span>
    </div>
  );
}

/* ================================================= */
/* Main page                                         */
/* ================================================= */

export default function Home() {
  const [city, setCity] =
    useState("Delhi");

  const [weather, setWeather] =
    useState<WeatherData | null>(
      null
    );

  const [location, setLocation] =
    useState<LocationData | null>(
      null
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [solarInfo, setSolarInfo] =
    useState<{
      solarTime: number;
      isDay: boolean;
      sunrise: number;
      sunset: number;
    } | null>(null);

  const searchRef =
    useRef<HTMLInputElement>(null);

  /* ============================================ */
  /* Geocoding                                    */
  /* ============================================ */

  const geocodeCity = async (
    cityName: string
  ): Promise<LocationData> => {
    const response =
      await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params: {
            q: cityName,
            format: "json",
            limit: 1,
            addressdetails: 1,
          },
          headers: {
            Accept:
              "application/json",
          },
          timeout: 10000,
        }
      );

    if (
      !response.data ||
      response.data.length === 0
    ) {
      throw new Error(
        "Location not found."
      );
    }

    const result =
      response.data[0];

    const address =
      result.address || {};

    const placeName =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.state ||
      result.display_name;

    const country =
      address.country || "";

    return {
      displayName: placeName,
      latitude: Number(
        result.lat
      ),
      longitude: Number(
        result.lon
      ),
      country,
    };
  };

  /* ============================================ */
  /* Weather request                              */
  /* ============================================ */

  const getWeather = async (
    requestedCity?: string
  ) => {
    const trimmedCity = (
      requestedCity ?? city
    ).trim();

    if (!trimmedCity) {
      setError(
        "Please enter a city name."
      );
      return;
    }

    setLoading(true);
    setError("");
    setWeather(null);

    try {
      const geo =
        await geocodeCity(
          trimmedCity
        );

      setLocation(geo);

      try {
        const weatherResponse =
          await axios.get(
            `${WEATHER_API}/weather/${encodeURIComponent(
              trimmedCity
            )}`,
            {
              headers: {
                "ngrok-skip-browser-warning":
                  "true",
              },
              timeout: 15000,
            }
          );

        setWeather(
          weatherResponse.data
        );
      } catch (weatherError) {
        console.error(
          "Weather API error:",
          weatherError
        );

        setError(
          "Location found, but weather data could not be loaded."
        );
      }

      setTimeout(() => {
        document
          .getElementById(
            "earth-section"
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
      }, 100);
    } catch (geoError) {
      console.error(
        "Geocoding error:",
        geoError
      );

      setLocation(null);
      setWeather(null);

      setError(
        "We couldn't find that location. Try another city."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ============================================ */
  /* Initial search                               */
  /* ============================================ */

  useEffect(() => {
    getWeather("Delhi");

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============================================ */
  /* Solar information                            */
  /* ============================================ */

  useEffect(() => {
    if (!location) {
      setSolarInfo(null);
      return;
    }

    const updateSolarInfo = () => {
      setSolarInfo(
        getSolarInfo(
          location.latitude,
          location.longitude
        )
      );
    };

    updateSolarInfo();

    const interval =
      window.setInterval(
        updateSolarInfo,
        30000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [location]);

  /* ============================================ */
  /* Search keyboard                              */
  /* ============================================ */

  const handleSearchKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      getWeather();
    }
  };

  /* ============================================ */
  /* Forecast data                                */
  /* ============================================ */

  const temperatureData =
    weather?.future_temp?.map(
      (value, index) => ({
        name: `Hour ${index + 1}`,
        value,
      })
    ) ?? [];

  const humidityData =
    weather?.future_humidity?.map(
      (value, index) => ({
        name: `Hour ${index + 1}`,
        value,
      })
    ) ?? [];

  const forecast =
    weather?.future_temp
      ?.slice(0, 8)
      .map((temp, index) => ({
        temp,
        humidity:
          weather.future_humidity?.[
            index
          ] ?? 0,
        hour: index + 1,
      })) ?? [];

  const selectedLocationName =
    location?.displayName || city;

  /* ============================================ */
  /* Render                                       */
  /* ============================================ */

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020617] text-white">

      {/* ====================================== */}
      {/* BACKGROUND                             */}
      {/* ====================================== */}

      <div className="pointer-events-none fixed inset-0 -z-10">

        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-cyan-500/[0.07] blur-[120px]" />

        <div className="absolute left-[-220px] top-[38%] h-[420px] w-[420px] rounded-full bg-blue-600/[0.06] blur-[120px]" />

        <div className="absolute bottom-[-180px] right-[-120px] h-[450px] w-[450px] rounded-full bg-indigo-500/[0.06] blur-[120px]" />

      </div>

      {/* ====================================== */}
      {/* HEADER                                 */}
      {/* ====================================== */}

      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#020617]/75 backdrop-blur-2xl">

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.12)]">
              <span className="text-lg">
                🌎
              </span>
            </div>

            <div>
              <p className="text-sm font-bold tracking-tight text-white">
                GlobeWeather
              </p>

              <p className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 sm:block">
                Live weather explorer
              </p>
            </div>

          </div>

          <div className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 sm:flex">

            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />

            <span className="text-[11px] font-medium text-slate-400">
              Interactive globe
            </span>

          </div>

        </div>

      </header>

      {/* ====================================== */}
      {/* HERO                                   */}
      {/* ====================================== */}

      <section className="relative">

        <div className="mx-auto max-w-7xl px-5 pb-10 pt-14 sm:px-8 sm:pt-20 lg:px-10 lg:pb-16 lg:pt-24">

          <div className="mx-auto max-w-3xl text-center">

            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/[0.06] px-3.5 py-1.5">

              <span className="text-xs">
                ✦
              </span>

              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                Explore weather anywhere
              </span>

            </div>

            <h1 className="text-4xl font-black tracking-[-0.055em] text-white sm:text-5xl lg:text-6xl">

              Weather,

              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                {" "}
                around the world.
              </span>

            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
              Search any city and explore
              its location on an interactive
              3D globe with live conditions,
              day/night lighting and forecast
              insights.
            </p>

            {/* Search */}

            <div className="mx-auto mt-9 max-w-2xl">

              <div className="group flex items-center gap-2 rounded-2xl border border-white/[0.09] bg-slate-900/75 p-2 shadow-[0_25px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl transition focus-within:border-cyan-400/30">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.045] text-lg text-slate-400">
                  ⌕
                </div>

                <input
                  ref={searchRef}
                  value={city}
                  onChange={(event) =>
                    setCity(
                      event.target.value
                    )
                  }
                  onKeyDown={
                    handleSearchKeyDown
                  }
                  placeholder="Search a city..."
                  className="min-w-0 flex-1 bg-transparent px-1 text-sm font-medium text-white outline-none placeholder:text-slate-600"
                />

                <button
                  type="button"
                  onClick={() =>
                    getWeather()
                  }
                  disabled={loading}
                  className="shrink-0 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_8px_30px_rgba(34,211,238,0.2)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Searching..."
                    : "Search"}
                </button>

              </div>

              <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-600">

                <span>
                  Press Enter to search
                </span>

                <span>•</span>

                <span>
                  Try Delhi, Tokyo, London
                </span>

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* ====================================== */}
      {/* GLOBE                                  */}
      {/* ====================================== */}

      <section
        id="earth-section"
        className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"
      >

        <div className="relative overflow-hidden rounded-[32px] border border-white/[0.07] bg-gradient-to-b from-slate-900/70 to-slate-950/80 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">

          {/* Label */}

          <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full border border-white/[0.07] bg-black/25 px-3 py-2 backdrop-blur-xl sm:left-7 sm:top-7">

            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />

            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Live globe
            </span>

          </div>

          {/* ================================== */}
          {/* DAY / NIGHT + WEATHER BOX          */}
          {/* ================================== */}

          <div className="absolute right-5 top-5 z-20 sm:right-7 sm:top-7">

            <div className="flex flex-col items-end gap-2">

              {/* DAY / NIGHT */}

              <div className="rounded-full border border-white/[0.07] bg-black/25 px-3 py-2 backdrop-blur-xl">

                <span className="text-[10px] font-medium text-slate-500">
                  {solarInfo?.isDay
                    ? "☀️ DAY"
                    : "🌙 NIGHT"}
                </span>

              </div>

              {/* WEATHER BOX */}

              {weather && location && (
                <div className="pointer-events-none select-none">

                  <div className="min-w-[150px] rounded-2xl border border-cyan-300/30 bg-slate-950/95 px-3.5 py-2.5 shadow-[0_10px_45px_rgba(0,0,0,0.55),0_0_25px_rgba(34,211,238,0.12)] backdrop-blur-xl">

                    <div className="flex items-center justify-between gap-4">

                      <span className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                        {location.displayName}
                      </span>

                      <span className="text-xl font-black leading-none text-white">
                        {Math.round(
                          weather.current_temp
                        )}
                        °
                      </span>

                    </div>

                    <div className="mt-2 text-xl leading-none">
                      {getWeatherEmoji(
                        weather.description
                      )}
                    </div>

                  </div>

                </div>
              )}

            </div>

          </div>

          {/* Controls */}

          <div className="absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 rounded-full border border-white/[0.06] bg-black/25 px-4 py-2 text-[10px] font-medium text-slate-500 backdrop-blur-xl sm:block">
            Drag to rotate · Scroll to zoom
          </div>

          <div className="h-[500px] w-full sm:h-[600px] lg:h-[680px]">

            <EarthScene
              location={location}
              weather={weather}
            />

          </div>

        </div>

      </section>

      {/* ====================================== */}
      {/* SELECTED LOCATION                      */}
      {/* ====================================== */}

      <section className="mx-auto max-w-5xl px-5 pt-10 sm:px-8 lg:pt-14">

        <div className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-slate-950/95 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)] sm:p-8">

          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-400/[0.07] blur-[70px]" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <div className="mb-2 flex items-center gap-2">

                <span className="text-sm">
                  📍
                </span>

                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">
                  Selected location
                </span>

              </div>

              <h2 className="text-2xl font-extrabold tracking-[-0.035em] text-white sm:text-3xl">
                {selectedLocationName}
              </h2>

              {location && (
                <p className="mt-2 text-sm text-slate-500">

                  {location.country}

                  <span className="mx-2 text-slate-700">
                    •
                  </span>

                  {location.latitude.toFixed(
                    2
                  )}
                  °,{" "}

                  {location.longitude.toFixed(
                    2
                  )}
                  °

                </p>
              )}

            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">

              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />

              <span className="text-xs font-semibold text-slate-400">
                {loading
                  ? "Updating..."
                  : "Location found"}
              </span>

            </div>

          </div>

        </div>

      </section>

      {/* ====================================== */}
      {/* SOLAR INFORMATION                      */}
      {/* ====================================== */}

      {location &&
        solarInfo && (
          <section className="mx-auto max-w-5xl px-5 pt-5 sm:px-8">

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

              <div className="rounded-2xl border border-white/[0.07] bg-slate-900/70 p-4 backdrop-blur-xl">

                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
                  Solar time
                </p>

                <p className="mt-2 text-lg font-extrabold text-white">
                  {formatSolarTime(
                    solarInfo.solarTime
                  )}
                </p>

              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-slate-900/70 p-4 backdrop-blur-xl">

                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
                  Status
                </p>

                <p className="mt-2 text-lg font-extrabold text-cyan-300">
                  {solarInfo.isDay
                    ? "☀️ Day"
                    : "🌙 Night"}
                </p>

              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-slate-900/70 p-4 backdrop-blur-xl">

                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
                  Sunrise
                </p>

                <p className="mt-2 text-lg font-extrabold text-white">
                  {formatHour(
                    solarInfo.sunrise
                  )}
                </p>

              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-slate-900/70 p-4 backdrop-blur-xl">

                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
                  Sunset
                </p>

                <p className="mt-2 text-lg font-extrabold text-white">
                  {formatHour(
                    solarInfo.sunset
                  )}
                </p>

              </div>

            </div>

          </section>
        )}

      {/* ====================================== */}
      {/* LOADING                                */}
      {/* ====================================== */}

      {loading && (
        <section className="mx-auto max-w-5xl px-5 pt-6 sm:px-8">

          <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.035] px-5 py-4">

            <LoadingSpinner />

          </div>

        </section>
      )}

      {/* ====================================== */}
      {/* ERROR                                  */}
      {/* ====================================== */}

      {error && !loading && (
        <section className="mx-auto max-w-5xl px-5 pt-6 sm:px-8">

          <div className="flex items-start gap-3 rounded-2xl border border-amber-400/10 bg-amber-400/[0.035] px-5 py-4">

            <span className="mt-0.5 text-sm">
              ⚠️
            </span>

            <div>

              <p className="text-sm font-semibold text-amber-200">
                Weather update
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                {error}
              </p>

            </div>

          </div>

        </section>
      )}

      {/* ====================================== */}
      {/* WEATHER                                */}
      {/* ====================================== */}

      {weather && (
        <section className="mx-auto max-w-7xl px-5 pb-20 pt-12 sm:px-8 lg:px-10 lg:pt-16">

          <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
                Current conditions
              </p>

              <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-white sm:text-3xl">
                Weather overview
              </h2>

            </div>

            <p className="text-xs text-slate-600">

              {weather.city}

              {weather.country
                ? `, ${weather.country}`
                : ""}

            </p>

          </div>

          {/* Main weather */}

          <div className="mb-5 overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-blue-950/40 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)] sm:p-8">

            <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">

              <div>

                <p className="text-sm font-semibold text-slate-400">
                  {weather.description}
                </p>

                <div className="mt-3 flex items-start">

                  <span className="text-6xl font-black tracking-[-0.07em] text-white sm:text-7xl">
                    {weather.current_temp}
                  </span>

                  <span className="mt-2 text-2xl font-bold text-cyan-300">
                    °C
                  </span>

                </div>

                <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">

                  Current conditions for{" "}

                  <span className="font-semibold text-slate-300">
                    {weather.city}
                  </span>
                  .

                </p>

              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:w-auto">

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-5 py-4">

                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
                    Humidity
                  </p>

                  <p className="mt-2 text-xl font-extrabold text-white">
                    {weather.humidity}%
                  </p>

                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-5 py-4">

                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
                    Rain
                  </p>

                  <p className="mt-2 max-w-[110px] truncate text-xl font-extrabold text-white">
                    {weather.rain_prediction}
                  </p>

                </div>

                <div className="col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-5 py-4 sm:col-span-1">

                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
                    Status
                  </p>

                  <p className="mt-2 text-xl font-extrabold text-emerald-300">
                    Live
                  </p>

                </div>

              </div>

            </div>

          </div>

          {/* Hourly forecast */}

          {forecast.length > 0 && (
            <div className="mb-5 overflow-x-auto rounded-[26px] border border-white/[0.07] bg-slate-900/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">

              <div className="mb-4 flex items-center justify-between">

                <div>

                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">
                    Upcoming hours
                  </p>

                  <h3 className="mt-1 text-lg font-bold text-white">
                    Hourly forecast
                  </h3>

                </div>

                <span className="text-xs text-slate-600">
                  Temperature
                </span>

              </div>

              <div className="flex min-w-max gap-3">

                {forecast.map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={index}
                      className={`min-w-[105px] rounded-2xl border px-4 py-4 ${
                        index === 0
                          ? "border-cyan-400/20 bg-cyan-400/[0.07]"
                          : "border-white/[0.06] bg-white/[0.025]"
                      }`}
                    >

                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">

                        {index === 0
                          ? "Now"
                          : `+${item.hour}H`}

                      </p>

                      <p className="mt-3 text-2xl font-black text-white">
                        {item.temp}°
                      </p>

                      <p className="mt-2 text-[10px] text-slate-600">
                        Humidity{" "}
                        {item.humidity}%
                      </p>

                    </div>
                  )
                )}

              </div>

            </div>
          )}

          {/* Weather cards */}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

            <WeatherCard
              title="Temperature"
              value={`${weather.current_temp}°C`}
            />

            <WeatherCard
              title="Humidity"
              value={`${weather.humidity}%`}
            />

            <WeatherCard
              title="Rain Prediction"
              value={
                weather.rain_prediction
              }
            />

            <WeatherCard
              title="Condition"
              value={
                weather.description
              }
            />

          </div>

          {/* Charts */}

          {(temperatureData.length > 0 ||
            humidityData.length > 0) && (
            <div className="mt-6 grid gap-5 lg:grid-cols-2">

              {temperatureData.length >
                0 && (
                <div className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-slate-900/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:p-6">

                  <div className="mb-5">

                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">
                      Forecast
                    </p>

                    <h3 className="mt-1 text-lg font-bold text-white">
                      Temperature trend
                    </h3>

                  </div>

                  <div className="h-[280px]">

                    <WeatherChart
                      data={
                        temperatureData
                      }
                    />

                  </div>

                </div>
              )}

              {humidityData.length >
                0 && (
                <div className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-slate-900/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:p-6">

                  <div className="mb-5">

                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-400">
                      Forecast
                    </p>

                    <h3 className="mt-1 text-lg font-bold text-white">
                      Humidity trend
                    </h3>

                  </div>

                  <div className="h-[280px]">

                    <WeatherChart
                      data={
                        humidityData
                      }
                    />

                  </div>

                </div>
              )}

            </div>
          )}

        </section>
      )}

      {/* ====================================== */}
      {/* EMPTY STATE                            */}
      {/* ====================================== */}

      {!weather &&
        !loading &&
        !error && (
          <section className="mx-auto max-w-5xl px-5 py-20 text-center sm:px-8">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.025] text-2xl">
              🌤️
            </div>

            <h2 className="mt-5 text-xl font-bold text-white">
              Search for a location
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Enter a city above to explore
              its weather on the interactive
              globe.
            </p>

          </section>
        )}

      {/* ====================================== */}
      {/* FOOTER                                 */}
      {/* ====================================== */}

      <footer className="border-t border-white/[0.06]">

        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">

          <div>

            <p className="text-sm font-bold text-slate-300">
              GlobeWeather
            </p>

            <p className="mt-1 text-[11px] text-slate-600">
              Interactive weather exploration
            </p>

          </div>

          <p className="text-[11px] text-slate-600">
            Search a city · Explore the globe
            · Check the forecast
          </p>

        </div>

      </footer>

    </main>
  );
}