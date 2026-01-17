import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial, Float } from '@react-three/drei';
import * as THREE from 'three';

function Particles({ count = 5000 }) {
  const points = useRef<THREE.Points>(null!);
  
  // Generate particles in a spiral galaxy formation
  const positions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color1 = new THREE.Color('#F7E7CE'); // Alchemical Gold
    const color2 = new THREE.Color('#00FF41'); // Terminal Green
    const color3 = new THREE.Color('#8A2BE2'); // Electric Violet

    for (let i = 0; i < count; i++) {
      // Spiral logic
      const branchAngle = (i % 3) * ((2 * Math.PI) / 3);
      const radius = Math.random() * Math.random() * 10; // Concentrate near center
      const spinAngle = radius * 2; // Spin more as we go out
      
      const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.5;
      const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.5;
      const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.5;

      const x = Math.cos(branchAngle + spinAngle) * radius + randomX;
      const y = (Math.random() - 0.5) * (radius * 0.5) + randomY; // Flattened disk
      const z = Math.sin(branchAngle + spinAngle) * radius + randomZ;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color logic based on radius
      const mixedColor = color1.clone();
      if (radius > 6) {
        mixedColor.lerp(color2, 0.5);
      } else if (radius > 3) {
        mixedColor.lerp(color3, 0.3);
      }
      
      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }
    return { positions, colors };
  }, [count]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    // Rotate the entire galaxy
    points.current.rotation.y = time * 0.05;
    // Gentle wobble
    points.current.rotation.z = Math.sin(time * 0.1) * 0.05;
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points ref={points} positions={positions.positions} colors={positions.colors} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          vertexColors
          size={0.03}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>
    </group>
  );
}

function Core() {
  const mesh = useRef<THREE.Mesh>(null!);
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const scale = 1 + Math.sin(time * 2) * 0.1;
    mesh.current.scale.set(scale, scale, scale);
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshBasicMaterial color="#F7E7CE" transparent opacity={0.8} />
    </mesh>
  );
}

export function GravityWell() {
  return (
    <div className="w-full h-full absolute inset-0 z-0">
      <Canvas camera={{ position: [0, 2, 8], fov: 60 }}>
        <fog attach="fog" args={['#050505', 5, 15]} />
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
          <Particles count={6000} />
          <Core />
        </Float>
        {/* Ambient glow */}
        <pointLight position={[0, 0, 0]} intensity={2} color="#F7E7CE" distance={5} />
      </Canvas>
    </div>
  );
}
