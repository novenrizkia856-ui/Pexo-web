import { useEffect, useRef, type CSSProperties } from "react";
import * as THREE from "three";
import { scrollProgress } from "@/state/experience";

/**
 * The page backdrop: a corridor of price paths running away to a horizon, over
 * a floor none of them cross.
 *
 * You are inside it rather than above it. The camera flies forward down the
 * corridor the whole time, and as the page is read it descends toward the
 * floor, so by the guarantees section you are skimming just over the plane the
 * paths are resting on. That descent is the argument the page is making, made
 * spatially: the floor stops being scenery and becomes the thing you are on.
 *
 *   hero        high over the corridor, floor far below and faint
 *   problem     the descent starts, paths begin cutting down
 *   how         the floor grid resolves underneath
 *   guarantees  skimming the plane, paths visibly flat against it
 *   keeper      lifting away again
 *
 * Every vertex is uploaded once. Motion is the camera moving, not geometry
 * being rewritten, so there is no per-frame CPU cost that scales with the
 * scene: the earlier backdrop rebuilt 13,200 points every frame, most of them
 * outside a portrait viewport. Depth is what the frustum culls here, not the
 * main thread.
 */

/** Colours, matching the design tokens. */
const INK = new THREE.Color("#0d0f12");
const FLOOR_COLOR = new THREE.Color("#0f6b52");

/** Spacing between samples along the corridor, in world units. */
const STEP_Z = 2;
/**
 * Distance after which the scene repeats exactly.
 *
 * The paths are generated periodic over this length and the grid is spaced to
 * divide into it, so wrapping the camera by exactly this leaves the view
 * unchanged. That is what makes the flight endless without any streaming.
 */
const PERIOD = 160;
/** How far ahead geometry exists. Must be a whole number of periods. */
const DEPTH = PERIOD * 3;

