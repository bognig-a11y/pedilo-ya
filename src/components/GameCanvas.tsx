/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { House, Obstacle, Vagabond, VehicleId, Order, TERRITORIES, getTerritoryAt } from '../types';
import { audio } from '../utils/audio';

function adjustHexColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent * 100);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0x00ff) + amt;
  let b = (num & 0x0000ff) + amt;

  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

interface GameCanvasProps {
  playerX: number;
  playerY: number;
  playerZ: number;
  playerAngle: number;
  currentVehicleId: VehicleId;
  houses: House[];
  obstacles: Obstacle[];
  vagabonds: Vagabond[];
  activeOrders: Order[];
  onPlayerMove: (x: number, y: number, angle: number) => void;
  onInteract: (zone: 'pizzeria' | 'casino' | 'concesionario' | 'own_pizzeria' | 'pizzeria_abandonada' | 'rival_pizzeria_defeated' | 'none') => void;
  onEnterCorner: (cornerIndex: number) => void;
  keysPressed: { [key: string]: boolean };
  virtualDirection: { x: number; y: number };
  isStunned: boolean;
  isSlowed: boolean;
  isVictory: boolean;
  hasOwnPizzeria: boolean;
  playerMarketShare: number;
  renovationLevel: number;
  employees: any[];
  rivalDeliverers?: any[];
  pizzeriaName: string;
  pizzeriaColor: string;
  hasGlobalized: boolean;
  tutorialStep?: 'off' | 'prompt' | 'pizzeria' | 'delivery' | 'concesionario' | 'casino' | 'completed';
  businessTutorialStep?: 'off' | 'prompt' | 'upgrades' | 'competition' | 'staff' | 'completed';
  chapter?: number;
  insideRegionId?: number | null;
  onClickRegion?: (regionId: number) => void;
}

