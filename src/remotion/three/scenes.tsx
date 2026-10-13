import { ThreeCanvas } from '@remotion/three';
import { useEffect, useMemo, useState } from 'react';
import { Easing, interpolate, random, useCurrentFrame, useDelayRender, useVideoConfig } from 'remotion';
import * as THREE from 'three';

/*
 * Three.js scenes. ThreeCanvas never runs its own clock while rendering, so
 * every motion here is a function of the Remotion frame and the export
 * matches the preview frame for frame.
 */

/**
 * Textures for a list of image URLs, holding the render until every one has
 * loaded (or failed, which leaves a null). Callers mount their ThreeCanvas
 * only once `ready`: while rendering, the canvas draws when its frame
 * changes, so a texture arriving after that draw would never be seen.
 */
export function useImageTextures(urls: Array<string | null>): { textures: Array<THREE.Texture | null>; ready: boolean } {
  const key = urls.join('|');
  const [state, setState] = useState<{ key: string; textures: Array<THREE.Texture | null> } | null>(null);
  const { delayRender, continueRender } = useDelayRender();
  useEffect(() => {
    const handle = delayRender(`Loading ${urls.length} textures`);
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    void Promise.all(
      urls.map((url) =>
        url
          ? loader.loadAsync(url).then(
              (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.anisotropy = 4;
                return texture;
              },
              () => null,
            )
          : Promise.resolve(null),
      ),
    ).then((textures) => {
      if (alive) setState({ key, textures });
      continueRender(handle);
    });
    return () => {
      alive = false;
      continueRender(handle);
    };
  }, [key]); // `key` stands for `urls`, which is a new array every render
  const ready = state?.key === key;
  return { textures: ready ? state.textures : urls.map(() => null), ready };
}

const HOLO_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// A CD's data side: silver, with a thin-film rainbow that slides around as
// the disc tilts, fine grooves and a couple of hard light streaks.
const HOLO_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  vec3 hsv(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float facing = dot(vView, vNormal);
    float hue = fract(a / 6.2831 * 2.0 + r * 1.2 + facing * 0.9 + uTime * 0.08);
    vec3 film = hsv(vec3(hue, 0.6, 1.0));
    float grooves = 0.88 + 0.12 * sin(r * 520.0);
    float streak = pow(abs(cos(a + uTime * 0.6)), 60.0) * 0.9;
    vec3 silver = vec3(0.80, 0.82, 0.86);
    vec3 col = mix(silver, film, 0.55 + 0.25 * (1.0 - facing)) * grooves + streak;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Disc({ art, spin, tilt }: { art: THREE.Texture | null; spin: number; tilt: number }) {
  const frame = useCurrentFrame();
  const holo = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: HOLO_VERTEX,
        fragmentShader: HOLO_FRAGMENT,
        side: THREE.DoubleSide,
      }),
    [],
  );
  holo.uniforms.uTime!.value = frame / 30;
  return (
    <group rotation={[tilt, Math.sin(frame / 40) * 0.35, 0]}>
      <group rotation={[0, 0, spin]}>
        <mesh material={holo}>
          <ringGeometry args={[0.16, 1, 160, 1]} />
        </mesh>
        <mesh position={[0, 0, 0.004]}>
          <ringGeometry args={[0.16, 0.6, 96, 1]} />
          {/* Keyed, so the textured material is a new one rather than the placeholder with a map added. */}
          {art ? <meshBasicMaterial key="art" map={art} /> : <meshBasicMaterial key="blank" color="#111" />}
        </mesh>
        <mesh position={[0, 0, 0.006]}>
          <ringGeometry args={[0.13, 0.2, 64, 1]} />
          <meshBasicMaterial color="#e8e8e8" transparent opacity={0.6} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A spinning holographic CD with album art printed on its label. Ring UVs map
 * the whole square, so the art shows through the label ring as a circle.
 */
export function HoloDisc({ art, size, enterAt = 0, speed = 1 }: { art: string | null; size: number; enterAt?: number; speed?: number }) {
  const frame = useCurrentFrame();
  const { textures, ready } = useImageTextures([art]);
  const enter = interpolate(frame - enterAt, [0, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.6)) });
  const spin = -frame * 0.045 * speed - (1 - enter) * 3;
  if (!ready) return null;
  return (
    <ThreeCanvas width={size} height={size} camera={{ fov: 30, position: [0, 0, 4.4] }} gl={{ antialias: true, alpha: true }}>
      <group scale={enter}>
        <Disc art={textures[0] ?? null} spin={spin} tilt={-0.35 + Math.sin(frame / 50) * 0.12} />
      </group>
    </ThreeCanvas>
  );
}

