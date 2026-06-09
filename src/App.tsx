/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  DollarSign, Car, Calendar, ShieldAlert, Award, Clock, Sparkles, 
  Play, RotateCcw, AlertTriangle, Volume2, VolumeX, Menu, CheckCircle2, Navigation
} from 'lucide-react';
import { GameState, House, Order, Obstacle, Vagabond, Upgrades, VehicleId } from './types';
import { PizzeriaModal } from './components/PizzeriaModal';
import { OwnPizzeriaModal } from './components/OwnPizzeriaModal';
import { ConcesionarioModal, VEHICLES_LIST } from './components/ConcesionarioModal';
import { CasinoModal } from './components/CasinoModal';
import { UpgradesModal } from './components/UpgradesModal';
import { PizzeriaCustomizationModal } from './components/PizzeriaCustomizationModal';
import { GameCanvas } from './components/GameCanvas';
import { Joystick } from './components/Joystick';
import { audio } from './utils/audio';

// Dynamic obstacle generator
const generateDynamicObstacles = (houses: House[], currentVehicleId: VehicleId, completedOrdersCount: number): Obstacle[] => {
  const list: Obstacle[] = [];
  
  // 1. PLACE TREES (scattered randomly on the map, allowing anywhere)
  for (let i = 0; i < 34; i++) {
    let x = (Math.random() * 800) - 400;
    let y = (Math.random() * 800) - 400;
    list.push({
      id: `tree-${i}-${Date.now()}`,
      type: 'tree',
      x,
      y,
      size: 10,
    });
  }

  // 2. PLACE MUD PUDDLES (scattered randomly, allowing anywhere)
  for (let i = 0; i < 15; i++) {
    let x = (Math.random() * 700) - 350;
    let y = (Math.random() * 700) - 350;
    list.push({
      id: `mud-${i}-${Date.now()}`,
      type: 'mud',
      x,
      y,
      size: 15,
    });
  }

  // 3. PLACE TRAFFIC STREET CARS (circulating on the roads!)
  const colors = ['#EF4444', '#3B82F6', '#1E293B', '#F59E0B', '#10B981', '#EC4899'];
  const STREET_COORDS = [-368, -123, 123, 368];
  const streets: { startX: number; startY: number; endX: number; endY: number; angle: number }[] = [];

  // Horizontal streets
  STREET_COORDS.forEach(Y_c => {
    streets.push({
      startX: -440,
      startY: Y_c,
      endX: 440,
      endY: Y_c,
      angle: 0
    });
  });

  // Vertical streets
  STREET_COORDS.forEach(X_c => {
    streets.push({
      startX: X_c,
      startY: -440,
      endX: X_c,
      endY: 440,
      angle: Math.PI / 2
    });
  });

  streets.forEach((st, idx) => {
    // Place 2 cars per street lane in opposite directions
    for (let c = 0; c < 2; c++) {
      const t = Math.random() * 0.7 + 0.15;
      const carX = st.startX + (st.endX - st.startX) * t;
      const carY = st.startY + (st.endY - st.startY) * t;
      
      // speed is increased to satisfy the "autos más rápidos" request
      const speed = 75 + Math.random() * 40;

      list.push({
        id: `car-${idx}-${c}-${Date.now()}`,
        type: 'car',
        x: carX,
        y: carY,
        size: 12,
        vx: Math.cos(st.angle) * speed * (c === 1 ? -1 : 1),
        vy: Math.sin(st.angle) * speed * (c === 1 ? -1 : 1),
        angle: st.angle + (c === 1 ? Math.PI : 0),
        color: colors[(idx + c) % colors.length],
        streetIndex: idx,
      });
    }
  });

  return list;
};