// 3D Projection & Painter utility types
interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface PolyFace {
  points: Point3D[];
  color: string;
  outlineColor?: string;
  outlineWidth?: number;
  text?: string;
  avgDepth: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  playerX,
  playerY,
  playerZ,
  playerAngle,
  currentVehicleId,
  houses,
  obstacles,
  vagabonds,
  activeOrders,
  onPlayerMove,
  onInteract,
  onEnterCorner,
  keysPressed,
  virtualDirection,
  isStunned,
  isSlowed,
  isVictory,
  hasOwnPizzeria,
  playerMarketShare,
  renovationLevel,
  employees,
  rivalDeliverers,
  pizzeriaName,
  pizzeriaColor,
  hasGlobalized,
  tutorialStep = 'off',
  businessTutorialStep = 'off',
  chapter = 1,
  insideRegionId = null,
  onClickRegion,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Interaction Prompts zone state
  const [activePrompt, setActivePrompt] = useState<'pizzeria' | 'casino' | 'concesionario' | 'own_pizzeria' | 'pizzeria_abandonada' | 'rival_pizzeria_defeated' | 'none'>('none');

  // Coordinates helper values
  const PIZZERIA_X = 0;
  const PIZZERIA_Y = 0;
  const DEALER_X = -245;
  const DEALER_Y = 0;
  const CASINO_X = 245;
  const CASINO_Y = 0;

  // New Pizzeria Base Coordinates
  const OWN_PIZZERIA_X = 0;
  const OWN_PIZZERIA_Y = 245;

  // Helipad positions in the 4 corners of the map (-900 to 900)
  const CORNERS = [
    { x: -880, y: -880 }, // Top-Left
    { x: 880, y: -880 },  // Top-Right
    { x: -880, y: 880 },  // Bottom-Left
    { x: 880, y: 880 },   // Bottom-Right
  ];

  // Sync props to refs to avoid tearing down the requestAnimationFrame loop
  const renderStateRef = useRef({
    playerX,
    playerY,
    playerZ,
    playerAngle,
    currentVehicleId,
    houses,
    obstacles,
    vagabonds,
    activeOrders,
    isStunned,
    isSlowed,
    hasOwnPizzeria,
    playerMarketShare,
    renovationLevel,
    employees: employees || [],
    rivalDeliverers: rivalDeliverers || [],
    pizzeriaName,
    pizzeriaColor,
    hasGlobalized,
    tutorialStep,
    businessTutorialStep,
    chapter,
    insideRegionId,
  });

  renderStateRef.current = {
    playerX,
    playerY,
    playerZ,
    playerAngle,
    currentVehicleId,
    houses,
    obstacles,
    vagabonds,
    activeOrders,
    isStunned,
    isSlowed,
    hasOwnPizzeria,
    playerMarketShare,
    renovationLevel,
    employees: employees || [],
    rivalDeliverers: rivalDeliverers || [],
    pizzeriaName,
    pizzeriaColor,
    hasGlobalized,
    tutorialStep,
    businessTutorialStep,
    chapter,
    insideRegionId,
  };

  // Camera coordinates (lerping towards player)
  const cameraRef = useRef({ x: 0, y: 0, z: 0 });

  // Rotor angle for the helicopter spinning animation
  const rotorAngleRef = useRef(0);

  // Key control listener
  useEffect(() => {
    // We smooth update camera position and run driving kinematics in a loop
    let animationId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      const state = renderStateRef.current;

      // Update helicopter rotor blade angle
      if (state.currentVehicleId === 'helicoptero') {
        rotorAngleRef.current = (rotorAngleRef.current + dt * 25) % (Math.PI * 2);
      }

      // Smooth camera follow or fixed/responsive overhead overview
      const isChapter3 = state.chapter === 3;
      let targetCamX = state.playerX;
      let targetCamY = state.playerY + 85;
      let targetCamZ = 70;

      if (isChapter3) {
        if (state.insideRegionId !== null && state.insideRegionId !== undefined) {
          // Camera follow player inside region
          targetCamX = state.playerX;
          targetCamY = state.playerY + 85;
          targetCamZ = 70;
        } else {
          // Center the camera static view between the two islands
          targetCamX = 260;
          targetCamY = 0;
          // Dynamically compute altitude based on width so both islands remain in full visual range
          const cw = canvasRef.current ? canvasRef.current.width : 1000;
          targetCamZ = Math.max(520, (680 * 800) / Math.max(300, cw));
        }
      }

      cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.08;
      cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.08;
      cameraRef.current.z += (targetCamZ - cameraRef.current.z) * 0.08;

      render();
      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, []);


  // Helper to project 3D relative to Camera
  const projectPoint = (
    val: Point3D,
    width: number,
    height: number,
    pitch: number = 0.85, // Perfect comfortable 3/4 diagonal Tilt X (approx. 50 degrees)
    yaw: number = 0.0     // Perfect 0.0 grid alignment for easy navigation
  ) => {
    const isChapter3 = renderStateRef.current?.chapter === 3;
    if (isChapter3) {
      // Clean top-down 2D perspective / orthographic projection for Chapter 3
      const dx = val.x - cameraRef.current.x;
      const dy = val.y - cameraRef.current.y;
      const dz = val.z; // world altitude above sea level (z)

      // Dynamic scale matching the responsive Z of the camera
      const scale = 400 / cameraRef.current.z;

      return {
        x: width / 2 + dx * scale,
        y: height / 2 + dy * scale - dz * scale * 0.12, // shift height upwards proportionately for clean 3D feel
        depth: -val.y - val.z, // roofs smaller (drawn last/on top of floor)
      };
    }

    const dx = val.x - cameraRef.current.x;
    const dy = val.y - cameraRef.current.y;
    const dz = val.z - cameraRef.current.z;

    // Rotate camera around Z-axis by yaw
    const rx = dx * Math.cos(yaw) - dy * Math.sin(yaw);
    const ry = dx * Math.sin(yaw) + dy * Math.cos(yaw);
    const rz = dz;

    // Tilt camera by pitch
    const sx = rx;
    const sy = ry * Math.cos(pitch) - rz * Math.sin(pitch);

    // Correct Depth sorting metric: higher Z values represent points closer to
    // the overhead camera and must be drawn on top (smaller depth).
    // ry is negative because camera is offset South of player (facing North).
    const sz = -ry * Math.sin(pitch) - rz * Math.cos(pitch);

    // Standard high-fidelity 3D perspective scaling factor
    const zoom = 1.45;
    const distanceFactor = 400;
    // Clamp the denominator to a positive, safe minimum to avoid division by zero or negative flip projection glitches
    const denom = Math.max(10, distanceFactor + sz);
    const fov = distanceFactor / denom;

    return {
      x: width / 2 + sx * fov * zoom,
      y: height / 2 + sy * fov * zoom,
      depth: sz, // Correct positive depth representation for Painter's algorithm
    };
  };

  // Check proximity interactions
  useEffect(() => {
    if (chapter === 3) {
      setActivePrompt('none');
      onInteract('none');
      return;
    }

    // Distance to shop zones
    const distPizza = Math.sqrt((playerX - PIZZERIA_X) ** 2 + (playerY - PIZZERIA_Y) ** 2);
    const distDealer = Math.sqrt((playerX - DEALER_X) ** 2 + (playerY - DEALER_Y) ** 2);
    const distCasino = Math.sqrt((playerX - CASINO_X) ** 2 + (playerY - CASINO_Y) ** 2);
    const distOwnPizza = Math.sqrt((playerX - OWN_PIZZERIA_X) ** 2 + (playerY - OWN_PIZZERIA_Y) ** 2);

    let active: typeof activePrompt = 'none';

    if (!hasOwnPizzeria) {
      if (distPizza < 45) {
        active = 'pizzeria';
      } else if (distOwnPizza < 45) {
        active = 'pizzeria_abandonada';
      }
    } else {
      if (distOwnPizza < 45) {
        active = 'own_pizzeria';
      } else if (distPizza < 45 && playerMarketShare === 100) {
        active = 'rival_pizzeria_defeated';
      }
    }

    if (active === 'none') {
      if (distDealer < 45) active = 'concesionario';
      else if (distCasino < 45) active = 'casino';
    }

    setActivePrompt(active);
    onInteract(active);

    // Also check corner helicopter escapes - Only active if player doesn't have their own corporate base yet
    if (currentVehicleId === 'helicoptero' && !hasOwnPizzeria) {
      CORNERS.forEach((corner, index) => {
        const cornerDist = Math.sqrt((playerX - corner.x) ** 2 + (playerY - corner.y) ** 2);
        if (cornerDist < 50) {
          onEnterCorner(index);
        }
      });
    }
  }, [playerX, playerY, currentVehicleId, hasOwnPizzeria, playerMarketShare, chapter]);


  // RENDERING ENGINE
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Destructure everything from our up-to-date state reference to prevent stale closure bugs
    const {
      playerX,
      playerY,
      playerZ,
      playerAngle,
      currentVehicleId,
      houses,
      obstacles,
      vagabonds,
      activeOrders,
      isStunned,
      isSlowed,
      hasOwnPizzeria,
      playerMarketShare,
      renovationLevel,
      employees,
      rivalDeliverers,
      pizzeriaName,
      pizzeriaColor,
      hasGlobalized,
      tutorialStep,
      businessTutorialStep,
      chapter,
      insideRegionId,
    } = renderStateRef.current;

    // Clear Canvas: inside region should be ONLY grass. No ocean.
    if (chapter === 3 && insideRegionId !== null) {
      const regObj = TERRITORIES.find(r => r.id === insideRegionId);
      const rColor = regObj ? regObj.color : '#15803D';
      ctx.fillStyle = rColor;
    } else {
      ctx.fillStyle = '#C0E4FF'; // Ocean blue/sky
    }
    ctx.fillRect(0, 0, width, height);

    // Setup tilted camera settings. Chapter 3 goes top-down (almost vertical 1.48) on global map, tilted inside regions or other chapters
    const pitch = (chapter === 3 && insideRegionId === null) ? 1.48 : 0.85; 
    const yaw = 0.0;

    const proj = (p: Point3D) => projectPoint(p, width, height, pitch, yaw);

    // Painter array
    const faces: PolyFace[] = [];

    // Helper to push 3D cube faces
    const push3DBox = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      colors: { top: string; front: string; side: string },
      angle = 0,
      label?: string
    ) => {
      // Create local 8 vertices relative to bounding box center
      const hw = w / 2;
      const hh = h / 2;

      let localPts = [
        { x: -hw, y: -hh, z: 0 },
        { x: hw, y: -hh, z: 0 },
        { x: hw, y: hh, z: 0 },
        { x: -hw, y: hh, z: 0 },
        { x: -hw, y: -hh, z: d },
        { x: hw, y: -hh, z: d },
        { x: hw, y: hh, z: d },
        { x: -hw, y: hh, z: d },
      ];

      // Rotate around Z axis by angle
      if (angle !== 0) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        localPts = localPts.map(pt => ({
          x: pt.x * c - pt.y * s,
          y: pt.x * s + pt.y * c,
          z: pt.z,
        }));
      }

      // Add absolute positions
      const vertices = localPts.map(pt => ({
        x: x + pt.x,
        y: y + pt.y,
        z: z + pt.z,
      }));

      // Define 6 faces (bottom is omitted since on floor)
      const faceDefs = [
        // Top
        { idx: [4, 5, 6, 7], col: colors.top, name: label },
        // Front (S)
        { idx: [3, 2, 6, 7], col: colors.front },
        // Back (N)
        { idx: [0, 1, 5, 4], col: colors.front },
        // Right (E)
        { idx: [1, 2, 6, 5], col: colors.side },
        // Left (W)
        { idx: [0, 3, 7, 4], col: colors.side },
      ];

      faceDefs.forEach(def => {
        const points = def.idx.map(i => vertices[i]);
        // Depth is average depth of vertices
        const depthsPrj = points.map(proj);
        const avgD = depthsPrj.reduce((sum, p) => sum + p.depth, 0) / points.length;

        faces.push({
          points,
          color: def.col,
          text: def.name,
          avgDepth: avgD,
        });
      });
    };

    // Helper to push 3D Pyramid (Roofs, trees)
    const push3DPyramid = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: string,
      sideColor: string,
      angle = 0
    ) => {
      const hw = w / 2;
      const hh = h / 2;

      let localPts = [
        { x: -hw, y: -hh, z: 0 },
        { x: hw, y: -hh, z: 0 },
        { x: hw, y: hh, z: 0 },
        { x: -hw, y: hh, z: 0 },
        { x: 0, y: 0, z: d }, // Peak
      ];

      // Rotate around Z axis by angle
      if (angle !== 0) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        localPts = localPts.map(pt => ({
          x: pt.x * c - pt.y * s,
          y: pt.x * s + pt.y * c,
          z: pt.z,
        }));
      }

      // Absolute positions
      const vertices = localPts.map(pt => ({
        x: x + pt.x,
        y: y + pt.y,
        z: z + pt.z,
      }));

      // 4 triangular sides
      const triangleDefs = [
        [0, 1, 4],
        [1, 2, 4],
        [2, 3, 4],
        [3, 0, 4],
      ];

      triangleDefs.forEach((def, index) => {
        const points = def.map(i => vertices[i]);
        const depthsPrj = points.map(proj);
        const avgD = depthsPrj.reduce((sum, p) => sum + p.depth, 0) / points.length;

        faces.push({
          points,
          color: index % 2 === 0 ? color : sideColor,
          avgDepth: avgD,
        });
      });
    };

    // DRAW FLAT GROUND GRAPHICS (Pre-painted directly under the painter list as subdivided tiles)
    const sandColor = '#FEF08A';
    const tileSize = 80;

    const drawSandTile = (gx: number, gy: number) => {
      const pts = [
        { x: gx, y: gy, z: -1 },
        { x: gx + tileSize, y: gy, z: -1 },
        { x: gx + tileSize, y: gy + tileSize, z: -1 },
        { x: gx, y: gy + tileSize, z: -1 },
      ];

      let hasBehind = false;
      pts.forEach(p => {
        const dx = p.x - cameraRef.current.x;
        const dy = p.y - cameraRef.current.y;
        const dz = p.z - cameraRef.current.z;
        const ry = dy;
        const sz = -ry * Math.sin(pitch) - dz * Math.cos(pitch);
        if (400 + sz < 15) {
          hasBehind = true;
        }
      });

      if (hasBehind) return;

      const prjPts = pts.map(proj);
      ctx.beginPath();
      ctx.moveTo(prjPts[0].x, prjPts[0].y);
      ctx.lineTo(prjPts[1].x, prjPts[1].y);
      ctx.lineTo(prjPts[2].x, prjPts[2].y);
      ctx.lineTo(prjPts[3].x, prjPts[3].y);
      ctx.closePath();
      ctx.fillStyle = sandColor;
      ctx.fill();
    };

    const drawGrassTile = (gx: number, gy: number, customColor?: string, isCeoFinal?: boolean) => {
      const pts = [
        { x: gx, y: gy, z: 0 },
        { x: gx + 60, y: gy, z: 0 },
        { x: gx + 60, y: gy + 60, z: 0 },
        { x: gx, y: gy + 60, z: 0 },
      ];

      let hasBehind = false;
      pts.forEach(p => {
        const dx = p.x - cameraRef.current.x;
        const dy = p.y - cameraRef.current.y;
        const dz = p.z - cameraRef.current.z;
        const ry = dy;
        const sz = -ry * Math.sin(pitch) - dz * Math.cos(pitch);
        if (400 + sz < 15) {
          hasBehind = true;
        }
      });

      if (hasBehind && chapter !== 3) return;

      const prjPts = pts.map(proj);
      ctx.beginPath();
      ctx.moveTo(prjPts[0].x, prjPts[0].y);
      ctx.lineTo(prjPts[1].x, prjPts[1].y);
      ctx.lineTo(prjPts[2].x, prjPts[2].y);
      ctx.lineTo(prjPts[3].x, prjPts[3].y);
      ctx.closePath();
      ctx.fillStyle = customColor || '#49A06D';
      ctx.fill();

      if (isCeoFinal) {
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    };

    if (chapter === 3) {
      if (insideRegionId !== null) {
        // ---- 1. RENDER LOCAL TEST MAP FOR REGIONS (Only spacious grass baseplate, no ocean, no other islands) ----
        // Find region colors
        const reg = TERRITORIES.find(r => r.id === insideRegionId);
        const rColor = reg ? reg.color : '#49A06D';
        const isCeo = insideRegionId === 8;
        
        // Render empty clean grass grid as baseplate from -540 to 540 (covers the active interactive area + buffer)
        for (let gx = -540; gx < 540; gx += 60) {
          for (let gy = -540; gy < 540; gy += 60) {
            drawGrassTile(gx, gy, rColor, isCeo);
          }
        }
      } else {
        // ---- 2. RENDER GLOBAL OPERATIONS MAP FOR CHAPTER 3 ----
        // SMALL ISLAND (SHRUNK): Sand from -360 to -120, and -120 to 120
        for (let gx = -360; gx < -120; gx += tileSize) {
          for (let gy = -120; gy < 120; gy += tileSize) {
            drawSandTile(gx, gy);
          }
        }
        // LARGE ISLAND (EXPANDED): Sand from 0 to 880, and -540 to 540
        for (let gx = 0; gx < 880; gx += tileSize) {
          for (let gy = -540; gy < 540; gy += tileSize) {
            drawSandTile(gx, gy);
          }
        }

        // SMALL ISLAND (SHRUNK): Grass from -300 to -180, and -90 to 90
        for (let gx = -300; gx < -180; gx += 60) {
          for (let gy = -90; gy < 90; gy += 60) {
            drawGrassTile(gx, gy);
          }
        }
        // LARGE ISLAND (EXPANDED): Grass divided into 8 organic asymmetrical territories!
        for (let gx = 80; gx < 800; gx += 60) {
          for (let gy = -480; gy < 480; gy += 60) {
            const t = getTerritoryAt(gx + 30, gy + 30);
            const color = t ? t.color : '#49A06D';
            const isCeo = t?.id === 8;
            drawGrassTile(gx, gy, color, isCeo);
          }
        }

        // Thin transparent layer on small island representing corporate domain
        let transColor = 'rgba(56, 189, 248, 0.22)';
        if (pizzeriaColor && pizzeriaColor.startsWith('#')) {
          transColor = pizzeriaColor + '40'; // ~25% alpha hex
        } else if (pizzeriaColor) {
          transColor = pizzeriaColor;
        }

        const overlayPts = [
          { x: -300, y: -90, z: 0.15 },
          { x: -180, y: -90, z: 0.15 },
          { x: -180, y: 90, z: 0.15 },
          { x: -300, y: 90, z: 0.15 },
        ];
        let overlayBehind = false;
        overlayPts.forEach(p => {
          const dx = p.x - cameraRef.current.x;
          const dy = p.y - cameraRef.current.y;
          const dz = p.z - cameraRef.current.z;
          const ry = dy;
          const sz = -ry * Math.sin(pitch) - dz * Math.cos(pitch);
          if (400 + sz < 15) {
            overlayBehind = true;
          }
        });
        if (!overlayBehind) {
          const prjOverlay = overlayPts.map(proj);
          ctx.beginPath();
          ctx.moveTo(prjOverlay[0].x, prjOverlay[0].y);
          ctx.lineTo(prjOverlay[1].x, prjOverlay[1].y);
          ctx.lineTo(prjOverlay[2].x, prjOverlay[2].y);
          ctx.lineTo(prjOverlay[3].x, prjOverlay[3].y);
          ctx.closePath();
          ctx.fillStyle = transColor;
          ctx.fill();

          // Elegant border for corporate dominance boundaries
          ctx.strokeStyle = pizzeriaColor || '#0284C7';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }
    } else {
      // CHAPTER 1 & 2 FULL ORIGINAL ISLAND
      for (let gx = -960; gx < 960; gx += tileSize) {
        for (let gy = -960; gy < 960; gy += tileSize) {
          drawSandTile(gx, gy);
        }
      }
      for (let gx = -900; gx < 900; gx += 60) {
        for (let gy = -900; gy < 900; gy += 60) {
          drawGrassTile(gx, gy);
        }
      }
    }

    if (chapter !== 3) {
      // DRAW STREETS & ROADS (Tarmac grey - subdivided segment-by-segment to prevent projection stretching)
    const STREET_COORDS = [-818, -613, -368, -123, 123, 368, 613, 818];
    const STREET_WIDTH = 22;

    const streetPlanners: { x: number; y: number; w: number; h: number; isVert: boolean }[] = [];

    // 8 vertical streets
    STREET_COORDS.forEach(X_c => {
      streetPlanners.push({
        x: X_c - STREET_WIDTH / 2,
        y: -880,
        w: STREET_WIDTH,
        h: 1760,
        isVert: true
      });
    });

    // 8 horizontal streets
    STREET_COORDS.forEach(Y_c => {
      streetPlanners.push({
        x: -880,
        y: Y_c - STREET_WIDTH / 2,
        w: 1760,
        h: STREET_WIDTH,
        isVert: false
      });
    });

    streetPlanners.forEach(st => {
      const segmentSize = 40;
      if (st.isVert) {
        for (let gy = st.y; gy < st.y + st.h; gy += segmentSize) {
          const chunkH = Math.min(segmentSize, st.y + st.h - gy);
          const v = [
            { x: st.x, y: gy, z: 0.1 },
            { x: st.x + st.w, y: gy, z: 0.1 },
            { x: st.x + st.w, y: gy + chunkH, z: 0.1 },
            { x: st.x, y: gy + chunkH, z: 0.1 },
          ];

          let hasBehind = false;
          v.forEach(p => {
            const dx = p.x - cameraRef.current.x;
            const dy = p.y - cameraRef.current.y;
            const dz = p.z - cameraRef.current.z;
            const ry = dy;
            const sz = -ry * Math.sin(pitch) - dz * Math.cos(pitch);
            if (400 + sz < 15) {
              hasBehind = true;
            }
          });

          if (hasBehind) continue;

          const p = v.map(proj);
          ctx.beginPath();
          ctx.moveTo(p[0].x, p[0].y);
          ctx.lineTo(p[1].x, p[1].y);
          ctx.lineTo(p[2].x, p[2].y);
          ctx.lineTo(p[3].x, p[3].y);
          ctx.closePath();
          ctx.fillStyle = '#3b4d61';
          ctx.fill();

          // Draw yellow dashed lines on this active slice
          ctx.strokeStyle = '#FCD34D';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          const startPrj = proj({ x: st.x + st.w / 2, y: gy, z: 0.2 });
          const endPrj = proj({ x: st.x + st.w / 2, y: gy + chunkH, z: 0.2 });
          ctx.moveTo(startPrj.x, startPrj.y);
          ctx.lineTo(endPrj.x, endPrj.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else {
        for (let gx = st.x; gx < st.x + st.w; gx += segmentSize) {
          const chunkW = Math.min(segmentSize, st.x + st.w - gx);
          const v = [
            { x: gx, y: st.y, z: 0.1 },
            { x: gx + chunkW, y: st.y, z: 0.1 },
            { x: gx + chunkW, y: st.y + st.h, z: 0.1 },
            { x: gx, y: st.y + st.h, z: 0.1 },
          ];

          let hasBehind = false;
          v.forEach(p => {
            const dx = p.x - cameraRef.current.x;
            const dy = p.y - cameraRef.current.y;
            const dz = p.z - cameraRef.current.z;
            const ry = dy;
            const sz = -ry * Math.sin(pitch) - dz * Math.cos(pitch);
            if (400 + sz < 15) {
              hasBehind = true;
            }
          });

          if (hasBehind) continue;

          const p = v.map(proj);
          ctx.beginPath();
          ctx.moveTo(p[0].x, p[0].y);
          ctx.lineTo(p[1].x, p[1].y);
          ctx.lineTo(p[2].x, p[2].y);
          ctx.lineTo(p[3].x, p[3].y);
          ctx.closePath();
          ctx.fillStyle = '#3b4d61';
          ctx.fill();

          // Draw yellow dashed lines on this active slice
          ctx.strokeStyle = '#FCD34D';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          const startPrj = proj({ x: gx, y: st.y + st.h / 2, z: 0.2 });
          const endPrj = proj({ x: gx + chunkW, y: st.y + st.h / 2, z: 0.2 });
          ctx.moveTo(startPrj.x, startPrj.y);
          ctx.lineTo(endPrj.x, endPrj.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    });

    // MUD PUDDLES DRAWING
    obstacles.forEach((obs) => {
      if (obs.type === 'mud') {
        // Draw flat mud puddle
        const points: Point3D[] = [];
        const numVertices = 8;
        // Seeded shape based on obstacle ID for consistency
        const seedValue = parseInt(obs.id.slice(-3), 16) || 88;

        for (let i = 0; i < numVertices; i++) {
          const angle = (i / numVertices) * Math.PI * 2;
          const r = obs.size * (0.85 + Math.abs(Math.sin(angle * 3 + seedValue)) * 0.3);
          points.push({
            x: obs.x + Math.cos(angle) * r,
            y: obs.y + Math.sin(angle) * r,
            z: 0.15,
          });
        }

        const depthsPrj = points.map(proj);
        const avgD = depthsPrj.reduce((sum, p) => sum + p.depth, 0) / points.length;

        faces.push({
          points,
          color: '#B45309', // Splendid thick mud brown
          avgDepth: avgD,
        });
      }
    });

    // TUTORIAL VISUAL BEACONS AND CELESTIAL GLOW INDICATORS
    const pushCheckpoint = (cx: number, cy: number, radius: number, color: string, outlineColor: string, label: string) => {
      // 1. Draw a massive base ground circle
      const numPts = 16;
      const pts: Point3D[] = [];
      for (let i = 0; i < numPts; i++) {
        const a = (i / numPts) * Math.PI * 2;
        pts.push({
          x: cx + Math.cos(a) * radius,
          y: cy + Math.sin(a) * radius,
          z: 0.5,
        });
      }
      const depthsPrj = pts.map(proj);
      const avgD = depthsPrj.reduce((sum, p) => sum + p.depth, 0) / pts.length;

      faces.push({
        points: pts,
        color: color,
        outlineColor: outlineColor,
        outlineWidth: 3.5,
        text: `📍 LOCALIZACIÓN: ${label.toUpperCase()}`,
        avgDepth: avgD,
      });

      // 2. Push a colossal celestial glowing beam / spire from ground up to Z = 110!
      // This is toweringly high so they can spot it immediately regardless of buildings or camera distance.
      const pulseSize = 12 + Math.sin(Date.now() / 250) * 1.5;
      push3DBox(
        cx,
        cy,
        0,
        pulseSize,
        pulseSize,
        110,
        {
          top: '#FFFFFF',
          front: color,
          side: outlineColor
        },
        0,
        undefined
      );

      // 3. Add an outer glowing defensive field base (wider, shorter)
      push3DBox(
        cx,
        cy,
        0,
        radius * 1.5,
        radius * 1.5,
        12,
        {
          top: 'rgba(255, 255, 255, 0.1)',
          front: color,
          side: color
        },
        0,
        undefined
      );

      // 4. Add a high-altitude floating label box that resides at the top of the tower (Z = 110)
      push3DBox(
        cx,
        cy,
        110,
        9,
        9,
        9,
        {
          top: '#FFFFFF',
          front: outlineColor,
          side: outlineColor
        },
        0,
        `👑 ${label.toUpperCase()}`
      );
    };

    if (tutorialStep === 'pizzeria') {
      pushCheckpoint(PIZZERIA_X, PIZZERIA_Y, 32, 'rgba(251, 191, 36, 0.4)', '#F59E0B', 'Tomar pedido');
    } else if (tutorialStep === 'delivery' && activeOrders.length > 0) {
      const currentActive = activeOrders[0];
      const house = houses.find(h => h.id === currentActive.houseId);
      if (house) {
        pushCheckpoint(house.x, house.y, 22, 'rgba(16, 185, 129, 0.4)', '#10B981', `Entregar Casa ${house.number}`);
      }
    } else if (tutorialStep === 'concesionario') {
      pushCheckpoint(DEALER_X, DEALER_Y, 28, 'rgba(59, 130, 246, 0.4)', '#3B82F6', 'Visitar Tienda');
    } else if (tutorialStep === 'casino') {
      pushCheckpoint(CASINO_X, CASINO_Y, 28, 'rgba(139, 92, 246, 0.4)', '#8B5CF6', 'Visitar Casino');
    }

    if (businessTutorialStep === 'upgrades') {
      pushCheckpoint(OWN_PIZZERIA_X, OWN_PIZZERIA_Y, 32, 'rgba(236, 72, 153, 0.4)', '#EC4899', 'Administrar Base');
    }

    // 4 CORNER DOCKS / HELIPADS (Rescue escapes)
    if (currentVehicleId === 'helicoptero' && !hasOwnPizzeria) {
      CORNERS.forEach((c, idx) => {
        // Draw a circular checkered pad on floor
        const numPts = 10;
        const padPts: Point3D[] = [];
        for (let i = 0; i < numPts; i++) {
          const a = (i / numPts) * Math.PI * 2;
          padPts.push({
            x: c.x + Math.cos(a) * 35,
            y: c.y + Math.sin(a) * 35,
            z: 0.3,
          });
        }
        const depthsPrj = padPts.map(proj);
        const avgD = depthsPrj.reduce((sum, p) => sum + p.depth, 0) / padPts.length;

        faces.push({
          points: padPts,
          color: idx % 2 === 0 ? '#FB7185' : '#60A5FA', // Neon pink and neon blue
          avgDepth: avgD,
          text: 'ESCAPE',
        });

        // Draw floating rescue beam indicators!
        const topPts: Point3D[] = [];
        for (let i = 0; i < numPts; i++) {
          const a = (i / numPts) * Math.PI * 2;
          topPts.push({
            x: c.x + Math.cos(a) * 15,
            y: c.y + Math.sin(a) * 15,
            z: 110,
          });
        }
        const depthsPrjTop = topPts.map(proj);
        const avgDTop = depthsPrjTop.reduce((sum, p) => sum + p.depth, 0) / topPts.length;

        // Draw a transparent visual escape cylinder side
        // In Painter's algorithm we represent this with floating vertices simple columns
      });
    }

    // PIZZERIA (Exactly in the center)
    // Red themed building to represent the rival / original pizzeria, or player's custom brand if globalized
    let rivalPizzaLabel = 'PIZZERIA';
    let rivalTopColor = '#EF4444';
    let rivalWallColor = '#EF4444';
    let rivalSideColor = '#B91C1C';
    let rivalPeakColorLighter = '#F87171';
    let rivalPeakColorDarker = '#DC2626';

    if (hasGlobalized) {
      rivalPizzaLabel = `⚡ ${pizzeriaName} ⚡`;
      rivalTopColor = pizzeriaColor;
      rivalWallColor = pizzeriaColor;
      rivalSideColor = adjustHexColor(pizzeriaColor, -0.2);
      rivalPeakColorLighter = adjustHexColor(pizzeriaColor, 0.2);
      rivalPeakColorDarker = adjustHexColor(pizzeriaColor, 0.2);
    } else if (hasOwnPizzeria) {
      rivalPizzaLabel = '🍕 PIZZERÍA RIVAL';
    }

    push3DBox(PIZZERIA_X, PIZZERIA_Y, 0, 48, 48, 30, {
      top: rivalTopColor,
      front: rivalWallColor,
      side: rivalSideColor,
    }, 0, rivalPizzaLabel);

    // A gorgeous roof peak on top of Pizza shop
    push3DPyramid(PIZZERIA_X, PIZZERIA_Y, 30, 48, 48, 14, rivalPeakColorLighter, rivalPeakColorDarker, 0);

    // PIZZERÍA PROPIA / ABANDONADA (In the cell below center)
    // Always drawn so players can view and interact with it from start!
    {
      let ownPizzaLabel = currentVehicleId === 'helicoptero' ? '🏚️ PIZZERÍA ABANDONADA (Comprable)' : '🏚️ PIZZERÍA ABANDONADA (Requiere Helicóptero)';
      let topColor = '#1E3A8A'; // Deep dark blue default
      let wallColor = '#1E3A8A';
      let sideColor = '#0F172A';
      let peakColor = '#1E40AF';

      if (hasOwnPizzeria) {
        topColor = pizzeriaColor;
        wallColor = pizzeriaColor;
        sideColor = adjustHexColor(pizzeriaColor, -0.2);
        peakColor = adjustHexColor(pizzeriaColor, 0.2);

        if (renovationLevel === 0) {
          ownPizzaLabel = `🏚️ ${pizzeriaName} (NIVEL 0)`;
        } else if (renovationLevel === 1) {
          ownPizzaLabel = `🍕 ${pizzeriaName} (L1)`;
        } else if (renovationLevel === 2) {
          ownPizzaLabel = `🍕 ${pizzeriaName} (L2)`;
        } else {
          ownPizzaLabel = `⚡ ${pizzeriaName} (L3) ⚡`;
        }
      }

      push3DBox(OWN_PIZZERIA_X, OWN_PIZZERIA_Y, 0, 48, 48, 30, {
        top: topColor,
        front: wallColor,
        side: sideColor,
      }, 0.1, ownPizzaLabel);

      push3DPyramid(OWN_PIZZERIA_X, OWN_PIZZERIA_Y, 30, 48, 48, 14, peakColor, peakColor, 0.1);
    }


    // CONCESIONARIO (Showroom) next to Pizza shop
    push3DBox(DEALER_X, DEALER_Y, 0, 40, 42, 26, {
      top: '#3B82F6',   // Deep sky blue showroom roof
      front: '#EFF6FF', // Friendly glassy front
      side: '#1D4ED8',  // Sporty racing deep blue columns
    }, 0.15, 'VEHICULOS');


    // CASINO
    push3DBox(CASINO_X, CASINO_Y, 0, 42, 40, 28, {
      top: '#8B5CF6',   // Royal purple casino roof
      front: '#1E1B4B', // Luxurious gold & black outline
      side: '#D97706',  // Amber gold walls
    }, -0.15, 'CASINO');


    // HOUSES (20 distributed houses with visual styles)
    houses.forEach((house) => {
      // Different structures (styles indices)
      const isRedeemingTarget = activeOrders.some(order => order.houseId === house.id);

      const roofColor = house.style % 3 === 0 ? '#F87171' : (house.style % 3 === 1 ? '#FB923C' : '#60A5FA');
      const roofSideColor = house.style % 3 === 0 ? '#EF4444' : (house.style % 3 === 1 ? '#F97316' : '#2563EB');

      const wallColor = '#FFFFFF';
      const wallSideColor = '#E2E8F0';

      // Push primary body of the house
      push3DBox(house.x, house.y, 0, 24, 24, 18, {
        top: wallSideColor,
        front: wallColor,
        side: wallSideColor,
      }, house.style * 0.45, isRedeemingTarget ? `Casa ${house.number}` : undefined);

      // Push distinct roof structure
      if (house.style % 2 === 0) {
        // Pyramid roof style
        push3DPyramid(house.x, house.y, 18, 28, 28, 11, roofColor, roofSideColor, house.style * 0.45);
      } else {
        // Box roof structure (slanted box feel)
        push3DBox(house.x, house.y, 18, 24, 24, 6, {
          top: roofColor,
          front: roofSideColor,
          side: roofColor,
        }, house.style * 0.45);
      }

      // ACTIVE PIZZA TARGET MARKER RING and GLOWING PIPELINE!
      if (isRedeemingTarget) {
        // Glowing spinning coin / tall floating rings over target house
        const pulseCycle = (Date.now() / 320) % (Math.PI * 2);
        const floatZ = 33 + Math.sin(pulseCycle) * 4;

        // Draw spinning Pizza Ring faces
        const segments = 12;
        const ringPts: Point3D[] = [];
        for (let i = 0; i < segments; i++) {
          const a = (i / segments) * Math.PI * 2 + (Date.now() / 600);
          ringPts.push({
            x: house.x + Math.cos(a) * 10,
            y: house.y + Math.sin(a) * 10,
            z: floatZ,
          });
        }
        const depthsPrjRing = ringPts.map(proj);
        const avgDRing = depthsPrjRing.reduce((sum, p) => sum + p.depth, 0) / ringPts.length;

        faces.push({
          points: ringPts,
          color: '#F43F5E', // Glowing Rose
          outlineColor: '#FFE4E6',
          outlineWidth: 3,
          avgDepth: avgDRing,
          text: '👉 ENTREGAR AQUÍ 🍕',
        });
      }
    });

    // OBSTACLES (TREES and CAR MOTORS)
    obstacles.forEach((obs) => {
      if (obs.type === 'tree') {
        // Draw wood trunk
        push3DBox(obs.x, obs.y, 0, 5, 5, 8, {
          top: '#78350F',
          front: '#92400E',
          side: '#78350F',
        });
        // Pine tree green tiers
        push3DPyramid(obs.x, obs.y, 8, 18, 18, 15, '#10B981', '#047857', 0);
        push3DPyramid(obs.x, obs.y, 17, 13, 13, 10, '#34D399', '#059669', 0.5);
      } else if (obs.type === 'car') {
        // Draw animated vehicle obstruction box
        const carCol = obs.color || '#EF4444';
        const angle = obs.angle || 0;

        // Base car frame
        push3DBox(obs.x, obs.y, 0, 18, 10, 7, {
          top: carCol,
          front: '#1E293B', // Windshield color
          side: carCol,
        }, angle);

        // Cockpit glass cabin
        push3DBox(obs.x - 2 * Math.cos(angle), obs.y - 2 * Math.sin(angle), 7, 10, 8, 4, {
          top: '#FFFFFF',
          front: '#1E293B',
          side: '#EF4444',
        }, angle);
      }
    });

    // VAGABONDS (Purple shadow ghosts)
    vagabonds.forEach((vag) => {
      // Draw a floating spherical cartoon monster
      const basePulse = Math.sin(Date.now() / 150) * 2;
      const shadowZ = 1 + basePulse;

      const bodyPts: Point3D[] = [];
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        bodyPts.push({
          x: vag.x + Math.cos(a) * 11,
          y: vag.y + Math.sin(a) * 11,
          z: shadowZ + 7,
        });
      }
      const depthsPrjVag = bodyPts.map(proj);
      const avgDVag = depthsPrjVag.reduce((sum, p) => sum + p.depth, 0) / bodyPts.length;

      faces.push({
        points: bodyPts,
        color: '#6B21A8', // Dark deep purple
        outlineColor: '#C084FC', // Neon purple borders
        outlineWidth: 2,
        avgDepth: avgDVag,
        text: '👻 LADRÓN',
      });
    });

    // DECORATIVE EMPLOYEES (Active pizza delivery guys flying/driving around)
    (employees || []).forEach((emp: any) => {
      const eX = emp.x;
      const eY = emp.y;

      const shadowPts: Point3D[] = [];
      const numSegs = 6;
      for (let i = 0; i < numSegs; i++) {
        const a = (i / numSegs) * Math.PI * 2;
        shadowPts.push({
          x: eX + Math.cos(a) * 4,
          y: eY + Math.sin(a) * 4,
          z: 0.1,
        });
      }
      const depthsPrjS = shadowPts.map(proj);
      const avgDS = depthsPrjS.reduce((sum, p) => sum + p.depth, 0) / shadowPts.length;
      faces.push({
        points: shadowPts,
        color: 'rgba(0,0,0,0.18)',
        avgDepth: avgDS,
      });

      // Match player's custom brand color exactly
      const empColors = {
        top: pizzeriaColor,
        front: pizzeriaColor,
        side: adjustHexColor(pizzeriaColor, -0.2)
      };

      // Employee 3D model box (smaller size, same color as player's clinic, no name tag)
      push3DBox(eX, eY, 0, 5, 5, 5, empColors, 0, undefined);
    });

    // DECORATIVE RIVAL EMPLOYEES (Active original pizzería red deliverers moving around)
    (rivalDeliverers || []).forEach((dev: any) => {
      const dX = dev.x;
      const dY = dev.y;

      const shadowPts: Point3D[] = [];
      const numSegs = 6;
      for (let i = 0; i < numSegs; i++) {
        const a = (i / numSegs) * Math.PI * 2;
        shadowPts.push({
          x: dX + Math.cos(a) * 4,
          y: dY + Math.sin(a) * 4,
          z: 0.1,
        });
      }
      const depthsPrjS = shadowPts.map(proj);
      const avgDS = depthsPrjS.reduce((sum, p) => sum + p.depth, 0) / shadowPts.length;
      faces.push({
        points: shadowPts,
        color: 'rgba(0,0,0,0.15)',
        avgDepth: avgDS,
      });

      // Match player's custom brand color if they have bought the own pizzeria or globalized
      const rivalColors = (hasOwnPizzeria || hasGlobalized)
        ? {
            top: pizzeriaColor,
            front: pizzeriaColor,
            side: adjustHexColor(pizzeriaColor, -0.2),
          }
        : {
            top: '#EF4444',   // bright red
            front: '#EF4444', // red body (matched)
            side: '#B91C1C',  // dark red trim
          };

      // Original/Rival Delivery Boy 3D model box (mini person dressed in custom/rival brand colors, no tag)
      push3DBox(dX, dY, 0, 5, 5, 5, rivalColors, 0, undefined);
    });
    } else {
      // CHAPTER 3 MAP: CUSTOM LANDMARKS, HQ AND REGIONS
      if (insideRegionId !== null) {
        // Draw flat central helipad for reference landing base inside region
        const t = TERRITORIES.find(r => r.id === insideRegionId);
        const tName = t ? t.name : 'ZONA DE PRUEBA';
        const tColor = t ? t.color : '#EF4444';
        
        const numPts = 12;
        const padPts: Point3D[] = [];
        for (let i = 0; i < numPts; i++) {
          const a = (i / numPts) * Math.PI * 2;
          padPts.push({
            x: 0 + Math.cos(a) * 45,
            y: 0 + Math.sin(a) * 45,
            z: 0.3,
          });
        }
        const depthsPrj = padPts.map(proj);
        const avgD = depthsPrj.reduce((sum, p) => sum + p.depth, 0) / padPts.length;

        faces.push({
          points: padPts,
          color: '#1E293B',
          outlineColor: tColor,
          outlineWidth: 4,
          avgDepth: avgD,
          text: `🚁 HELIPUERTO ${tName.toUpperCase()}`,
        });

        // DRAW VISIBLE BOUNDARY: Laser Fences & High-Tech Glowing Pylons along -480 and 480
        const limitVal = 480;
        const segmentSize = 160;

        // Generate segmented wall faces to prevent projection stretching
        const wallSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];

        // Top edge
        for (let x = -limitVal; x < limitVal; x += segmentSize) {
          wallSegments.push({ x1: x, y1: -limitVal, x2: x + segmentSize, y2: -limitVal });
        }
        // Bottom edge
        for (let x = -limitVal; x < limitVal; x += segmentSize) {
          wallSegments.push({ x1: x, y1: limitVal, x2: x + segmentSize, y2: limitVal });
        }
        // Left edge
        for (let y = -limitVal; y < limitVal; y += segmentSize) {
          wallSegments.push({ x1: -limitVal, y1: y, x2: -limitVal, y2: y + segmentSize });
        }
        // Right edge
        for (let y = -limitVal; y < limitVal; y += segmentSize) {
          wallSegments.push({ x1: limitVal, y1: y, x2: limitVal, y2: y + segmentSize });
        }

        wallSegments.forEach((seg) => {
          // Semi-transparent laser wall height = 22
          const wallPts = [
            { x: seg.x1, y: seg.y1, z: 0.2 },
            { x: seg.x2, y: seg.y2, z: 0.2 },
            { x: seg.x2, y: seg.y2, z: 22 },
            { x: seg.x1, y: seg.y1, z: 22 },
          ];

          const depthsW = wallPts.map(proj);
          const avgDW = depthsW.reduce((sum, p) => sum + p.depth, 0) / wallPts.length;

          faces.push({
            points: wallPts,
            color: `${tColor}1c`, // 10% opacity colored laser membrane
            outlineColor: tColor,
            outlineWidth: 2,
            avgDepth: avgDW,
          });
        });

        // High-tech decorative glowing corner/edge pylons
        const pylonPoints: { x: number; y: number }[] = [];
        for (let x = -limitVal; x <= limitVal; x += segmentSize) {
          pylonPoints.push({ x, y: -limitVal });
          pylonPoints.push({ x, y: limitVal });
        }
        for (let y = -limitVal + segmentSize; y < limitVal; y += segmentSize) {
          pylonPoints.push({ x: -limitVal, y });
          pylonPoints.push({ x: limitVal, y });
        }

        pylonPoints.forEach((pt) => {
          // Column pylon
          push3DBox(pt.x, pt.y, 0, 8, 8, 25, {
            top: '#FFFFFF',
            front: tColor,
            side: '#1E293B',
          }, 0);
          // Glowing top cap
          push3DPyramid(pt.x, pt.y, 25, 8, 8, 6, '#FFFFFF', tColor, 0);
        });
      } else {
        // 1. Corporate HQ building representing the player's enterprise (small corporate island approx -250, 0)
        push3DBox(-250, 0, 0, 48, 48, 45, {
          top: '#1E293B',
          front: pizzeriaColor || '#0F172A',
          side: '#1E293B'
        }, 0.2, pizzeriaName || "CORPORACIÓN DELIVER");
        push3DPyramid(-250, 0, 45, 48, 48, 20, pizzeriaColor || '#38BDF8', '#0284C7', 0.2);

        // 2. Draw floating landmarks/pillars above each territory center so they are easily distinguishable
        TERRITORIES.forEach(t => {
          push3DBox(t.cx, t.cy, 0, 16, 16, 10, {
            top: '#1E293B',
            front: t.color,
            side: '#1E293B'
          }, 0.2, t.name);
          push3DPyramid(t.cx, t.cy, 10, 16, 16, 6, t.accent, t.color, 0.2);
        });
      }
    }

    // PLAYER MODEL GRAPHICS
    // Size and properties depends on the current vehicle!
    const constructPlayerModel = () => {
      const px = playerX;
      const py = playerY;
      const pz = playerZ;
      const angle = playerAngle;

      // Draw player Shadow
      const shadowPts: Point3D[] = [];
      const numSegs = 10;
      const sRadius = currentVehicleId === 'helicoptero' ? 12 : 9;
      for (let i = 0; i < numSegs; i++) {
        const a = (i / numSegs) * Math.PI * 2;
        shadowPts.push({
          x: px + Math.cos(a) * sRadius,
          y: py + Math.sin(a) * sRadius,
          z: 0.1, // Flat on grass
        });
      }
      const depthsPrjS = shadowPts.map(proj);
      const avgDS = depthsPrjS.reduce((sum, p) => sum + p.depth, 0) / shadowPts.length;

      // Shadow is translucent black
      faces.push({
        points: shadowPts,
        color: 'rgba(0,0,0,0.22)',
        avgDepth: avgDS,
      });

      // Active player visual layers depending on vehicles
      if (currentVehicleId === 'pie') {
        // Red Backpack Box on body
        push3DBox(px, py, pz, 7, 7, 11, { top: '#DC2626', front: '#EF4444', side: '#DC2626' }, angle);
        // Head
        push3DBox(px + 1 * Math.cos(angle), py + 1 * Math.sin(angle), pz + 11, 4.5, 4.5, 4, { top: '#FED7AA', front: '#FDBA74', side: '#F59E0B' }, angle);
      } else if (currentVehicleId === 'skateboard') {
        // Flat orange slice skateboard
        push3DBox(px, py, pz, 14, 5, 2, { top: '#F97316', front: '#C2410C', side: '#C2410C' }, angle);
        // Player standing on bottom
        push3DBox(px, py, pz + 2, 6, 6, 12, { top: '#DC2626', front: '#3B82F6', side: '#DC2626' }, angle);
        push3DBox(px, py, pz + 14, 4, 4, 3.5, { top: '#FDBA74', front: '#000', side: '#FDBA74' }, angle);
      } else if (currentVehicleId === 'bicicleta') {
        // Wheels and frame
        // Back wheel
        push3DBox(px - 6 * Math.cos(angle), py - 6 * Math.sin(angle), pz, 1, 4, 4, { top: '#475569', front: '#64748B', side: '#64748B' }, angle);
        // Front wheel
        push3DBox(px + 6 * Math.cos(angle), py + 6 * Math.sin(angle), pz, 1, 4, 4, { top: '#475569', front: '#64748B', side: '#64748B' }, angle);
        // Frame/Backpack
        push3DBox(px, py, pz + 3, 5, 5, 11, { top: '#DC2626', front: '#EF4444', side: '#EF4444' }, angle);
        push3DBox(px, py, pz + 14, 4.5, 4.5, 4, { top: '#FED7AA', front: '#EF4444', side: '#FED7AA' }, angle);
      } else if (currentVehicleId === 'moto') {
        // Red sleek scooter frame
        push3DBox(px, py, pz, 17, 7, 5, { top: '#EF4444', front: '#B91C1C', side: '#EF4444' }, angle);
        // Seat + Shield
        push3DBox(px + 4 * Math.cos(angle), py + 4 * Math.sin(angle), pz + 5, 6, 6, 6, { top: '#1E293B', front: '#EF4444', side: '#B91C1C' }, angle);
        // Driver backpack
        push3DBox(px - 1 * Math.cos(angle), py - 1 * Math.sin(angle), pz + 6, 6, 6, 9, { top: '#DC2626', front: '#FDBA74', side: '#DC2626' }, angle);
        push3DBox(px - 1 * Math.cos(angle), py - 1 * Math.sin(angle), pz + 15, 4.5, 4.5, 4, { top: '#FDBA74', front: '#B91C1C', side: '#FDBA74' }, angle);
      } else if (currentVehicleId === 'auto') {
        // Bright Yellow Taxi layout
        push3DBox(px, py, pz, 21, 10, 7, { top: '#FBBF24', front: '#F59E0B', side: '#FBBF24' }, angle);
        // Glass top Cabin with pizza slice icon on top
        push3DBox(px - 2 * Math.cos(angle), py - 2 * Math.sin(angle), pz + 7, 12, 9, 4.5, { top: '#FFF', front: '#1E293B', side: '#D97706' }, angle, '🍕 PEDILO YA');
      } else if (currentVehicleId === 'camion') {
        // 10 wheels big cargo trucks carrying stack of pizzas
        push3DBox(px + 7 * Math.cos(angle), py + 7 * Math.sin(angle), pz, 10, 11, 12, { top: '#A78BFA', front: '#1E293B', side: '#7C3AED' }, angle); // Cab
        push3DBox(px - 6 * Math.cos(angle), py - 6 * Math.sin(angle), pz, 18, 12, 11, { top: '#FFFFFF', front: '#F43F5E', side: '#E2E8F0' }, angle, '📦 CARGA PIZZA'); // Container box
      } else if (currentVehicleId === 'helicoptero') {
        // Futuristic mini dual landing gear heli body, floating at high playerZ (30)!
        const heliZ = pz;
        // Landing skids
        push3DBox(px, py, heliZ, 16, 12, 2, { top: '#1E293B', front: '#334155', side: '#1E293B' }, angle);
        // Helicopter fuselage
        push3DBox(px, py, heliZ + 2, 19, 10, 10, { top: '#F472B6', front: '#1E293B', side: '#DB2777' }, angle);
        // Vertical motor beam
        push3DBox(px - 3 * Math.cos(angle), py - 3 * Math.sin(angle), heliZ + 12, 2, 2, 4, { top: '#334155', front: '#1E293B', side: '#334155' }, angle);
        
        // Spinning Rotor blade face!
        const rBladeLength = 18;
        const spinAngle = rotorAngleRef.current;
        const rPts = [
          { x: px + Math.cos(spinAngle) * rBladeLength, y: py + Math.sin(spinAngle) * rBladeLength, z: heliZ + 16 },
          { x: px + Math.cos(spinAngle + Math.PI) * rBladeLength, y: py + Math.sin(spinAngle + Math.PI) * rBladeLength, z: heliZ + 16 },
          { x: px + Math.cos(spinAngle + Math.PI / 2) * rBladeLength, y: py + Math.sin(spinAngle + Math.PI / 2) * rBladeLength, z: heliZ + 16 },
          { x: px + Math.cos(spinAngle - Math.PI / 2) * rBladeLength, y: py + Math.sin(spinAngle - Math.PI / 2) * rBladeLength, z: heliZ + 16 },
        ];
        const rProj = rPts.map(proj);
        const rAvgD = rProj.reduce((s, p) => s + p.depth, 0) / rPts.length;

        // Draw structural blade line links
        faces.push({
          points: [rPts[0], rPts[1]],
          color: '#1E293B',
          outlineColor: '#FFF',
          outlineWidth: 2,
          avgDepth: rAvgD,
        });
        faces.push({
          points: [rPts[2], rPts[3]],
          color: '#1E293B',
          outlineColor: '#FFF',
          outlineWidth: 2,
          avgDepth: rAvgD + 0.1,
        });
      }
    };

    constructPlayerModel();

    // Sort to render back to front
    faces.sort((a, b) => b.avgDepth - a.avgDepth);

    const labelsToRender: { text: string; x: number; y: number; depth: number }[] = [];

    // DRAW FACES
    faces.forEach((face) => {
      if (face.points.length < 2) return;

      // Class 3D Near Plane Clip: Skip drawing the face entirely if any vertex lies behind or too close to the camera (only in chapters 1 & 2)
      let hasBehind = false;
      if (chapter !== 3) {
        for (const p of face.points) {
          const dx = p.x - cameraRef.current.x;
          const dy = p.y - cameraRef.current.y;
          const dz = p.z - cameraRef.current.z;
          const ry = dy; // yaw is 0
          const sz = -ry * Math.sin(pitch) - dz * Math.cos(pitch);
          if (400 + sz < 10) {
            hasBehind = true;
            break;
          }
        }
      }
      if (hasBehind) return;

      const projected = face.points.map(proj);

      ctx.beginPath();
      ctx.moveTo(projected[0].x, projected[0].y);
      for (let i = 1; i < projected.length; i++) {
        ctx.lineTo(projected[i].x, projected[i].y);
      }
      ctx.closePath();

      // Flat shading color fill
      ctx.fillStyle = face.color;
      ctx.fill();

      // Border outline (optional but beautiful for giving a cartoon comic outline look!)
      ctx.strokeStyle = face.outlineColor || 'rgba(0,0,0,0.15)';
      ctx.lineWidth = face.outlineWidth || 0.8;
      ctx.stroke();

      // Collect floating billboards text for buildings / targets
      if (face.text) {
        // Average coordinates for centering labels
        const avgX = projected.reduce((s, p) => s + p.x, 0) / projected.length;
        const avgY = projected.reduce((s, p) => s + p.y, 0) / projected.length;
        labelsToRender.push({
          text: face.text,
          x: avgX,
          y: avgY,
          depth: face.avgDepth
        });
      }
    });

    // Draw all collected labels AFTER all faces are drawn so they are never covered by building volumes
    labelsToRender.sort((a, b) => b.depth - a.depth);
    labelsToRender.forEach((lbl) => {
      ctx.font = 'bold 9px sans-serif';
      const txtWidth = ctx.measureText(lbl.text).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(lbl.x - txtWidth / 2 - 5, lbl.y - 14, txtWidth + 10, 15);

      // Core text
      ctx.fillStyle = '#FED7AA'; // pleasant yellow
      ctx.textAlign = 'center';
      ctx.fillText(lbl.text, lbl.x, lbl.y - 4);
    });

    // DRAW WATER WAVES SURROUNDING THE ISLAND
    // Render simple vector border overlays or text prompts depending on proximity
    // COMPASS ARROW OVERLAY TO PIZZERIA (If no delivery active) OR SEEDED TARGETS (If delivering!)
    const hasActiveOrders = activeOrders.length > 0;
    
    let defaultPizzeriaX = 0;
    let defaultPizzeriaY = hasOwnPizzeria ? 245 : 0;

    if (!hasActiveOrders) {
      if (tutorialStep === 'concesionario') {
        defaultPizzeriaX = DEALER_X;
        defaultPizzeriaY = DEALER_Y;
      } else if (tutorialStep === 'casino') {
        defaultPizzeriaX = CASINO_X;
        defaultPizzeriaY = CASINO_Y;
      } else if (businessTutorialStep === 'upgrades') {
        defaultPizzeriaX = OWN_PIZZERIA_X;
        defaultPizzeriaY = OWN_PIZZERIA_Y;
      }
    }

    const targetX = hasActiveOrders 
      ? (houses.find(h => h.id === activeOrders[0].houseId)?.x || 0) 
      : defaultPizzeriaX;
    const targetY = hasActiveOrders 
      ? (houses.find(h => h.id === activeOrders[0].houseId)?.y || 0) 
      : defaultPizzeriaY;

    // Relative angle to target
    const dx = targetX - playerX;
    const dy = targetY - playerY;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);

    if (distToTarget > 40) {
      const targetAngle = Math.atan2(dy, dx);
      // Floating, bobbing 3D chevron arrow hovering precisely above the player's head!
      const bounce = Math.sin(Date.now() / 150) * 3.5;
      const arrowZ = playerZ + 36 + bounce;

      const tip = {
        x: playerX + Math.cos(targetAngle) * 16,
        y: playerY + Math.sin(targetAngle) * 16,
        z: arrowZ,
      };
      const leftBase = {
        x: playerX + Math.cos(targetAngle + Math.PI * 0.8) * 10,
        y: playerY + Math.sin(targetAngle + Math.PI * 0.8) * 10,
        z: arrowZ,
      };
      const rightBase = {
        x: playerX + Math.cos(targetAngle - Math.PI * 0.8) * 10,
        y: playerY + Math.sin(targetAngle - Math.PI * 0.8) * 10,
        z: arrowZ,
      };
      const notch = {
        x: playerX + Math.cos(targetAngle + Math.PI) * 4,
        y: playerY + Math.sin(targetAngle + Math.PI) * 4,
        z: arrowZ,
      };

      const pTip = proj(tip);
      const pLeft = proj(leftBase);
      const pRight = proj(rightBase);
      const pNotch = proj(notch);

      ctx.beginPath();
      ctx.moveTo(pTip.x, pTip.y);
      ctx.lineTo(pLeft.x, pLeft.y);
      ctx.lineTo(pNotch.x, pNotch.y);
      ctx.lineTo(pRight.x, pRight.y);
      ctx.closePath();

      // Color scheme dynamic pairing
      if (hasActiveOrders) {
        ctx.fillStyle = '#EF4444'; // Vibrant red for active delivery
      } else if (tutorialStep === 'concesionario') {
        ctx.fillStyle = '#0EA5E9'; // Sky blue for car dealer
      } else if (tutorialStep === 'casino') {
        ctx.fillStyle = '#A855F7'; // Purple for casino
      } else if (businessTutorialStep === 'upgrades') {
        ctx.fillStyle = '#EC4899'; // Pink for base upgrades
      } else {
        ctx.fillStyle = '#EAB308'; // Amber/Golden for central pizzeria
      }

      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Inner glow indicator for modern detail
      ctx.beginPath();
      ctx.arc(pNotch.x, pNotch.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }

    // MAP STUN EFFECT OVERLAY
    if (isStunned) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      ctx.fillRect(0, 0, width, height);
      // Draw stars spinning!
      ctx.fillStyle = '#FCD34D';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      const playerScr = proj({ x: playerX, y: playerY, z: playerZ + 18 });
      ctx.fillText('💫 ¡CHOCASTE! 💫', playerScr.x, playerScr.y);
    }

    if (isSlowed) {
      ctx.fillStyle = 'rgba(180, 83, 9, 0.08)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#FBBF24';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const playerScr = proj({ x: playerX, y: playerY, z: playerZ + 18 });
      ctx.fillText('💩 LODO ralentizando... 💩', playerScr.x, playerScr.y - 10);
    }
  };

  // Adjust canvas size to parent container
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        render();
      }
    };

    window.addEventListener('resize', handleResize);
    // Initial size
    handleResize();

    // Trigger double render just in case layout engine settles
    setTimeout(handleResize, 100);
    setTimeout(handleResize, 350);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Distance and Compass Direction calculations
  const activeOrder = activeOrders && activeOrders[0];
  const targetHouse = activeOrder ? houses.find(h => h.id === activeOrder.houseId) : null;

  let targetX = 0;
  let targetY = hasOwnPizzeria ? 245 : 0;
  let targetLabel = hasOwnPizzeria ? 'Base Propia' : 'Pizzería';
  let targetSub = hasOwnPizzeria ? 'Ir a Base' : 'Ir a Pizzería';

  if (tutorialStep === 'pizzeria') {
    targetX = 0;
    targetY = 0;
    targetLabel = 'Pizzería Central';
    targetSub = 'TOMAR PEDIDO [0, 0]';
  } else if (tutorialStep === 'delivery' && targetHouse) {
    targetX = targetHouse.x;
    targetY = targetHouse.y;
    targetLabel = `Casa ${targetHouse.number}`;
    targetSub = 'ENTREGAR PEDIDO';
  } else if (tutorialStep === 'concesionario') {
    targetX = -245; // DEALER_X
    targetY = 0;    // DEALER_Y
    targetLabel = 'Tienda Vehículos';
    targetSub = 'MEJORAR VELOCIDAD';
  } else if (tutorialStep === 'casino') {
    targetX = 245;  // CASINO_X
    targetY = 0;    // CASINO_Y
    targetLabel = 'Casino de la Isla';
    targetSub = 'COMPLETAR TUTORIAL';
  } else if (businessTutorialStep === 'upgrades') {
    targetX = 0;    // OWN_PIZZERIA_X
    targetY = 245;  // OWN_PIZZERIA_Y
    targetLabel = 'Base Administrativa';
    targetSub = 'MEJORAS E IMPERIO';
  } else if (targetHouse) {
    targetX = targetHouse.x;
    targetY = targetHouse.y;
    targetLabel = `Casa ${targetHouse.number}`;
    targetSub = 'ENTREGAR PEDIDO';
  }

  const distDx = targetX - playerX;
  const distDy = targetY - playerY;
  const distance = Math.round(Math.sqrt(distDx * distDx + distDy * distDy));

  // Base map coordinate system: North is Y=-1, South is Y=1, East is X=1, West is X=-1
  const targetAngle = Math.atan2(distDy, distDx);
  const angleDeg = (targetAngle * 180) / Math.PI;

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (chapter !== 3 || insideRegionId !== null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get click coordinates relative to the canvas
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert click coordinates to world coordinates
    const width = canvas.width;
    const height = canvas.height;
    
    const camZ = cameraRef.current.z || 500;
    const scale = 400 / camZ;

    const dx = (clickX - width / 2) / scale;
    const dy = (clickY - height / 2) / scale;

    const clickWorldX = cameraRef.current.x + dx;
    const clickWorldY = cameraRef.current.y + dy;

    // Now, let's find the nearest territory to this 3D coordinate!
    const activeTerritory = getTerritoryAt(clickWorldX, clickWorldY);
    if (activeTerritory) {
      // If they clicked within 180 world units of the region node
      const distSq = (clickWorldX - activeTerritory.cx) ** 2 + (clickWorldY - activeTerritory.cy) ** 2;
      if (distSq < 32400 && onClickRegion) {
        onClickRegion(activeTerritory.id);
      }
    }
  };

  return (
    <div id="canvas-wrapper" className="relative w-full h-full min-h-[350px] bg-slate-900 rounded-3xl border-4 border-slate-700/80 overflow-hidden shadow-inner flex flex-col justify-end select-none">
      <canvas 
        ref={canvasRef} 
        id="game-3d-canvas"
        className="absolute inset-0 w-full h-full block cursor-pointer"
        onClick={handleCanvasClick}
      />

      {/* COMPASS OVERLAY (Top-Left) */}
      <div className="absolute top-4 left-4 bg-slate-950/90 backdrop-blur-md border-[3px] border-amber-400 p-2.5 rounded-2xl flex items-center gap-2.5 shadow-2xl z-30 pointer-events-none select-none animate-pulse">
        <div className="relative w-11 h-11 rounded-full border-2 border-slate-700 bg-slate-900 flex items-center justify-center shrink-0">
          <span className="absolute top-0.5 text-[6px] text-slate-500 font-extrabold font-mono">N</span>
          <span className="absolute bottom-0.5 text-[6px] text-slate-500 font-extrabold font-mono">S</span>
          <span className="absolute left-0.5 text-[6px] text-slate-500 font-extrabold font-mono">O</span>
          <span className="absolute right-0.5 text-[6px] text-slate-500 font-extrabold font-mono">E</span>
          
          <div 
            className="absolute w-1.5 h-8 flex flex-col justify-between items-center transition-transform duration-75 ease-out"
            style={{ transform: `rotate(${angleDeg + 90}deg)` }}
          >
            <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[14px] border-b-red-500" />
            <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[14px] border-t-slate-400" />
          </div>
          
          <div className="absolute w-1.5 h-1.5 rounded-full bg-slate-200 border border-slate-700 shadow" />
        </div>
        
        <div className="text-left font-sans text-xs">
          <p className="text-[8px] text-amber-500 font-black uppercase tracking-wider">OBJETIVO</p>
          <p className="font-black text-white truncate max-w-[125px] leading-none text-xs uppercase font-sans mt-0.5">
            {targetLabel}
          </p>
          <p className="text-[9px] text-amber-400 font-mono font-black mt-0.5 leading-none shrink-0 uppercase tracking-tight">
            {targetSub}
          </p>
        </div>
      </div>

      {/* METERS DISTANCE COUNTER OVERLAY (Bottom-Center) */}
      <div className="absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 bg-slate-950/85 backdrop-blur-md border border-emerald-500/50 p-2 px-4 rounded-xl flex items-center gap-2 shadow-2xl z-30 pointer-events-none select-none">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <p className="text-[11px] font-sans text-slate-355 font-extrabold uppercase leading-none">
          Distancia: <span className="text-emerald-400 font-mono font-black text-xs">{distance} metros</span>
        </p>
      </div>

      {/* Dynamic Interaction Overlay Floating prompts */}
      {activePrompt !== 'none' && (
        <div 
          id="active-interaction-prompt"
          className="absolute inset-x-0 bottom-6 flex justify-center z-35 pointer-events-none"
        >
          <div className="bg-slate-950/90 text-white border-2 border-amber-400 p-3 px-6 rounded-2xl flex items-center gap-3 shadow-2xl animate-bounce pointer-events-auto transition">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <div className="text-left font-sans leading-none">
              <p className="text-sm font-black text-amber-300">
                {activePrompt === 'pizzeria' && '🍕 Pizzería "El Horno Feliz"'}
                {activePrompt === 'own_pizzeria' && '⚡ Tu Imperio de Pizza (Base Principal)'}
                {activePrompt === 'pizzeria_abandonada' && '🏚️ Pizzería Abandonada ($10,000)'}
                {activePrompt === 'rival_pizzeria_defeated' && '👿 Adquirir Pizzería Rival ($100,000)'}
                {activePrompt === 'concesionario' && '🚗 Tienda de Vehículos "Motores de la Isla"'}
                {activePrompt === 'casino' && '🎰 Casino "Isla Fortune"'}
              </p>
              <p className="text-[10px] text-slate-350 font-bold tracking-wide mt-1 uppercase">
                Haz clic o pulsa [Espacio] para interactuar
              </p>
            </div>
            {/* Click Button */}
            <button
              id="interact-prompt-btn"
              type="button"
              onClick={() => {
                // Mock an space space keydown manually
                window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
              }}
              className="bg-amber-400 text-slate-950 hover:bg-amber-500 p-1.5 px-3 rounded-lg text-xs font-black shadow transition shrink-0"
            >
              ABRIR
            </button>
          </div>
        </div>
      )}

      {/* Helicopters Escape Warning Floating Overlays */}
      {currentVehicleId === 'helicoptero' && !hasOwnPizzeria && (
        <div className="absolute top-2 w-full text-center pointer-events-none z-30">
          <span className="bg-pink-100 text-pink-700 font-black text-[10px] tracking-widest uppercase p-1.5 px-3 rounded-full border border-pink-300 shadow animate-pulse inline-block">
            🚁 Vuelo Libre: ¡Aproxima las esquinas del mapa con el Helicóptero para escapar de la Isla!
          </span>
        </div>
      )}
    </div>
  );
};
