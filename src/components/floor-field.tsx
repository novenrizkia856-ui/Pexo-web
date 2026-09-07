import { useEffect, useRef, type CSSProperties } from "react";
import * as THREE from "three";
import { scrollProgress } from "@/state/experience";

/**
 * The page backdrop: a price surface rendered as a point field, with a hard
 * plane beneath it standing in for the guard floor.
 *
 * It runs the length of the page and tells the product story as you scroll:
 *
 *   hero        rolling, unguarded price action
 *   problem     the swell turns choppy and cuts deeper -- the gap risk
 *   how         the floor draws itself in underneath
 *   guarantees  the surface clamps against it, visibly flat-bottomed
 *   keeper      ripples fire outward from random points, as guards are triggered
 *
 * Opacity is modulated per zone so the field is loudest over open space and
 * quietest behind body copy. It must never compete with reading.
 */

const COLS = 150;
const ROWS = 88;
const SPREAD_X = 38;
const SPREAD_Z = 22;
const FLOOR_Y = -1.9;

/** Smooth 0..1 ramp between two edges. */
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Piecewise lookup over scroll progress, smoothed between stops. */
function ramp(stops: readonly (readonly [number, number])[], x: number) {
  if (x <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i += 1) {
    const [px, pv] = stops[i - 1];
    const [cx, cv] = stops[i];
    if (x <= cx) return pv + (cv - pv) * smoothstep(px, cx, x);
  }
  return stops[stops.length - 1][1];
}

type Ripple = { x: number; z: number; born: number };