// Procedural Houses generator (constructed once upon launch!)
const generateHouses = (): House[] => {
  const list: House[] = [];
  const houseNames = [
    "Barrio Central", "Chalet Altos", "Quinta del Prado", "Villa Soleada",
    "Villa Esmeralda", "Casa del Huerto", "Residencia Soler", "Cabaña de Pinos",
    "Mansión de la Isla", "Chalet del Río", "Residencia Arenas", "Villa Marina",
    "Casa del Bosque", "Edificio Primavera", "Quinta Linda", "Casita Blanca",
    "Estancia Alegre", "Chalet Azul", "Mansión Colinas", "La Fortaleza"
  ];
  const colors = [
    "#F87171", "#60A5FA", "#34D399", "#FB923C", "#A78BFA", 
    "#F472B6", "#FB7185", "#38BDF8", "#FCD34D", "#4ADE80"
  ];

  const colBounds = [-450, -368, -123, 123, 368, 450];
  const rowBounds = [-450, -368, -123, 123, 368, 450];

  const cells: { col: number; row: number }[] = [];
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 3; c++) {
      // Exclude middle square (Row 2, Col 2) and square below middle (Row 3, Col 2) only!
      if (r === 2 && c === 2) continue;
      if (r === 3 && c === 2) continue;
      cells.push({ col: c, row: r });
    }
  }

  // Shuffle cells to assign unique sectors randomly
  const shuffledCells = [...cells];
  for (let i = shuffledCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledCells[i], shuffledCells[j]] = [shuffledCells[j], shuffledCells[i]];
  }

  // Generate 28 houses (increased from 20 to add more houses)
  const totalHousesToGenerate = 28;
  for (let i = 0; i < totalHousesToGenerate; i++) {
    const targetCell = shuffledCells[i % shuffledCells.length];
    const cellMinX = colBounds[targetCell.col];
    const cellMaxX = colBounds[targetCell.col + 1];
    const cellMinY = rowBounds[targetCell.row];
    const cellMaxY = rowBounds[targetCell.row + 1];

    let attempts = 0;
    let placed = false;

    while (attempts < 300) {
      // Pick random coordinate within the assigned cell
      // add padding of 15 to avoid edge clipping
      const padding = 15;
      const x = Math.floor(Math.random() * (cellMaxX - cellMinX - 2 * padding)) + cellMinX + padding;
      const y = Math.floor(Math.random() * (cellMaxY - cellMinY - 2 * padding)) + cellMinY + padding;

      // 1. Minimum distance to original Pizzeria (0, 0)
      const dPizzeria = Math.sqrt(x*x + y*y);
      if (dPizzeria < 110) {
        attempts++;
        continue;
      }

      // 2. Minimum distance to Own Pizzeria (0, 245)
      const dOwnPizzeria = Math.sqrt(x*x + (y - 245)**2);
      if (dOwnPizzeria < 110) {
        attempts++;
        continue;
      }

      // 3. Minimum distance to Concesionario (-245, 0)
      const dDealer = Math.sqrt((x - (-245))**2 + y**2);
      if (dDealer < 65) {
        attempts++;
        continue;
      }

      // 4. Minimum distance to Casino (245, 0)
      const dCasino = Math.sqrt((x - 245)**2 + y**2);
      if (dCasino < 65) {
        attempts++;
        continue;
      }

      // 5. Check distance to already placed houses
      let tooClose = false;
      const minHouseDist = attempts > 200 ? 30 : 50;
      for (const h of list) {
        const d = Math.sqrt((x - h.x)**2 + (y - h.y)**2);
        if (d < minHouseDist) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        list.push({
          id: i + 1,
          x,
          y,
          name: houseNames[i % houseNames.length],
          color: colors[i % colors.length],
          number: (i * 7 + 15).toString(),
          style: i,
        });
        placed = true;
        break;
      }
      attempts++;
    }

    // High stress fallback if cell is completely blocked
    if (!placed) {
      let fallbackAttempts = 0;
      while (fallbackAttempts < 100) {
        const randomCell = cells[Math.floor(Math.random() * cells.length)];
        const minX = colBounds[randomCell.col] + 15;
        const maxX = colBounds[randomCell.col + 1] - 15;
        const minY = rowBounds[randomCell.row] + 15;
        const maxY = rowBounds[randomCell.row + 1] - 15;
        const x = Math.floor(Math.random() * (maxX - minX)) + minX;
        const y = Math.floor(Math.random() * (maxY - minY)) + minY;

        let tooClose = false;
        for (const h of list) {
          if (Math.sqrt((x - h.x)**2 + (y - h.y)**2) < 30) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          list.push({
            id: i + 1,
            x,
            y,
            name: houseNames[i % houseNames.length],
            color: colors[i % colors.length],
            number: (i * 7 + 15).toString(),
            style: i,
          });
          break;
        }
        fallbackAttempts++;
      }
    }
  }

  return list;
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [muted, setMuted] = useState(false);

  // Core Player States
  const [money, setMoney] = useState(50);
  const [currentVehicleId, setCurrentVehicleId] = useState<VehicleId>('pie');
  const [upgrades, setUpgrades] = useState<Upgrades>({ ganancia: 0, suerte: 0, fuerza: 0 });
  const [failures, setFailures] = useState(0);
  const [completedOrdersCount, setCompletedOrdersCount] = useState(0);

  // Spatial Positions
  const [playerX, setPlayerX] = useState(0);
  const [playerY, setPlayerY] = useState(40); // Spawn clean in front of pizzería
  const [playerZ, setPlayerZ] = useState(0);
  const [playerAngle, setPlayerAngle] = useState(Math.PI / 2);

  // Refs for coordinates, keyboard inputs, and virtual parameters to avoid stale closures under continuous loops
  const playerXRef = useRef(0);
  const playerYRef = useRef(40);
  const playerAngleRef = useRef(Math.PI / 2);
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});
  const physicsStateRef = useRef<any>({});

  // Environment data
  const [houses] = useState<House[]>(() => generateHouses());
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [vagabonds, setVagabonds] = useState<Vagabond[]>([]);

  // Time & Rental Logic
  const [day, setDay] = useState(1);
  const [dayTimeLeft, setDayTimeLeft] = useState(60); // 1 minute is 60 seconds
  const [rentWarning, setRentWarning] = useState(false);
  const [rentPaymentNotice, setRentPaymentNotice] = useState<{ amount: number; nextDay: number } | null>(null);

  // Auto-hide rent payment notice after 3 seconds
  useEffect(() => {
    if (rentPaymentNotice) {
      const timer = setTimeout(() => {
        setRentPaymentNotice(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [rentPaymentNotice]);

  // Start/Stop Game Background Music loop based on gameplay state
  useEffect(() => {
    if (gameState === 'playing') {
      audio.startBGM();
    } else {
      audio.stopBGM();
    }
    return () => {
      audio.stopBGM();
    };
  }, [gameState]);

  // Pizzeria Order states
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);

  // Screens triggers
  const [isPizzeriaOpen, setIsPizzeriaOpen] = useState(false);
  const [isDealerOpen, setIsDealerOpen] = useState(false);
  const [isCasinoOpen, setIsCasinoOpen] = useState(false);
  const [isUpgradesOpen, setIsUpgradesOpen] = useState(false);

  // Stuns and slows active timers
  const [stunTime, setStunTime] = useState(0);
  const [slowTime, setSlowTime] = useState(0);

  // Helipads near exit interactive popup
  const [isEscapeAsking, setIsEscapeAsking] = useState(false);

  // Business late-game expansion states
  const [hasOwnPizzeria, setHasOwnPizzeria] = useState(false);
  const [pizzeriaName, setPizzeriaName] = useState('Base Propia');
  const [pizzeriaColor, setPizzeriaColor] = useState('#10B981'); // Emerald green default
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const [renovationLevel, setRenovationLevel] = useState(0); // 0, 1, 2, 3
  const [playerMarketShare, setPlayerMarketShare] = useState(20);
  const [businessDaysHeld, setBusinessDaysHeld] = useState(0);
  const [rivalPassiveRate, setRivalPassiveRate] = useState(2);
  const [employeeLevel, setEmployeeLevel] = useState(0); // 0-5
  const [isRivalDefeated, setIsRivalDefeated] = useState(false);
  const [hasGlobalized, setHasGlobalized] = useState(false);
  const [passiveTimer, setPassiveTimer] = useState(0);

  // Simulation employees state
  const [employees, setEmployees] = useState<any[]>([]);
  const [rivalDeliverers, setRivalDeliverers] = useState<any[]>([]);

  // Password terminal cheat states
  const [isCheatOpen, setIsCheatOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // Modals system triggers
  const [isBuyPizzeriaOpen, setIsBuyPizzeriaOpen] = useState(false);
  const [isOwnPizzeriaOpen, setIsOwnPizzeriaOpen] = useState(false);
  const [isBuyRivalOpen, setIsBuyRivalOpen] = useState(false);
  const [isRivalDecisionOpen, setIsRivalDecisionOpen] = useState(false);
  const [rivalPulse, setRivalPulse] = useState(false);

  // Virtual controller directions state
  const [virtualDirection, setVirtualDirection] = useState({ x: 0, y: 0 });

  // Tracking keys state
  const [keysPressed, setKeysPressed] = useState<{ [key: string]: boolean }>({});

  const currentVehicle = VEHICLES_LIST.find(v => v.id === currentVehicleId) || VEHICLES_LIST[0];

  // Map limits
  const LIMIT = 450;

  physicsStateRef.current = {
    gameState,
    currentVehicleId,
    obstacles,
    vagabonds,
    activeOrders,
    money,
    upgrades,
    stunTime,
    slowTime,
    completedOrdersCount,
    currentVehicle,
    virtualDirection,
    isPizzeriaOpen,
    isDealerOpen,
    isCasinoOpen,
    isUpgradesOpen,
    isBuyPizzeriaOpen,
    isOwnPizzeriaOpen,
    isBuyRivalOpen,
    isRivalDecisionOpen,
    isCheatOpen,
    houses,
    hasOwnPizzeria,
    playerMarketShare,
    hasGlobalized,
    isRivalDefeated,
    isCustomizationOpen,
    renovationLevel,
    pizzeriaName,
    pizzeriaColor,
  };

  // Initialize and regenerate 3 orders
  const generatePizzeriaOrders = (playerVehicleSpeed: number) => {
    const list: Order[] = [];
    const housePool = [...houses];
    
    // Choose 3 unique houses
    const difficulties: ('facil' | 'medio' | 'dificil')[] = ['facil', 'medio', 'dificil'];

    for (let i = 0; i < 3; i++) {
      if (housePool.length === 0) break;
      const hIdx = Math.floor(Math.random() * housePool.length);
      const targetHouse = housePool.splice(hIdx, 1)[0];

      // Calculate absolute distance (from pizzeria center X:0 Y:0 to house, or custom pizzeria base [0, 245])
      const refX = 0;
      const refY = hasOwnPizzeria ? 245 : 0;
      const dist = Math.sqrt((targetHouse.x - refX) ** 2 + (targetHouse.y - refY) ** 2);
      
      // Calculate realistic travel duration base: distance / speed
      const baseTripDuration = dist / playerVehicleSpeed;

      const diff = difficulties[i];

      // Wiggle padding multiplier based on difficulty
      let multiplier = 2.4;
      let rewardFactor = 0.5;

      if (diff === 'medio') {
        multiplier = 1.7;
        rewardFactor = 0.75;
      } else if (diff === 'dificil') {
        multiplier = 1.25;
        rewardFactor = 1.1;
      }

      // Time allowed: base timer + margin offset
      let finalTime = Math.ceil(baseTripDuration * multiplier + 6);
      // Ensure no order can have less than 5 seconds (strict user requested constraint!)
      finalTime = Math.max(5, finalTime);

      // Reward based on distance and difficulty scale
      const rewardVal = Math.round(dist * rewardFactor + 35);

      list.push({
        id: `order-${i}-${Date.now()}`,
        houseId: targetHouse.id,
        timeLimit: finalTime,
        timeLeft: finalTime,
        reward: rewardVal,
        difficulty: diff,
      });
    }

    setAvailableOrders(list);
  };

  // Generate 3 available orders at startup and refresh upon every completed order delivery
  useEffect(() => {
    generatePizzeriaOrders(currentVehicle.speed);
  }, [currentVehicleId, completedOrdersCount]);

  // Audio muting handler
  const handleToggleMute = () => {
    const n = !muted;
    setMuted(n);
    audio.setMuted(n);
  };

  // Setup Keyboard hooks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code.toLowerCase();
      
      const newKeys = { 
        ...keysPressedRef.current, 
        [key]: true,
        [code]: true 
      };
      keysPressedRef.current = newKeys;
      setKeysPressed(newKeys);

      // SPACEBAR triggers active interactions
      if (e.key === ' ' || e.key === 'Spacebar') {
        const curX = playerXRef.current;
        const curY = playerYRef.current;

        const state = physicsStateRef.current;

        // Check secret password cheat in bottom-right corner (around 440, 440)
        const distCornerBR = Math.sqrt((curX - 440) ** 2 + (curY - 440) ** 2);
        if (distCornerBR < 55 && !state.isCheatOpen) {
          setIsCheatOpen(true);
          setIsPizzeriaOpen(false);
          setIsDealerOpen(false);
          setIsCasinoOpen(false);
          setIsUpgradesOpen(false);
          setIsBuyPizzeriaOpen(false);
          setIsOwnPizzeriaOpen(false);
          setIsBuyRivalOpen(false);
          setIsRivalDecisionOpen(false);
          audio.playUpgrade();
          return;
        }

        const distPizza = Math.sqrt((curX - 0) ** 2 + (curY - 0) ** 2);
        const distDealer = Math.sqrt((curX - (-245)) ** 2 + (curY - 0) ** 2);
        const distCasino = Math.sqrt((curX - 245) ** 2 + (curY - 0) ** 2);
        const distOwnPizza = Math.sqrt((curX - 0) ** 2 + (curY - 245) ** 2);

        if (!state.hasOwnPizzeria) {
          if (distPizza < 50 && !state.isPizzeriaOpen) {
            setIsPizzeriaOpen(true);
            setIsDealerOpen(false);
            setIsCasinoOpen(false);
            setIsUpgradesOpen(false);
            audio.playUpgrade();
          } else if (distOwnPizza < 50 && !state.isBuyPizzeriaOpen) {
            if (state.currentVehicleId === 'helicoptero') {
              setIsBuyPizzeriaOpen(true);
              setIsDealerOpen(false);
              setIsCasinoOpen(false);
              setIsUpgradesOpen(false);
              audio.playUpgrade();
            } else {
              alertBanner("⚠️ Solo puedes adquirir esta base propia si tienes el Helicóptero principal de la concesionaria.");
            }
          }
        } else {
          if (distOwnPizza < 50 && !state.isOwnPizzeriaOpen) {
            setIsOwnPizzeriaOpen(true);
            setIsDealerOpen(false);
            setIsCasinoOpen(false);
            setIsUpgradesOpen(false);
            audio.playUpgrade();
          } else if (distPizza < 50 && !state.isBuyRivalOpen && !state.hasGlobalized) {
            if (state.playerMarketShare >= 99.8) {
              setIsBuyRivalOpen(true);
              setIsDealerOpen(false);
              setIsCasinoOpen(false);
              setIsUpgradesOpen(false);
              audio.playUpgrade();
            } else {
              alertBanner(`⚠️ No puedes adquirir la pizzería rival todavía. Logra el 100% de la participación del mercado primero (Rival tiene ${(100 - state.playerMarketShare).toFixed(1)}%).`);
            }
          }
        }

        if (distDealer < 50 && !state.isDealerOpen) {
          setIsDealerOpen(true);
          setIsPizzeriaOpen(false);
          setIsCasinoOpen(false);
          setIsUpgradesOpen(false);
          audio.playUpgrade();
        } else if (distCasino < 50 && !state.isCasinoOpen) {
          setIsCasinoOpen(true);
          setIsPizzeriaOpen(false);
          setIsDealerOpen(false);
          setIsUpgradesOpen(false);
          audio.playUpgrade();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code.toLowerCase();
      const newKeys = { 
        ...keysPressedRef.current, 
        [key]: false,
        [code]: false 
      };
      keysPressedRef.current = newKeys;
      setKeysPressed(newKeys);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isEscapeAsking]);


  // KINEMATICS & OBSTACLE MOTION ticking loop (runs at requestAnimationFrame)
  useEffect(() => {
    if (gameState !== 'playing') return;

    let animId: number;
    let lastTime = performance.now();

    const updateGamePhysics = (time: number) => {
      const dt = Math.min(0.04, (time - lastTime) / 1000); // capped at 40ms to avoid tunneling
      lastTime = time;

      const state = physicsStateRef.current;

      // 1. STUN & SLOW TIMERS PROGRESSION
      if (state.stunTime > 0) {
        setStunTime(prev => Math.max(0, prev - dt));
      }
      if (state.slowTime > 0) {
        setSlowTime(prev => Math.max(0, prev - dt));
      }

      // 2. CHECK KEYBOARD AND VIRTUAL DIRECTIONS
      let dx = 0;
      let dy = 0;

      const keys = keysPressedRef.current;
      if (keys['w'] || keys['keyw'] || keys['arrowup']) dy = -1;
      if (keys['s'] || keys['keys'] || keys['arrowdown']) dy = 1;
      if (keys['a'] || keys['keya'] || keys['arrowleft']) dx = -1;
      if (keys['d'] || keys['keyd'] || keys['arrowright']) dx = 1;

      // Overlap with touch joystick direction if keyboard quiet
      if (dx === 0 && dy === 0) {
        dx = state.virtualDirection.x;
        dy = state.virtualDirection.y;
      }

      // Normalize movement vector
      if (dx !== 0 && dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
      }

      // 3. VELOCITY CALCULATION WITH STATS BONUSES
      let moveSpeed = state.currentVehicle.speed;

      // Check mud slow reduction
      if (state.slowTime > 0) {
        // Fuerza Level reduce negative factors
        // At level 10: Mud slow percentage reduction is only 15% instead of 55%!
        const mudSlowMultiplier = 0.55 - (state.upgrades.fuerza * 0.04);
        moveSpeed *= mudSlowMultiplier;
      }

      // Zero speed when fully stunned or any menu layout is active
      const isAnyModalActive = 
        state.isPizzeriaOpen || 
        state.isDealerOpen || 
        state.isCasinoOpen || 
        state.isUpgradesOpen ||
        state.isBuyPizzeriaOpen ||
        state.isOwnPizzeriaOpen ||
        state.isBuyRivalOpen ||
        state.isRivalDecisionOpen ||
        state.isCustomizationOpen ||
        state.isCheatOpen;

      if (state.stunTime > 0 || isAnyModalActive) {
        moveSpeed = 0;
      }

      // Apply coordinates change
      if ((dx !== 0 || dy !== 0) && state.stunTime <= 0) {
        // Target angle
        const targetAngle = Math.atan2(dy, dx);
        playerAngleRef.current = targetAngle;
        setPlayerAngle(targetAngle);

        // Compute step
        let nextX = playerXRef.current + dx * moveSpeed * dt;
        let nextY = playerYRef.current + dy * moveSpeed * dt;

        // Constraint within island map boundary (Ground vehicles cannot enter ocean waters!)
        if (state.currentVehicleId !== 'helicoptero') {
          nextX = Math.max(-LIMIT, Math.min(LIMIT, nextX));
          nextY = Math.max(-LIMIT, Math.min(LIMIT, nextY));
        } else {
          // Helicopter can hover slightly broader but still stay on map bounding box
          nextX = Math.max(-LIMIT - 10, Math.min(LIMIT + 10, nextX));
          nextY = Math.max(-LIMIT - 10, Math.min(LIMIT + 10, nextY));
        }

        // 4. COLLISION CHECKS WITH BUILDINGS & SOLID OBJECTS (Helicopter ignores ground collisions!)
        if (state.currentVehicleId !== 'helicoptero') {
          // A. Central Shops
          // Pizzeria (0, 0) radius 24
          const dPiz = Math.sqrt(nextX**2 + nextY**2);
          if (dPiz < 25) {
            const curDist = Math.sqrt(playerXRef.current**2 + playerYRef.current**2);
            if (dPiz < curDist) {
              nextX = playerXRef.current;
              nextY = playerYRef.current;
            }
          }
          // Own Pizzeria base (0, 245) radius 24
          const dOwnPiz = Math.sqrt(nextX**2 + (nextY - 245)**2);
          if (dOwnPiz < 25) {
            const curDist = Math.sqrt(playerXRef.current**2 + (playerYRef.current - 245)**2);
            if (dOwnPiz < curDist) {
              nextX = playerXRef.current;
              nextY = playerYRef.current;
            }
          }
          // Concesionario (-245, 0) radius 22
          const dDeal = Math.sqrt((nextX - (-245))**2 + nextY**2);
          if (dDeal < 23) {
            const curDist = Math.sqrt((playerXRef.current - (-245))**2 + playerYRef.current**2);
            if (dDeal < curDist) {
              nextX = playerXRef.current;
              nextY = playerYRef.current;
            }
          }
          // Casino (245, 0) radius 22
          const dCas = Math.sqrt((nextX - 245)**2 + nextY**2);
          if (dCas < 23) {
            const curDist = Math.sqrt((playerXRef.current - 245)**2 + playerYRef.current**2);
            if (dCas < curDist) {
              nextX = playerXRef.current;
              nextY = playerYRef.current;
            }
          }

          // B. Houses (20 houses) radius 14
          state.houses.forEach((h: House) => {
            const hDist = Math.sqrt((nextX - h.x)**2 + (nextY - h.y)**2);
            if (hDist < 15) {
              const curDist = Math.sqrt((playerXRef.current - h.x)**2 + (playerYRef.current - h.y)**2);
              if (hDist < curDist) {
                nextX = playerXRef.current;
                nextY = playerYRef.current;
              }
            }
          });

          // C. Obstacle Solid Trees trunk radius 8
          state.obstacles.forEach((obs: Obstacle) => {
            if (obs.type === 'tree') {
              const tDist = Math.sqrt((nextX - obs.x)**2 + (nextY - obs.y)**2);
              if (tDist < 9.5) {
                const curDist = Math.sqrt((playerXRef.current - obs.x)**2 + (playerYRef.current - obs.y)**2);
                if (tDist < curDist) {
                  nextX = playerXRef.current;
                  nextY = playerYRef.current;
                }
              }
            }
          });
        }

        // Apply updated coordinates
        playerXRef.current = nextX;
        playerYRef.current = nextY;
        setPlayerX(nextX);
        setPlayerY(nextY);

        // Sound cues for motorbike scooters engines!
        audio.playEngine(moveSpeed / 320);
      }

      // 5. ALTITUDE (Z HEIGHT) LERP
      const targetZ = state.currentVehicleId === 'helicoptero' ? 30 : 0;
      setPlayerZ(prev => prev + (targetZ - prev) * 0.12);

      // 6. ANIMATE / MOVE TRAFFIC CARS & REGISTER COLLISION EVENTS
      if (state.obstacles.length > 0) {
        setObstacles(prevObs => {
          return prevObs.map(obs => {
            if (obs.type === 'car' && obs.vx !== undefined && obs.vy !== undefined) {
              let nx = obs.x + obs.vx * dt;
              let ny = obs.y + obs.vy * dt;

              // Bounce cars when hitting boundaries of streets loop
              if (nx < -445 || nx > 445 || ny < -445 || ny > 445) {
                return {
                  ...obs,
                  vx: -obs.vx,
                  vy: -obs.vy,
                  angle: (obs.angle || 0) + Math.PI,
                };
              }

              // Evaluate physical collision with player
              if (state.currentVehicleId !== 'helicoptero' && state.stunTime <= 0) {
                const distToPlayer = Math.sqrt((playerXRef.current - nx)**2 + (playerYRef.current - ny)**2);
                if (distToPlayer < 14) {
                  // Trigger crash stun!
                  audio.playCrash();
                  const stunDuration = Math.max(1.0, 2.5 - (state.upgrades.fuerza * 0.15));
                  setStunTime(stunDuration);
                  // Turn car around
                  return {
                    ...obs,
                    x: nx - obs.vx * dt * 2,
                    y: ny - obs.vy * dt * 2,
                    vx: -obs.vx,
                    vy: -obs.vy,
                    angle: (obs.angle || 0) + Math.PI,
                  };
                }
              }

              return { ...obs, x: nx, y: ny };
            }
            return obs;
          });
        });
      }

      // 7. MUD OVERLAY EVALUATION
      if (state.currentVehicleId !== 'helicoptero' && state.slowTime <= 0) {
        state.obstacles.forEach((obs: Obstacle) => {
          if (obs.type === 'mud') {
            const distMud = Math.sqrt((playerXRef.current - obs.x)**2 + (playerYRef.current - obs.y)**2);
            if (distMud < obs.size) {
              // Mud slowdown initiated!
              audio.playSlow();
              const slowDuration = Math.max(1.0, 3.0 - (state.upgrades.fuerza * 0.2));
              setSlowTime(slowDuration);
            }
          }
        });
      }

      // 8. CHASING VAGABONDS MOTION INTERLOCKS
      if (state.vagabonds.length > 0 && state.activeOrders.length > 0) {
        setVagabonds(prevVags => {
          return prevVags.map(vag => {
            // Chase Player
            const vDx = playerXRef.current - vag.x;
            const vDy = playerYRef.current - vag.y;
            const d = Math.sqrt(vDx * vDx + vDy * vDy);

            if (d < 12) {
              // ROB EFFECT INSTANT!
              audio.playRobbed();
              const stolenAmount = Math.round(state.money * 0.5);
              setMoney(prev => Math.max(0, prev - stolenAmount));

              // Alert warning
              alertBanner(`💸 ¡TE ROBÓ EL VAGABUNDO! Perdiste $${stolenAmount}`);

              // Teleport vagabond back to a far random spot to prevent locking player
              const coin = Math.random() < 0.5 ? -380 : 380;
              return {
                ...vag,
                x: coin,
                y: Math.random() * 800 - 400,
              };
            }

            // Normal chase vector direction
            const vagSpeed = state.currentVehicle.speed * 0.5;
            const stepX = vag.x + (vDx / (d || 1)) * vagSpeed * dt;
            const stepY = vag.y + (vDy / (d || 1)) * vagSpeed * dt;

            return {
              ...vag,
              x: stepX,
              y: stepY,
            };
          });
        });
      }

      // 9. COLD DELIVERY DROP OFF CHECK
      if (state.activeOrders.length > 0) {
        const primaryDelivery = state.activeOrders[0];
        const destHouse = state.houses.find((h: House) => h.id === primaryDelivery.houseId);
        
        if (destHouse) {
          const dropDist = Math.sqrt((playerXRef.current - destHouse.x)**2 + (playerYRef.current - destHouse.y)**2);
          if (dropDist < 25) {
            // SUCCESSFUL PIZZA DROP OFF !
            audio.playSuccess();
            
            // Calculate final reward with Ganancia Level percentage bonus payout (12% per level)
            const bonusPercent = state.upgrades.ganancia * 0.12;
            let finalPayout = Math.round(primaryDelivery.reward * (1 + bonusPercent));
            const isTruck = state.currentVehicleId === 'camion';
            if (isTruck) {
              finalPayout *= 2;
            }

            // Apply 50% penalty if own pizzeria Nivel 0
            const isDilapidated = hasOwnPizzeria && renovationLevel === 0;
            if (isDilapidated) {
              finalPayout = Math.round(finalPayout * 0.5);
            }
            
            setMoney(prev => prev + finalPayout);
            setCompletedOrdersCount(prev => prev + 1);

            // Trigger customer alert messages
            if (isDilapidated) {
              alertBanner(`🍕 ¡ENTREGA COMPLETADA! Casa ${destHouse.number}. Cobraste $${finalPayout} (Deteriorada: -50% castigo 🏚️)`);
            } else if (isTruck) {
              alertBanner(`🍕 ¡ENTREGA COMPLETADA! Casa ${destHouse.number}. Cobraste $${finalPayout} (¡DUPLICADO x2 por Camión! 🚚)`);
            } else {
              alertBanner(`🍕 ¡ENTREGA COMPLETADA! Casa ${destHouse.number}. Cobraste $${finalPayout} (Bono: +${state.upgrades.ganancia * 12}%)`);
            }

            // Support market share growth
            if (state.hasOwnPizzeria && !state.isRivalDefeated) {
              const gain = state.renovationLevel >= 2 ? 1.0 : 0.2;
              setPlayerMarketShare(prev => {
                let nextShare = prev + gain;
                nextShare = Math.round(nextShare * 10) / 10;
                const finalShare = Math.min(100, nextShare);
                if (finalShare >= 99.8) {
                  setIsRivalDefeated(true);
                  alertBanner("🏆 ¡COMPETIDOR VENCIDO! 100% de Competencia logrado. Compra la pizzería rival en el centro ($100.000).");
                  audio.playCasinoWin();
                  return 100;
                } else {
                  // Alert the user about their market share gain too
                  setTimeout(() => {
                    alertBanner(`📈 Cuota de mercado alcanzada: ${finalShare.toFixed(state.renovationLevel >= 2 ? 0 : 1)}% (+${gain}%)`);
                  }, 2000);
                }
                return finalShare;
              });
            }

            // Shift Pizza Queue list
            setActiveOrders(prev => {
              const queue = [...prev];
              queue.shift(); // remove completed
              
              // If Queue is completely empty now, clear all dynamic threats
              if (queue.length === 0) {
                setObstacles([]);
                setVagabonds([]);
              }
              return queue;
            });
          }
        }
      }

      animId = requestAnimationFrame(updateGamePhysics);
    };

    animId = requestAnimationFrame(updateGamePhysics);
    return () => cancelAnimationFrame(animId);
  }, [gameState]);


  // SECOND-INTERVAL TIMER FOR THE LEASE COUNTDOWNS AND ACTIVE ORDER CLOCKS
  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = setTimeout(() => {
      // 1. Day Clock tick
      if (dayTimeLeft <= 1) {
        // Increment Day (Day transitions from `day` to `day + 1`)
        // Rent Due checks: Only if they DO NOT own their pizzeria!
        const rentDue = (!hasOwnPizzeria && day % 3 === 0) ? Math.floor(day / 3) * 500 : 0;

        if (rentDue > 0) {
          if (money < rentDue) {
            // Game Over! Insolvency lease debt!
            audio.playFail();
            setGameState('gameover');
            return;
          } else {
            // Deduct rent safely
            setMoney(cash => cash - rentDue);
            audio.playRentPay();
            setRentPaymentNotice({ amount: rentDue, nextDay: day + 3 });
            alertBanner(`🏢 PAGASTE LA RENTA: -$${rentDue}. Siguiente pago en 3 días.`);
          }
        }

        // Apply new day state updates cleanly
        setDay(d => d + 1);
        setDayTimeLeft(60);

        // Tycoon rival growth: Increases every day / minute of holding!
        if (hasOwnPizzeria && !isRivalDefeated && !hasGlobalized) {
          const nextDaysHeld = businessDaysHeld + 1;
          setBusinessDaysHeld(nextDaysHeld);

          const shareLoss = rivalPassiveRate;
          setPlayerMarketShare(prev => {
            const nextShare = Math.max(0, prev - shareLoss);
            if (nextShare <= 0) {
              // Game Over! Market share hit 0% (rival reaches 100%)
              audio.playFail();
              setGameState('gameover');
              return 0;
            }

            // Warnings
            const rivalShareGauge = 100 - nextShare;
            if (rivalShareGauge >= 99) {
              alertBanner("🚨 ¡La pizzería rival está a punto de monopolizar la isla! (99% Competencia)");
              audio.playAlert();
            } else if (rivalShareGauge >= 95) {
              alertBanner("⚠️ ¡Última oportunidad! Estás a punto de perder todo el mercado. (95% Competencia)");
              audio.playAlert();
            } else if (rivalShareGauge >= 90) {
              alertBanner("❗ ¡Alerta competitiva! La competencia domina la isla. (90% Competencia)");
              audio.playAlert();
            }

            setRivalPulse(true);
            setTimeout(() => setRivalPulse(false), 800);

            return nextShare;
          });

          // Rival permanent growth bonus increase: Every 3 days (+2% additional growth rate)
          if (nextDaysHeld > 0 && nextDaysHeld % 3 === 0) {
            const addedGrowth = 2;
            const updatedRate = rivalPassiveRate + addedGrowth;
            setRivalPassiveRate(updatedRate);

            setTimeout(() => {
              setPlayerMarketShare(currentShare => {
                const totalRivalShare = 100 - currentShare;
                alertBanner(`😈 ¡COMPETIDOR FORTALECIDO! El rival obtiene +${addedGrowth}% de crecimiento permanente. Crece +${updatedRate}% por minuto (Rival total: ${totalRivalShare}%).`);
                audio.playAlert();
                return currentShare;
              });
            }, 100);
          }
        }

        // Rent warning calculation: Day 2, 5, 8...
        const nextDay = day + 1;
        if (!hasOwnPizzeria && nextDay % 3 === 2) {
          setRentWarning(true);
          audio.playAlert();
          setTimeout(() => {
            setRentWarning(false);
          }, 2000);
        }
      } else {
        setDayTimeLeft(prev => prev - 1);
      }

      // 2. Active Deliveries clocks tick
      if (activeOrders.length > 0) {
        let orderExpired = false;
        let expiredHouseId = -1;

        setActiveOrders(prev => {
          if (prev.length === 0) return prev;
          if (prev[0].timeLeft <= 1) {
            orderExpired = true;
            expiredHouseId = prev[0].houseId;
            return prev.slice(1); // remove expired order immediately
          } else {
            return prev.map((ord, idx) => {
              if (idx === 0) {
                return { ...ord, timeLeft: ord.timeLeft - 1 };
              }
              return ord;
            });
          }
        });

        if (orderExpired) {
          audio.playFail();
          setFailures(f => {
            const nextFailures = f + 1;
            if (nextFailures >= 3) {
              setGameState('gameover');
            }
            return nextFailures;
          });

          const targetHouse = houses.find(h => h.id === expiredHouseId);
          alertBanner(`⏰ ¡SE ACABÓ EL TIEMPO! Fallaste la entrega en Casa ${targetHouse?.number || ''}`);

          // Clear out any dynamic map clutter since the active run is ended
          setObstacles([]);
          setVagabonds([]);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [gameState, day, dayTimeLeft, activeOrders, money, houses]);


  // Tycoon Passive Income and Competition Progression (1-second tick-rate engine)
  useEffect(() => {
    if (gameState !== 'playing' || !hasOwnPizzeria) return;

    const interval = setInterval(() => {
      setPassiveTimer(prev => {
        const nextSec = prev + 1;
        
        // 1. Regular 30s check for Level 3 (Negocio Operativo) & Employee levels 1 to 4
        if (nextSec % 30 === 0) {
          // Level 3 renovation bonuses
          if (renovationLevel >= 3) {
            // Level 3: Every 30s: +2% competition, +$200 income
            setMoney(m => m + 200);
            
            if (!isRivalDefeated) {
              setPlayerMarketShare(pts => {
                const nextShare = Math.min(100, pts + 2);
                if (nextShare >= 99.8) {
                  setIsRivalDefeated(true);
                  alertBanner("🏆 ¡COMPETIDOR VENCIDO! 100% de Competencia logrado. Compra la pizzería rival ($100.000).");
                  audio.playCasinoWin();
                  return 100;
                }
                return nextShare;
              });
            }
            alertBanner("🏢 INCOME PASIVO: +$200 y +2% de cuota por Negocio Operativo.");
            // Silent and discrete notification (no playRentPay audio played!)
          }

          // Employees level 1 to 4 (Novato up to Experto)
          if (employeeLevel > 0 && employeeLevel <= 4) {
            let moneyBonus = 0;
            let shareBonus = 0;
            let empName = "";

            if (employeeLevel === 1) {
              moneyBonus = 300;
              shareBonus = 3;
              empName = "Novato";
            } else if (employeeLevel === 2) {
              moneyBonus = 400;
              shareBonus = 4;
              empName = "Experimentado";
            } else if (employeeLevel === 3) {
              moneyBonus = 500;
              shareBonus = 5;
              empName = "Profesional";
            } else if (employeeLevel === 4) {
              moneyBonus = 1000;
              shareBonus = 5;
              empName = "Experto";
            }

            if (moneyBonus > 0) {
              setMoney(m => m + moneyBonus);
              if (!isRivalDefeated) {
                setPlayerMarketShare(pts => {
                  const nextShare = Math.min(100, pts + shareBonus);
                  if (nextShare >= 99.8) {
                    setIsRivalDefeated(true);
                    alertBanner("🏆 ¡COMPETIDOR VENCIDO! 100% de Competencia logrado. Compra la pizzería rival ($100.000).");
                    audio.playCasinoWin();
                    return 100;
                  }
                  return nextShare;
                });
              }
              // Display a combined notification so the player feels the progression!
              setTimeout(() => {
                alertBanner(`🛵 EMPLEADO [${empName}]: Generó +$${moneyBonus} y +${shareBonus}% de cuota de mercado.`);
              }, 1200);
            }
          }
        }

        // 2. Specialized 15s check for Nivel 5 (Experto+)
        if (nextSec % 15 === 0) {
          if (employeeLevel === 5) {
            const moneyBonus = 1000;
            const shareBonus = 5;

            setMoney(m => m + moneyBonus);
            if (!isRivalDefeated) {
              setPlayerMarketShare(pts => {
                const nextShare = Math.min(100, pts + shareBonus);
                if (nextShare >= 99.8) {
                  setIsRivalDefeated(true);
                  alertBanner("🏆 ¡COMPETIDOR VENCIDO! 100% de Competencia logrado. Compra la pizzería rival ($100.000).");
                  audio.playCasinoWin();
                  return 100;
                }
                return nextShare;
              });
            }
            alertBanner(`🛸 EMPLEADO [Experto+]: Generó +$${moneyBonus} y +${shareBonus}% (Frecuencia: ¡Cada 15s! ⚡)`);
          }
        }

        return nextSec;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, hasOwnPizzeria, renovationLevel, employeeLevel, isRivalDefeated]);


  // Synchronous visual employees simulation movement loop
  useEffect(() => {
    if (gameState !== 'playing' || !hasOwnPizzeria || employeeLevel === 0) {
      setEmployees([]);
      return;
    }

    const count = Math.min(5, employeeLevel);
    const emojis = ['🛵', '🚗', '🚲', '🚀', '🛸'];
    
    let initialList = Array.from({ length: count }, (_, idx) => {
      return {
        id: idx,
        x: 0,
        y: 245,
        targetX: 0 + (Math.random() * 200 - 100),
        targetY: 245 + (Math.random() * 200 - 100),
        speed: 20 + idx * 5,
        emoji: emojis[idx],
        mode: 'heading_to_delivery'
      };
    });

    setEmployees(initialList);

    const interval = setInterval(() => {
      setEmployees(prev => {
        if (prev.length === 0) return initialList;
        return prev.map(emp => {
          let dx = emp.targetX - emp.x;
          let dy = emp.targetY - emp.y;
          let d = Math.sqrt(dx * dx + dy * dy);

          if (d < 15) {
            if (emp.mode === 'heading_to_delivery') {
              return {
                ...emp,
                targetX: 0,
                targetY: 245,
                mode: 'returning_to_base'
              };
            } else {
              const targetH = houses[Math.floor(Math.random() * houses.length)];
              return {
                ...emp,
                targetX: targetH.x,
                targetY: targetH.y,
                mode: 'heading_to_delivery'
              };
            }
          } else {
            const step = (emp.speed * 0.15); // scaled step
            const moveX = (dx / d) * step;
            const moveY = (dy / d) * step;
            return {
              ...emp,
              x: emp.x + moveX,
              y: emp.y + moveY
            };
          }
        });
      });
    }, 150);

    return () => clearInterval(interval);
  }, [gameState, hasOwnPizzeria, employeeLevel, houses]);

  // Synchronous visual original/rival pizzería decorative red deliverers movement loop (0, 0)
  useEffect(() => {
    if (gameState !== 'playing' || !hasOwnPizzeria) {
      setRivalDeliverers([]);
      return;
    }

    const count = 4;
    let initialList = Array.from({ length: count }, (_, idx) => {
      const targetH = houses[Math.floor(Math.random() * houses.length)];
      return {
        id: idx,
        x: 0,
        y: 0,
        targetX: targetH.x,
        targetY: targetH.y,
        speed: 20 + idx * 5,
        mode: 'heading_to_delivery'
      };
    });

    setRivalDeliverers(initialList);

    const interval = setInterval(() => {
      setRivalDeliverers(prev => {
        if (prev.length === 0) return initialList;
        return prev.map(dev => {
          let dx = dev.targetX - dev.x;
          let dy = dev.targetY - dev.y;
          let d = Math.sqrt(dx * dx + dy * dy);

          if (d < 15) {
            if (dev.mode === 'heading_to_delivery') {
              return {
                ...dev,
                targetX: 0,
                targetY: 0,
                mode: 'returning_to_base'
              };
            } else {
              const targetH = houses[Math.floor(Math.random() * houses.length)];
              return {
                ...dev,
                targetX: targetH.x,
                targetY: targetH.y,
                mode: 'heading_to_delivery'
              };
            }
          } else {
            const step = (dev.speed * 0.15); // scaled step
            const moveX = (dx / d) * step;
            const moveY = (dy / d) * step;
            return {
              ...dev,
              x: dev.x + moveX,
              y: dev.y + moveY
            };
          }
        });
      });
    }, 150);

    return () => clearInterval(interval);
  }, [gameState, hasOwnPizzeria, houses]);


  // Helper alert notifications message
  const [activeBanner, setActiveBanner] = useState<string | null>(null);
  const alertBanner = (msg: string) => {
    setActiveBanner(msg);
    setTimeout(() => {
      setActiveBanner(prev => prev === msg ? null : prev);
    }, 3800);
  };


  // HELPER TO SAFELY CLOSE ALL MODALS AND RESTORE KEYBOARD FOCUS
  const closeAllModals = () => {
    setIsPizzeriaOpen(false);
    setIsDealerOpen(false);
    setIsCasinoOpen(false);
    setIsUpgradesOpen(false);
    setIsBuyPizzeriaOpen(false);
    setIsOwnPizzeriaOpen(false);
    setIsBuyRivalOpen(false);
    setIsRivalDecisionOpen(false);
    setIsCheatOpen(false);

    // Reset pressed keys ref and state to avoid sticky keys
    keysPressedRef.current = {};
    setKeysPressed({});

    // Restore focus to window so WASD keys work instantly
    if (typeof window !== 'undefined') {
      window.focus();
      if (typeof document !== 'undefined' && document.activeElement) {
        (document.activeElement as HTMLElement).blur();
      }
    }
  };


  // PIZZERIA ORDER ACCEPTED HANDLER
  const handleAcceptOrder = (order: Order) => {
    // Add to player active pizza queue
    const limitMax = 1;

    if (activeOrders.length >= limitMax) {
      alert('¡Capacidad de transporte llena!');
      return;
    }

    const nextQueue = [...activeOrders, { ...order, timeLeft: order.timeLimit }];
    setActiveOrders(nextQueue);

    // Remove the selected order from available list
    setAvailableOrders(prev => prev.filter(o => o.id !== order.id));

    // Dynamic spawn threats strictly when delivery starts:
    // "Los obstáculos aparecen únicamente cuando existe un pedido activo. Al entregar o fallar el pedido desaparecen."
    if (nextQueue.length === 1) {
      // First order starting, initialize randomized dynamic roadblocks
      const newObs = generateDynamicObstacles(houses, currentVehicleId, completedOrdersCount);
      setObstacles(newObs);

      // Vagabonds trigger criteria check:
      // "A partir del cuarto pedido comienzan a aparecer vagabundos (completedOrdersCount >= 3)"
      if (completedOrdersCount >= 3) {
        const vagList: Vagabond[] = [];
        // Spawn quantity increases dynamically with completed deliveries difficulty!
        const vagQuantity = Math.min(6, 1 + Math.floor((completedOrdersCount - 3) / 2));
        
        for (let v = 0; v < vagQuantity; v++) {
          // Far coordinates spawn so players can adapt steering
          const farX = Math.random() < 0.5 ? -370 : 370;
          const farY = Math.random() < 0.5 ? -370 : 370;
          vagList.push({
            id: `vag-${v}-${Date.now()}`,
            x: farX,
            y: farY,
            speed: currentVehicle.speed * 0.5, // 50% player base speed
          });
        }
        setVagabonds(vagList);
        audio.playAlert();
        alertBanner(`⚠️ ¡CUIDADO! Se avistaron ${vagQuantity} ladrones hambrientos persiguiendo tu carga.`);
      }
    }

    // Close screen and restore focus
    closeAllModals();
  };


  // VEHICLE PURCHASE INTERLOCKS
  const handleBuyVehicle = (vehicleId: VehicleId, price: number) => {
    if (money < price) {
      alert('¡Dinero insuficiente!');
      return;
    }

    setMoney(prev => prev - price);
    setCurrentVehicleId(vehicleId);
    audio.playUpgrade();
    alertBanner(`🛵 ¡HAZ ADQUIRIDO UN NUEVO VEHÍCULO: ${VEHICLES_LIST.find(v => v.id === vehicleId)?.name}!`);

    // Regenerate pizzeria orders to match the speed of the newly bought ride!
    const targetSpeed = VEHICLES_LIST.find(v => v.id === vehicleId)?.speed || 40;
    generatePizzeriaOrders(targetSpeed);

    // Close screen and restore focus
    closeAllModals();
  };

  // BUY UPGRADE STATS HANDLER
  const handleBuyUpgrade = (stat: keyof Upgrades, cost: number) => {
    if (money < cost) {
      alert('¡Efectivo insuficiente!');
      return;
    }

    setMoney(prev => prev - cost);
    setUpgrades(prev => ({
      ...prev,
      [stat]: Math.min(10, prev[stat] + 1)
    }));
    audio.playUpgrade();
  };

  // TYCOON RENOVATION BUY HANDLER
  const handleUpgradeRenovation = (nextLvl: number, cost: number) => {
    if (money < cost) return;
    setMoney(prev => prev - cost);
    setRenovationLevel(nextLvl);
    audio.playUpgrade();
    alertBanner(`🛠️ ¡INFRAESTRUCTURA MEJORADA! Has invertido $${cost}. Pizzería alcanzó Nivel ${nextLvl}.`);
  };

  // TYCOON EMPLOYEE RECRUIT HANDLER
  const handleUpgradeEmployee = (nextLvl: number, cost: number) => {
    if (money < cost) return;
    setMoney(prev => prev - cost);
    setEmployeeLevel(nextLvl);
    audio.playUpgrade();
    const ranks = ["Ninguno", "Novato", "Experimentado", "Profesional", "Experto", "Experto+"];
    alertBanner(`🛵 ¡RECLUTAMIENTO EFECTIVO! Rango alcanzado: ${ranks[nextLvl]} (Inversión: $${cost}).`);
  };

  // CASINO REWARDS INJECTIONS
  const handleCasinoAddMoney = (amount: number) => {
    setMoney(prev => Math.max(0, prev + amount));
  };

  // VICTORY ESCAPE EVALUATION
  const handleTriggerEscapeVictory = () => {
    // Requisites check: Helicopter and > $10000
    if (currentVehicleId !== 'helicoptero') return;

    if (money >= 10000) {
      // SUCCESS! Fly away escape sequence
      setGameState('victory');
      audio.playCasinoWin();
    } else {
      // Warn player
      alertBanner('🚁 ¡NECESITAS AL MENOS $10,000 en mano para poder comprar combustible y escapar!');
    }
    setIsEscapeAsking(false);
  };


  // GAME RESTART HANDLER
  const handleResetGame = () => {
    setGameState('playing');
    setMoney(70); // start off-balance
    setCurrentVehicleId('pie');
    setUpgrades({ ganancia: 0, suerte: 0, fuerza: 0 });
    setFailures(0);
    setCompletedOrdersCount(0);
    setPlayerX(0);
    setPlayerY(50);
    playerXRef.current = 0;
    playerYRef.current = 50;
    setPlayerZ(0);
    setPlayerAngle(Math.PI / 2);
    playerAngleRef.current = Math.PI / 2;
    keysPressedRef.current = {};
    setKeysPressed({});
    setObstacles([]);
    setVagabonds([]);
    setDay(1);
    setDayTimeLeft(60);
    setActiveOrders([]);
    setRentWarning(false);
    setIsEscapeAsking(false);
    setStunTime(0);
    setSlowTime(0);

    // Business tycoon expansions resets
    setHasOwnPizzeria(false);
    setRenovationLevel(0);
    setPlayerMarketShare(20);
    setBusinessDaysHeld(0);
    setRivalPassiveRate(2);
    setEmployeeLevel(0);
    setIsRivalDefeated(false);
    setHasGlobalized(false);
    setPassiveTimer(0);
    setEmployees([]);
    setIsBuyPizzeriaOpen(false);
    setIsOwnPizzeriaOpen(false);
    setIsBuyRivalOpen(false);
    setIsRivalDecisionOpen(false);
    setIsCheatOpen(false);

    generatePizzeriaOrders(VEHICLES_LIST[0].speed);
  };

  // Rent details
  const nextRentDay = Math.ceil(day / 3) * 3;
  const nextRentAmount = Math.floor(nextRentDay / 3) * 500;
  const daysUntilNextRent = nextRentDay - day;

  return (
    <div id="pedilo-ya-root-app" className={`w-full ${gameState === 'playing' ? 'h-screen overflow-hidden' : 'min-h-screen overflow-y-auto'} bg-sky-200 flex flex-col justify-between relative select-none selection:bg-amber-100 font-sans`}>
      
      {/* 1. TOP NAVBAR / HUD */}
      <header className="bg-white/95 backdrop-blur-md border-b-4 border-yellow-400 p-4 shrink-0 flex items-center justify-between shadow-md z-25">
        <div className="flex items-center gap-2.5">
          <div className="bg-red-500 text-white p-2.5 rounded-2xl animate-bounce shadow-md border border-red-400">
            <span className="text-2.5xl leading-none">🍕</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-red-500 tracking-tight font-serif">Pedilo Ya</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Isla Delivery Arcade</p>
          </div>
        </div>

        {/* Dynamic HUD components visible during play */}
        {gameState === 'playing' && (
          <div className="hidden md:flex items-center gap-4">
            
            {/* Money Box */}
            <div className="bg-green-50 border-2 border-emerald-400 p-1.5 px-4 rounded-2xl flex items-center gap-2 shadow-sm text-emerald-950 font-bold">
              <span className="bg-emerald-500 text-white rounded-full p-1 leading-none text-xs shrink-0 font-bold">$</span>
              <div>
                <p className="text-[9px] uppercase text-emerald-600 font-extrabold tracking-wider leading-none">Efectivo</p>
                <p className="font-mono text-base font-black leading-none mt-0.5 text-emerald-600">${money}</p>
              </div>
            </div>

            {/* Vehicle Box */}
            <div className="bg-white border-2 border-sky-400 p-1.5 px-4 rounded-2xl flex items-center gap-2 shadow-sm text-sky-950 font-bold">
              <span className="text-xl">{currentVehicle.emoji}</span>
              <div>
                <p className="text-[9px] uppercase text-sky-500 font-extrabold tracking-wider leading-none">Vehículo</p>
                <p className="text-xs font-black leading-none mt-0.5 truncate max-w-[120px] text-sky-600">{currentVehicle.name}</p>
              </div>
            </div>

            {/* Days Box */}
            <div className="bg-orange-50 border-2 border-orange-400 p-1.5 px-4 rounded-2xl flex items-center gap-2 shadow-sm text-yellow-950 font-bold" title={hasOwnPizzeria ? '¡Eres dueño de la pizzería!' : `Próximo pago de renta: $${nextRentAmount}`}>
              <Calendar className="w-5 h-5 text-orange-550 font-bold" />
              <div>
                <p className="text-[9px] uppercase text-orange-600 font-extrabold tracking-wider leading-none">Día {day}</p>
                <p className="font-mono text-xs font-black leading-none mt-0.5 text-orange-500">
                  {hasOwnPizzeria ? (
                    <span className="text-emerald-600 font-sans font-bold">🏢 Negocio Propio (Renta $0)</span>
                  ) : daysUntilNextRent === 0 ? (
                    <span className="text-red-600 animate-pulse">¡HOY Renta: ${nextRentAmount} (en {60 - dayTimeLeft}s)!</span>
                  ) : (
                    <span>Renta: ${nextRentAmount} en {daysUntilNextRent}d ({60 - dayTimeLeft}s)</span>
                  )}
                </p>
              </div>
            </div>

            {/* Fails Box */}
            <div className={`p-1.5 px-4 rounded-2xl flex items-center gap-2 shadow-sm border-2 font-bold ${
              failures >= 2 ? 'bg-red-100 border-red-400 text-red-950' : 'bg-pink-50 border-pink-300 text-pink-950'
            }`}>
              <ShieldAlert className="w-5 h-5 text-pink-500" />
              <div>
                <p className="text-[9px] uppercase text-pink-600 font-extrabold tracking-wider leading-none">Fallos</p>
                <p className="font-mono text-xs font-black leading-none mt-0.5 text-pink-700">📦 {failures} / 3</p>
              </div>
            </div>

          </div>
        )}

        {/* Right operations (Mute + Upgrades open button) */}
        <div className="flex items-center gap-2">
          {/* Audio toggle button */}
          <button
            onClick={handleToggleMute}
            className="p-2.5 rounded-xl border-2 border-gray-150 hover:bg-gray-100 transition text-gray-500 cursor-pointer"
            title={muted ? "Activar audio" : "Silenciar"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {gameState === 'playing' && (
            <button
              id="permanent-upgrades-hud-btn"
              onClick={() => setIsUpgradesOpen(true)}
              className="bg-pink-500 hover:bg-pink-600 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-[0_4px_0_rgb(190,24,93)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_rgb(190,24,93)] transition-all flex items-center gap-1.5 border-2 border-pink-600 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 fill-pink-200" />
              Upgrade Habilidad
            </button>
          )}
        </div>
      </header>

      {/* MOBILE DISPLAY STATS */}
      {gameState === 'playing' && (
        <section className="bg-white border-b-2 border-yellow-400 p-2 text-[10px] flex justify-around items-center md:hidden font-sans font-bold text-gray-700">
          <span>💵 <strong className="text-emerald-600 font-black">${money}</strong></span>
          <span>{currentVehicle.emoji} {currentVehicle.name}</span>
          <span>📅 Día {day} ({hasOwnPizzeria ? '🏢 Imperio' : (daysUntilNextRent === 0 ? `HOY Renta: $${nextRentAmount}` : `Renta: $${nextRentAmount} en ${daysUntilNextRent}d`)})</span>
          <span className="text-pink-650">⚠️ Fallos: {failures}/3</span>
        </section>
      )}

      {/* 2. DYNAMIC GAME AREA PANEL */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 flex flex-col justify-center relative overflow-hidden">
        
        {/* COMPARTIDA DE COMPETENCIA BAR */}
        {hasOwnPizzeria && (
          <div className={`mb-3 w-full bg-slate-900/95 border-2 border-amber-500/80 p-3 rounded-2xl flex flex-col gap-1.5 shadow-xl select-none z-10 transition-all duration-300 relative ${rivalPulse ? 'scale-[1.01] border-red-500' : ''}`}>
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 font-sans font-black uppercase" style={{ color: pizzeriaColor }}>
                <span className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-black/20" style={{ backgroundColor: pizzeriaColor }} />
                <span>{pizzeriaName.toUpperCase()}: <strong>{playerMarketShare.toFixed(playerMarketShare % 1 === 0 ? 0 : 1)}%</strong></span>
              </div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                {isRivalDefeated ? '👑 ¡MERCADO CONQUISTADO! (RIVAL ELIMINADO)' : `COMPETENCIA (PASIVA RIVAL: +${rivalPassiveRate}%/MIN)`}
              </span>
              <div className="flex items-center gap-1.5 font-sans font-black uppercase text-red-550">
                <span className="w-3 h-3 bg-red-600 rounded-full shrink-0 shadow-sm border border-black/20" />
                <span>RIVAL: <strong>{(100 - playerMarketShare).toFixed((100 - playerMarketShare) % 1 === 0 ? 0 : 1)}%</strong></span>
              </div>
            </div>
            
            {/* 100% split visual progress bar */}
            <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden flex shadow-inner border border-slate-800">
              <div 
                className="h-full transition-all duration-350 ease-out shrink-0"
                style={{ width: `${playerMarketShare}%`, backgroundColor: pizzeriaColor }}
              />
              <div 
                className="bg-red-600 h-full transition-all duration-350 ease-out shrink-0"
                style={{ width: `${100 - playerMarketShare}%` }}
              />
            </div>
          </div>
        )}
        
        {/* FLASHING NOTIFICATION BANNER */}
        {activeBanner && (
          <div className="absolute top-6 inset-x-4 flex justify-center z-45 animate-fade-in pointer-events-none">
            <span className="bg-slate-900/95 text-white border-2 border-yellow-400 font-sans p-3 px-6 rounded-2xl shadow-2xl text-xs font-bold pointer-events-auto">
              {activeBanner}
            </span>
          </div>
        )}

        {/* 1 DAY RENT WARNING POPUP */}
        {rentWarning && (
          <div className="absolute inset-0 bg-rose-600/30 backdrop-blur-xs flex items-center justify-center z-45">
            <div className="bg-rose-500 text-white border-4 border-yellow-400 p-6 rounded-[32px] text-center space-y-2 max-w-xs animate-bounce shadow-2xl">
              <AlertTriangle className="w-12 h-12 text-yellow-300 mx-auto animate-pulse" />
              <h3 className="text-2xl font-black font-serif uppercase">¡MAÑANA PAGAS RENTA!</h3>
              <p className="text-xs font-semibold">Necesitas pagar al menos <strong>${nextRentAmount}</strong> en {dayTimeLeft}s.</p>
            </div>
          </div>
        )}

        {/* SUCCESS RENT PAID FLOATING NOTICE */}
        {rentPaymentNotice && (
          <div className="absolute top-22 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 border-2 border-emerald-300 p-2.5 px-4 rounded-2xl flex items-center gap-3 shadow-2xl text-white z-50 animate-bounce max-w-[90%] md:max-w-md">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-100 animate-pulse" />
            <div className="text-left leading-tight">
              <p className="text-[9px] uppercase font-black tracking-widest text-emerald-100 leading-none">Renta Pagada de la Isla</p>
              <p className="text-xs font-bold mt-0.5">
                Se debitaron <span className="font-mono text-yellow-300 font-extrabold">-${rentPaymentNotice.amount}</span>. Siguiente pago: <span className="font-mono text-emerald-100 font-extrabold">Día {rentPaymentNotice.nextDay}</span>
              </p>
            </div>
          </div>
        )}

        {/* MAIN MENU VIEW */}
        {gameState === 'menu' && (
          <div className="bg-white rounded-[32px] border-4 border-yellow-400 p-8 max-w-lg mx-auto text-center space-y-6 shadow-2xl relative overflow-hidden">
            
            {/* Decorative Pizza */}
            <div className="text-6.5xl animate-bounce">🍕🛵</div>

            <div className="space-y-2">
              <h2 className="text-4xl font-extrabold tracking-tight text-red-500 leading-none font-serif">Pedilo Ya</h2>
              <p className="text-sm font-semibold text-gray-400">¿Tienes la destreza para ser el mejor repartidor de la Isla?</p>
            </div>

            <hr className="border-gray-100" />

            <div className="text-left bg-amber-50/70 border border-amber-200/60 p-4 rounded-2xl text-xs text-orange-950 space-y-2 leading-relaxed font-semibold">
              <p className="font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" /> Trabaja de repartidor de pizzas para ganar dinero.</p>
              <p className="font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" /> Compra vehículos y helicópteros en la Tienda.</p>
              <p className="font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" /> Invierte en el Casino de la isla para duplicar tu botín.</p>
              <p className="font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" /> ¡Paga tu renta cada 3 días o quédate fuera!</p>
              <p className="font-black flex items-center gap-1.5 bg-yellow-100/80 p-2 rounded-xl border border-yellow-300 text-amber-950"><CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" /> <span>🎯 <strong>OBJETIVO REAL:</strong> ¡Compra el <strong>Helicóptero privado</strong> y reúne <strong>$10,000</strong> en mano para cargar combustible y escapar victorioso!</span></p>
            </div>

            <button
              onClick={() => {
                audio.playUpgrade();
                setGameState('playing');
              }}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl shadow-[0_5px_0_rgb(153,27,27)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_rgb(153,27,27)] transition-all flex items-center justify-center gap-2 font-sans cursor-pointer text-sm uppercase tracking-wider border-2 border-red-650"
            >
              <Play className="w-5 h-5 fill-white" />
              Comenzar Carrera
            </button>
          </div>
        )}


        {/* GAME PLAYING ACTIVE AREA */}
        {gameState === 'playing' && (
          <div className="relative w-full h-full flex flex-col items-center">
            
            {/* Top orders instructions HUD */}
            <div className="w-full max-w-xl bg-white/95 border-2 border-yellow-400 rounded-2xl p-3 px-5 shadow mb-4 flex justify-between items-center text-xs font-bold text-gray-800 z-30">
              {activeOrders.length > 0 ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full animate-ping shrink-0" />
                    <span>Entregar a: <strong className="text-red-500 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">Casa {houses.find(h => h.id === activeOrders[0].houseId)?.number || ''}</strong></span>
                  </div>
                  <span className="font-mono text-orange-600 bg-orange-50 p-1 px-3 rounded-lg border border-orange-200 flex items-center gap-1 animate-pulse">
                    <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    {Math.ceil(activeOrders[0].timeLeft)}s restantes del pedido
                  </span>
                </>
              ) : (
                <div className="text-gray-500 flex items-center gap-2 w-full justify-center">
                  <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                  <span>
                    {hasOwnPizzeria 
                      ? 'Sin pedidos activos. Dirígete a tu Base Propia [0, 245] para asignar el reparto.' 
                      : 'Sin pedidos activos. Dirígete a la Pizzería central [0, 0] para tomar entregas.'}
                  </span>
                </div>
              )}
            </div>

            {/* Visual Screen instructions */}
            <div className="absolute top-1 right-2 bg-slate-900/60 p-1 px-2.5 rounded-lg text-[9px] font-mono text-slate-200 z-10 select-none">
              Movimiento: [W,S,A,D] o Flechas | [Espacio] interactuar
            </div>

            {/* Canvas 3D Area */}
            <div className="w-full flex-1 max-h-[620px] rounded-3xl relative border-4 border-white/60 shadow-lg overflow-hidden">
              <GameCanvas
                playerX={playerX}
                playerY={playerY}
                playerZ={playerZ}
                playerAngle={playerAngle}
                currentVehicleId={currentVehicleId}
                houses={houses}
                obstacles={obstacles}
                vagabonds={vagabonds}
                activeOrders={activeOrders}
                isStunned={stunTime > 0}
                isSlowed={slowTime > 0}
                keysPressed={keysPressed}
                virtualDirection={virtualDirection}
                isVictory={false}
                hasOwnPizzeria={hasOwnPizzeria}
                playerMarketShare={playerMarketShare}
                renovationLevel={renovationLevel}
                employees={employees}
                rivalDeliverers={rivalDeliverers}
                pizzeriaName={pizzeriaName}
                pizzeriaColor={pizzeriaColor}
                hasGlobalized={hasGlobalized}
                onPlayerMove={(x, y, a) => {
                  setPlayerX(x);
                  setPlayerY(y);
                  setPlayerAngle(a);
                }}
                onInteract={(zone) => {
                  // Floating triggers locator
                }}
                onEnterCorner={(index) => {
                  if (!hasOwnPizzeria && !isEscapeAsking && currentVehicleId === 'helicoptero') {
                    setIsEscapeAsking(true);
                  }
                }}
              />
            </div>
          </div>
        )}


        {/* GAME OVER VIEW */}
        {gameState === 'gameover' && (
          <div className="bg-slate-900 rounded-[32px] border-4 border-red-500 p-8 max-w-md mx-auto text-center space-y-6 text-white shadow-2xl relative overflow-hidden">
            <div className="text-5xl animate-spin">💀💀</div>
            <h2 className="text-3.5xl font-black uppercase text-red-505 tracking-tight font-serif">¡PARTIDA PERDIDA!</h2>

            <div className="p-4 rounded-2xl bg-slate-955 font-sans text-xs border border-red-500/20 text-left space-y-2 select-none font-semibold text-slate-300">
              <p>📍 Has quebrado por falta de pago de renta, o has fallado 3 pedidos de pizza de la isla.</p>
              <hr className="border-slate-800" />
              <p>🏁 Día alcanzado: <strong className="text-white font-mono">Día {day}</strong></p>
              <p>🍕 Entregas logradas: <strong className="text-green-400 font-mono">{completedOrdersCount} pizzas</strong></p>
              <p>💵 Efectivo restante: <strong className="text-yellow-400 font-mono">${money}</strong></p>
            </div>

            <button
              onClick={handleResetGame}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl transition shadow-[0_4px_0_rgb(153,27,27)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_rgb(153,27,27)] cursor-pointer text-xs"
            >
              <RotateCcw className="w-4 h-4 inline shrink-0" /> REINTENTAR PARTIDA
            </button>
          </div>
        )}


        {/* VICTORY VICTORY SCREEN */}
        {gameState === 'victory' && (
          <div className="bg-gradient-to-r from-purple-900 via-pink-900 to-amber-900 text-white rounded-[32px] border-4 border-yellow-300 p-8 max-w-lg mx-auto text-center space-y-6 shadow-2xl animate-fade-in relative">
            <div className="text-6.5xl animate-bounce">🚁🏆👑</div>
            <h2 className="text-4xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-250 font-serif uppercase">¡VUELO DE ESCAPE LOGRADO!</h2>
            <p className="text-sm font-semibold text-slate-200">¡Lograste comprar el helicóptero privado, reuniste la billetera de capital necesaria y superaste la renta de la Isla!</p>

            <div className="p-5 rounded-2xl bg-black/40 text-left font-sans text-xs space-y-2 border border-white/10 select-none">
              <h4 className="font-extrabold text-sm text-yellow-300">Resumen del Magnate Repartidor:</h4>
              <p>🚁 Vehículo Final: <strong>Helicóptero Privado</strong></p>
              <p>💵 Fortuna final en mano: <strong className="text-green-300 font-mono">${money}</strong></p>
              <p>🕒 Días sobrevividos: <strong className="text-white font-mono">{day} días</strong></p>
              <p>🍕 Total Entregas: <strong className="text-white font-mono">{completedOrdersCount}</strong></p>
            </div>

            <button
              onClick={handleResetGame}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-black py-4 rounded-xl transition shadow scale-100 hover:scale-[1.02] flex items-center justify-center gap-1 text-xs cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> VOLVER A JUGAR DE NUEVO
            </button>
          </div>
        )}

      </main>

      {/* DECORATIVE GRADIENT LINE OF THE VIBRANT PALETTE */}
      <div className="h-2 w-full bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 shrink-0 z-10" />

      {/* FOOTER BAR */}
      <footer className="bg-white border-t border-gray-150 p-2.5 text-center text-[10px] text-gray-400 font-semibold uppercase tracking-widest shrink-0 select-none">
        Pedilo Ya © 2026 - Hecho con la más limpia tecnología de visualización 3D por la Isla
      </footer>


      {/* 3. MODALS SYSTEM INTERCONNECTIONS */}
      {/* 1. Pizzería modal */}
      <PizzeriaModal
        isOpen={isPizzeriaOpen}
        onClose={closeAllModals}
        availableOrders={availableOrders}
        activeOrders={activeOrders}
        onAcceptOrder={handleAcceptOrder}
        houses={houses}
        currentVehicleId={currentVehicleId}
      />

      {/* 2. Concesionario modal */}
      <ConcesionarioModal
        isOpen={isDealerOpen}
        onClose={closeAllModals}
        currentVehicleId={currentVehicleId}
        money={money}
        onBuyVehicle={handleBuyVehicle}
      />

      {/* 3. Upgrades modal */}
      <UpgradesModal
        isOpen={isUpgradesOpen}
        onClose={closeAllModals}
        upgrades={upgrades}
        money={money}
        onBuyUpgrade={handleBuyUpgrade}
      />

      {/* 4. Casino modal */}
      <CasinoModal
        isOpen={isCasinoOpen}
        onClose={closeAllModals}
        money={money}
        upgrades={upgrades}
        onAddMoney={handleCasinoAddMoney}
      />

      {/* 5. Helicopters Escape Confirmation Banner */}
      {isEscapeAsking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-pink-400 rounded-3xl p-6 text-center text-slate-800 space-y-4 max-w-sm shadow-xl">
            <h3 className="text-xl font-black text-pink-500 font-serif uppercase">¿Deseas escapar de la Isla?</h3>
            <p className="text-xs text-gray-500 font-semibold">Toma el helicóptero privado y desvía la ruta para ganar. Se requiere al menos <strong>$10.000</strong> de fortuna.</p>
            
            <div className="grid grid-cols-2 gap-2 text-xs font-bold font-sans">
              <button
                onClick={handleTriggerEscapeVictory}
                className="bg-pink-500 hover:bg-pink-600 text-white rounded-xl py-2.5 transition shadow"
              >
                Sí, Escapar de la Isla
              </button>
              <button
                onClick={() => setIsEscapeAsking(false)}
                className="bg-gray-250 hover:bg-gray-300 text-gray-600 rounded-xl py-2.5 border border-gray-150 transition"
              >
                No por ahora, Seguir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Own Pizzeria main manager dashboard */}
      <OwnPizzeriaModal
        isOpen={isOwnPizzeriaOpen}
        onClose={closeAllModals}
        availableOrders={availableOrders}
        activeOrders={activeOrders}
        onAcceptOrder={handleAcceptOrder}
        houses={houses}
        currentVehicleId={currentVehicleId}
        money={money}
        renovationLevel={renovationLevel}
        onUpgradeRenovation={handleUpgradeRenovation}
        employeeLevel={employeeLevel}
        onUpgradeEmployee={handleUpgradeEmployee}
        playerMarketShare={playerMarketShare}
        rivalMarketShare={100 - playerMarketShare}
        rivalPassiveRate={rivalPassiveRate}
        businessDaysHeld={businessDaysHeld}
        pizzeriaName={pizzeriaName}
        pizzeriaColor={pizzeriaColor}
      />

      {/* 7. Abandoned Pizzeria Purchase confirmation Overlay */}
      {isBuyPizzeriaOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-amber-500 p-6 rounded-3xl max-w-sm w-full shadow-2xl text-slate-100 flex flex-col gap-4">
            <div className="text-center">
              <span className="text-5xl inline-block animate-bounce">🏚️💥🏚️</span>
              <h3 className="text-lg font-black text-amber-400 font-sans uppercase mt-2">Pizzería Abandonada</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Oportunidad de Expansión Comercial</p>
            </div>
            
            <p className="text-xs text-slate-300 leading-normal text-center bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
              Estás parado frente a una vieja pizzería deteriorada. ¿Deseas comprar la propiedad por <strong className="text-yellow-400 font-mono">$10,000</strong>?
              <br /><br />
              <span className="text-amber-500 font-bold">⚠️ IMPORTANTE</span>: Al adquirirla, la vieja pizzería central en [0,0] dejará de aceptar pedidos y todos tus despachos se mudarán aquí. Además, no podrás escapar en helicóptero.
            </p>

            <div className="flex gap-2">
              <button 
                onClick={() => setIsBuyPizzeriaOpen(false)}
                className="w-1/2 py-2.5 bg-slate-800 text-slate-400 hover:text-slate-250 text-xs font-bold uppercase rounded-xl transition"
              >
                Cancelar
              </button>
              <button 
                disabled={money < 10000}
                onClick={() => {
                  setMoney(m => m - 10000);
                  setHasOwnPizzeria(true);
                  setPlayerMarketShare(20);
                  setRenovationLevel(0);
                  setIsBuyPizzeriaOpen(false);
                  setBusinessDaysHeld(0);
                  setRivalPassiveRate(2);
                  setIsCustomizationOpen(true); // Open branding screen!
                  alertBanner("🏠 ¡IMPERIO COMIENZA! Adquiriste la Pizzería Abandonada ($10,000). Define la identidad visual de tu marca.");
                  audio.playCasinoWin();
                }}
                className={`w-1/2 py-2.5 rounded-xl font-black text-xs transition uppercase ${
                  money >= 10000 
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md' 
                    : 'bg-slate-800 text-slate-600 border border-slate-750 cursor-not-allowed'
                }`}
              >
                {money >= 10000 ? 'Comprar ($10,000)' : 'Sin Fondos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Rival Pizzeria Buyout confirmation Overlay */}
      {isBuyRivalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-emerald-500 p-6 rounded-3xl max-w-sm w-full shadow-2xl text-slate-100 flex flex-col gap-4">
            <div className="text-center">
              <span className="text-5xl inline-block animate-pulse">👑🔥🎯</span>
              <h3 className="text-lg font-black text-emerald-400 font-sans uppercase mt-2">Derrumbar Competencia</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unificación Oligopólica de la Isla</p>
            </div>

            <p className="text-xs text-slate-300 leading-normal text-center bg-slate-950/45 p-4 rounded-2xl border border-slate-800">
              Has conquistado el 100% de la participación de la isla. ¿Deseas adquirir las dependencias centrales de tu rival derrotado por <strong className="text-yellow-405 font-mono">$100,000</strong>?
            </p>

            <div className="flex gap-2">
              <button 
                onClick={() => setIsBuyRivalOpen(false)}
                className="w-1/2 py-2.5 bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold uppercase rounded-xl transition"
              >
                Cancelar
              </button>
              <button 
                disabled={money < 100000}
                onClick={() => {
                  setMoney(m => m - 100000);
                  setIsBuyRivalOpen(false);
                  setIsRivalDecisionOpen(true);
                  audio.playCasinoWin();
                }}
                className={`w-1/2 py-2.5 rounded-xl font-black text-xs transition uppercase ${
                  money >= 100000 
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-md' 
                    : 'bg-slate-800 text-slate-600 border border-slate-750 cursor-not-allowed'
                }`}
              >
                {money >= 100000 ? 'Comprar ($100k)' : 'Sin Fondos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Final Crossroads Decision */}
      {isRivalDecisionOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-yellow-400 p-8 rounded-3xl max-w-lg w-full shadow-2xl text-slate-100 flex flex-col gap-5">
            <div className="text-center font-sans">
              <div className="text-6xl mb-1 animate-pulse">👑✈️👑</div>
              <h3 className="text-2xl font-black text-yellow-400 font-serif uppercase tracking-wider">Monopolio Absoluto</h3>
              <p className="text-xs text-slate-400 font-semibold uppercase">Tus pizza-dólares controlan toda la isla</p>
            </div>
            
            <p className="text-xs text-slate-200 leading-relaxed text-center bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              Has adquirido la pizzería rival. La distribución local completa responde ahora ante tu firma corporativa de pizzas. Toma una decisión definitiva:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              {/* Opción A - Globalizarte */}
              <button
                onClick={() => {
                  setIsRivalDecisionOpen(false);
                  setHasGlobalized(true);
                  setPlayerMarketShare(100);
                  alertBanner("🌐 ¡GLOBALIZACIÓN EN MARCHA! Te has expandido a mercados internacionales. Tu imperio trasciende mares.");
                  audio.playCasinoWin();
                }}
                className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 p-4 rounded-2xl text-center flex flex-col items-center gap-1.5 transition hover:-translate-y-1 cursor-pointer group"
              >
                <span className="text-3xl group-hover:scale-110 transition duration-150">🌐</span>
                <span className="text-xs font-black uppercase text-amber-400">Globalizarte</span>
                <span className="text-[10px] text-slate-400 leading-normal font-semibold">Lanza franquicias internacionales y sigue jugando en tu isla sin límites de capital.</span>
              </button>

              {/* Opción B - Quedarte en la Isla */}
              <button
                onClick={() => {
                  setIsRivalDecisionOpen(false);
                  setGameState('victory');
                }}
                className="bg-slate-950 border border-slate-800 hover:border-red-500/50 p-4 rounded-2xl text-center flex flex-col items-center gap-1.5 transition hover:-translate-y-1 cursor-pointer group"
              >
                <span className="text-3xl group-hover:scale-110 transition duration-150">🏝️</span>
                <span className="text-xs font-black uppercase text-red-500">Retirarse en la Isla</span>
                <span className="text-[10px] text-slate-400 leading-normal font-semibold">Declara victoria definitiva, finaliza el juego como el indiscutible rey multimillonario.</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Developer Terminal Password Dialog */}
      {isCheatOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-indigo-500 p-6 rounded-3xl max-w-sm w-full shadow-2xl text-slate-100 flex flex-col gap-4">
            <div className="text-center">
              <span className="text-4xl animate-bounce inline-block">🤫👾🤫</span>
              <h3 className="text-base font-black text-indigo-400 uppercase tracking-widest mt-1">Consola del Desarrollador</h3>
              <p className="text-[9px] text-slate-400 font-semibold uppercase">Introducir terminal de códigos del sistema de depuración</p>
            </div>
            
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] uppercase font-bold text-slate-500">Contraseña Secreta:</label>
              <input 
                type="text"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (passwordInput === '67nashe') {
                      setMoney(m => m + 10000000);
                      setIsCheatOpen(false);
                      setPasswordInput('');
                      alertBanner("🔑 CONEXIÓN COMPLETA: ¡Has cargado secreto de $10,000,000 pizza-dólares adicionales!");
                      audio.playCasinoWin();
                    } else {
                      alertBanner("❌ ACCESO RECHAZADO: Contraseña incorrecta.");
                      audio.playFail();
                    }
                  }
                }}
                placeholder="Introducir código..."
                className="w-full bg-slate-950 text-emerald-400 border-2 border-slate-800 focus:border-indigo-500 p-2.5 rounded-xl outline-none font-mono text-center tracking-wider text-xs"
              />
            </div>

            <div className="flex gap-2 select-none">
              <button 
                onClick={() => {
                  setIsCheatOpen(false);
                  setPasswordInput('');
                }}
                className="w-1/2 py-2 bg-slate-800 text-slate-400 text-xs font-bold uppercase rounded-md hover:bg-slate-700 transition"
              >
                Cerrar
              </button>
              <button 
                onClick={() => {
                  if (passwordInput === '67nashe') {
                    setMoney(m => m + 10000000);
                    setIsCheatOpen(false);
                    setPasswordInput('');
                    alertBanner("🔑 CONEXIÓN COMPLETA: ¡Has cargado secreto de $10,000,000 pizza-dólares adicionales!");
                    audio.playCasinoWin();
                  } else {
                    alertBanner("❌ ACCESO RECHAZADO: Contraseña incorrecta.");
                    audio.playFail();
                  }
                }}
                className="w-1/2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase rounded-md transition hover:-translate-y-0.5 active:translate-y-0.5"
              >
                Validar
              </button>
            </div>
          </div>
        </div>
      )}

      {isCustomizationOpen && (
        <PizzeriaCustomizationModal
          isOpen={isCustomizationOpen}
          onClose={() => setIsCustomizationOpen(false)}
          onSave={(name, color) => {
            setPizzeriaName(name);
            setPizzeriaColor(color);
          }}
          initialName={pizzeriaName}
          initialColor={pizzeriaColor}
        />
      )}

    </div>
  );
}
