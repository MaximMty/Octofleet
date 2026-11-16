'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ArrowRight,
  ChevronDown,
  Compass,
  Maximize2,
  Minimize2,
  Moon,
  Navigation,
  ShieldCheck,
  Sun,
} from 'lucide-react';

type CameraPreset = 'quarter' | 'profile' | 'topdown' | 'aft';
type AtmosphereMode = 'midnight' | 'dusk';

function createTeakTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#a27446';
    ctx.fillRect(0, 0, 512, 512);

    const plankCount = 24;
    const plankW = 512 / plankCount;
    for (let i = 0; i < plankCount; i++) {
      const shade = (Math.sin(i * 1.7) * 0.5 + 0.5) * 18 - 9;
      const r = Math.min(255, Math.max(0, 165 + shade));
      const g = Math.min(255, Math.max(0, 118 + shade * 0.8));
      const b = Math.min(255, Math.max(0, 72 + shade * 0.6));
      ctx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
      ctx.fillRect(i * plankW, 0, plankW - 2, 512);

      // Subtle wood grain lines
      ctx.fillStyle = 'rgba(60, 35, 15, 0.08)';
      for (let y = 0; y < 512; y += 16) {
        if ((i + y) % 3 === 0) {
          ctx.fillRect(i * plankW + 2, y, plankW - 5, 8);
        }
      }

      // Dark marine caulk seam
      ctx.fillStyle = '#1b140e';
      ctx.fillRect((i + 1) * plankW - 2, 0, 2, 512);

      // Butt joints along planks
      const buttY = ((i * 137) % 420) + 40;
      ctx.fillRect(i * plankW, buttY, plankW, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 128);
    ctx.save();
    ctx.translate(128, 64);
    ctx.scale(2.0, 0.85);
    const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, 60);
    grad.addColorStop(0, 'rgba(1, 4, 10, 0.92)');
    grad.addColorStop(0.55, 'rgba(2, 8, 18, 0.65)');
    grad.addColorStop(1, 'rgba(2, 9, 20, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

/**
 * Creates a horizontal waterplane footprint shape in the X-Y plane
 * (which becomes X-Z after rotating -Math.PI / 2 around X).
 * Bow is at -length/2 (sharp plumb bow), Stern is at +length/2 (broad transom).
 */
function createWaterplaneShape(
  bowX: number,
  sternX: number,
  halfBeam: number,
  transomFactor = 0.78
): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(bowX, 0);
  // Starboard curve from bow to midships to stern quarter
  shape.bezierCurveTo(
    bowX + (sternX - bowX) * 0.16,
    halfBeam * 0.55,
    bowX + (sternX - bowX) * 0.42,
    halfBeam,
    bowX + (sternX - bowX) * 0.72,
    halfBeam
  );
  shape.lineTo(sternX - 0.25, halfBeam * transomFactor);
  shape.quadraticCurveTo(sternX, halfBeam * transomFactor * 0.85, sternX, 0);
  // Port side mirror
  shape.quadraticCurveTo(
    sternX,
    -halfBeam * transomFactor * 0.85,
    sternX - 0.25,
    -halfBeam * transomFactor
  );
  shape.lineTo(bowX + (sternX - bowX) * 0.72, -halfBeam);
  shape.bezierCurveTo(
    bowX + (sternX - bowX) * 0.42,
    -halfBeam,
    bowX + (sternX - bowX) * 0.16,
    -halfBeam * 0.55,
    bowX,
    0
  );
  return shape;
}

