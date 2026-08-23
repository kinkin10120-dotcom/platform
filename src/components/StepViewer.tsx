"use client";

import { useEffect, useRef, useState } from "react";
import { Layers, Eye, EyeOff, MapPin, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createAnnotation, listenAnnotations } from "@/lib/firestore/annotations";
import { ModelAnnotation } from "@/lib/types";
import AnnotationThread from "@/components/AnnotationThread";

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

export default function StepViewer({
  url,
  height = 300,
  taskId,
  fileId,
}: {
  url: string;
  height?: number;
  // 리뷰 핀 기능은 taskId/fileId가 있을 때만 켜진다 — 견적 상담 단계에서 받는 도면처럼
  // 아직 프로젝트/업무가 없는 파일은 이 둘 없이 보기 전용으로 쓸 수 있다.
  taskId?: string;
  fileId?: string;
}) {
  const { appUser } = useAuth();
  const mountRef = useRef<HTMLDivElement>(null);
  const gizmoRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [step, setStep] = useState<keyof typeof STEP_LABELS>("wasm");
  const [errorMsg, setErrorMsg] = useState("");
  const [parts, setParts] = useState<{ name: string; visible: boolean }[]>([]);
  const [showPartsPanel, setShowPartsPanel] = useState(false);
  const partGroupsRef = useRef<import("three").Group[]>([]);

  // ── 3D 모델 위 리뷰 핀 ─────────────────────────────────────────
  const [annotations, setAnnotations] = useState<ModelAnnotation[]>([]);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<{ localPos: { x: number; y: number; z: number }; screenX: number; screenY: number } | null>(null);
  const [pinText, setPinText] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  // three.js의 animate() 루프/이벤트 리스너는 init() 안에서 딱 한 번 만들어지는 클로저라
  // React state를 직접 참조하면 그 시점 값에 갇힌다 — 매 프레임 최신 값을 읽도록 ref로 미러링.
  const annotationsRef = useRef<ModelAnnotation[]>([]);
  const annotateModeRef = useRef(false);
  const pinElsRef = useRef<Map<string, { group: SVGGElement; circle: SVGCircleElement; text: SVGTextElement }>>(new Map());

  const annotationsEnabled = !!taskId && !!fileId;

  useEffect(() => {
    if (!taskId || !fileId) return;
    return listenAnnotations(taskId, fileId, setAnnotations);
  }, [taskId, fileId]);
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);
  useEffect(() => { annotateModeRef.current = annotateMode; }, [annotateMode]);

  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId) ?? null;

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
        const partGroups: import("three").Group[] = [];
        result.meshes.forEach((mesh: any, i: number) => {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3));
          if (mesh.attributes.normal) {
            geo.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3));
          } else {
            geo.computeVertexNormals();
          }
          geo.setIndex(mesh.index.array);
          const partGroup = new THREE.Group();
          partGroup.name = mesh.name || `part-${i + 1}`;
          partGroup.add(new THREE.Mesh(
            geo,
            new THREE.MeshPhongMaterial({ color: 0x6ab0d8, side: THREE.DoubleSide, shininess: 60, specular: 0x445566 })
          ));
          partGroup.add(new THREE.LineSegments(
            new THREE.EdgesGeometry(geo, 40),
            new THREE.LineBasicMaterial({ color: 0x1a2a3a, transparent: true, opacity: 0.7 })
          ));
          group.add(partGroup);
          partGroups.push(partGroup);
        });
        scene.add(group);
        partGroupsRef.current = partGroups;
        if (partGroups.length > 1) {
          setParts(partGroups.map((g) => ({ name: g.name, visible: true })));
        }

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

        // ── Snap to an arbitrary face direction (ortho) ───────────
        function snapToDirection(normal: import("three").Vector3) {
          const dist = maxDim * 5;
          // 노멀과 가장 덜 평행한 월드축을 up 기준으로 선택 (짐벌락 방지)
          const worldUp = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
          const right = new THREE.Vector3().crossVectors(worldUp, normal).normalize();
          const up = new THREE.Vector3().crossVectors(normal, right).normalize();

          orthoCam!.position.copy(normal).multiplyScalar(dist);
          orthoCam!.up.copy(up);
          orthoCam!.lookAt(0, 0, 0);
          orthoCam!.updateProjectionMatrix();
          controls.dispose();
          controls = setupControls(orthoCam!);
          controls.target.set(0, 0, 0);
          controls.update();
          activeCam = orthoCam!;
        }

        function snapToFace(fi: number) {
          const face = FACE_INFO[fi];
          snapToDirection(new THREE.Vector3(face.camPos[0], face.camPos[1], face.camPos[2]));
          activeFaceIdx = fi;
        }

        // ── 모델 면 클릭 → 그 면 정면으로 시점 전환 ─────────────────
        const modelRaycaster = new THREE.Raycaster();
        let downX = 0, downY = 0;

        function getModelMeshes() {
          const meshes: import("three").Mesh[] = [];
          group.traverse((c) => {
            if ((c as import("three").Mesh).isMesh) meshes.push(c as import("three").Mesh);
          });
          return meshes;
        }

        r.domElement.addEventListener("pointerdown", (e) => {
          downX = e.clientX; downY = e.clientY;
        });

        r.domElement.addEventListener("pointerup", (e) => {
          const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
          if (moved > 5) return; // 드래그(회전)로 판단 — 스냅 무시

          const rect = r!.domElement.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          modelRaycaster.setFromCamera(new THREE.Vector2(x, y), activeCam);
          const hits = modelRaycaster.intersectObjects(getModelMeshes());
          if (!hits.length || !hits[0].face) return;

          // 핀 찍기 모드면 카메라 스냅 대신, 맞은 지점을 모델 로컬 좌표(group.position 기준)로
          // 저장해두고 첫 코멘트를 입력받을 팝오버를 그 화면 좌표에 띄운다.
          if (annotateModeRef.current) {
            const local = hits[0].point.clone().sub(group.position);
            setPendingPin({
              localPos: { x: local.x, y: local.y, z: local.z },
              screenX: e.clientX - rect.left,
              screenY: e.clientY - rect.top,
            });
            return;
          }

          const worldNormal = hits[0].face.normal
            .clone()
            .transformDirection(hits[0].object.matrixWorld)
            .normalize();
          activeFaceIdx = -1;
          snapToDirection(worldNormal);
        });

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

        // ── 3D 모델 위 리뷰 핀 오버레이 ──────────────────────────────
        // 치수 라벨과 같은 방식으로, 핀의 모델 로컬 좌표를 매 프레임 현재 카메라 기준
        // 화면 좌표로 재투영한다 — 카메라를 돌려도 핀이 모델 표면에 붙어있게 보인다.
        function updateAnnotationOverlay() {
          if (!svgRef.current) return;
          const svg = svgRef.current;
          const currentIds = new Set(annotationsRef.current.map((a) => a.id));

          for (const [id, els] of pinElsRef.current) {
            if (!currentIds.has(id)) {
              svg.removeChild(els.group);
              pinElsRef.current.delete(id);
            }
          }

          for (const ann of annotationsRef.current) {
            let els = pinElsRef.current.get(ann.id);
            if (!els) {
              const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
              g.style.cursor = "pointer";
              g.style.pointerEvents = "auto";
              const circle = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
              circle.setAttribute("r", "10");
              circle.setAttribute("stroke", "#fff");
              circle.setAttribute("stroke-width", "2");
              const text = document.createElementNS(SVG_NS, "text") as SVGTextElement;
              text.setAttribute("text-anchor", "middle");
              text.setAttribute("dominant-baseline", "central");
              text.setAttribute("fill", "#fff");
              text.setAttribute("font-size", "11");
              text.setAttribute("font-weight", "700");
              text.style.pointerEvents = "none";
              g.appendChild(circle);
              g.appendChild(text);
              g.addEventListener("click", (ev) => {
                ev.stopPropagation();
                setSelectedAnnotationId(ann.id);
              });
              svg.appendChild(g);
              els = { group: g, circle, text };
              pinElsRef.current.set(ann.id, els);
            }
            els.circle.setAttribute("fill", ann.resolved ? "#86868b" : "#ff3b30");
            els.text.textContent = String(ann.number);
            const worldPos = new THREE.Vector3(ann.position.x, ann.position.y, ann.position.z).add(group.position);
            const p = projectPt(worldPos);
            els.circle.setAttribute("cx", String(p.x));
            els.circle.setAttribute("cy", String(p.y));
            els.text.setAttribute("x", String(p.x));
            els.text.setAttribute("y", String(p.y));
          }
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
          updateAnnotationOverlay();

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

  function togglePart(index: number) {
    const g = partGroupsRef.current[index];
    if (!g) return;
    g.visible = !g.visible;
    setParts((prev) => prev.map((p, i) => (i === index ? { ...p, visible: g.visible } : p)));
  }

  async function handleSubmitPin() {
    if (!appUser || !taskId || !fileId || !pendingPin || !pinText.trim()) return;
    setPinSubmitting(true);
    try {
      await createAnnotation(taskId, fileId, pendingPin.localPos, appUser.uid, appUser.name, appUser.role, pinText.trim());
      setPendingPin(null);
      setPinText("");
      setAnnotateMode(false);
    } finally {
      setPinSubmitting(false);
    }
  }

  return (
    /* outer div: no overflow-hidden so SVG dim labels aren't clipped */
    <div className="relative rounded-2xl bg-white" style={{ height }}>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
          <div className="space-y-2 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#1d1d1f] border-t-transparent" />
            <p className="text-xs text-[#86868b]">{STEP_LABELS[step]}</p>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center rounded-2xl">
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* Three.js canvas — clipped inside rounded corners */}
      <div ref={mountRef} className="h-full w-full overflow-hidden rounded-2xl" />

      {/* SVG dimension overlay — sits on top, not clipped */}
      <svg ref={svgRef} className="absolute inset-0 pointer-events-none" style={{ overflow: "visible" }} />

      {/* Orientation gizmo — bottom-left */}
      <div ref={gizmoRef} className="absolute bottom-2 left-2" style={{ width: 90, height: 90 }} />

      {/* 리뷰 핀 추가 토글 — 상단 좌측 (taskId/fileId 없으면 핀 기능 자체를 숨긴다) */}
      {status === "ready" && annotationsEnabled && (
        <div className="absolute left-2 top-2">
          <button
            onClick={() => { setAnnotateMode((v) => !v); setPendingPin(null); }}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              annotateMode ? "border-[#ff3b30] bg-[#ff3b30] text-white" : "border-[#e5e5e5] bg-white/90 text-[#86868b] hover:text-[#1d1d1f]"
            }`}
            title={annotateMode ? "핀 찍기 모드 (모델을 클릭하세요)" : "리뷰 핀 추가"}
          >
            <MapPin size={15} />
          </button>
        </div>
      )}

      {/* 핀 찍은 직후 — 첫 코멘트 입력 팝오버 */}
      {pendingPin && (
        <div
          className="absolute z-10 w-64 space-y-2 rounded-2xl border border-[#e5e5e5] bg-white p-3 shadow-[0_4px_20px_rgba(0,0,0,0.14)]"
          style={{ left: Math.min(pendingPin.screenX, 460), top: Math.min(pendingPin.screenY, height - 120) }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1d1d1f]">새 리뷰 핀</span>
            <button onClick={() => { setPendingPin(null); setPinText(""); }} className="text-[#86868b] hover:text-[#1d1d1f]"><X size={13} /></button>
          </div>
          <textarea
            autoFocus
            value={pinText}
            onChange={(e) => setPinText(e.target.value)}
            placeholder="이 위치에 대한 코멘트를 입력하세요"
            rows={2}
            className="w-full resize-none rounded-xl border border-[#d1d1d6] px-2.5 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
          />
          <button
            onClick={handleSubmitPin}
            disabled={pinSubmitting || !pinText.trim()}
            className="w-full rounded-full bg-[#1d1d1f] py-1.5 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
          >
            핀 등록
          </button>
        </div>
      )}

      {/* 선택된 핀 코멘트 스레드 — 우측 하단 도킹 */}
      {selectedAnnotation && taskId && fileId && (
        <div className="absolute bottom-2 right-2 z-10">
          <AnnotationThread
            taskId={taskId}
            fileId={fileId}
            annotation={selectedAnnotation}
            onClose={() => setSelectedAnnotationId(null)}
          />
        </div>
      )}

      {/* 조립품 부품 목록 토글 — 상단 우측 */}
      {parts.length > 1 && status === "ready" && (
        <div className="absolute right-2 top-2">
          <button
            onClick={() => setShowPartsPanel((v) => !v)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              showPartsPanel ? "border-[#1d1d1f] bg-[#1d1d1f] text-white" : "border-[#e5e5e5] bg-white/90 text-[#86868b] hover:text-[#1d1d1f]"
            }`}
            title="부품 목록"
          >
            <Layers size={15} />
          </button>
          {showPartsPanel && (
            <div className="no-scrollbar absolute right-0 top-9 max-h-52 w-48 overflow-y-auto rounded-xl border border-[#e5e5e5] bg-white p-1.5 shadow-lg">
              {parts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => togglePart(i)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-[#f5f5f7] ${
                    p.visible ? "text-[#1d1d1f]" : "text-[#c7c7cc]"
                  }`}
                >
                  {p.visible ? <Eye size={12} className="shrink-0" /> : <EyeOff size={12} className="shrink-0" />}
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