export function FloorField() {
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
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
    camera.position.set(0, 5.6, 15.5);
    camera.lookAt(0, -1.2, -2);

    // --- price surface, as points -------------------------------------------
    const count = COLS * ROWS;
    const positions = new Float32Array(count * 3);
    const base = new Float32Array(count * 2);
    const alphas = new Float32Array(count);

    let i = 0;
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const x = (c / (COLS - 1) - 0.5) * SPREAD_X;
        const z = (r / (ROWS - 1) - 0.5) * SPREAD_Z;
        positions[i * 3] = x;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = z;
        base[i * 2] = x;
        base[i * 2 + 1] = z;

        // Fade toward the edges so the field dissolves into the page rather
        // than ending on a hard rectangle.
        const edgeX = 1 - Math.min(1, Math.abs(x) / (SPREAD_X * 0.5));
        const edgeZ = 1 - Math.min(1, Math.abs(z) / (SPREAD_Z * 0.5));
        alphas[i] = Math.pow(Math.min(edgeX, edgeZ) * 1.6, 1.5);
        i += 1;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(0x0d0f12) },
        uFloorColor: { value: new THREE.Color(0x0f6b52) },
        uSize: { value: 1.7 * Math.min(window.devicePixelRatio, 2) },
        uOpacity: { value: 0.27 },
        uFloorY: { value: FLOOR_Y },
        /** How strongly points resting on the floor take the floor colour. */
        uFloorTint: { value: 0 },
      },
      vertexShader: [
        "attribute float aAlpha;",
        "uniform float uSize;",
        "uniform float uFloorY;",
        "varying float vAlpha;",
        "varying float vOnFloor;",
        "void main() {",
        "  vAlpha = aAlpha;",
        "  vOnFloor = 1.0 - smoothstep(uFloorY, uFloorY + 0.18, position.y);",
        "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
        "  gl_PointSize = uSize * (34.0 / -mv.z);",
        "  gl_Position = projectionMatrix * mv;",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uColor;",
        "uniform vec3 uFloorColor;",
        "uniform float uOpacity;",
        "uniform float uFloorTint;",
        "varying float vAlpha;",
        "varying float vOnFloor;",
        "void main() {",
        // Round the points off; square dots read as compression artefacts.
        "  vec2 d = gl_PointCoord - vec2(0.5);",
        "  if (dot(d, d) > 0.25) discard;",
        "  vec3 c = mix(uColor, uFloorColor, vOnFloor * uFloorTint);",
        "  gl_FragColor = vec4(c, vAlpha * uOpacity * (1.0 + vOnFloor * 0.6));",
        "}",
      ].join("\n"),
    });

    const field = new THREE.Points(geometry, material);
    field.position.y = -2.4;
    scene.add(field);

    // --- the floor ----------------------------------------------------------
    const floorGeometry = new THREE.BufferGeometry();
    const floorVerts: number[] = [];
    for (let c = 0; c < COLS; c += 10) {
      const x = (c / (COLS - 1) - 0.5) * SPREAD_X;
      floorVerts.push(x, FLOOR_Y, -SPREAD_Z / 2, x, FLOOR_Y, SPREAD_Z / 2);
    }
    for (let r = 0; r < ROWS; r += 10) {
      const z = (r / (ROWS - 1) - 0.5) * SPREAD_Z;
      floorVerts.push(-SPREAD_X / 2, FLOOR_Y, z, SPREAD_X / 2, FLOOR_Y, z);
    }
    floorGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(floorVerts, 3),
    );
    const floorMaterial = new THREE.LineBasicMaterial({
      color: 0x0f6b52,
      transparent: true,
      opacity: 0,
    });
    const floor = new THREE.LineSegments(floorGeometry, floorMaterial);
    floor.position.y = -2.4;
    scene.add(floor);

    // --- loop ---------------------------------------------------------------
    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const clock = new THREE.Clock();
    let frame = 0;
    let visible = true;
    let settle = 0;
    let ripples: Ripple[] = [];
    let nextRipple = 0;

    function resize() {
      const w = host!.clientWidth;
      const h = host!.clientHeight;
      if (w === 0 || h === 0) return;
      // updateStyle must stay on. With it off, three sets only the canvas
      // width/height attributes (which are multiplied by the pixel ratio) and
      // leaves the CSS size unset, so the element lays out at its intrinsic
      // pixel size: twice the intended width on a 2x display.
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function render() {
      frame = requestAnimationFrame(render);
      if (!visible) return;

      const t = reduced ? 0 : clock.getElapsedTime();
      settle += (scrollProgress.current - settle) * 0.07;
      const p = settle;

      // --- per-zone character ----------------------------------------------
      // Swell: calm, agitated through the problem framing, then held down.
      const swell = ramp(
        [[0, 1], [0.16, 1.15], [0.3, 1.45], [0.5, 1], [0.7, 0.72], [1, 0.6]],
        p,
      );
      // Chop: high-frequency detail, peaks with the gap risk.
      const chop = ramp([[0.05, 0], [0.3, 1], [0.52, 0.25], [1, 0.1]], p);
      // Clamp: how hard the surface is held above the floor.
      const clampAmount = ramp([[0.34, 0], [0.6, 1], [1, 1]], p);
      // Ripples: keepers firing, in the closing stretch.
      const rippleGain = ramp([[0.72, 0], [0.85, 1], [1, 1]], p);
      // Loud over open space, quiet behind body copy.
      const opacity = ramp(
        [[0, 0.27], [0.12, 0.13], [0.62, 0.15], [0.82, 0.24], [1, 0.27]],
        p,
      );
      // Sink the rig as the page is read, bringing the floor into view.
      const drop = ramp([[0, 0], [0.45, 0.9], [1, 1.25]], p);

      // --- ripple emission --------------------------------------------------
      if (!reduced && rippleGain > 0.02) {
        if (t > nextRipple) {
          nextRipple = t + 0.9 + Math.random() * 1.4;
          ripples.push({
            x: (Math.random() - 0.5) * SPREAD_X * 0.7,
            z: (Math.random() - 0.5) * SPREAD_Z * 0.7,
            born: t,
          });
        }
        if (ripples.length) ripples = ripples.filter((r) => t - r.born < 4.2);
      } else if (ripples.length) {
        ripples = [];
      }

      const arr = posAttr.array as Float32Array;
      for (let n = 0; n < count; n += 1) {
        const x = base[n * 2];
        const z = base[n * 2 + 1];

        let y =
          (Math.sin(x * 0.34 + t * 0.55) * 0.62 +
            Math.sin(z * 0.42 - t * 0.42) * 0.44 +
            Math.sin((x + z) * 0.22 + t * 0.31) * 0.5) *
          swell;

        if (chop > 0.01) {
          y +=
            (Math.sin(x * 1.15 - t * 1.5) * 0.2 +
              Math.sin(z * 1.32 + t * 1.15) * 0.16) *
            chop;
        }

        for (let k = 0; k < ripples.length; k += 1) {
          const rp = ripples[k];
          const age = t - rp.born;
          const dx = x - rp.x;
          const dz = z - rp.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const band = Math.exp(-Math.pow(dist - age * 4.2, 2) * 0.55);
          y += band * Math.max(0, 1 - age / 4.2) * 0.85 * rippleGain;
        }

        y -= drop;

        // The floor is the product promise: nothing goes below it.
        if (clampAmount > 0.001 && y < FLOOR_Y) {
          y = FLOOR_Y + (y - FLOOR_Y) * (1 - clampAmount);
        }

        arr[n * 3 + 1] = y;
      }
      posAttr.needsUpdate = true;

      material.uniforms.uOpacity.value = opacity;
      material.uniforms.uFloorTint.value = clampAmount;
      floorMaterial.opacity = ramp(
        [[0.3, 0], [0.55, 0.2], [0.8, 0.28], [1, 0.32]],
        p,
      );

      field.rotation.y = Math.sin(t * 0.06) * 0.045;
      floor.rotation.y = field.rotation.y;

      // Lift the mask once the hero is behind, so the field fills the frame
      // further down instead of only hugging the bottom edge.
      const maskStart = ramp([[0, 54], [0.16, 6], [1, 0]], p);
      host!.style.setProperty("--field-mask-start", maskStart + "%");
      host!.style.setProperty("--field-mask-mid", maskStart + 26 + "%");

      renderer.render(scene, camera);
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);

    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      geometry.dispose();
      material.dispose();
      floorGeometry.dispose();
      floorMaterial.dispose();
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
          "--field-mask-start": "54%",
          "--field-mask-mid": "80%",
          maskImage: maskValue,
          WebkitMaskImage: maskValue,
        } as CSSProperties
      }
    />
  );
}