export default function LuxuryYachtHero() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const heroSectionRef = useRef<HTMLElement | null>(null);

  const [activePreset, setActivePreset] = useState<CameraPreset>('quarter');
  const [atmosphere, setAtmosphere] = useState<AtmosphereMode>('midnight');
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Refs for mutable state read inside the requestAnimationFrame loop
  const presetRef = useRef<CameraPreset>('quarter');
  const atmosphereRef = useRef<AtmosphereMode>('midnight');

  useEffect(() => {
    presetRef.current = activePreset;
  }, [activePreset]);

  useEffect(() => {
    atmosphereRef.current = atmosphere;
  }, [atmosphere]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Renderer & Tone Mapping
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.className = 'absolute inset-0 w-full h-full block';
    container.innerHTML = '';
    container.appendChild(canvas);

    // 2. Scene & Procedural RoomEnvironment PMREM
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.026);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    // 3. Narrow 34° FOV Undistorted Camera
    const camera = new THREE.PerspectiveCamera(
      34,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      120
    );
    camera.position.set(0, 2.75, 15.2);

    // 4. Studio & Maritime Lighting
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x050b16, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.6);
    keyLight.position.set(-9, 13, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 35;
    const d = 8;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const cyanRimLight = new THREE.DirectionalLight(0x22d3ee, 1.45);
    cyanRimLight.position.set(11, 5, -9);
    scene.add(cyanRimLight);

    const warmDeckGlow = new THREE.PointLight(0xfbbf24, 1.2, 9, 1.6);
    warmDeckGlow.position.set(1.5, 1.4, 1.5);
    scene.add(warmDeckGlow);

    // 5. Procedural 3D Superyacht Assembly (THREE.Group)
    const yachtGroup = new THREE.Group();
    // Position on the right half on desktop, angled 45° (-Math.PI / 4) coming from the right toward the user
    const BASE_YACHT_YAW = -Math.PI / 4;
    yachtGroup.rotation.y = BASE_YACHT_YAW;
    scene.add(yachtGroup);

    // Materials
    const teakTex = createTeakTexture();

    const hullNavyMat = new THREE.MeshPhysicalMaterial({
      color: 0x08101e,
      metalness: 0.35,
      roughness: 0.22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.9,
    });

    const keelDarkMat = new THREE.MeshStandardMaterial({
      color: 0x04070e,
      metalness: 0.2,
      roughness: 0.65,
    });

    const goldStripeMat = new THREE.MeshStandardMaterial({
      color: 0xdfb15b,
      metalness: 0.92,
      roughness: 0.18,
      emissive: 0x3a2808,
      emissiveIntensity: 0.25,
    });

    const pearlWhiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      metalness: 0.12,
      roughness: 0.2,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
    });

    const teakDeckMat = new THREE.MeshStandardMaterial({
      map: teakTex,
      roughness: 0.55,
      metalness: 0.05,
    });

    const smokedGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x050d1a,
      metalness: 0.15,
      roughness: 0.06,
      transmission: 0.45,
      transparent: true,
      opacity: 0.88,
      ior: 1.52,
      reflectivity: 0.95,
      clearcoat: 1.0,
    });

    const glassBalustradeMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.1,
      roughness: 0.08,
      transmission: 0.72,
      transparent: true,
      opacity: 0.45,
      ior: 1.5,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.96,
      roughness: 0.1,
    });

    const carbonMastMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.45,
      roughness: 0.3,
    });

    // --- A. Lower Antifouling Keel ---
    const keelShape = createWaterplaneShape(-4.05, 3.85, 0.82, 0.72);
    const keelGeo = new THREE.ExtrudeGeometry(keelShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.06,
      bevelThickness: 0.08,
    });
    keelGeo.rotateX(-Math.PI / 2);
    const keelMesh = new THREE.Mesh(keelGeo, keelDarkMat);
    keelMesh.position.y = -0.34;
    yachtGroup.add(keelMesh);

    // --- B. Metallic Gold (#dfb15b) Waterline Boot Stripe ---
    const stripeShape = createWaterplaneShape(-4.22, 4.02, 0.95, 0.77);
    const stripeGeo = new THREE.ExtrudeGeometry(stripeShape, {
      depth: 0.075,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    stripeGeo.rotateX(-Math.PI / 2);
    const stripeMesh = new THREE.Mesh(stripeGeo, goldStripeMat);
    stripeMesh.position.y = -0.02;
    yachtGroup.add(stripeMesh);

    // --- C. Solid Beveled Plumb-Bow Hull (#08101e) ---
    const hullShape = createWaterplaneShape(-4.35, 4.05, 0.96, 0.78);
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.62,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 2,
      bevelSize: 0.08,
      bevelThickness: 0.09,
    });
    hullGeo.rotateX(-Math.PI / 2);

    // Sculpt sheerline & plumb-bow flare slightly via vertex pass
    const hullPos = hullGeo.attributes.position;
    for (let i = 0; i < hullPos.count; i++) {
      const vx = hullPos.getX(i);
      const vy = hullPos.getY(i);
      const vz = hullPos.getZ(i);
      const bowFactor = Math.max(0, (-vx - 1.2) / 3.2);
      const sheerRise = bowFactor * bowFactor * 0.16;
      const flare = vy > 0.35 ? 1.04 : 0.96;
      hullPos.setY(i, vy + sheerRise);
      hullPos.setZ(i, vz * flare);
    }
    hullGeo.computeVertexNormals();

    const hullMesh = new THREE.Mesh(hullGeo, hullNavyMat);
    hullMesh.position.y = 0.04;
    hullMesh.castShadow = true;
    hullMesh.receiveShadow = true;
    yachtGroup.add(hullMesh);

    // Hull side recessed portlight windows
    for (let i = 0; i < 6; i++) {
      const px = -2.1 + i * 0.78;
      const portGeo = new THREE.BoxGeometry(0.42, 0.1, 1.98);
      const portMesh = new THREE.Mesh(portGeo, smokedGlassMat);
      portMesh.position.set(px, 0.38, 0);
      yachtGroup.add(portMesh);
    }

    // --- D. Main Teak Deck & Stainless Coamings ---
    const mainDeckShape = createWaterplaneShape(-4.18, 3.95, 0.91, 0.77);
    const mainDeckGeo = new THREE.ExtrudeGeometry(mainDeckShape, {
      depth: 0.05,
      bevelEnabled: false,
    });
    mainDeckGeo.rotateX(-Math.PI / 2);
    const mainDeckMesh = new THREE.Mesh(mainDeckGeo, teakDeckMat);
    mainDeckMesh.position.y = 0.7;
    mainDeckMesh.receiveShadow = true;
    yachtGroup.add(mainDeckMesh);

    // Pearlescent white bulwark coamings
    const coamingShape = createWaterplaneShape(-3.6, 3.3, 0.93, 0.78);
    const coamingGeo = new THREE.ExtrudeGeometry(coamingShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });
    coamingGeo.rotateX(-Math.PI / 2);
    const coamingMesh = new THREE.Mesh(coamingGeo, pearlWhiteMat);
    coamingMesh.position.y = 0.68;
    yachtGroup.add(coamingMesh);

    // --- E. Aft Beach Club Swim Platform, Dual Staircases, Tender Garage & Glass Balustrade ---
    const swimShape = createWaterplaneShape(3.2, 4.55, 0.76, 0.92);
    const swimGeo = new THREE.ExtrudeGeometry(swimShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.03,
      bevelThickness: 0.03,
    });
    swimGeo.rotateX(-Math.PI / 2);
    const swimPlatform = new THREE.Mesh(swimGeo, teakDeckMat);
    swimPlatform.position.y = 0.18;
    yachtGroup.add(swimPlatform);

    const swimSkirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.14, 1.38),
      pearlWhiteMat
    );
    swimSkirt.position.set(3.98, 0.12, 0);
    yachtGroup.add(swimSkirt);

    const garageDoorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.36, 0.86),
      chromeMat
    );
    garageDoorFrame.position.set(3.92, 0.42, 0);
    yachtGroup.add(garageDoorFrame);

    const garageDoorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.3, 0.78),
      hullNavyMat
    );
    garageDoorPanel.position.set(3.93, 0.42, 0);
    yachtGroup.add(garageDoorPanel);

    const stairSteps = 5;
    for (const side of [-1, 1]) {
      for (let s = 0; s < stairSteps; s++) {
        const stepMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.04, 0.24),
          teakDeckMat
        );
        stepMesh.position.set(
          3.55 + s * 0.12,
          0.66 - s * 0.09,
          side * 0.56
        );
        yachtGroup.add(stepMesh);
      }
    }

    const aftBalustrade = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.22, 1.32),
      glassBalustradeMat
    );
    aftBalustrade.position.set(3.48, 0.86, 0);
    yachtGroup.add(aftBalustrade);

    const aftRailTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.025, 1.34),
      chromeMat
    );
    aftRailTop.position.set(3.48, 0.98, 0);
    yachtGroup.add(aftRailTop);

    // --- F. Three-Tier Pearlescent Superstructure & Smoked Ribbon Windows ---
    // Tier 1: Main Salon Deckhouse
    const tier1Shape = createWaterplaneShape(-2.05, 2.85, 0.74, 0.84);
    const tier1BaseGeo = new THREE.ExtrudeGeometry(tier1Shape, {
      depth: 0.48,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    });
    tier1BaseGeo.rotateX(-Math.PI / 2);
    const tier1Base = new THREE.Mesh(tier1BaseGeo, pearlWhiteMat);
    tier1Base.position.y = 0.74;
    tier1Base.castShadow = true;
    yachtGroup.add(tier1Base);

    const tier1GlassShape = createWaterplaneShape(-1.92, 2.68, 0.76, 0.85);
    const tier1GlassGeo = new THREE.ExtrudeGeometry(tier1GlassShape, {
      depth: 0.26,
      bevelEnabled: false,
    });
    tier1GlassGeo.rotateX(-Math.PI / 2);
    const tier1Glass = new THREE.Mesh(tier1GlassGeo, smokedGlassMat);
    tier1Glass.position.y = 0.86;
    yachtGroup.add(tier1Glass);

    const deck2TeakShape = createWaterplaneShape(-2.25, 3.1, 0.78, 0.85);
    const deck2TeakGeo = new THREE.ExtrudeGeometry(deck2TeakShape, {
      depth: 0.04,
      bevelEnabled: false,
    });
    deck2TeakGeo.rotateX(-Math.PI / 2);
    const deck2Teak = new THREE.Mesh(deck2TeakGeo, teakDeckMat);
    deck2Teak.position.y = 1.24;
    yachtGroup.add(deck2Teak);

    // Tier 2: Forward-Raked Wheelhouse Bridge & Owner Deck
    const tier2Shape = createWaterplaneShape(-1.45, 2.15, 0.62, 0.82);
    const tier2Geo = new THREE.ExtrudeGeometry(tier2Shape, {
      depth: 0.44,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    });
    tier2Geo.rotateX(-Math.PI / 2);
    const t2Pos = tier2Geo.attributes.position;
    for (let i = 0; i < t2Pos.count; i++) {
      const vx = t2Pos.getX(i);
      const vy = t2Pos.getY(i);
      if (vx < -0.5 && vy > 0.2) {
        t2Pos.setX(i, vx - 0.18);
      }
    }
    tier2Geo.computeVertexNormals();
    const tier2Mesh = new THREE.Mesh(tier2Geo, pearlWhiteMat);
    tier2Mesh.position.y = 1.26;
    tier2Mesh.castShadow = true;
    yachtGroup.add(tier2Mesh);

    const tier2GlassShape = createWaterplaneShape(-1.48, 1.95, 0.64, 0.82);
    const tier2GlassGeo = new THREE.ExtrudeGeometry(tier2GlassShape, {
      depth: 0.22,
      bevelEnabled: false,
    });
    tier2GlassGeo.rotateX(-Math.PI / 2);
    const tier2Glass = new THREE.Mesh(tier2GlassGeo, smokedGlassMat);
    tier2Glass.position.y = 1.38;
    yachtGroup.add(tier2Glass);

    // Tier 3: Sun Deck & Hardtop Canopy on Chrome Pillars
    const sunDeckShape = createWaterplaneShape(-0.95, 1.75, 0.5, 0.8);
    const sunDeckGeo = new THREE.ExtrudeGeometry(sunDeckShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });
    sunDeckGeo.rotateX(-Math.PI / 2);
    const sunDeckMesh = new THREE.Mesh(sunDeckGeo, teakDeckMat);
    sunDeckMesh.position.y = 1.72;
    yachtGroup.add(sunDeckMesh);

    const sunLounge = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.24, 0.72),
      pearlWhiteMat
    );
    sunLounge.position.set(0.25, 1.86, 0);
    yachtGroup.add(sunLounge);

    const sunLoungeGlass = new THREE.Mesh(
      new THREE.BoxGeometry(1.32, 0.14, 0.75),
      smokedGlassMat
    );
    sunLoungeGlass.position.set(0.25, 1.88, 0);
    yachtGroup.add(sunLoungeGlass);

    // Hardtop canopy
    const canopyShape = createWaterplaneShape(-0.85, 1.85, 0.46, 0.82);
    const canopyGeo = new THREE.ExtrudeGeometry(canopyShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });
    canopyGeo.rotateX(-Math.PI / 2);
    const canopyMesh = new THREE.Mesh(canopyGeo, pearlWhiteMat);
    canopyMesh.position.y = 2.12;
    canopyMesh.castShadow = true;
    yachtGroup.add(canopyMesh);

    const pillarCoords: [number, number][] = [
      [-0.55, -0.32],
      [-0.55, 0.32],
      [1.45, -0.34],
      [1.45, 0.34],
    ];
    pillarCoords.forEach(([px, pz]) => {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.38, 12),
        chromeMat
      );
      pillar.position.set(px, 1.93, pz);
      yachtGroup.add(pillar);
    });

    // --- G. Foredeck Illuminated Jacuzzi & Stainless Bow Rails ---
    const jacuzziCoaming = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.4, 0.16, 28),
      pearlWhiteMat
    );
    jacuzziCoaming.position.set(-2.85, 0.8, 0);
    yachtGroup.add(jacuzziCoaming);

    const jacuzziTeakRim = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.36, 28),
      teakDeckMat
    );
    jacuzziTeakRim.rotation.x = -Math.PI / 2;
    jacuzziTeakRim.position.set(-2.85, 0.885, 0);
    yachtGroup.add(jacuzziTeakRim);

    const jacuzziWaterMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.4,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.92,
    });
    const jacuzziWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.05, 28),
      jacuzziWaterMat
    );
    jacuzziWater.position.set(-2.85, 0.86, 0);
    yachtGroup.add(jacuzziWater);

    const jacuzziLight = new THREE.PointLight(0x22d3ee, 1.1, 2.8, 1.8);
    jacuzziLight.position.set(-2.85, 1.05, 0);
    yachtGroup.add(jacuzziLight);

    // Stainless steel bow rails
    for (const side of [-1, 1]) {
      const railPoints = [
        new THREE.Vector3(-4.2, 0.98, side * 0.05),
        new THREE.Vector3(-3.6, 0.96, side * 0.48),
        new THREE.Vector3(-2.7, 0.92, side * 0.78),
        new THREE.Vector3(-1.8, 0.9, side * 0.88),
      ];
      const railCurve = new THREE.CatmullRomCurve3(railPoints);
      const railGeo = new THREE.TubeGeometry(railCurve, 24, 0.014, 8, false);
      const railMesh = new THREE.Mesh(railGeo, chromeMat);
      yachtGroup.add(railMesh);

      railPoints.forEach((pt) => {
        const stanchion = new THREE.Mesh(
          new THREE.CylinderGeometry(0.01, 0.01, 0.22, 8),
          chromeMat
        );
        stanchion.position.set(pt.x, pt.y - 0.11, pt.z);
        yachtGroup.add(stanchion);
      });
    }

    // --- H. Carbon-Fiber Mast, Dual Satellite Radomes & Spinning Radar Scanner Bar ---
    const mastGroup = new THREE.Group();
    mastGroup.position.set(0.15, 2.16, 0);
    yachtGroup.add(mastGroup);

    const mainMastStrut = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.92, 0.14),
      carbonMastMat
    );
    mainMastStrut.position.set(0, 0.42, 0);
    mainMastStrut.rotation.z = -0.24;
    mastGroup.add(mainMastStrut);

    const crossTree = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.04, 0.92),
      carbonMastMat
    );
    crossTree.position.set(0.06, 0.56, 0);
    mastGroup.add(crossTree);

    for (const side of [-1, 1]) {
      const domePedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.06, 16),
        carbonMastMat
      );
      domePedestal.position.set(0.06, 0.6, side * 0.34);
      mastGroup.add(domePedestal);

      const satDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 24, 24),
        pearlWhiteMat
      );
      satDome.position.set(0.06, 0.72, side * 0.34);
      mastGroup.add(satDome);
    }

    const radarScannerGroup = new THREE.Group();
    radarScannerGroup.position.set(-0.02, 0.92, 0);
    mastGroup.add(radarScannerGroup);

    const radarHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.07, 16),
      pearlWhiteMat
    );
    radarScannerGroup.add(radarHub);

    const radarBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.045, 0.68),
      pearlWhiteMat
    );
    radarBar.position.y = 0.04;
    radarScannerGroup.add(radarBar);

    const navBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    navBeacon.position.set(0.05, 1.06, 0);
    mastGroup.add(navBeacon);

    // --- I. 9 Submerged Cyan LED Hull Lenses & PointLights ---
    const ledLensMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
    });
    const ledLensGeo = new THREE.SphereGeometry(0.042, 12, 12);

    const ledPositions: [number, number, number][] = [
      [-1.8, -0.07, 0.82],
      [-0.4, -0.07, 0.93],
      [1.0, -0.07, 0.93],
      [2.4, -0.07, 0.85],
      [-1.8, -0.07, -0.82],
      [-0.4, -0.07, -0.93],
      [1.0, -0.07, -0.93],
      [2.4, -0.07, -0.85],
      [4.25, -0.07, 0.0],
    ];

    const underwaterPointLights: THREE.PointLight[] = [];
    ledPositions.forEach(([lx, ly, lz]) => {
      const lens = new THREE.Mesh(ledLensGeo, ledLensMat);
      lens.position.set(lx, ly, lz);
      yachtGroup.add(lens);

      const ptLight = new THREE.PointLight(0x06b6d4, 1.45, 3.4, 1.85);
      ptLight.position.set(lx, ly - 0.04, lz * 1.12);
      yachtGroup.add(ptLight);
      underwaterPointLights.push(ptLight);
    });

    // --- J. Soft Radial Contact Shadow Plane Beneath the Hull ---
    const shadowTex = createContactShadowTexture();
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(10.8, 3.8),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, -0.02, 0);
    yachtGroup.add(shadowPlane);

    // 6. Fluid Dark Ocean Surface (Subdivided PlaneGeometry + MeshPhysicalMaterial)
    const oceanGeo = new THREE.PlaneGeometry(65, 65, 128, 128);
    oceanGeo.rotateX(-Math.PI / 2);

    const oceanBasePos = new Float32Array(
      oceanGeo.attributes.position.array.length
    );
    oceanBasePos.set(oceanGeo.attributes.position.array);

    const oceanMat = new THREE.MeshPhysicalMaterial({
      color: 0x020914,
      roughness: 0.14,
      metalness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.07,
      ior: 1.333,
      transparent: true,
      opacity: 0.94,
      reflectivity: 0.95,
    });

    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.y = -0.04;
    oceanMesh.receiveShadow = true;
    scene.add(oceanMesh);

    // 7. Mouse Tracking & Frame-Rate-Independent Damping
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
      pointer.targetX = THREE.MathUtils.clamp(nx, -1, 1);
      pointer.targetY = THREE.MathUtils.clamp(ny, -1, 1);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop state
    let rafId = 0;
    const clock = new THREE.Clock();
    const currentCamPos = new THREE.Vector3(0, 2.75, 15.2);
    const currentLookAt = new THREE.Vector3(0, 0.55, 0);

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      pointer.x = THREE.MathUtils.damp(pointer.x, pointer.targetX, 4.5, dt);
      pointer.y = THREE.MathUtils.damp(pointer.y, pointer.targetY, 4.5, dt);

      const isDesktop = container.clientWidth >= 1024;
      const desktopXShift = isDesktop ? 2.15 : 0.0;
      yachtGroup.position.x = THREE.MathUtils.damp(
        yachtGroup.position.x,
        desktopXShift,
        4.0,
        dt
      );

      const heaveY = Math.sin(elapsed * 1.35) * 0.055;
      const pitchWave = Math.sin(elapsed * 1.05 + 0.6) * 0.016;
      const rollWave = Math.cos(elapsed * 1.25) * 0.022;

      yachtGroup.position.y = heaveY;

      let targetYaw = BASE_YACHT_YAW; // -Math.PI / 4 (45° facing user from the right)
      const preset = presetRef.current;
      if (preset === 'profile') {
        targetYaw = 0;
      } else if (preset === 'aft') {
        targetYaw = -Math.PI * 0.72;
      } else if (preset === 'topdown') {
        targetYaw = -Math.PI / 5;
      }

      const desiredRotY = targetYaw + pointer.x * 0.14;
      const desiredRotX = pitchWave + pointer.y * 0.05;
      const desiredRotZ = rollWave - pointer.x * 0.04;

      yachtGroup.rotation.y = THREE.MathUtils.damp(
        yachtGroup.rotation.y,
        desiredRotY,
        3.8,
        dt
      );
      yachtGroup.rotation.x = THREE.MathUtils.damp(
        yachtGroup.rotation.x,
        desiredRotX,
        3.8,
        dt
      );
      yachtGroup.rotation.z = THREE.MathUtils.damp(
        yachtGroup.rotation.z,
        desiredRotZ,
        3.8,
        dt
      );

      // Continuously spin radar scanner bar
      radarScannerGroup.rotation.y = elapsed * 2.6;

      let baseCamX = 0;
      let baseCamY = 2.65;
      let baseCamZ = 15.2;

      if (preset === 'profile') {
        baseCamX = 0;
        baseCamY = 2.15;
        baseCamZ = 15.4;
      } else if (preset === 'aft') {
        baseCamX = 1.6;
        baseCamY = 2.35;
        baseCamZ = 13.8;
      } else if (preset === 'topdown') {
        baseCamX = 0.6;
        baseCamY = 13.6;
        baseCamZ = 4.2;
      }

      const targetCamX = baseCamX + pointer.x * 0.45;
      const targetCamY = baseCamY + pointer.y * 0.3;
      const targetCamZ = baseCamZ;

      currentCamPos.x = THREE.MathUtils.damp(currentCamPos.x, targetCamX, 4.2, dt);
      currentCamPos.y = THREE.MathUtils.damp(currentCamPos.y, targetCamY, 4.2, dt);
      currentCamPos.z = THREE.MathUtils.damp(currentCamPos.z, targetCamZ, 4.2, dt);
      camera.position.copy(currentCamPos);

      const lookTargetX = isDesktop ? 0.35 : 0.0;
      const lookTargetY = 0.65;
      currentLookAt.x = THREE.MathUtils.damp(currentLookAt.x, lookTargetX, 4.5, dt);
      currentLookAt.y = THREE.MathUtils.damp(currentLookAt.y, lookTargetY, 4.5, dt);
      currentLookAt.z = THREE.MathUtils.damp(currentLookAt.z, 0, 4.5, dt);
      camera.lookAt(currentLookAt);

      const isDusk = atmosphereRef.current === 'dusk';
      const targetKeyColor = isDusk
        ? new THREE.Color(0xff9e5e)
        : new THREE.Color(0xfff1d6);
      const targetRimColor = isDusk
        ? new THREE.Color(0xf59e0b)
        : new THREE.Color(0x22d3ee);
      const targetLedColor = isDusk
        ? new THREE.Color(0x38bdf8)
        : new THREE.Color(0x06b6d4);

      keyLight.color.lerp(targetKeyColor, dt * 3.5);
      keyLight.intensity = THREE.MathUtils.damp(
        keyLight.intensity,
        isDusk ? 3.4 : 2.6,
        3.5,
        dt
      );
      cyanRimLight.color.lerp(targetRimColor, dt * 3.5);

      const ledTargetIntensity = isDusk ? 0.85 : 1.55;
      for (let i = 0; i < underwaterPointLights.length; i++) {
        underwaterPointLights[i].color.lerp(targetLedColor, dt * 3.5);
        underwaterPointLights[i].intensity = THREE.MathUtils.damp(
          underwaterPointLights[i].intensity,
          ledTargetIntensity,
          3.5,
          dt
        );
      }

      // Per-frame Ocean Vertex Wave Displacement
      const posAttr = oceanGeo.attributes.position;
      const posArr = posAttr.array as Float32Array;
      const hullWorldX = yachtGroup.position.x;
      const hullWorldZ = yachtGroup.position.z;

      for (let i = 0; i < posArr.length; i += 3) {
        const ox = oceanBasePos[i];
        const oz = oceanBasePos[i + 2];

        const swell1 =
          Math.sin(ox * 0.28 + elapsed * 1.15) *
          Math.cos(oz * 0.24 + elapsed * 0.85) *
          0.11;
        const ripple =
          Math.sin(ox * 1.15 - elapsed * 2.1 + oz * 0.9) * 0.024;

        const dx = ox - hullWorldX;
        const dz = oz - hullWorldZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const wakeEnvelope = Math.exp(-dist * 0.22);
        const wakeWave =
          Math.sin(dist * 3.4 - elapsed * 4.2) * 0.055 * wakeEnvelope;

        posArr[i + 1] = swell1 + ripple + wakeWave;
      }
      posAttr.needsUpdate = true;
      oceanGeo.computeVertexNormals();

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      pmremGenerator.dispose();
      envTexture.dispose();
      teakTex.dispose();
      shadowTex.dispose();
      oceanGeo.dispose();
      oceanMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <section
      ref={heroSectionRef}
      className="relative min-h-screen w-full overflow-hidden bg-[#030712] border-b border-slate-800/80 flex items-center"
    >
      {/* Full-Bleed Three.js WebGL Canvas Background */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full z-0"
        aria-label="Interactive 3D Superyacht WebGL Scene"
      />

      {/* Smooth Dark Gradient Scrim Fading from Solid #030712 on the Left to Transparent on the Right */}
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-[#030712] via-[#030712]/85 lg:via-[#030712]/55 to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 z-10 bg-gradient-to-t from-[#030712] to-transparent"
        aria-hidden="true"
      />

      {/* Foreground Left-Aligned Content Grid */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24 pointer-events-none">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left-Aligned Column (lg:col-span-5) */}
          <div className="lg:col-span-5 pointer-events-auto">
            {/* Subtle Monospace Kicker */}
            <div className="inline-flex items-center gap-2.5 rounded-full bg-white/[0.04] backdrop-blur-md border border-white/10 px-3.5 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] text-[#dfb15b] mb-6">
              <span className="h-2 w-2 rounded-full bg-[#dfb15b] shadow-[0_0_8px_#dfb15b]" />
              OCTOFLEET // SUPERYACHT TELEMETRY &amp; SPEC OS
            </div>

            {/* High-Contrast Display Headline with Metallic Silver Gradient Accent */}
            <h1 className="text-4xl sm:text-5xl xl:text-[3.4rem] font-bold tracking-tight text-white leading-[1.06]">
              Complete Command of{' '}
              <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Your Vessel.
              </span>
            </h1>

            {/* Concise 1–2 Sentence Subheadline */}
            <p className="mt-5 text-base sm:text-lg text-slate-300/90 leading-relaxed">
              OctoFleet unifies per-hull inventory compliance, SOLAS safety
              thresholds, restock approvals, and conflict-safe Google Sheets
              synchronization into one role-secured maritime platform.
            </p>

            {/* Primary Glowing Metallic-Gold Rimmed CTA + Translucent Glass Secondary Button */}
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-b from-[#dfb15b]/25 to-[#dfb15b]/10 border border-[#dfb15b]/80 px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_25px_rgba(223,177,91,0.28)] hover:shadow-[0_0_35px_rgba(223,177,91,0.48)] hover:bg-[#dfb15b]/30 transition-all"
              >
                <span className="text-[#f7d996] group-hover:text-white transition-colors">
                  Access Command Deck
                </span>
                <ArrowRight className="h-4 w-4 text-[#dfb15b] group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl backdrop-blur-md bg-white/[0.05] border border-white/15 px-5 py-3.5 text-sm font-semibold text-slate-200 hover:bg-white/[0.1] hover:border-white/25 transition-all"
              >
                Switch Role / Sign In
              </Link>
            </div>

            {/* Two Compact Frosted-Glass Live Telemetry Cards */}
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Telemetry Card 1 */}
              <div className="rounded-xl backdrop-blur-md bg-white/[0.04] border border-white/10 p-4">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    SOLAS &amp; SPEC SYNC
                  </span>
                  <span className="text-emerald-400">LIVE</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between font-mono tabular-nums">
                  <span className="text-2xl font-bold text-white">99.4%</span>
                  <span className="text-xs text-cyan-300">0 CRITICAL GAPS</span>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
                  <span>RLS ISOLATION</span>
                  <span className="text-slate-200">3-TIER VERIFIED</span>
                </div>
              </div>

              {/* Telemetry Card 2 */}
              <div className="rounded-xl backdrop-blur-md bg-white/[0.04] border border-white/10 p-4">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Navigation className="h-3.5 w-3.5 text-cyan-400" />
                    HULL TELEMETRY
                  </span>
                  <span className="text-[#dfb15b]">HDG 045°</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between font-mono tabular-nums">
                  <span className="text-2xl font-bold text-white">18.6 KN</span>
                  <span className="text-xs text-slate-300">DRAFT 3.8M</span>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
                  <span>SHEETS BRIDGE</span>
                  <span className="text-emerald-400">SYNCED · 12MS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Open Right Column (lg:col-span-7) so 3D Superyacht Sits Cleanly on the Right */}
          <div className="hidden lg:block lg:col-span-7" aria-hidden="true" />
        </div>
      </div>

      {/* Collapsible Bottom-Right Floating Glass Viewport Controls Dock */}
      <div className="
        absolute bottom-6 right-6 z-30
        rounded-2xl backdrop-blur-md bg-slate-950/75 border border-white/10
        shadow-[0_12px_40px_rgba(0,0,0,0.65)] p-2.5
        transition-all duration-200
      ">
        <div className="flex items-center justify-between gap-3 px-1.5">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-300">
            <Compass className="h-3.5 w-3.5 text-[#dfb15b]" />
            <span>VIEWPORT OPTICS</span>
          </div>
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={
              dockCollapsed
                ? 'Expand viewport controls'
                : 'Collapse viewport controls'
            }
          >
            {dockCollapsed ? (
              <Maximize2 className="h-3.5 w-3.5" />
            ) : (
              <Minimize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {!dockCollapsed && (
          <div className="mt-2.5 space-y-2 border-t border-white/10 pt-2.5">
            {/* Camera Angle Preset Buttons */}
            <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px]">
              {(
                [
                  { id: 'quarter', label: 'Quarter' },
                  { id: 'profile', label: 'Profile' },
                  { id: 'topdown', label: 'Top-Down' },
                  { id: 'aft', label: 'Aft' },
                ] as { id: CameraPreset; label: string }[]
              ).map((preset) => {
                const active = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setActivePreset(preset.id)}
                    className={`rounded-lg px-2.5 py-1.5 transition-all ${
                      active
                        ? 'bg-[#dfb15b]/25 border border-[#dfb15b] text-white shadow-[0_0_12px_rgba(223,177,91,0.3)]'
                        : 'bg-white/[0.04] border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Atmosphere Toggle (Midnight LED vs Golden Dusk) */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 pl-1">
                ATMOSPHERE
              </span>
              <div className="inline-flex rounded-lg bg-white/[0.04] border border-white/10 p-0.5 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => setAtmosphere('midnight')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors ${
                    atmosphere === 'midnight'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Moon className="h-3 w-3" />
                  <span>Midnight LED</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAtmosphere('dusk')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors ${
                    atmosphere === 'dusk'
                      ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sun className="h-3 w-3" />
                  <span>Golden Dusk</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
