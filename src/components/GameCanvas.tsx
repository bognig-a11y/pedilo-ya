/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { House, Obstacle, Vagabond, VehicleId, Order } from '../types';
import { audio } from '../utils/audio';

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
  onInteract: (zone: 'pizzeria' | 'casino' | 'concesionario' | 'none') => void;
  onEnterCorner: (cornerIndex: number) => void;
  keysPressed: { [key: string]: boolean };
  virtualDirection: { x: number; y: number };
  isStunned: boolean;
  isSlowed: boolean;
  isVictory: boolean;
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
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Interaction Prompts zone state
  const [activePrompt, setActivePrompt] = useState<'pizzeria' | 'casino' | 'concesionario' | 'none'>('none');

  // Coordinates helper values
  const PIZZERIA_X = 0;
  const PIZZERIA_Y = 0;
  const DEALER_X = -130;
  const DEALER_Y = -20;
  const CASINO_X = 130;
  const CASINO_Y = -20;

  // Helipad positions in the 4 corners of the map (-450 to 450)
  const CORNERS = [
    { x: -440, y: -440 }, // Top-Left
    { x: 440, y: -440 },  // Top-Right
    { x: -440, y: 440 },  // Bottom-Left
    { x: 440, y: 440 },   // Bottom-Right
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

      // Smooth camera follow (lerp towards player)
      cameraRef.current.x += (state.playerX - cameraRef.current.x) * 0.08;
      // Camera is placed south of the player to create a gorgeous 3/4 diagonal perspective look
      const targetCamY = state.playerY + 85;
      cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.08;
      // Altitude changes based on whether helicopter is flying
      const targetCamZ = (state.currentVehicleId === 'helicoptero') ? 110 : 70;
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
    const zoom = 1.95;
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
    // Distance to shop zones
    const distPizza = Math.sqrt((playerX - PIZZERIA_X) ** 2 + (playerY - PIZZERIA_Y) ** 2);
    const distDealer = Math.sqrt((playerX - DEALER_X) ** 2 + (playerY - DEALER_Y) ** 2);
    const distCasino = Math.sqrt((playerX - CASINO_X) ** 2 + (playerY - CASINO_Y) ** 2);

    let active: typeof activePrompt = 'none';
    if (distPizza < 45) active = 'pizzeria';
    else if (distDealer < 45) active = 'concesionario';
    else if (distCasino < 45) active = 'casino';

    setActivePrompt(active);
    onInteract(active);

    // Also check corner helicopter escapes
    if (currentVehicleId === 'helicoptero') {
      CORNERS.forEach((corner, index) => {
        const cornerDist = Math.sqrt((playerX - corner.x) ** 2 + (playerY - corner.y) ** 2);
        if (cornerDist < 50) {
          onEnterCorner(index);
        }
      });
    }
  }, [playerX, playerY, currentVehicleId]);


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
    } = renderStateRef.current;

    // Clear Canvas with lovely clear blue sky/ocean background
    ctx.fillStyle = '#C0E4FF';
    ctx.fillRect(0, 0, width, height);

    // Setup tilted camera settings
    const pitch = 0.85; 
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
    // Map bounds: -500 to 500
    const sandColor = '#FEF08A';
    const tileSize = 80;

    // Draw sand shoreline as tiled grid to prevent projection flips when player goes far or near edges
    for (let gx = -480; gx < 480; gx += tileSize) {
      for (let gy = -480; gy < 480; gy += tileSize) {
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
          const sz = -ry * Math.sin(0.85) - dz * Math.cos(0.85);
          if (400 + sz < 15) {
            hasBehind = true;
          }
        });

        if (hasBehind) continue;

        const prjPts = pts.map(proj);
        ctx.beginPath();
        ctx.moveTo(prjPts[0].x, prjPts[0].y);
        ctx.lineTo(prjPts[1].x, prjPts[1].y);
        ctx.lineTo(prjPts[2].x, prjPts[2].y);
        ctx.lineTo(prjPts[3].x, prjPts[3].y);
        ctx.closePath();
        ctx.fillStyle = sandColor;
        ctx.fill();
      }
    }

    // Draw green island grass as tiled grid to prevent projection flips when player goes far or near edges
    for (let gx = -450; gx < 450; gx += 60) {
      for (let gy = -450; gy < 450; gy += 60) {
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
          const sz = -ry * Math.sin(0.85) - dz * Math.cos(0.85);
          if (400 + sz < 15) {
            hasBehind = true;
          }
        });

        if (hasBehind) continue;

        const prjPts = pts.map(proj);
        ctx.beginPath();
        ctx.moveTo(prjPts[0].x, prjPts[0].y);
        ctx.lineTo(prjPts[1].x, prjPts[1].y);
        ctx.lineTo(prjPts[2].x, prjPts[2].y);
        ctx.lineTo(prjPts[3].x, prjPts[3].y);
        ctx.closePath();
        ctx.fillStyle = '#49A06D';
        ctx.fill();
      }
    }

    // DRAW STREETS & ROADS (Tarmac grey - subdivided segment-by-segment to prevent projection stretching)
    const streetPlanners = [
      // Central avenues crossing the island
      { x: -440, y: -15, w: 880, h: 30, isVert: false },
      { x: -15, y: -440, w: 30, h: 880, isVert: true },

      // Middle ring streets
      { x: -250, y: -250, w: 500, h: 18, isVert: false },
      { x: -250, y: 240, w: 500, h: 18, isVert: false },
      { x: -250, y: -250, w: 18, h: 500, isVert: true },
      { x: 245, y: -250, w: 18, h: 500, isVert: true },
    ];

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
            const sz = -ry * Math.sin(0.85) - dz * Math.cos(0.85);
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
            const sz = -ry * Math.sin(0.85) - dz * Math.cos(0.85);
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

    // 4 CORNER DOCKS / HELIPADS (Rescue escapes)
    if (currentVehicleId === 'helicoptero') {
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
    // Red, White, Green stylized building with pizza banner
    push3DBox(PIZZERIA_X, PIZZERIA_Y, 0, 48, 48, 30, {
      top: '#10B981',   // Pizza green roof
      front: '#F9FAFB', // White walls
      side: '#EF4444',  // Italian red side columns
    }, 0, 'PIZZERIA');

    // A gorgeous little yellow roof peak on top of Pizza shop
    push3DPyramid(PIZZERIA_X, PIZZERIA_Y, 30, 48, 48, 14, '#FCD34D', '#FBBF24', 0);


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
      }, house.style * 0.45, `Casa ${house.number}`);

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

    // SORT ALL FACES BACK-TO-FRONT (Painter's Algorithm)
    // Faces with HIGHER avgDepth (which means further away sz from camera) are drawn FIRST.
    // Faces with LOWER avgDepth (closer to screen) are drawn LATER (on top!).
    faces.sort((a, b) => b.avgDepth - a.avgDepth);

    // DRAW FACES
    faces.forEach((face) => {
      if (face.points.length < 2) return;

      // Class 3D Near Plane Clip: Skip drawing the face entirely if any vertex lies behind or too close to the camera
      let hasBehind = false;
      for (const p of face.points) {
        const dx = p.x - cameraRef.current.x;
        const dy = p.y - cameraRef.current.y;
        const dz = p.z - cameraRef.current.z;
        const ry = dy; // yaw is 0
        const sz = -ry * Math.sin(0.85) - dz * Math.cos(0.85);
        if (400 + sz < 10) {
          hasBehind = true;
          break;
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

      // Draw floating billboards text for buildings / targets
      if (face.text) {
        // Average coordinates for centering labels
        const avgX = projected.reduce((s, p) => s + p.x, 0) / projected.length;
        const avgY = projected.reduce((s, p) => s + p.y, 0) / projected.length;

        ctx.font = 'black 9px sans-serif';
        // Shadow/Glow text box background
        const txtWidth = ctx.measureText(face.text).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(avgX - txtWidth / 2 - 4, avgY - 14, txtWidth + 8, 14);

        // Core text
        ctx.fillStyle = '#FED7AA'; // pleasant yellow
        ctx.textAlign = 'center';
        ctx.fillText(face.text, avgX, avgY - 4);
      }
    });

    // DRAW WATER WAVES SURROUNDING THE ISLAND
    // Render simple vector border overlays or text prompts depending on proximity
    // COMPASS ARROW OVERLAY TO PIZZERIA (If no delivery active) OR SEEDED TARGETS (If delivering!)
    const hasActiveOrders = activeOrders.length > 0;
    const targetX = hasActiveOrders 
      ? (houses.find(h => h.id === activeOrders[0].houseId)?.x || 0) 
      : PIZZERIA_X;
    const targetY = hasActiveOrders 
      ? (houses.find(h => h.id === activeOrders[0].houseId)?.y || 0) 
      : PIZZERIA_Y;

    // Relative angle to target
    const dx = targetX - playerX;
    const dy = targetY - playerY;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);

    if (distToTarget > 60) {
      const targetAngle = Math.atan2(dy, dx);
      // Clean spinning glowing pointer at the bottom/top of the screen or around player!
      // Draw around the player disk!
      const radiusAroundPlayer = 20;
      const arrowPoint = {
        x: playerX + Math.cos(targetAngle) * radiusAroundPlayer,
        y: playerY + Math.sin(targetAngle) * radiusAroundPlayer,
        z: playerZ + 4,
      };
      
      const screenArrow = proj(arrowPoint);
      ctx.beginPath();
      ctx.arc(screenArrow.x, screenArrow.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = hasActiveOrders ? '#F43F5E' : '#EAB308'; // red for delivery, golden for pizza shop
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();
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
  const targetX = targetHouse ? targetHouse.x : 0; // Pizzeria is at [0,0]
  const targetY = targetHouse ? targetHouse.y : 0;

  const distDx = targetX - playerX;
  const distDy = targetY - playerY;
  const distance = Math.round(Math.sqrt(distDx * distDx + distDy * distDy));

  // Base map coordinate system: North is Y=-1, South is Y=1, East is X=1, West is X=-1
  const targetAngle = Math.atan2(distDy, distDx);
  const angleDeg = (targetAngle * 180) / Math.PI;

  return (
    <div id="canvas-wrapper" className="relative w-full h-full min-h-[350px] bg-slate-900 rounded-3xl border-4 border-slate-700/80 overflow-hidden shadow-inner flex flex-col justify-end select-none">
      <canvas 
        ref={canvasRef} 
        id="game-3d-canvas"
        className="absolute inset-0 w-full h-full block cursor-pointer"
      />

      {/* COMPASS OVERLAY (Top-Left) */}
      <div className="absolute top-4 left-4 bg-slate-950/85 backdrop-blur-md border-[3px] border-amber-400 p-2.5 rounded-2xl flex items-center gap-2.5 shadow-2xl z-30 pointer-events-none select-none">
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
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Dirección</p>
          <p className="font-black text-amber-300 truncate max-w-[110px] leading-tight text-xs uppercase font-serif">
            {targetHouse ? `Casa ${targetHouse.number}` : 'Pizzería'}
          </p>
          <p className="text-[9px] text-slate-200 font-mono font-medium leading-normal shrink-0">
            {targetHouse ? 'Destino' : 'Ir a Pizzería'}
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
      {currentVehicleId === 'helicoptero' && (
        <div className="absolute top-2 w-full text-center pointer-events-none z-30">
          <span className="bg-pink-100 text-pink-700 font-black text-[10px] tracking-widest uppercase p-1.5 px-3 rounded-full border border-pink-300 shadow animate-pulse inline-block">
            🚁 Vuelo Libre: ¡Aproxima las esquinas del mapa con el Helicóptero para escapar de la Isla!
          </span>
        </div>
      )}
    </div>
  );
};
