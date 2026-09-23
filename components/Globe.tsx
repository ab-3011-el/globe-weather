"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  OrbitControls,
  Stars,
  Environment,
} from "@react-three/drei";

import { useRef } from "react";
import * as THREE from "three";

function Earth() {
  const earthRef = useRef<THREE.Group>(null!);

  const dayTexture = useLoader(
    THREE.TextureLoader,
    "/textures/earth-day.jpg"
  );

  const nightTexture = useLoader(
    THREE.TextureLoader,
    "/textures/earth-night.jpg"
  );

  // Improve texture quality
  dayTexture.colorSpace = THREE.SRGBColorSpace;
  nightTexture.colorSpace = THREE.SRGBColorSpace;

  dayTexture.anisotropy = 16;
  nightTexture.anisotropy = 16;

  useFrame((_, delta) => {
    // Very slow rotation instead of the boring fast spinning
    earthRef.current.rotation.y += delta * 0.025;
  });

  return (
    <group ref={earthRef}>

      {/* Main Earth */}
      <mesh>

        <sphereGeometry args={[2.25, 128, 128]} />

        <meshStandardMaterial
          map={dayTexture}
          roughness={0.8}
          metalness={0}
        />

      </mesh>


      {/* Night lights layer */}
      <mesh scale={[1.002, 1.002, 1.002]}>

        <sphereGeometry args={[2.25, 128, 128]} />

        <meshBasicMaterial
          map={nightTexture}
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />

      </mesh>


      {/* Atmosphere */}
      <mesh scale={[1.07, 1.07, 1.07]}>

        <sphereGeometry args={[2.25, 128, 128]} />

        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.075}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />

      </mesh>


      {/* Outer atmospheric glow */}
      <mesh scale={[1.12, 1.12, 1.12]}>

        <sphereGeometry args={[2.25, 128, 128]} />

        <meshBasicMaterial
          color="#2563eb"
          transparent
          opacity={0.035}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />

      </mesh>

    </group>
  );
}


function EarthScene() {
  return (
    <>
      {/* Space */}
      <color attach="background" args={["#020617"]} />

      <Stars
        radius={80}
        depth={50}
        count={5000}
        factor={3}
        saturation={0}
        fade
        speed={0.25}
      />


      {/* Sun light */}
      <directionalLight
        position={[5, 3, 5]}
        intensity={3}
      />

      <ambientLight intensity={0.35} />


      <Earth />


      {/* Camera controls */}
      <OrbitControls
        enableZoom={true}
        enablePan={false}

        minDistance={3.5}
        maxDistance={10}

        rotateSpeed={0.5}
        zoomSpeed={0.7}

        autoRotate={false}
      />
    </>
  );
}


export default function Globe() {
  return (
    <div className="w-full h-full rounded-3xl overflow-hidden">

      <Canvas
        camera={{
          position: [0, 0, 6.5],
          fov: 45,
        }}

        dpr={[1, 2]}
      >

        <EarthScene />

      </Canvas>

    </div>
  );
}