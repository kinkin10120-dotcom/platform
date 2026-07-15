"use client";

import { useEffect, useRef, useState } from "react";

// eslint-disable-next-line
type OcctInstance = any;

let occtPromise: Promise<OcctInstance> | null = null;
function getOcct(): Promise<OcctInstance> {
  if (!occtPromise) {
    occtPromise = import("occt-import-js").then((m) =>
      m.default({ locateFile: (p: string) => `/${p}` })
    );
  }
  return occtPromise;
}

const STEP_LABELS: Record<string, string> = {
  wasm: "엔진 초기화 중...",
  download: "파일 다운로드 중...",
  parse: "3D 파싱 중...",
  render: "렌더링 중...",
};

// BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
const FACE_INFO = [
  { label: "RIGHT",  camPos: [ 1, 0,  0], camUp: [0, 1, 0], hDim: "z", vDim: "y" },
  { label: "LEFT",   camPos: [-1, 0,  0], camUp: [0, 1, 0], hDim: "z", vDim: "y" },
  { label: "TOP",    camPos: [ 0, 1,  0], camUp: [0, 0,-1], hDim: "x", vDim: "z" },
  { label: "BOTTOM", camPos: [ 0,-1,  0], camUp: [0, 0, 1], hDim: "x", vDim: "z" },
  { label: "FRONT",  camPos: [ 0, 0,  1], camUp: [0, 1, 0], hDim: "x", vDim: "y" },
  { label: "BACK",   camPos: [ 0, 0, -1], camUp: [0, 1, 0], hDim: "x", vDim: "y" },
] as const;

function makeFaceCanvas(label: string, hovered: boolean) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = hovered ? "#ddeeff" : "#f4f7fa";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = hovered ? "#5588cc" : "#c0ccd8";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 125, 125);
  ctx.fillStyle = hovered ? "#1a3d6e" : "#6b7a8d";
  ctx.font = "500 21px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 64, 64);
  return c;
}

function makeAxisSprite(THREE: any, text: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.font = "bold 46px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, 32, 35);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })
  );
  sprite.scale.set(0.26, 0.26, 0.26);
  return sprite;
}