/** Eases a value through a set of stops. */
function ramp(stops: readonly (readonly [number, number])[], t: number): number {
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [x0, y0] = stops[i];
    const [x1, y1] = stops[i + 1];
    if (t <= x1) {
      const k = Math.min(1, Math.max(0, (t - x0) / (x1 - x0)));
      return y0 + (y1 - y0) * (k * k * (3 - 2 * k));
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * One lane's height profile, sampled along the corridor and made periodic.
 *
 * A random walk does not join up with itself, so the tail is cross faded into
 * the head. Without that the wrap point reads as a visible seam every few
 * seconds, which is the one thing that would give the loop away.
 */
function laneProfile(samples: number, volatility: number): Float32Array {
  const raw = new Float32Array(samples);
  let level = 0.45 + Math.random() * 0.35;
  let falling = 0;

  for (let i = 0; i < samples; i += 1) {
    if (falling > 0) {
      falling -= 1;
      level -= 0.05 + Math.random() * volatility;
    } else {
      level += (0.55 - level) * 0.04 + (Math.random() - 0.5) * volatility;
      if (Math.random() < 0.02) falling = 4 + Math.floor(Math.random() * 12);
    }
    if (level > 1) level = 1;
    // The floor. A hard clamp, never a bounce: a path that dipped under it,
    // even by a pixel, would contradict the only claim the product makes.
    if (level < 0) level = 0;
    raw[i] = level;
  }

  const blend = Math.floor(samples * 0.18);
  const out = Float32Array.from(raw);
  for (let i = 0; i < blend; i += 1) {
    const k = i / blend;
    const smooth = k * k * (3 - 2 * k);
    const tail = raw[samples - blend + i];
    const head = raw[i];
    out[samples - blend + i] = tail * (1 - smooth) + head * smooth;
  }
  // Clamping again, because the cross fade can only move values between two
  // already valid samples, but rounding should not be trusted to prove it.
  for (let i = 0; i < samples; i += 1) if (out[i] < 0) out[i] = 0;
  return out;
}

const VERTEX = `
  attribute float aOnFloor;
  attribute float aWeight;
  varying float vAlpha;
  varying float vOnFloor;
  uniform float uNear;
  uniform float uFar;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = -mv.z;

    // Fade in from just in front of the camera and out toward the horizon, so
    // geometry never pops at either end of the corridor.
    float near = smoothstep(uNear, uNear + 26.0, depth);
    float far = 1.0 - smoothstep(uFar * 0.16, uFar * 0.66, depth);

    vAlpha = aWeight * near * far;
    vOnFloor = aOnFloor;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = `
  precision mediump float;
  varying float vAlpha;
  varying float vOnFloor;
  uniform vec3 uInk;
  uniform vec3 uFloor;
  uniform float uOpacity;
  uniform float uFloorMix;

  void main() {
    // Only the stretches resting on the floor take the floor's colour. It is
    // the one moment the guarantee is doing something, so it is the one thing
    // in the backdrop that is not grey.
    vec3 color = mix(uInk, uFloor, vOnFloor * uFloorMix);
    float alpha = vAlpha * uOpacity * mix(1.0, 1.9, vOnFloor);
    if (alpha <= 0.001) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

export function FloorCorridor() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, 1, 0.5, DEPTH);

    const uniforms = {
      uInk: { value: INK },
      uFloor: { value: FLOOR_COLOR },
      uOpacity: { value: 0.5 },
      uFloorMix: { value: 0.2 },
      uNear: { value: 4 },
      uFar: { value: DEPTH * 0.82 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
    });

    let paths: THREE.LineSegments | null = null;
    let grid: THREE.LineSegments | null = null;

    /**
     * Builds the corridor for the current aspect.
     *
     * Lane spread follows the aspect so the composition holds in portrait
     * instead of showing a narrow slice of a scene framed for landscape.
     */
    function build(aspect: number) {
      for (const old of [paths, grid]) {
        if (!old) continue;
        scene.remove(old);
        old.geometry.dispose();
      }

      const halfWidth = Math.max(13, 15 * aspect);
      const lanes = aspect < 0.8 ? 11 : aspect < 1.4 ? 15 : 19;
      const samples = Math.round(PERIOD / STEP_Z);
      const total = Math.round(DEPTH / STEP_Z);
      const height = 13;

      // --- price paths -------------------------------------------------------
      const pathPos: number[] = [];
      const pathFloor: number[] = [];
      const pathWeight: number[] = [];

      for (let l = 0; l < lanes; l += 1) {
        const t = l / (lanes - 1);
        const x = (t - 0.5) * 2 * halfWidth;
        // Lanes near the centre line sit lower and read stronger; the outer
        // ones are faint, so the corridor has a middle rather than a wall.
        const centre = 1 - Math.abs(t - 0.5) * 2;
        const weight = 0.17 + centre * 0.5;
        const profile = laneProfile(samples, 0.05 + Math.random() * 0.05);
        const amp = height * (0.45 + centre * 0.55);

        let prevY = profile[0] * amp;
        let prevOnFloor = profile[0] === 0 ? 1 : 0;
        for (let i = 1; i <= total; i += 1) {
          const v = profile[i % samples];
          const y = v * amp;
          const onFloor = v === 0 ? 1 : 0;

          pathPos.push(x, prevY, -(i - 1) * STEP_Z, x, y, -i * STEP_Z);
          pathFloor.push(prevOnFloor, onFloor);
          pathWeight.push(weight, weight);

          prevY = y;
          prevOnFloor = onFloor;
        }
      }

      const pathGeo = new THREE.BufferGeometry();
      pathGeo.setAttribute("position", new THREE.Float32BufferAttribute(pathPos, 3));
      pathGeo.setAttribute("aOnFloor", new THREE.Float32BufferAttribute(pathFloor, 1));
      pathGeo.setAttribute("aWeight", new THREE.Float32BufferAttribute(pathWeight, 1));
      paths = new THREE.LineSegments(pathGeo, material);
      scene.add(paths);

      // --- the floor itself --------------------------------------------------
      // A grid, not a plane: the rungs streaming toward you are what makes the
      // motion legible, and an empty plane in a light theme is invisible.
      const gridPos: number[] = [];
      const gridFloor: number[] = [];
      const gridWeight: number[] = [];
      const rails = 9;
      const railGap = (halfWidth * 2) / (rails - 1);

      for (let r = 0; r < rails; r += 1) {
        const x = -halfWidth + r * railGap;
        gridPos.push(x, 0, 0, x, 0, -DEPTH);
        gridFloor.push(1, 1);
        gridWeight.push(0.14, 0.14);
      }

      const rungGap = STEP_Z * 5;
      for (let z = 0; z <= DEPTH; z += rungGap) {
        gridPos.push(-halfWidth, 0, -z, halfWidth, 0, -z);
        gridFloor.push(1, 1);
        gridWeight.push(0.22, 0.22);
      }

      const gridGeo = new THREE.BufferGeometry();
      gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridPos, 3));
      gridGeo.setAttribute("aOnFloor", new THREE.Float32BufferAttribute(gridFloor, 1));
      gridGeo.setAttribute("aWeight", new THREE.Float32BufferAttribute(gridWeight, 1));
      grid = new THREE.LineSegments(gridGeo, material);
      scene.add(grid);
    }

    function resize() {
      const w = host!.clientWidth;
      const h = host!.clientHeight;
      if (w === 0 || h === 0) return;

      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      build(camera.aspect);
    }

    let frame = 0;
    let visible = true;
    let travelled = 0;
    let eased = 0;
    let last = performance.now();

    function draw(now: number) {
      const dt = Math.min(64, now - last);
      last = now;

      eased += (scrollProgress.current - eased) * 0.06;

      // Descending toward the floor as the page is read.
      const camY = ramp(
        [
          [0, 7.4],
          [0.3, 5.2],
          [0.68, 2.1],
          [0.9, 3.4],
          [1, 5],
        ],
        eased,
      );
      const speed = ramp(
        [
          [0, 24],
          [0.35, 36],
          [0.7, 28],
          [1, 19],
        ],
        eased,
      );
      uniforms.uOpacity.value = ramp(
        [
          [0, 0.8],
          [0.2, 1],
          [0.75, 1],
          [1, 0.8],
        ],
        eased,
      );
      // The floor's colour arrives with the guarantee, not before it.
      uniforms.uFloorMix.value = ramp(
        [
          [0, 0.35],
          [0.3, 0.7],
          [0.65, 1],
          [1, 0.9],
        ],
        eased,
      );

      if (!reduced) travelled += (dt / 1000) * speed;
      // Wrap by exactly one period, which the geometry repeats over, so the
      // corridor never ends and nothing has to be rebuilt.
      const z = -(travelled % PERIOD);

      camera.position.set(0, camY, z);
      camera.lookAt(0, camY + 3.4, z - 30);

      renderer.render(scene, camera);

      // Lift the mask once the hero is behind, so the corridor fills the frame
      // further down instead of only hugging the bottom edge.
      const maskStart = ramp(
        [
          [0, 26],
          [0.16, 2],
          [1, 0],
        ],
        eased,
      );
      host!.style.setProperty("--field-mask-start", maskStart + "%");
      host!.style.setProperty("--field-mask-mid", maskStart + 22 + "%");
    }

    function loop(now: number) {
      frame = requestAnimationFrame(loop);
      if (!visible) return;
      draw(now);
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      // Skip the gap, or the flight lurches forward by however long we slept.
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) {
      draw(performance.now());
    } else {
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      for (const mesh of [paths, grid]) mesh?.geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  const maskValue =
    "linear-gradient(to bottom, transparent 0%, transparent var(--field-mask-start), #000 var(--field-mask-mid), #000 100%)";

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={
        {
          "--field-mask-start": "26%",
          "--field-mask-mid": "50%",
          maskImage: maskValue,
          WebkitMaskImage: maskValue,
        } as CSSProperties
      }
    />
  );
}