/**
 * Album art on a turning ring, landing on each in turn: `index(frame)` says
 * which faces the camera, and the ring eases from one to the next.
 */
export function ArtCarousel({ images, width, height, holdFrames, startAt = 0 }: {
  images: Array<string | null>;
  width: number;
  height: number;
  holdFrames: number;
  startAt?: number;
}) {
  const frame = useCurrentFrame();
  const count = images.length;
  const step = (2 * Math.PI) / count;
  const local = Math.max(0, frame - startAt);
  const index = Math.min(count - 1, Math.floor(local / holdFrames));
  const within = local - index * holdFrames;
  // The first image is already facing; each later one swings in over 14 frames.
  const position =
    index === 0 ? 0 : interpolate(within, [0, 14], [index - 1, index], { extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.3)) });
  const angle = -position * step;
  const radius = 2.1;
  const { textures, ready } = useImageTextures(images);
  if (!ready) return null;
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 32, position: [0, 0.5, 6.4] }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={1} />
      <group rotation={[0.08, angle, 0]}>
        {textures.map((texture, i) => (
          <ArtPlane key={i} texture={texture} angle={i * step} radius={radius} lit={i === index} />
        ))}
      </group>
    </ThreeCanvas>
  );
}

function ArtPlane({ texture, angle, radius, lit }: { texture: THREE.Texture | null; angle: number; radius: number; lit: boolean }) {
  return (
    <group rotation={[0, angle, 0]}>
      <group position={[0, 0, radius]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[1.86, 1.86]} />
          <meshBasicMaterial color={lit ? '#ffffff' : '#bdbdbd'} />
        </mesh>
        <mesh>
          <planeGeometry args={[1.7, 1.7]} />
          {texture ? <meshBasicMaterial key="art" map={texture} color={lit ? '#ffffff' : '#8a8a8a'} /> : <meshBasicMaterial key="blank" color="#333" />}
        </mesh>
      </group>
    </group>
  );
}

/**
 * The listening clock as a turntable: 24 bars round a platter, each as tall as
 * that hour's share, the busiest in the accent colour. It grows in, then turns.
 */
export function Turntable({ hours, peakHour, width, height, accent, base }: {
  hours: number[];
  peakHour: number;
  width: number;
  height: number;
  accent: string;
  base: string;
}) {
  const frame = useCurrentFrame();
  const max = Math.max(1, ...hours);
  const turn = interpolate(frame, [0, 180], [0.6, -0.4]);
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 34, position: [0, 4.4, 6.6] }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 6, 4]} intensity={2.2} />
      <group rotation={[0, turn, 0]}>
        <mesh position={[0, -0.06, 0]}>
          <cylinderGeometry args={[2.25, 2.25, 0.12, 96]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.36, 48]} />
          <meshBasicMaterial color="#555" />
        </mesh>
        {hours.map((minutes, hour) => {
          const grow = interpolate(frame - 8 - hour * 1.2, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
          const h = Math.max(0.04, (minutes / max) * 1.7 * grow);
          // Midnight at the back, the day running clockwise seen from above.
          const a = -(hour / 24) * Math.PI * 2 + Math.PI;
          const r = 1.55;
          return (
            <mesh key={hour} position={[Math.sin(a) * r, h / 2, Math.cos(a) * r]} rotation={[0, a, 0]}>
              <boxGeometry args={[0.26, h, 0.5]} />
              <meshStandardMaterial color={hour === peakHour ? accent : base} roughness={0.35} />
            </mesh>
          );
        })}
      </group>
    </ThreeCanvas>
  );
}

/** Paper confetti tumbling down, for the big moments. */
export function Confetti({ width, height, colors, count = 70, seed = 'confetti' }: {
  width: number;
  height: number;
  colors: string[];
  count?: number;
  seed?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 50, position: [0, 0, 10] }} gl={{ antialias: true, alpha: true }}>
      {Array.from({ length: count }, (_, i) => {
        const x = (random(`${seed}x${i}`) - 0.5) * 11;
        const fall = 1.2 + random(`${seed}s${i}`) * 1.6;
        const y = 9 - ((random(`${seed}y${i}`) * 22 + t * fall) % 22) ;
        const spin = t * (1 + random(`${seed}r${i}`) * 3);
        return (
          <mesh key={i} position={[x + Math.sin(t + i) * 0.3, y, (random(`${seed}z${i}`) - 0.5) * 4]} rotation={[spin, spin * 0.7, i]}>
            <planeGeometry args={[0.32, 0.18]} />
            <meshBasicMaterial color={colors[i % colors.length]} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </ThreeCanvas>
  );
}