export default function StepViewer({ url, height = 300 }: { url: string; height?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const gizmoRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [step, setStep] = useState<keyof typeof STEP_LABELS>("wasm");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!mountRef.current) return;

    let cancelled = false;
    let animId: number;
    let r: import("three").WebGLRenderer | null = null;
    let gizmoR: import("three").WebGLRenderer | null = null;

    async function init() {
      try {
        setStep("wasm");
        const [THREE, { OrbitControls }, occt] = await Promise.all([
          import("three"),
          import("three/examples/jsm/controls/OrbitControls.js"),
          getOcct(),
        ]);

        setStep("download");
        const res = await fetch(`/api/stp-proxy?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error(await res.text());
        const fileContent = new Uint8Array(await res.arrayBuffer());

        setStep("parse");
        const result = occt.ReadStepFile(fileContent, {
          linearUnit: "millimeter",
          linearDeflectionType: "bounding_box_ratio",
          linearDeflection: 0.05,
          angularDeflection: 0.5,
        });
        if (!result.success) throw new Error("STP 파일을 파싱할 수 없습니다.");
        if (cancelled) return;

        setStep("render");
        const mount = mountRef.current!;
        const W = mount.clientWidth || 460;
        const H = mount.clientHeight || height;

        r = new THREE.WebGLRenderer({ antialias: true });
        r.setSize(W, H);
        r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mount.appendChild(r.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        // ── Cameras ──────────────────────────────────────────────
        const perspCam = new THREE.PerspectiveCamera(45, W / H, 0.001, 100000);
        const aspect = W / H;
        let orthoCam: import("three").OrthographicCamera | null = null;
        let activeCam: import("three").Camera = perspCam;
        let activeFaceIdx = -1;

        function setupControls(cam: import("three").Camera) {
          const c = new OrbitControls(cam, r!.domElement);
          c.enableDamping = true;
          c.dampingFactor = 0.05;
          c.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.PAN,
          };
          return c;
        }
        let controls = setupControls(perspCam);

        // Lighting
        scene.add(new THREE.HemisphereLight(0xffffff, 0xd0d0d0, 0.8));
        const dir1 = new THREE.DirectionalLight(0xffffff, 0.9);
        dir1.position.set(2, 3, 4); scene.add(dir1);
        const dir2 = new THREE.DirectionalLight(0xffffff, 0.4);
        dir2.position.set(-2, -1, -3); scene.add(dir2);

        const group = new THREE.Group();
        for (const mesh of result.meshes) {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3));
          if (mesh.attributes.normal) {
            geo.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3));
          } else {
            geo.computeVertexNormals();
          }
          geo.setIndex(mesh.index.array);
          group.add(new THREE.Mesh(
            geo,
            new THREE.MeshPhongMaterial({ color: 0x6ab0d8, side: THREE.DoubleSide, shininess: 60, specular: 0x445566 })
          ));
          group.add(new THREE.LineSegments(
            new THREE.EdgesGeometry(geo, 40),
            new THREE.LineBasicMaterial({ color: 0x1a2a3a, transparent: true, opacity: 0.7 })
          ));
        }
        scene.add(group);

        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        group.position.sub(center);

        const bb = new THREE.Box3().setFromObject(group);
        const bboxHelper = new THREE.Box3Helper(bb, new THREE.Color(0xaabbcc));
        scene.add(bboxHelper);

        // Init perspective camera
        perspCam.near = maxDim * 0.001;
        perspCam.far = maxDim * 100;
        perspCam.position.set(maxDim * 1.5, maxDim * 0.8, maxDim * 1.5);
        perspCam.updateProjectionMatrix();
        controls.update();

        // Init ortho camera
        const fs = maxDim * 1.6;
        orthoCam = new THREE.OrthographicCamera(-fs * aspect / 2, fs * aspect / 2, fs / 2, -fs / 2, -maxDim * 500, maxDim * 500);

        // ── Snap to face (ortho) ──────────────────────────────────
        function snapToFace(fi: number) {
          const face = FACE_INFO[fi];
          const dist = maxDim * 5;
          orthoCam!.position.set(face.camPos[0] * dist, face.camPos[1] * dist, face.camPos[2] * dist);
          orthoCam!.up.set(face.camUp[0], face.camUp[1], face.camUp[2]);
          orthoCam!.lookAt(0, 0, 0);
          orthoCam!.updateProjectionMatrix();
          controls.dispose();
          controls = setupControls(orthoCam!);
          controls.target.set(0, 0, 0);
          controls.update();
          activeCam = orthoCam!;
          activeFaceIdx = fi;
        }

        // ── SVG dimension overlay ─────────────────────────────────
        const SVG_NS = "http://www.w3.org/2000/svg";

        function projectPt(v3: import("three").Vector3) {
          const v = v3.clone().project(activeCam);
          return { x: (v.x + 1) / 2 * W, y: (1 - (v.y + 1) / 2) * H };
        }

        const dimTexts: SVGTextElement[] = [];

        if (svgRef.current) {
          const svg = svgRef.current;
          svg.setAttribute("width", String(W));
          svg.setAttribute("height", String(H));
          for (let i = 0; i < 3; i++) {
            const t = document.createElementNS(SVG_NS, "text") as SVGTextElement;
            t.setAttribute("fill", "#444");
            t.setAttribute("font-size", "12");
            t.setAttribute("font-family", "-apple-system, system-ui, sans-serif");
            t.setAttribute("text-anchor", "middle");
            t.setAttribute("dominant-baseline", "middle");
            svg.appendChild(t);
            dimTexts.push(t);
          }
        }

        // Place label at the midpoint of a bounding box edge, offset outward from model center
        function drawDimLabel(
          textIdx: number,
          pt3A: import("three").Vector3, pt3B: import("three").Vector3,
          label: string
        ) {
          const pA = projectPt(pt3A);
          const pB = projectPt(pt3B);
          const midPt = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 };
          const centerPt = projectPt(new THREE.Vector3(0, 0, 0));

          // Direction away from model center
          let nx = midPt.x - centerPt.x, ny = midPt.y - centerPt.y;
          const nLen = Math.sqrt(nx * nx + ny * ny) || 1;
          nx /= nLen; ny /= nLen;

          const OFF = 16;
          dimTexts[textIdx].setAttribute("x", String(Math.round(midPt.x + nx * OFF)));
          dimTexts[textIdx].setAttribute("y", String(Math.round(midPt.y + ny * OFF)));
          dimTexts[textIdx].textContent = label;
        }

        function updateDimOverlay() {
          if (!svgRef.current || dimTexts.length < 3) return;

          drawDimLabel(0,
            new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z),
            new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z),
            `${size.x.toFixed(2)} mm`
          );
          drawDimLabel(1,
            new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z),
            new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z),
            `${size.y.toFixed(2)} mm`
          );
          drawDimLabel(2,
            new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z),
            new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z),
            `${size.z.toFixed(2)} mm`
          );
        }

        // ── Gizmo cube ───────────────────────────────────────────
        const GIZMO_PX = 90;
        const gizmoScene = new THREE.Scene();
        gizmoScene.add(new THREE.AmbientLight(0xffffff, 1));
        const gizmoCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

        const faceMaterials = FACE_INFO.map(({ label }) =>
          new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(makeFaceCanvas(label, false)) })
        );
        const gizmoCube = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.68, 0.68), faceMaterials);
        gizmoScene.add(gizmoCube);
        gizmoScene.add(new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(0.68, 0.68, 0.68)),
          new THREE.LineBasicMaterial({ color: 0xa0b0c0 })
        ));

        const mkArrow = (dir: [number, number, number], color: number) =>
          new THREE.ArrowHelper(new THREE.Vector3(...dir).normalize(), new THREE.Vector3(0, 0, 0), 0.92, color, 0.17, 0.08);
        gizmoScene.add(mkArrow([1, 0, 0], 0xff3b30));
        gizmoScene.add(mkArrow([0, 1, 0], 0x34c759));
        gizmoScene.add(mkArrow([0, 0, 1], 0x007aff));

        const xSp = makeAxisSprite(THREE, "X", "#ff3b30"); xSp.position.set(1.12, 0, 0); gizmoScene.add(xSp);
        const ySp = makeAxisSprite(THREE, "Y", "#34c759"); ySp.position.set(0, 1.12, 0); gizmoScene.add(ySp);
        const zSp = makeAxisSprite(THREE, "Z", "#007aff"); zSp.position.set(0, 0, 1.12); gizmoScene.add(zSp);

        if (gizmoRef.current) {
          gizmoR = new THREE.WebGLRenderer({ antialias: true, alpha: true });
          gizmoR.setSize(GIZMO_PX, GIZMO_PX);
          gizmoR.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          gizmoRef.current.appendChild(gizmoR.domElement);

          let hoveredFace = -1;
          gizmoR.domElement.style.cursor = "pointer";
          const raycaster = new THREE.Raycaster();

          const getHitFace = (e: MouseEvent) => {
            const rect = gizmoR!.domElement.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(new THREE.Vector2(x, y), gizmoCamera);
            const hits = raycaster.intersectObject(gizmoCube);
            return hits.length ? hits[0].face!.materialIndex : -1;
          };

          gizmoR.domElement.addEventListener("click", (e) => {
            const fi = getHitFace(e);
            if (fi >= 0) snapToFace(fi);
          });
          gizmoR.domElement.addEventListener("mousemove", (e) => {
            const fi = getHitFace(e);
            if (fi !== hoveredFace) {
              hoveredFace = fi;
              FACE_INFO.forEach(({ label }, i) => {
                const mat = faceMaterials[i] as import("three").MeshBasicMaterial;
                mat.map = new THREE.CanvasTexture(makeFaceCanvas(label, i === fi));
                mat.needsUpdate = true;
              });
            }
          });
          gizmoR.domElement.addEventListener("mouseleave", () => {
            hoveredFace = -1;
            FACE_INFO.forEach(({ label }, i) => {
              const mat = faceMaterials[i] as import("three").MeshBasicMaterial;
              mat.map = new THREE.CanvasTexture(makeFaceCanvas(label, false));
              mat.needsUpdate = true;
            });
          });
        }

        setStatus("ready");

        function animate() {
          if (cancelled) return;
          animId = requestAnimationFrame(animate);
          controls.update();
          r!.render(scene, activeCam);
          updateDimOverlay();

          if (gizmoR) {
            gizmoCamera.position.copy((activeCam as import("three").PerspectiveCamera).position).normalize().multiplyScalar(3);
            gizmoCamera.lookAt(0, 0, 0);
            gizmoCamera.up.copy(activeCam.up);
            gizmoCamera.updateProjectionMatrix();
            gizmoR.render(gizmoScene, gizmoCamera);
          }
        }
        animate();
      } catch (e: unknown) {
        if (!cancelled) {
          setErrorMsg(e instanceof Error ? e.message : "알 수 없는 오류");
          setStatus("error");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      if (r) { r.dispose(); r.domElement.remove(); }
      if (gizmoR) { gizmoR.dispose(); gizmoR.domElement.remove(); }
    };
  }, [url, height]);

  return (
    /* outer div: no overflow-hidden so SVG dim labels aren't clipped */
    <div className="relative rounded-lg bg-white" style={{ height }}>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg">
          <div className="space-y-2 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <p className="text-xs text-gray-400">{STEP_LABELS[step]}</p>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center rounded-lg">
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* Three.js canvas — clipped inside rounded corners */}
      <div ref={mountRef} className="h-full w-full overflow-hidden rounded-lg" />

      {/* SVG dimension overlay — sits on top, not clipped */}
      <svg ref={svgRef} className="absolute inset-0 pointer-events-none" style={{ overflow: "visible" }} />

      {/* Orientation gizmo — bottom-left */}
      <div ref={gizmoRef} className="absolute bottom-2 left-2" style={{ width: 90, height: 90 }} />
    </div>
  );
}
