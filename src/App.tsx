/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  DollarSign, Car, Calendar, ShieldAlert, Award, Clock, Sparkles, 
  Play, RotateCcw, AlertTriangle, Volume2, VolumeX, Menu, CheckCircle2, Navigation,
  Pause, Save, Settings, LogOut, ArrowLeft, Trash2, Check
} from 'lucide-react';
import { GameState, House, Order, Obstacle, Vagabond, Upgrades, VehicleId, TERRITORIES, getTerritoryAt, REGION_MAP_OFFSET_X, REGION_MAP_OFFSET_Y } from './types';
import { PizzeriaModal } from './components/PizzeriaModal';
import { OwnPizzeriaModal } from './components/OwnPizzeriaModal';
import { ConcesionarioModal, VEHICLES_LIST } from './components/ConcesionarioModal';
import { CasinoModal } from './components/CasinoModal';
import { UpgradesModal } from './components/UpgradesModal';
import { PizzeriaCustomizationModal } from './components/PizzeriaCustomizationModal';
import { GameCanvas } from './components/GameCanvas';
import { Joystick } from './components/Joystick';
import { audio } from './utils/audio';

/// Dynamic obstacle generator
const generateDynamicObstacles = (houses: House[], currentVehicleId: VehicleId, completedOrdersCount: number): Obstacle[] => {
  const list: Obstacle[] = [];
  const STREET_COORDS = [-818, -613, -368, -123, 123, 368, 613, 818];

  const isValidPlacement = (x: number, y: number, minDistanceToOthers = 30): boolean => {
    // 1. Check streets
    const onStreet = STREET_COORDS.some(sc => Math.abs(x - sc) < 22) || STREET_COORDS.some(sc => Math.abs(y - sc) < 22);
    if (onStreet) return false;

    // 2. Check main buildings
    const dPiz = Math.sqrt(x*x + y*y);
    if (dPiz < 40) return false;
    const dOwnPiz = Math.sqrt(x*x + (y - 245)**2);
    if (dOwnPiz < 40) return false;
    const dDealer = Math.sqrt((x - (-245))**2 + y**2);
    if (dDealer < 40) return false;
    const dCas = Math.sqrt((x - 245)**2 + y**2);
    if (dCas < 40) return false;

    // 3. Check houses
    const nearHouse = houses.some(h => Math.sqrt((x - h.x)**2 + (y - h.y)**2) < 25);
    if (nearHouse) return false;

    // 4. Check already placed items in list
    const nearOther = list.some(item => Math.sqrt((x - item.x)**2 + (y - item.y)**2) < minDistanceToOthers);
    if (nearOther) return false;

    return true;
  };

  // 1. PLACE TREES (scattered randomly on the map, nicely separated)
  for (let i = 0; i < 125; i++) {
    let placed = false;
    let attempts = 0;
    let x = 0, y = 0;
    while (attempts < 100 && !placed) {
      x = (Math.random() * 1760) - 880;
      y = (Math.random() * 1760) - 880;
      if (isValidPlacement(x, y, 32)) {
        placed = true;
      }
      attempts++;
    }
    // Fallback if tight
    if (!placed) {
      x = (Math.random() * 1760) - 880;
      y = (Math.random() * 1760) - 880;
    }
    list.push({
      id: `tree-${i}-${Date.now()}`,
      type: 'tree',
      x,
      y,
      size: 10,
    });
  }

  // 2. PLACE MUD PUDDLES (scattered on grass blocks, nicely separated)
  for (let i = 0; i < 50; i++) {
    let placed = false;
    let attempts = 0;
    let x = 0, y = 0;
    while (attempts < 100 && !placed) {
      x = (Math.random() * 1600) - 800;
      y = (Math.random() * 1600) - 800;
      if (isValidPlacement(x, y, 40)) {
        placed = true;
      }
      attempts++;
    }
    if (!placed) {
      x = (Math.random() * 1600) - 800;
      y = (Math.random() * 1600) - 800;
    }
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
  const streets: { startX: number; startY: number; endX: number; endY: number; angle: number }[] = [];

  // Horizontal streets
  STREET_COORDS.forEach(Y_c => {
    streets.push({
      startX: -880,
      startY: Y_c,
      endX: 880,
      endY: Y_c,
      angle: 0
    });
  });

  // Vertical streets
  STREET_COORDS.forEach(X_c => {
    streets.push({
      startX: X_c,
      startY: -880,
      endX: X_c,
      endY: 880,
      angle: Math.PI / 2
    });
  });

  streets.forEach((st, idx) => {
    // Place 3 cars per street lane in opposite directions
    for (let c = 0; c < 3; c++) {
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
        vx: Math.cos(st.angle) * speed * (c % 2 === 1 ? -1 : 1),
        vy: Math.sin(st.angle) * speed * (c % 2 === 1 ? -1 : 1),
        angle: st.angle + (c % 2 === 1 ? Math.PI : 0),
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

  const colBounds = [-900, -818, -613, -368, -123, 123, 368, 613, 818, 900];
  const rowBounds = [-900, -818, -613, -368, -123, 123, 368, 613, 818, 900];

  const cells: { col: number; row: number }[] = [];
  for (let r = 1; r <= 7; r++) {
    for (let c = 1; c <= 7; c++) {
      // Exclude cells around major buildings to ensure no overlapping
      if (r === 4 && c === 4) continue; // Pizzería original
      if (r === 4 && c === 3) continue; // Concesionario
      if (r === 4 && c === 5) continue; // Casino
      if (r === 5 && c === 4) continue; // Own Pizzería / Pizzería abandonada
      cells.push({ col: c, row: r });
    }
  }

  // Shuffle cells to assign unique sectors randomly
  const shuffledCells = [...cells];
  for (let i = shuffledCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledCells[i], shuffledCells[j]] = [shuffledCells[j], shuffledCells[i]];
  }

  // Generate 90 houses (scaled up to support expanded map and richess)
  const totalHousesToGenerate = 90;
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

  // New Save / Pause / Config state variables
  const [currentSaveSlot, setCurrentSaveSlot] = useState<number | null>(null);
  const [timePlayed, setTimePlayed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [menuScreen, setMenuScreen] = useState<'main' | 'slots_new' | 'slots_load' | 'config'>('main');
  const [saveSlotSelectedConfirm, setSaveSlotSelectedConfirm] = useState<number | null>(null);
  const [slotToDeleteConfirm, setSlotToDeleteConfirm] = useState<number | null>(null);
  const [showExitToMenuConfirm, setShowExitToMenuConfirm] = useState(false);
  const [savesVersion, setSavesVersion] = useState(0);

  const [musicVol, setMusicVol] = useState(() => {
    try {
      const stored = localStorage.getItem('pedilo_ya_config');
      if (stored) {
        const c = JSON.parse(stored);
        if (c.musicVol !== undefined) return c.musicVol;
      }
    } catch(e){}
    return 0.5;
  });

  const [sfxVol, setSfxVol] = useState(() => {
    try {
      const stored = localStorage.getItem('pedilo_ya_config');
      if (stored) {
        const c = JSON.parse(stored);
        if (c.sfxVol !== undefined) return c.sfxVol;
      }
    } catch(e){}
    return 0.5;
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Apply volume configuration and save to localStorage
  useEffect(() => {
    audio.setMusicVolume(musicVol);
    audio.setSfxVolume(sfxVol);
    try {
      localStorage.setItem('pedilo_ya_config', JSON.stringify({ musicVol, sfxVol }));
    } catch(e){}
  }, [musicVol, sfxVol]);

  // Fullscreen change listener to sync state with user events
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  // Tutorial Systems State
  const [tutorialStep, setTutorialStep] = useState<'off' | 'prompt' | 'pizzeria' | 'delivery' | 'concesionario' | 'casino' | 'completed'>('prompt');
  const [businessTutorialStep, setBusinessTutorialStep] = useState<'off' | 'prompt' | 'upgrades' | 'competition' | 'staff' | 'completed'>('off');
  const [showTutorialEndModal, setShowTutorialEndModal] = useState(false);
  const [isTutorialMinimized, setIsTutorialMinimized] = useState(false);
  const [wasUsingHelicopter, setWasUsingHelicopter] = useState(false);
  const [victoryEnding, setVictoryEnding] = useState<'escape' | 'island_retire'>('escape');

  // Time Played Accumulator
  useEffect(() => {
    if (gameState !== 'playing' || isPaused || showTutorialEndModal) return;
    const interval = setInterval(() => {
      setTimePlayed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState, isPaused, showTutorialEndModal]);

  // Core Player States
  const [money, setMoney] = useState(50);
  const [currentVehicleId, setCurrentVehicleId] = useState<VehicleId>('pie');
  const [upgrades, setUpgrades] = useState<Upgrades>({ ganancia: 0, suerte: 0, fuerza: 0 });
  const [failures, setFailures] = useState(0);
  const [gameOverReason, setGameOverReason] = useState<'rent' | 'failures' | 'competition' | 'none'>('none');
  const [completedOrdersCount, setCompletedOrdersCount] = useState(0);

  // Konami Code Cheat State
  const [konamiSpeedTimer, setKonamiSpeedTimer] = useState(0);
  const konamiSpeedTimerRef = useRef(0);
  const konamiSeqRef = useRef<string[]>([]);

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
    if (gameState === 'playing' && !isPaused) {
      audio.startBGM();
    } else if (gameState === 'menu') {
      audio.startMenuBGM();
    } else {
      audio.stopBGM();
    }
    return () => {
      audio.stopBGM();
    };
  }, [gameState, isPaused]);

  // Periodic autosave every 60 seconds (only during gameplay)
  useEffect(() => {
    if (gameState !== 'playing' || isPaused || showTutorialEndModal || !currentSaveSlot) return;
    const interval = setInterval(() => {
      handleSaveGame(currentSaveSlot, true);
    }, 60000);
    return () => clearInterval(interval);
  }, [gameState, isPaused, showTutorialEndModal, currentSaveSlot]);

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

  // Chapter 3 States
  const [chapter, setChapter] = useState<1 | 2 | 3>(1);
  const [insideRegionId, setInsideRegionId] = useState<number | null>(null);
  const [landingRegionId, setLandingRegionId] = useState<number | null>(null);
  const [globalPlayerX, setGlobalPlayerX] = useState<number>(-250);
  const [globalPlayerY, setGlobalPlayerY] = useState<number>(40);
  const [showChapter3Transition, setShowChapter3Transition] = useState(false);

  const startChapter3TransitionSequence = () => {
    setShowChapter3Transition(true);
    audio.startChapter3BGM();
    
    // Clear any active orders when moving to Chapter 3
    setActiveOrders([]);
    setAvailableOrders([]);

    setTimeout(() => {
      setChapter(3);
      setHasGlobalized(true);
      setMoney(0);
      setPlayerX(-250); // Small corporate island center approx -250, 0
      setPlayerY(40);
      playerXRef.current = -250;
      playerYRef.current = 40;
      setShowChapter3Transition(false);
    }, 7500); // 7.5 seconds screen
  };

  const handleExitRegion = () => {
    // Preparation for future restrictions (e.g. activeOrders, miniGames, etc.)
    const isRestricted = false;
    if (isRestricted) {
      alertBanner("⚠️ No puedes salir del territorio en este momento.");
      audio.playFail();
      return;
    }

    audio.playUpgrade();
    setPlayerX(globalPlayerX);
    setPlayerY(globalPlayerY);
    playerXRef.current = globalPlayerX;
    playerYRef.current = globalPlayerY;
    setInsideRegionId(null);
    alertBanner("🗺️ Has regresado al mapa de operaciones global.");
  };

  const triggerEnterRegionSequence = (regionId: number) => {
    const reg = TERRITORIES.find(r => r.id === regionId);
    if (!reg) return;

    // Start of landing sequence
    audio.playUpgrade();
    setGlobalPlayerX(playerXRef.current);
    setGlobalPlayerY(playerYRef.current);
    setLandingRegionId(regionId);

    setTimeout(() => {
      setPlayerX(REGION_MAP_OFFSET_X);
      setPlayerY(REGION_MAP_OFFSET_Y);
      playerXRef.current = REGION_MAP_OFFSET_X;
      playerYRef.current = REGION_MAP_OFFSET_Y;
      setInsideRegionId(regionId);
      setLandingRegionId(null);
      audio.playUpgrade();
      alertBanner("Mapa de región cargado");
    }, 2800);
  };

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
  const LIMIT = 900;

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
    chapter,
    isRivalDefeated,
    isCustomizationOpen,
    renovationLevel,
    pizzeriaName,
    pizzeriaColor,
    tutorialStep,
    businessTutorialStep,
    konamiSpeedTimer,
    showTutorialEndModal,
    wasUsingHelicopter,
    victoryEnding,
    isPaused,
    insideRegionId,
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

      // Toggle Pause with Escape or P keys
      if (key === 'escape' || key === 'p') {
        const state = physicsStateRef.current;
        if (state.gameState === 'playing') {
          setIsPaused(prev => !prev);
          audio.playUpgrade();
          return;
        }
      }
      
      const newKeys = { 
        ...keysPressedRef.current, 
        [key]: true,
        [code]: true 
      };
      keysPressedRef.current = newKeys;
      setKeysPressed(newKeys);

      // Konami Cheat Sequence Detector (Up Up Down Down Left Right Left Right B A)
      const cheatKeyMap: { [key: string]: string } = {
        arrowup: 'up',
        arrowdown: 'down',
        arrowleft: 'left',
        arrowright: 'right',
        b: 'b',
        a: 'a'
      };
      const parsedCheat = cheatKeyMap[key];
      if (parsedCheat) {
        konamiSeqRef.current = [...konamiSeqRef.current, parsedCheat].slice(-10);
        const targetSequence = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
        const isSeqComplete = targetSequence.every((val, idx) => val === konamiSeqRef.current[idx]);
        if (isSeqComplete) {
          konamiSeqRef.current = [];
          konamiSpeedTimerRef.current = 5;
          setKonamiSpeedTimer(5);
          audio.playSuccess();
          alertBanner("💨 ¡TRUCO KONAMI DE VELOCIDAD ACTIVADO! x2 Velocidad durante 5s.");
        }
      } else {
        konamiSeqRef.current = [...konamiSeqRef.current, 'other'].slice(-10);
      }

      // SPACEBAR triggers active interactions
      if (e.key === ' ' || e.key === 'Spacebar') {
        const curX = playerXRef.current;
        const curY = playerYRef.current;

        const state = physicsStateRef.current;

        if (state.chapter === 3) {
          if (state.insideRegionId === null) {
            const activeTerritory = getTerritoryAt(curX, curY);
            if (activeTerritory) {
              triggerEnterRegionSequence(activeTerritory.id);
            }
          }
          return;
        }

        // Check secret password cheat in bottom-right corner (around 880, 880)
        const distCornerBR = Math.sqrt((curX - 880) ** 2 + (curY - 880) ** 2);
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
      if (state.konamiSpeedTimer > 0) {
        setKonamiSpeedTimer(prev => Math.max(0, prev - dt));
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

      // Apply Konami speed cheat x4 speed multiplier
      if (state.konamiSpeedTimer > 0) {
        moveSpeed *= 4.0;
      }

      // Zero speed when fully stunned or any menu layout is active
      const isAnyModalActive = 
        state.isPaused ||
        state.isPizzeriaOpen || 
        state.isDealerOpen || 
        state.isCasinoOpen || 
        state.isUpgradesOpen ||
        state.isBuyPizzeriaOpen ||
        state.isOwnPizzeriaOpen ||
        state.isBuyRivalOpen ||
        state.isRivalDecisionOpen ||
        state.isCustomizationOpen ||
        state.isCheatOpen ||
        state.showTutorialEndModal;

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
        if (state.insideRegionId !== null) {
          // Inside a territory/region, we have a hard boundary of -470 to 470 for all vehicles
          nextX = Math.max(REGION_MAP_OFFSET_X - 470, Math.min(REGION_MAP_OFFSET_X + 470, nextX));
          nextY = Math.max(REGION_MAP_OFFSET_Y - 470, Math.min(REGION_MAP_OFFSET_Y + 470, nextY));
        } else if (state.chapter === 3 && state.insideRegionId === null) {
          nextX = Math.max(-350, Math.min(850, nextX));
          nextY = Math.max(-480, Math.min(480, nextY));
        } else if (state.currentVehicleId !== 'helicoptero') {
          nextX = Math.max(-LIMIT, Math.min(LIMIT, nextX));
          nextY = Math.max(-LIMIT, Math.min(LIMIT, nextY));
        } else {
          // Helicopter can hover slightly broader but still stay on map bounding box
          nextX = Math.max(-LIMIT - 10, Math.min(LIMIT + 10, nextX));
          nextY = Math.max(-LIMIT - 10, Math.min(LIMIT + 10, nextY));
        }

        // 4. COLLISION CHECKS WITH BUILDINGS & SOLID OBJECTS (Helicopter ignores ground collisions!)
        if (state.currentVehicleId !== 'helicoptero') {
          if (state.chapter === 3) {
            if (state.insideRegionId === null) {
              // Corporate HQ building (-250, 0) radius 25
              const dCorp = Math.sqrt((nextX - (-250))**2 + nextY**2);
              if (dCorp < 25) {
                const curDist = Math.sqrt((playerXRef.current - (-250))**2 + playerYRef.current**2);
                if (dCorp < curDist) {
                  nextX = playerXRef.current;
                  nextY = playerYRef.current;
                }
              }
            }
          } else {
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
              if (nx < -885 || nx > 885 || ny < -885 || ny > 885) {
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
              const coin = Math.random() < 0.5 ? -750 : 750;
              return {
                ...vag,
                x: coin,
                y: Math.random() * 1600 - 800,
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
            
            // Advance tutorial step 2 to step 3 (concesionario)
            if (state.tutorialStep === 'delivery') {
              setTutorialStep('concesionario');
              setTimeout(() => {
                alertBanner("🎉 ¡PRIMERA ENTREGA EXITOSA! Cobraste tus primeras monedas. Ahora continuemos con el Paso 3.");
              }, 1500);
            }

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
    if (gameState !== 'playing' || isPaused) return;
    if (showTutorialEndModal) return;

    const timer = setTimeout(() => {
      if (showTutorialEndModal || isPaused) return;
      const isTutorialActive = (tutorialStep !== 'off' && tutorialStep !== 'completed') && !hasOwnPizzeria;

      // 1. Day Clock tick - Locked/Paused during training
      if (isTutorialActive) {
        setDayTimeLeft(60);
      } else {
        if (dayTimeLeft <= 1) {
          // Increment Day (Day transitions from `day` to `day + 1`)
          // Rent Due checks: Only if they DO NOT own their pizzeria! No rent during the tutorial.
          const rentDue = (!hasOwnPizzeria && day % 3 === 0) ? Math.floor(day / 3) * 500 : 0;

          if (rentDue > 0) {
            if (money < rentDue) {
              // Game Over! Insolvency lease debt!
              audio.playFail();
              setGameOverReason('rent');
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
                if (businessTutorialStep !== 'off' && businessTutorialStep !== 'completed') {
                  // Safeguard during business/corporate tutorial so player can understand without stress
                  alertBanner("⚠️ PARTICIPACIÓN AL 0%. Salvado de Game Over por estar en el tutorial empresarial.");
                  return 5;
                }
                // Game Over! Market share hit 0% (rival reaches 100%)
                audio.playFail();
                setGameOverReason('competition');
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
      }

      // 2. Active Deliveries clocks tick
      if (activeOrders.length > 0) {
        const firstOrder = activeOrders[0];
        if (firstOrder.timeLeft <= 1) {
          const expiredHouseId = firstOrder.houseId;

          audio.playFail();
          setFailures(f => {
            const nextFailures = f + 1;
            const isTutorialActive = (tutorialStep !== 'off' && tutorialStep !== 'completed') && !hasOwnPizzeria;
            if (nextFailures >= 3 && !isTutorialActive) {
              setGameOverReason('failures');
              setGameState('gameover');
            } else if (nextFailures >= 3 && isTutorialActive) {
              alertBanner("🎓 TUTORIAL PROTEGIDO: Has fallado 3 entregas, pero la protección de entrenamiento evitó el Game Over.");
            }
            return nextFailures;
          });

          const targetHouse = houses.find(h => h.id === expiredHouseId);
          alertBanner(`⏰ ¡SE ACABÓ EL TIEMPO! Fallaste la entrega en Casa ${targetHouse?.number || ''}`);

          // Remove the expired order immediately
          setActiveOrders(prev => prev.slice(1));

          // Clear out any dynamic map clutter since the active run is ended
          setObstacles([]);
          setVagabonds([]);
        } else {
          setActiveOrders(prev => {
            if (prev.length === 0) return prev;
            return prev.map((ord, idx) => {
              if (idx === 0) {
                return { ...ord, timeLeft: ord.timeLeft - 1 };
              }
              return ord;
            });
          });
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    gameState,
    day,
    dayTimeLeft,
    activeOrders,
    money,
    houses,
    tutorialStep,
    hasOwnPizzeria,
    businessTutorialStep,
    isRivalDefeated,
    hasGlobalized,
    businessDaysHeld,
    rivalPassiveRate,
    showTutorialEndModal,
    isPaused
  ]);


  // Return to helicopter once the active orders are finished (delivered or expired/failed)
  useEffect(() => {
    if (activeOrders.length === 0 && wasUsingHelicopter) {
      setCurrentVehicleId('helicoptero');
      setWasUsingHelicopter(false);
      alertBanner("🚁 ¡Entrega concluida! El Helicóptero vuelve a estar activo para moverte por la isla.");
    }
  }, [activeOrders.length, wasUsingHelicopter]);


  // Tycoon Passive Income and Competition Progression (1-second tick-rate engine)
  useEffect(() => {
    if (gameState !== 'playing' || !hasOwnPizzeria || showTutorialEndModal || isPaused || chapter === 3) return;

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
  }, [gameState, hasOwnPizzeria, renovationLevel, employeeLevel, isRivalDefeated, showTutorialEndModal, isPaused]);


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

    let activeVehicleId = currentVehicleId;
    if (activeVehicleId === 'helicoptero') {
      setWasUsingHelicopter(true);
      setCurrentVehicleId('camion');
      activeVehicleId = 'camion';
      alertBanner("🚁 ¡Helicóptero estacionado! Usando el Camión Duplicador para la entrega terrestre.");
    }

    const nextQueue = [...activeOrders, { ...order, timeLeft: order.timeLimit }];
    setActiveOrders(nextQueue);

    // If tutorial step 1 is active, advance to step 2 delivery
    if (tutorialStep === 'pizzeria') {
      setTutorialStep('delivery');
      alertBanner("🏠 ¡PEDIDO CARGADO! Ahora dirígete a la casa objetivo guiándote por el indicador verde.");
    }

    // Remove the selected order from available list
    setAvailableOrders(prev => prev.filter(o => o.id !== order.id));

    // Dynamic spawn threats strictly when delivery starts:
    // "Los obstáculos aparecen únicamente cuando existe un pedido activo. Al entregar o fallar el pedido desaparecen."
    if (nextQueue.length === 1) {
      // First order starting, initialize randomized dynamic roadblocks
      const newObs = generateDynamicObstacles(houses, activeVehicleId, completedOrdersCount);
      setObstacles(newObs);

      // Vagabonds trigger criteria check:
      // "A partir del cuarto pedido comienzan a aparecer vagabundos (completedOrdersCount >= 3)"
      if (completedOrdersCount >= 3) {
        const vagList: Vagabond[] = [];
        // Spawn quantity increases dynamically with completed deliveries difficulty!
        const vagQuantity = Math.min(6, 1 + Math.floor((completedOrdersCount - 3) / 2));
        
        for (let v = 0; v < vagQuantity; v++) {
          // Far coordinates spawn so players can adapt steering
          const farX = Math.random() < 0.5 ? -750 : 750;
          const farY = Math.random() < 0.5 ? -750 : 750;
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
    triggerAutosave();
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
    triggerAutosave();
  };

  // TYCOON RENOVATION BUY HANDLER
  const handleUpgradeRenovation = (nextLvl: number, cost: number) => {
    if (money < cost) return;
    setMoney(prev => prev - cost);
    setRenovationLevel(nextLvl);
    audio.playUpgrade();
    alertBanner(`🛠️ ¡INFRAESTRUCTURA MEJORADA! Has invertido $${cost}. Pizzería alcanzó Nivel ${nextLvl}.`);

    // Auto-advance business tutorial steps if level 3 renovation (enabling employees) is purchased
    if ((businessTutorialStep === 'upgrades' || businessTutorialStep === 'competition') && nextLvl === 3) {
      setBusinessTutorialStep('staff');
      audio.playSuccess();
      alertBanner("🎓 TUTORIAL: ¡Ingreso automático desbloqueado! Comienza el reclutamiento en la nueva pestaña 'Personal Autónomo'.");
    }
    triggerAutosave();
  };

  // TYCOON EMPLOYEE RECRUIT HANDLER
  const handleUpgradeEmployee = (nextLvl: number, cost: number) => {
    if (money < cost) return;
    setMoney(prev => prev - cost);
    setEmployeeLevel(nextLvl);
    audio.playUpgrade();
    const ranks = ["Ninguno", "Novato", "Experimentado", "Profesional", "Experto", "Experto+"];
    alertBanner(`🛵 ¡RECLUTAMIENTO EFECTIVO! Rango alcanzado: ${ranks[nextLvl]} (Inversión: $${cost}).`);
    triggerAutosave();
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
      setVictoryEnding('escape');
      setGameState('victory');
      audio.playCasinoWin();
    } else {
      // Warn player
      alertBanner('🚁 ¡NECESITAS AL MENOS $10,000 en mano para poder comprar combustible y escapar!');
    }
    setIsEscapeAsking(false);
  };


  // GAME RESTART HANDLER
  const handleResetGame = (slotId?: number) => {
    setGameState('playing');
    setMoney(70); // start off-balance
    setCurrentVehicleId('pie');
    setWasUsingHelicopter(false);
    setVictoryEnding('escape');
    setUpgrades({ ganancia: 0, suerte: 0, fuerza: 0 });
    setFailures(0);
    setGameOverReason('none');
    setCompletedOrdersCount(0);
    setTutorialStep('prompt');
    setBusinessTutorialStep('off');
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

    if (slotId !== undefined) {
      setCurrentSaveSlot(slotId);
      setTimePlayed(0);
    }

    generatePizzeriaOrders(VEHICLES_LIST[0].speed);
  };

  const getSaveSlotData = (slotId: number): any | null => {
    try {
      const parsed = localStorage.getItem(`pedilo_ya_save_${slotId}`);
      return parsed ? JSON.parse(parsed) : null;
    } catch (e) {
      return null;
    }
  };

  const hasAnySaveGame = (): boolean => {
    const _dummy = savesVersion;
    for (let i = 1; i <= 5; i++) {
      if (localStorage.getItem(`pedilo_ya_save_${i}`)) return true;
    }
    return false;
  };

  const getMostRecentSaveSlot = (): number | null => {
    const _dummy = savesVersion;
    let rawSlot: number | null = null;
    let latestTime = 0;
    for (let i = 1; i <= 5; i++) {
      const raw = localStorage.getItem(`pedilo_ya_save_${i}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const saveTime = new Date(parsed.lastSavedAt).getTime();
          if (saveTime > latestTime) {
            latestTime = saveTime;
            rawSlot = i;
          }
        } catch(e){}
      }
    }
    return rawSlot;
  };

  const handleSaveGame = (slotId: number, isAutosave = false) => {
    // Collect active states
    const saveData = {
      slotId,
      lastSavedAt: new Date().toISOString(),
      timePlayed,
      money,
      currentVehicleId,
      wasUsingHelicopter,
      upgrades,
      failures,
      day,
      dayTimeLeft,
      completedOrdersCount,
      tutorialStep,
      businessTutorialStep,
      playerX,
      playerY,
      playerAngle,
      hasOwnPizzeria,
      renovationLevel,
      playerMarketShare,
      businessDaysHeld,
      rivalPassiveRate,
      employeeLevel,
      isRivalDefeated,
      hasGlobalized,
      chapter,
      passiveTimer,
      pizzeriaName,
      pizzeriaColor
    };

    try {
      localStorage.setItem(`pedilo_ya_save_${slotId}`, JSON.stringify(saveData));
      setSavesVersion(v => v + 1);
      if (!isAutosave) {
        alertBanner(`💾 ¡JUEGO GUARDADO EXITOSAMENTE! (Slot ${slotId})`);
      } else {
        alertBanner(`🔄 AUTOGUARDADO RÁPIDO COMPLETO (Slot ${slotId})`);
      }
      audio.playCasinoWin();
    } catch(e) {
      alertBanner("❌ Error al acceder a localStorage para guardar");
    }
  };

  const handleLoadGameBySlot = (slotId: number) => {
    const data = getSaveSlotData(slotId);
    if (!data) {
      alertBanner(`❌ No hay datos guardados en el Slot ${slotId}`);
      return;
    }

    // Set all active states
    setCurrentSaveSlot(slotId);
    if (data.timePlayed !== undefined) setTimePlayed(data.timePlayed);
    setMoney(data.money);
    setCurrentVehicleId(data.currentVehicleId);
    if (data.wasUsingHelicopter !== undefined) setWasUsingHelicopter(data.wasUsingHelicopter);
    setUpgrades(data.upgrades);
    setFailures(data.failures);
    setDay(data.day);
    setDayTimeLeft(data.dayTimeLeft);
    setCompletedOrdersCount(data.completedOrdersCount);
    setTutorialStep(data.tutorialStep);
    setBusinessTutorialStep(data.businessTutorialStep);
    
    setPlayerX(data.playerX);
    setPlayerY(data.playerY);
    playerXRef.current = data.playerX;
    playerYRef.current = data.playerY;
    
    if (data.playerAngle !== undefined) {
      setPlayerAngle(data.playerAngle);
      playerAngleRef.current = data.playerAngle;
    }
    
    setHasOwnPizzeria(data.hasOwnPizzeria);
    setRenovationLevel(data.renovationLevel);
    setPlayerMarketShare(data.playerMarketShare);
    setBusinessDaysHeld(data.businessDaysHeld);
    setRivalPassiveRate(data.rivalPassiveRate);
    setEmployeeLevel(data.employeeLevel);
    setIsRivalDefeated(data.isRivalDefeated);
    setHasGlobalized(data.hasGlobalized);
    if (data.chapter !== undefined) {
      setChapter(data.chapter);
    } else {
      setChapter(data.hasGlobalized ? 3 : 1);
    }
    setPassiveTimer(data.passiveTimer);

    if (data.pizzeriaName !== undefined) setPizzeriaName(data.pizzeriaName);
    if (data.pizzeriaColor !== undefined) setPizzeriaColor(data.pizzeriaColor);

    // clear active key states and resets
    keysPressedRef.current = {};
    setKeysPressed({});
    setRentWarning(false);
    setIsEscapeAsking(false);
    setIsPaused(false);
    setStunTime(0);
    setSlowTime(0);

    // regenerate valid list of orders
    const loadedVehicle = VEHICLES_LIST.find(v => v.id === data.currentVehicleId) || VEHICLES_LIST[0];
    generatePizzeriaOrders(loadedVehicle.speed);

    setGameState('playing');
    alertBanner(`📂 PARTIDA CARGADA CORRECTAMENTE (Slot ${slotId})`);
    audio.playSuccess();
  };

  const handleDeleteSaveSlot = (slotId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      localStorage.removeItem(`pedilo_ya_save_${slotId}`);
      alertBanner(`🗑️ Slot ${slotId} borrado correctamente.`);
      audio.playCasinoWin();
      setSavesVersion(v => v + 1);
      if (currentSaveSlot === slotId) {
        setCurrentSaveSlot(null);
      }
    } catch(e){}
  };

  const triggerAutosave = () => {
    if (currentSaveSlot) {
      setTimeout(() => {
        handleSaveGame(currentSaveSlot, true);
      }, 200);
    }
  };

  const handleExitGame = () => {
    alertBanner("👋 ¡Gracias por jugar! Tu progreso se guarda automáticamente. Puedes cerrar esta pestaña de forma segura.");
    audio.playCasinoWin();
  };

  const renderSlotCard = (slotId: number, mode: 'new' | 'load') => {
    const _dummyValueUsingState = savesVersion;
    const data = getSaveSlotData(slotId);
    
    // Format played time
    const formatTimePlayed = (seconds?: number) => {
      if (!seconds) return '00:00';
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const hasSave = !!data;

    return (
      <div
        key={slotId}
        id={`save-slot-card-${slotId}`}
        onClick={() => {
          if (mode === 'new') {
            if (hasSave) {
              setSaveSlotSelectedConfirm(slotId);
            } else {
              handleResetGame(slotId);
            }
          } else {
            if (hasSave) {
              handleLoadGameBySlot(slotId);
            } else {
              alertBanner("💥 Slot vacío, comienza un nuevo juego primero.");
            }
          }
        }}
        className={`w-full text-left p-4 rounded-2xl border-2 transition relative flex flex-col gap-1.5 focus:outline-none cursor-pointer ${
          hasSave 
            ? 'bg-slate-900 border-amber-500 text-slate-100 shadow-[0_4px_12px_rgba(245,158,11,0.15)] hover:border-amber-400 hover:scale-[1.01]' 
            : 'bg-slate-950/40 border-slate-800 text-slate-400 border-dashed hover:border-slate-500 hover:text-slate-200'
        }`}
      >
        <div className="flex justify-between items-center w-full">
          <span className="font-sans font-black uppercase text-xs tracking-wider text-yellow-400">
            Slot {slotId}
          </span>
          {hasSave ? (
            <span className="text-[10px] bg-emerald-950 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded font-mono font-extrabold uppercase leading-none">
              Ocupado
            </span>
          ) : (
            <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-500 px-2 py-0.5 rounded font-mono font-extrabold uppercase leading-none animate-pulse">
              Disponible
            </span>
          )}
        </div>

        {hasSave ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-300">
            <div className="truncate">💵 Efectivo: <strong className="text-emerald-400 font-mono">${data.money}</strong></div>
            <div>📅 Día: <strong className="text-amber-400 font-mono">{data.day}</strong></div>
            <div className="truncate text-left flex items-center gap-1">🛵 Vehículo: <span className="font-bold">{VEHICLES_LIST.find(v => v.id === data.currentVehicleId)?.emoji || '🦶'} {VEHICLES_LIST.find(v => v.id === data.currentVehicleId)?.name || 'Pie'}</span></div>
            <div>🕒 Tiempo: <strong className="text-slate-450 font-mono">{formatTimePlayed(data.timePlayed)}</strong></div>
            {data.hasOwnPizzeria && (
              <div className="col-span-2 mt-1.5 pt-1.5 border-t border-slate-800 text-[10px] flex justify-between items-center text-amber-500">
                <span className="truncate max-w-[130px]">🏢 {data.pizzeriaName || 'Mi Pizzería'} (Lvl {data.renovationLevel})</span>
                <span className="font-bold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/40 font-mono text-[9px]">📊 Cuota: {data.playerMarketShare?.toFixed(1) || 0}%</span>
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center w-full text-[11px] text-slate-500 font-bold uppercase tracking-wider">
            + CREAR NUEVA PARTIDA
          </div>
        )}

        {hasSave && (
          <button
            title="Borrar Partida"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSlotToDeleteConfirm(slotId);
            }}
            className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-red-950/95 border-2 border-red-500 text-red-400 hover:bg-red-650 hover:text-white hover:scale-110 active:scale-95 transition-all duration-200 shadow-[0_4px_12px_rgba(239,68,68,0.35)] cursor-pointer z-20 flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  // Rent details
  const nextRentDay = Math.ceil(day / 3) * 3;
  const nextRentAmount = Math.floor(nextRentDay / 3) * 500;
  const daysUntilNextRent = nextRentDay - day;
  const totalRentSecondsRemaining = (daysUntilNextRent * 60) + dayTimeLeft;

  const formatTimeRemaining = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
            {chapter !== 3 && (
              <div className="bg-white border-2 border-sky-400 p-1.5 px-4 rounded-2xl flex items-center gap-2 shadow-sm text-sky-950 font-bold">
                <span className="text-xl">{currentVehicle.emoji}</span>
                <div>
                  <p className="text-[9px] uppercase text-sky-500 font-extrabold tracking-wider leading-none">Vehículo</p>
                  <p className="text-xs font-black leading-none mt-0.5 truncate max-w-[120px] text-sky-600">{currentVehicle.name}</p>
                </div>
              </div>
            )}

            {/* Days Box */}
            {chapter !== 3 && (
              <div className="bg-orange-50 border-2 border-orange-400 p-1.5 px-4 rounded-2xl flex items-center gap-2 shadow-sm text-yellow-950 font-bold" title={hasOwnPizzeria ? '¡Eres dueño de la pizzería!' : `Próximo pago de renta: $${nextRentAmount}`}>
                <Calendar className="w-5 h-5 text-orange-550 font-bold" />
                <div>
                  <p className="text-[9px] uppercase text-orange-600 font-extrabold tracking-wider leading-none">Día {day}</p>
                  <p className="font-mono text-xs font-black leading-none mt-0.5 text-orange-500">
                    {hasOwnPizzeria ? (
                      <span className="text-emerald-600 font-sans font-bold">🏢 Negocio Propio (Renta $0)</span>
                    ) : (
                      <span>Próxima renta ($${nextRentAmount}) en: {formatTimeRemaining(totalRentSecondsRemaining)}</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Fails Box */}
            {chapter !== 3 && (
              <div className={`p-1.5 px-4 rounded-2xl flex items-center gap-2 shadow-sm border-2 font-bold ${
                failures >= 2 ? 'bg-red-100 border-red-400 text-red-950' : 'bg-pink-50 border-pink-300 text-pink-950'
              }`}>
                <ShieldAlert className="w-5 h-5 text-pink-500" />
                <div>
                  <p className="text-[9px] uppercase text-pink-600 font-extrabold tracking-wider leading-none">Fallos</p>
                  <p className="font-mono text-xs font-black leading-none mt-0.5 text-pink-700">📦 {failures} / 3</p>
                </div>
              </div>
            )}

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
            <>
              {chapter === 3 && insideRegionId !== null && (
                <button
                  id="return-global-map-hud-btn"
                  onClick={handleExitRegion}
                  className="bg-red-550 hover:bg-red-600 text-white font-black text-xs py-2.5 px-3.5 rounded-xl shadow-[0_4px_0_rgb(153,27,27)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_rgb(153,27,27)] transition-all flex items-center gap-1.5 border-2 border-red-605 cursor-pointer"
                  title="Volver al mapa global"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-white" />
                  <span>Volver al mapa global</span>
                </button>
              )}

              <button
                id="pause-game-hud-btn"
                onClick={() => {
                  setIsPaused(prev => !prev);
                  audio.playUpgrade();
                }}
                className="bg-sky-500 hover:bg-sky-600 text-white font-black text-xs py-2.5 px-3.5 rounded-xl shadow-[0_4px_0_rgb(3,105,161)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_rgb(3,105,161)] transition-all flex items-center gap-1.5 border-2 border-sky-600 cursor-pointer"
                title="Pausar juego"
              >
                <Pause className="w-3.5 h-3.5 fill-sky-200 text-sky-200" />
                <span>Pausa</span>
              </button>

              {chapter !== 3 && (
                <button
                  id="permanent-upgrades-hud-btn"
                  onClick={() => setIsUpgradesOpen(true)}
                  className="bg-pink-500 hover:bg-pink-600 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-[0_4px_0_rgb(190,24,93)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_rgb(190,24,93)] transition-all flex items-center gap-1.5 border-2 border-pink-600 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-pink-200" />
                  Upgrade Habilidad
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* MOBILE DISPLAY STATS */}
      {gameState === 'playing' && chapter !== 3 && (
        <section className="bg-white border-b-2 border-yellow-400 p-2 text-[10px] flex justify-around items-center md:hidden font-sans font-bold text-gray-700">
          <span>💵 <strong className="text-emerald-600 font-black">${money}</strong></span>
          <span>{currentVehicle.emoji} {currentVehicle.name}</span>
          <span>📅 Día {day} ({hasOwnPizzeria ? '🏢 Imperio' : `Renta ($${nextRentAmount}) en: ${formatTimeRemaining(totalRentSecondsRemaining)}`})</span>
          <span className="text-pink-650">⚠️ Fallos: {failures}/3</span>
        </section>
      )}

      {/* 2. DYNAMIC GAME AREA PANEL */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 flex flex-col justify-center relative overflow-hidden">
        
        {/* COMPARTIDA DE COMPETENCIA BAR */}
        {hasOwnPizzeria && chapter !== 3 && (
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
          <div className="relative w-full max-w-lg mx-auto p-1 z-10 transition-all duration-300">
            {/* Parallax Cosmic Background */}
            <div className="absolute inset-x-[-12px] inset-y-[-12px] bg-slate-950 pointer-events-none overflow-hidden rounded-[40px] border-4 border-slate-800 shadow-2xl z-0">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-955 via-slate-900 to-slate-955" />
              {/* Star particles */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-1/5 left-1/4 w-1.5 h-1.5 bg-yellow-300 rounded-full animate-pulse" />
                <div className="absolute top-1/3 left-3/4 w-1 h-1 bg-yellow-250 rounded-full animate-ping" />
                <div className="absolute top-2/3 left-1/5 w-1 h-1 bg-white rounded-full animate-pulse" />
                <div className="absolute top-1/2 left-2/3 w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                <div className="absolute top-10 left-10 w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-1 h-1 bg-yellow-200 rounded-full animate-ping animate-pulse" />
              </div>
              <span className="absolute -left-6 top-1/4 text-6xl opacity-10 rotate-12 animate-bounce flex flex-col gap-8">
                <span>🍕</span>
                <span>🚁</span>
              </span>
              <span className="absolute -right-6 bottom-1/4 text-6xl opacity-10 -rotate-12 animate-pulse flex flex-col gap-10">
                <span>🛵</span>
                <span>🏪</span>
              </span>
              {/* Bottom stylized grid */}
              <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-slate-900 to-transparent opacity-45" />
            </div>

            <div className="relative z-10 p-6 md:p-8 space-y-6 text-center select-none">
              {menuScreen === 'main' && (
                <>
                  <div className="space-y-1.5">
                    <span className="text-[10px] tracking-widest font-extrabold text-amber-500 uppercase bg-amber-950/50 border border-amber-900/50 p-1 px-3.5 rounded-full inline-block">
                      🏁 ISLA DELIVERY ARCADE • CAPÍTULOS 1 & 2
                    </span>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-amber-400 via-orange-500 to-red-650 leading-none py-1">
                      PEDILO YA
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                      Magnate Repartidor de Pizzas
                    </p>
                  </div>

                  <hr className="border-slate-800" />

                  {/* Buttons Option Layout */}
                  <div className="space-y-3 pt-2">
                    {/* CONTINUAR BUTTON */}
                    {hasAnySaveGame() && (
                      <button
                        id="menu-btn-continuar"
                        onClick={() => {
                          const slot = getMostRecentSaveSlot();
                          if (slot) {
                            handleLoadGameBySlot(slot);
                          }
                        }}
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-550 text-white font-black py-4 px-6 rounded-2xl shadow-[0_5px_0_rgb(6,95,70)] active:translate-y-0.5 active:shadow-[0_1px_0_rgb(6,95,70)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 font-sans cursor-pointer text-xs uppercase tracking-wider border border-emerald-400"
                      >
                        <Play className="w-4 h-4 fill-white animate-pulse" />
                        <span>Continuar</span>
                      </button>
                    )}

                    {/* NUEVA PARTIDA BUTTON */}
                    <button
                      id="menu-btn-nueva-partida"
                      onClick={() => {
                        audio.playUpgrade();
                        setMenuScreen('slots_new');
                      }}
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-550 text-white font-black py-4 px-6 rounded-2xl shadow-[0_5px_0_rgb(146,64,14)] active:translate-y-0.5 active:shadow-[0_1px_0_rgb(146,64,14)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 font-sans cursor-pointer text-xs uppercase tracking-wider border border-orange-400"
                    >
                      <Sparkles className="w-4 h-4 text-orange-250 fill-orange-255" />
                      <span>Nueva Partida</span>
                    </button>

                    {/* CARGAR PARTIDA BUTTON */}
                    <button
                      id="menu-btn-cargar-partida"
                      onClick={() => {
                        audio.playUpgrade();
                        setMenuScreen('slots_load');
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-850 text-slate-100 font-black py-3.5 px-6 rounded-2xl shadow-[0_4px_0_rgb(15,23,42)] active:translate-y-0.5 active:shadow-none hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 font-sans cursor-pointer text-xs uppercase border border-slate-800"
                    >
                      <Save className="w-4 h-4 text-slate-400" />
                      <span>Cargar Partida</span>
                    </button>

                    {/* CONFIGURACION BUTTON */}
                    <button
                      id="menu-btn-configuracion"
                      onClick={() => {
                        audio.playUpgrade();
                        setMenuScreen('config');
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-850 text-slate-100 font-black py-3.5 px-6 rounded-2xl shadow-[0_4px_0_rgb(15,23,42)] active:translate-y-0.5 active:shadow-none hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 font-sans cursor-pointer text-xs uppercase border border-slate-800"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Configuración</span>
                    </button>

                    {/* SALIR BUTTON */}
                    <button
                      id="menu-btn-salir"
                      onClick={() => {
                        handleExitGame();
                      }}
                      className="w-full bg-slate-950/50 hover:bg-slate-900 text-slate-500 font-bold py-2 px-6 rounded-xl hover:text-slate-300 transition-all flex items-center justify-center gap-2 font-sans cursor-pointer text-[11px] uppercase tracking-wide"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Salir</span>
                    </button>
                  </div>
                </>
              )}

              {/* SLOTS NEW GAME VIEW */}
              {menuScreen === 'slots_new' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-left">
                    <button
                      onClick={() => setMenuScreen('main')}
                      className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="text-lg font-black text-slate-100 uppercase leading-none">Nueva Partida</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Elige en qué slot quieres guardar la partida</p>
                    </div>
                  </div>

                  <hr className="border-slate-800" />

                  {/* Slots Grid */}
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {[1, 2, 3, 4, 5].map(idx => renderSlotCard(idx, 'new'))}
                  </div>
                </div>
              )}

              {/* SLOTS LOAD GAME VIEW */}
              {menuScreen === 'slots_load' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-left">
                    <button
                      onClick={() => setMenuScreen('main')}
                      className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="text-lg font-black text-slate-100 uppercase leading-none">Cargar Partida</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Selecciona la partida que deseas jugar</p>
                    </div>
                  </div>

                  <hr className="border-slate-800" />

                  {/* Slots Grid */}
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {[1, 2, 3, 4, 5].map(idx => renderSlotCard(idx, 'load'))}
                  </div>
                </div>
              )}

              {/* CONFIGURATION PANEL SCREEN */}
              {menuScreen === 'config' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-left">
                    <button
                      onClick={() => setMenuScreen('main')}
                      className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="text-lg font-black text-slate-100 uppercase leading-none">Configuración</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Ajusta el sonido y pantalla de visualización</p>
                    </div>
                  </div>

                  <hr className="border-slate-800" />

                  {/* Sliders Area */}
                  <div className="space-y-5 text-left bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
                    {/* Music Volume control */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-[11px] font-black text-slate-200">
                        <span>🎶 VOLUMEN DE MÚSICA DE FONDO</span>
                        <span className="font-mono text-amber-400">{Math.round(musicVol * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={musicVol}
                        onChange={(e) => setMusicVol(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    {/* SFX Volume control */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-[11px] font-black text-slate-200">
                        <span>🔊 VOLUMEN DE EFECTOS SONOROS</span>
                        <span className="font-mono text-amber-400">{Math.round(sfxVol * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={sfxVol}
                        onChange={(e) => setSfxVol(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    {/* Screen Toggle */}
                    <div className="flex justify-between items-center bg-slate-950/80 p-3 rounded-xl border border-slate-850 mt-4">
                      <div className="text-[11px] font-black text-slate-200">
                        <span>🖥️ PANTALLA COMPLETA</span>
                        <p className="text-[9px] font-semibold text-slate-500 uppercase mt-0.5">Alternar pantalla completa de ventana</p>
                      </div>
                      <button
                        onClick={() => {
                          audio.playUpgrade();
                          if (!document.fullscreenElement) {
                            document.documentElement.requestFullscreen().catch(() => {});
                          } else {
                            document.exitFullscreen().catch(() => {});
                          }
                        }}
                        className={`px-4 py-2 font-black rounded-xl text-[10px] uppercase transition cursor-pointer ${
                          isFullscreen 
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-black' 
                            : 'bg-slate-800 text-slate-350 hover:bg-slate-750'
                        }`}
                      >
                        {isFullscreen ? "Activada" : "Desactivada"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CONFIRM SLOT OVERWRITE ALERT OVERLAY */}
            {saveSlotSelectedConfirm !== null && (
              <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-slate-950 border-2 border-red-500 p-6 rounded-3xl max-w-sm w-full space-y-4 text-center shadow-2xl relative">
                  <div className="mx-auto w-12 h-12 rounded-full bg-red-950 flex items-center justify-center border border-red-500 text-red-500 text-2xl animate-bounce">
                    ⚠️
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-md font-black text-slate-150 uppercase">¿Quieres reemplazar la partida?</h4>
                    <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                      Este slot ya contiene una partida guardada. ¿Deseas reemplazarla y comenzar una nueva aventura? Se borrarán todos los datos anteriores.
                    </p>
                  </div>
                  <div className="flex gap-2.5 pt-2">
                    <button
                      onClick={() => setSaveSlotSelectedConfirm(null)}
                      className="w-1/2 py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl font-bold text-xs uppercase text-slate-400 tracking-wider transition cursor-pointer"
                    >
                      No, Cancelar
                    </button>
                    <button
                      onClick={() => {
                        const slot = saveSlotSelectedConfirm;
                        setSaveSlotSelectedConfirm(null);
                        handleResetGame(slot);
                      }}
                      className="w-1/2 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-[0_3px_0_rgb(153,27,27)] active:translate-y-0.5 active:shadow-none border border-red-500"
                    >
                      Sí, Reemplazar
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                      ? 'Sin pedidos activos. Diríjase a su Base Propia siguiendo la flecha orientadora.' 
                      : 'Sin pedidos activos. Siga la flecha flotante hacia la Pizzería central.'}
                  </span>
                </div>
              )}
            </div>

            {/* Visual Screen instructions */}
            <div className="absolute top-1 right-2 bg-slate-900/60 p-1 px-2.5 rounded-lg text-[9px] font-mono text-slate-200 z-10 select-none">
              Movimiento: [W,S,A,D] o Flechas | [Espacio] interactuar
            </div>

            {/* Canvas 3D Area */}
            <div className="w-full flex-1 h-[700px] max-h-[820px] min-h-[480px] rounded-3xl relative border-4 border-white/60 shadow-lg overflow-hidden">
              {/* KONAMI SPEED BOOST HUD OVERLAY */}
              {konamiSpeedTimer > 0 && (
                <div 
                  id="konami-cheat-hud" 
                  className="absolute top-3 right-3 z-35 bg-amber-500 text-slate-950 font-black p-2.5 px-4 rounded-2xl shadow-2xl border border-amber-400 select-none animate-bounce flex items-center gap-2 text-xs uppercase tracking-wider"
                >
                  <span className="text-base animate-pulse">💨</span>
                  <div>
                    <span className="font-sans font-black">SUPER VELOCIDAD TRUCO</span>
                    <div className="font-mono text-[10px] bg-slate-950/20 px-1.5 py-0.5 rounded-md mt-0.5 flex items-center justify-center font-bold">
                      MULTIPLICADOR x4.0 • {konamiSpeedTimer.toFixed(1)}s
                    </div>
                  </div>
                </div>
              )}

              {/* COMPACT FLOATING TUTORIAL PANEL */}
              {((tutorialStep !== 'off' && tutorialStep !== 'completed') || 
                (businessTutorialStep !== 'off' && businessTutorialStep !== 'completed')) && (
                <div id="tutorial-hud-card" className="absolute top-3 left-3 z-35 max-w-[210px] sm:max-w-[270px] md:max-w-[310px] bg-slate-950/80 backdrop-blur-md border-2 border-amber-500/80 rounded-2xl p-2.5 sm:p-3 shadow-2xl text-left text-white select-none transition-all duration-200">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center gap-2">
                      <h4 className="font-sans font-black text-amber-400 text-[10px] sm:text-xs uppercase tracking-wider flex items-center gap-1.5 leading-none">
                        <span>🎓 Guía</span>
                        <span className="bg-amber-500/20 text-yellow-300 text-[9px] font-mono px-1.5 py-0.5 rounded border border-amber-500/20 leading-none">
                          {tutorialStep !== 'off' && tutorialStep !== 'completed' ? (
                            <>
                              {tutorialStep === 'pizzeria' && 'Paso 1/4'}
                              {tutorialStep === 'delivery' && 'Paso 2/4'}
                              {tutorialStep === 'concesionario' && 'Paso 3/4'}
                              {tutorialStep === 'casino' && 'Paso 4/4'}
                            </>
                          ) : (
                            <>
                              {businessTutorialStep === 'upgrades' && 'Gestión 1/3'}
                              {businessTutorialStep === 'competition' && 'Gestión 2/3'}
                              {businessTutorialStep === 'staff' && 'Gestión 3/3'}
                            </>
                          )}
                        </span>
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          id="btn-toggle-tutorial-minimize"
                          onClick={() => setIsTutorialMinimized(!isTutorialMinimized)}
                          className="text-[9px] font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 p-0.5 px-2 rounded cursor-pointer transition select-none flex items-center leading-none"
                          title={isTutorialMinimized ? "Expandir guía" : "Minimizar guía"}
                        >
                          {isTutorialMinimized ? "Expandir" : "Minimizar"}
                        </button>
                        <button
                          id="btn-close-tutorial"
                          onClick={() => {
                            if (tutorialStep !== 'off' && tutorialStep !== 'completed') {
                              setTutorialStep('off');
                              localStorage.setItem('tutorial_shown', 'true');
                            } else {
                              setBusinessTutorialStep('off');
                              localStorage.setItem('business_shown', 'true');
                            }
                            audio.playRentPay();
                            alertBanner("Asistencia desactivada.");
                          }}
                          className="text-[9px] font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 p-0.5 px-1.5 rounded cursor-pointer transition select-none leading-none"
                          title="Cerrar guía"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {!isTutorialMinimized && (
                      <p className="text-[10px] sm:text-xs text-slate-200 leading-snug font-semibold">
                        {tutorialStep !== 'off' && tutorialStep !== 'completed' ? (
                          <>
                            {tutorialStep === 'pizzeria' && 'Ve a la pizzería central (marcada con el indicador dorado) y pulsa Espacio en la entrada para recibir tu primer pedido.'}
                            {tutorialStep === 'delivery' && 'Entrega el pedido en la casa señalada con el indicador verde, y pulsa Espacio al llegar.'}
                            {tutorialStep === 'concesionario' && 'Sigue la flecha hacia el indicador azul en la tienda para adquirir un vehículo útil.'}
                            {tutorialStep === 'casino' && 'Sigue la flecha hacia el indicador morado del casino para completar tu aprendizaje.'}
                          </>
                        ) : (
                          <>
                            {businessTutorialStep === 'upgrades' && 'Dirígete a tu base (indicador rosa) y pulsa Espacio para desbloquear mejoras de cocina.'}
                            {businessTutorialStep === 'competition' && 'Gana cuota de mercado entregando pedidos y contratando personal autónomo.'}
                            {businessTutorialStep === 'staff' && 'Contrata personal autónomo para que genere ingresos pasivos de manera continua.'}
                          </>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}
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
                chapter={chapter}
                insideRegionId={insideRegionId}
                onClickRegion={triggerEnterRegionSequence}
                tutorialStep={tutorialStep}
                businessTutorialStep={businessTutorialStep}
                onPlayerMove={(x, y, a) => {
                  setPlayerX(x);
                  setPlayerY(y);
                  setPlayerAngle(a);
                }}
                onInteract={(zone) => {
                  if (tutorialStep === 'concesionario' && zone === 'concesionario') {
                    setTutorialStep('casino');
                    alertBanner("🚲 ¡EXCELENTE! Llegaste a la Tienda de Vehículos. Ahora dirígete al Casino guiándote con el indicador violeta.");
                    audio.playUpgrade();
                  } else if (tutorialStep === 'casino' && zone === 'casino') {
                    setTutorialStep('completed');
                    setShowTutorialEndModal(true);
                    audio.playCasinoWin();
                  }
                }}
                onEnterCorner={(index) => {
                  if (!hasOwnPizzeria && !isEscapeAsking && currentVehicleId === 'helicoptero') {
                    setIsEscapeAsking(true);
                  }
                }}
              />

              {/* Chapter 3 Territory HUD Overlay */}
              {chapter === 3 && insideRegionId === null && (
                (() => {
                  const activeTerritory = getTerritoryAt(playerX, playerY);
                  if (!activeTerritory) return null;
                  return (
                    <div 
                      id="territory-hud"
                      onClick={() => triggerEnterRegionSequence(activeTerritory.id)}
                      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-45 bg-slate-950/90 backdrop-blur-md border-4 rounded-3xl p-4 px-6 shadow-2xl text-center select-none flex flex-col items-center gap-1.5 min-w-[280px] sm:min-w-[340px] cursor-pointer hover:scale-[1.03] active:scale-95 transition-all animate-bounce"
                      style={{ borderColor: activeTerritory.color }}
                      title="Haz click o presiona ESPACIO para ingresar"
                    >
                      <span className="text-xl">📍</span>
                      <div>
                        <h3 
                          className="text-sm sm:text-base font-black tracking-tight"
                          style={{ color: activeTerritory.accent }}
                        >
                          {activeTerritory.name.toUpperCase()}
                        </h3>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">
                          Territorio de Operación (Haz click para ingresar)
                        </p>
                      </div>
                      <div className="w-full h-[1px] bg-slate-800 my-1" />
                      <p className="text-xs font-black text-white flex items-center gap-1.5">
                        Presiona <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded text-[10px] font-extrabold font-mono">ESPACIO</span> o <span className="text-amber-400 underline font-extrabold font-sans">haz click aquí</span>
                      </p>
                    </div>
                  );
                })()
              )}

              {/* Chapter 3 Inside Territory HUD Overlay */}
              {chapter === 3 && insideRegionId !== null && (
                (() => {
                  const reg = TERRITORIES.find(r => r.id === insideRegionId);
                  if (!reg) return null;
                  return (
                    <div 
                      id="territory-inside-hud"
                      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-45 bg-slate-950/90 backdrop-blur-md border-4 rounded-3xl p-3 px-5 shadow-2xl text-center select-none flex flex-col items-center gap-1 min-w-[280px] sm:min-w-[340px]"
                      style={{ borderColor: reg.color }}
                    >
                      <span className="text-xl animate-pulse">🛠️</span>
                      <div>
                        <h3 
                          className="text-sm sm:text-base font-black tracking-tight"
                          style={{ color: reg.accent }}
                        >
                          {reg.name.toUpperCase()} (MÉTODO DE PRUEBA)
                        </h3>
                        <p className="text-[9px] text-slate-350 font-extrabold uppercase tracking-widest leading-none mt-0.5">
                          Simulador Temporal de Capítulo 3
                        </p>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}


        {/* GAME OVER VIEW */}
        {gameState === 'gameover' && (
          <div className="bg-slate-900 rounded-[32px] border-4 border-red-500 p-8 max-w-md mx-auto text-center space-y-6 text-white shadow-2xl relative overflow-hidden">
            <div className="text-5xl animate-spin">💀💀</div>
            <h2 className="text-3.5xl font-black uppercase text-red-505 tracking-tight font-serif">¡PARTIDA PERDIDA!</h2>

            <div className="p-5 rounded-2xl bg-slate-955 border border-red-500/20 text-left space-y-3.5 font-sans">
              <div className="space-y-1">
                <h4 className="text-[10px] font-extrabold uppercase text-red-400 tracking-wider">Causa de la derrota:</h4>
                <p className="text-sm font-black text-rose-500 leading-tight">
                  {gameOverReason === 'failures' && 'Has acumulado 3 entregas fallidas.'}
                  {gameOverReason === 'rent' && 'No tenías suficiente dinero para pagar la renta.'}
                  {gameOverReason === 'competition' && 'La pizzería rival alcanzó el 100% del mercado.'}
                  {gameOverReason === 'none' && 'Has quebrado por falta de recursos o de organización.'}
                </p>
              </div>

              <hr className="border-slate-800" />

              <div className="space-y-2 text-xs font-semibold text-slate-300">
                <p className="flex justify-between items-center">
                  <span>📅 Día alcanzado:</span>
                  <strong className="text-white font-mono">Día {day}</strong>
                </p>
                <p className="flex justify-between items-center font-semibold">
                  <span>💵 Dinero final:</span>
                  <strong className="text-emerald-450 font-mono">${money}</strong>
                </p>
                <p className="flex justify-between items-center">
                  <span>🚗 Vehículo utilizado:</span>
                  <strong className="text-sky-400 font-sans font-extrabold">{currentVehicle.emoji} {currentVehicle.name}</strong>
                </p>
                <p className="flex justify-between items-center">
                  <span>🍕 Entregas completadas:</span>
                  <strong className="text-green-400 font-mono">{completedOrdersCount}</strong>
                </p>
                <p className="flex justify-between items-center">
                  <span>⚠️ Entregas fallidas:</span>
                  <strong className="text-red-450 font-mono">{failures} / 3</strong>
                </p>
                {hasOwnPizzeria && (
                  <p className="flex justify-between items-center">
                    <span>🏢 Cuota de mercado final:</span>
                    <strong className="text-pink-400 font-mono">{playerMarketShare.toFixed(1)}%</strong>
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleResetGame}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl transition shadow-[0_4px_0_rgb(153,27,27)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_rgb(153,27,27)] cursor-pointer text-xs"
            >
              <RotateCcw className="w-4 h-4 inline shrink-0 mr-1" /> REINTENTAR PARTIDA
            </button>
          </div>
        )}


        {/* VICTORY VICTORY SCREEN */}
        {gameState === 'victory' && (
          <div className="bg-gradient-to-r from-purple-900 via-pink-900 to-amber-900 text-white rounded-[32px] border-4 border-yellow-300 p-8 max-w-lg mx-auto text-center space-y-6 shadow-2xl animate-fade-in relative">
            {victoryEnding === 'escape' ? (
              <>
                <div className="text-6.5xl animate-bounce">🚁🏆👑</div>
                <h2 className="text-yxl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-250 font-serif uppercase text-3xl sm:text-4xl">¡VUELO DE ESCAPE LOGRADO!</h2>
                <p className="text-sm font-semibold text-slate-200">¡Lograste comprar el helicóptero privado, reuniste la billetera de capital necesaria y superaste la renta de la Isla para escapar volando del circuito!</p>
              </>
            ) : (
              <>
                <div className="text-6.5xl animate-bounce">🏝️🍕👑</div>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-250 font-serif uppercase">¡REY DE LA ISLA!</h2>
                <p className="text-sm font-semibold text-slate-200">¡Compraste la pizzería abandonada, derrotaste a tu rival y decidiste quedarte en la isla! Declaraste el monopolio total del imperio pizzero como el indiscutible Rey Supremo.</p>
              </>
            )}

            <div className="p-5 rounded-2xl bg-black/40 text-left font-sans text-xs space-y-2 border border-white/10 select-none">
              <h4 className="font-extrabold text-sm text-yellow-300">Resumen del Magnate Repartidor:</h4>
              <p>🚀 Destino: <strong>{victoryEnding === 'escape' ? 'Fugitivo con Helicóptero Privado' : 'Establecido como Amo de la Isla'}</strong></p>
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
        tutorialStep={tutorialStep}
      />

      {/* 2. Concesionario modal */}
      <ConcesionarioModal
        isOpen={isDealerOpen}
        onClose={closeAllModals}
        currentVehicleId={currentVehicleId}
        money={money}
        onBuyVehicle={handleBuyVehicle}
        tutorialStep={tutorialStep}
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
        tutorialStep={tutorialStep}
      />

      {/* 4. GAME PAUSE MODAL OVERLAY */}
      {isPaused && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in text-center">
          <div className="bg-slate-900 border-4 border-sky-400 p-8 max-w-sm w-full rounded-2xl space-y-6 text-center shadow-2xl relative select-none">
            <div className="space-y-1.5">
              <span className="text-[10px] tracking-widest font-extrabold text-sky-400 uppercase bg-sky-950/50 px-3.5 py-1 rounded-full border border-sky-900 inline-block">
                ⏸️ JUEGO EN PAUSA
              </span>
              <h3 className="text-2xl font-black text-slate-100 uppercase mt-2 font-serif">Menú de Pausa</h3>
              {currentSaveSlot ? (
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Slot {currentSaveSlot} • Guardado activo</p>
              ) : (
                <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider animate-pulse">⚠️ Sin slot asignado (Guardado inactivo)</p>
              )}
            </div>

            <hr className="border-slate-800" />

            <div className="space-y-3 text-center">
              {/* CONTINUAR JUEGO (RESUME) */}
              <button
                id="pause-btn-resume"
                onClick={() => {
                  setIsPaused(false);
                  audio.playUpgrade();
                }}
                className="w-full bg-sky-500 hover:bg-sky-450 text-white font-black py-3 rounded-xl shadow-[0_4px_0_rgb(3,105,161)] active:translate-y-0.5 active:shadow-none hover:-translate-y-0.5 transition-all text-xs tracking-wider uppercase cursor-pointer border border-sky-450"
              >
                Volver al Juego
              </button>

              {/* SAVING OPTION */}
              <button
                id="pause-btn-save"
                onClick={() => {
                  if (currentSaveSlot) {
                    handleSaveGame(currentSaveSlot);
                  } else {
                    alertBanner("❌ No hay un slot asignado a la partida actual");
                  }
                }}
                disabled={!currentSaveSlot}
                className={`w-full font-black py-3 rounded-xl transition-all text-xs uppercase cursor-pointer border ${
                  currentSaveSlot 
                    ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border-slate-700 shadow-sm' 
                    : 'bg-slate-900 text-slate-600 border-slate-850 cursor-not-allowed opacity-50'
                }`}
              >
                Guardar Partida
              </button>

              {/* LIVE SETTINGS AREA FOR PAUSE MENU */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3.5 text-left">
                {/* Music Volume control */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-black text-slate-400">
                    <span>MÚSICA DE FONDO</span>
                    <span className="font-mono text-sky-400">{Math.round(musicVol * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={musicVol}
                    onChange={(e) => setMusicVol(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>

                {/* SFX Volume control */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-black text-slate-400">
                    <span>EFECTOS DE SONIDO</span>
                    <span className="font-mono text-sky-400">{Math.round(sfxVol * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={sfxVol}
                    onChange={(e) => setSfxVol(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>

                {/* Fullscreen inside pause */}
                <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-2 rounded-xl text-[10px] text-slate-300 font-bold leading-none mt-2">
                  <span>PANTALLA COMPLETA</span>
                  <button
                    onClick={() => {
                      audio.playUpgrade();
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(() => {});
                      } else {
                        document.exitFullscreen().catch(() => {});
                      }
                    }}
                    className={`px-3 py-1 font-extrabold rounded-lg text-[9px] uppercase transition cursor-pointer ${
                      isFullscreen 
                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-400' 
                        : 'bg-slate-850 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {isFullscreen ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              {/* RETURN TO MAIN MENU */}
              <button
                id="pause-btn-mainmenu"
                onClick={() => {
                  audio.playUpgrade();
                  setShowExitToMenuConfirm(true);
                }}
                className="w-full bg-slate-950 hover:bg-slate-900 text-red-500 border border-red-950 font-bold py-2.5 rounded-xl transition text-[10px] uppercase cursor-pointer"
              >
                Volver al Menú Principal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4.5 Tutorial End Modal */}
      {showTutorialEndModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-amber-500 rounded-[2rem] p-8 sm:p-10 max-w-2xl w-full shadow-[0_0_50px_rgba(245,158,11,0.35)] text-center flex flex-col gap-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600"></div>
            
            <div className="flex flex-col items-center gap-3">
              <span className="text-6xl animate-bounce">🎓🍕🏆</span>
              <h2 className="text-2xl sm:text-3xl font-black text-amber-400 font-sans tracking-wide uppercase">
                ¡TUTORIAL COMPLETADO!
              </h2>
            </div>

            <p className="text-lg sm:text-2xl font-semibold text-slate-100 leading-relaxed font-sans text-center tracking-normal px-2">
              ya conoces las mecanicas basicas del juego, ahora reparti pizzas, paga tu renta cada 3 dias y compra el helicoptero para escapar de la isla o iniciar tu propio negocio en la pizzeria abandonada. Suerte!
            </p>

            <div className="flex justify-center mt-4">
              <button
                id="btn-close-tutorial-end"
                onClick={() => {
                  setShowTutorialEndModal(false);
                  audio.playSuccess();
                }}
                className="px-10 py-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-lg rounded-2xl transition-all duration-150 shadow-[0_6px_25px_rgba(245,158,11,0.4)] uppercase cursor-pointer hover:scale-[1.03] active:scale-[0.98]"
              >
                ¡Entendido, a Repartir!
              </button>
            </div>
          </div>
        </div>
      )}

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
        businessTutorialStep={businessTutorialStep}
        onSetBusinessTutorialStep={setBusinessTutorialStep}
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
                  setTutorialStep('off'); // Force close initial tutorial if active
                  setPlayerMarketShare(20);
                  setRenovationLevel(0);
                  setIsBuyPizzeriaOpen(false);
                  setBusinessDaysHeld(0);
                  setRivalPassiveRate(2);
                  setIsCustomizationOpen(true); // Open branding screen!
                  alertBanner("🏠 ¡IMPERIO COMIENZA! Adquiriste la Pizzería Abandonada ($10,000). Define la identidad visual de tu marca.");
                  audio.playCasinoWin();
                  triggerAutosave();
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
                  startChapter3TransitionSequence();
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
                  setVictoryEnding('island_retire');
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
                    } else if (passwordInput === 'skibidi') {
                      setPlayerMarketShare(100);
                      setIsCheatOpen(false);
                      setPasswordInput('');
                      alertBanner("🔑 CÓDIGO ACTIVO: ¡Tu competencia ha capitulado! Tienes el 100% de la participación de mercado.");
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
                  } else if (passwordInput === 'skibidi') {
                    setPlayerMarketShare(100);
                    setIsCheatOpen(false);
                    setPasswordInput('');
                    alertBanner("🔑 CÓDIGO ACTIVO: ¡Tu competencia ha capitulado! Tienes el 100% de la participación de mercado.");
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
          onClose={() => {
            setIsCustomizationOpen(false);
            setBusinessTutorialStep('prompt');
          }}
          onSave={(name, color) => {
            setPizzeriaName(name);
            setPizzeriaColor(color);
            setIsCustomizationOpen(false);
            setBusinessTutorialStep('prompt');
          }}
          initialName={pizzeriaName}
          initialColor={pizzeriaColor}
        />
      )}

      {/* 8. Initial Tutorial Invite Dialog */}
      {tutorialStep === 'prompt' && gameState === 'playing' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-amber-600 p-8 rounded-3xl max-w-sm w-full shadow-2xl text-slate-100 flex flex-col gap-5 text-center">
            <div>
              <span className="text-5xl inline-block animate-bounce">🎓</span>
              <h3 className="text-lg font-black text-amber-500 font-sans uppercase mt-3">Guía de Introducción</h3>
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Procedimiento de adiestramiento operativo</p>
            </div>

            <p className="text-xs text-slate-350 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800 text-left font-medium">
              Recomendamos iniciar el adiestramiento para familiarizarse con las mecánicas fundamentales (Gestión de pedidos, adquisición de vehículos y visita al casino).
              <br /><br />
              <span className="text-amber-500 font-bold">⚠️ SUSPENSIÓN TEMPORAL DE RENTAS</span>:
              Mientras la guía permanezca activa, el contador diario de rentas y las penalizaciones de tiempo estarán completamente suspendidos para permitir un aprendizaje óptimo.
            </p>

            <div className="flex gap-3 mt-1 font-bold">
              <button
                onClick={() => {
                  setTutorialStep('off');
                  localStorage.setItem('tutorial_shown', 'true');
                  audio.playRentPay();
                  alertBanner("Comienzo de operaciones sin guía.");
                }}
                className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-white text-xs font-black uppercase rounded-2xl transition cursor-pointer"
              >
                Declinar
              </button>
              <button
                onClick={() => {
                  setTutorialStep('pizzeria');
                  localStorage.setItem('tutorial_shown', 'true');
                  audio.playUpgrade();
                  alertBanner("Guía iniciada. Diríjase al objetivo indicado por la flecha.");
                }}
                className="w-1/2 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black uppercase rounded-2xl transition shadow-md cursor-pointer"
              >
                Aceptar Guía
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Business/Corporate Corporate Tutorial Invite Dialog */}
      {businessTutorialStep === 'prompt' && gameState === 'playing' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-pink-600 p-8 rounded-3xl max-w-sm w-full shadow-2xl text-slate-100 flex flex-col gap-5 text-center">
            <div>
              <span className="text-5xl inline-block animate-bounce">🏢</span>
              <h3 className="text-lg font-black text-pink-400 font-sans uppercase mt-3">Guía Administrativa</h3>
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Mecánicas de expansión empresarial</p>
            </div>

            <p className="text-xs text-slate-350 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800 text-left font-medium">
              Aprenderá las dinámicas de competencia de mercado que se activan tras la adquisición de su inmueble operativo.
              <br /><br />
              <span className="text-pink-400 font-bold">🛠️ ORIENTACIÓN ESTRATÉGICA</span>:
              Se le guiará a través del panel de control empresarial para optimizar su base de operaciones y reclutar personal de reparto calificado.
            </p>

            <div className="flex gap-3 mt-1 font-bold">
              <button
                onClick={() => {
                  setBusinessTutorialStep('off');
                  localStorage.setItem('business_shown', 'true');
                  audio.playRentPay();
                  alertBanner("Operaciones corporativas regulares activadas.");
                }}
                className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-black uppercase rounded-2xl transition cursor-pointer"
              >
                Declinar
              </button>
              <button
                onClick={() => {
                  setBusinessTutorialStep('upgrades');
                  localStorage.setItem('business_shown', 'true');
                  audio.playUpgrade();
                  setIsOwnPizzeriaOpen(true);
                  alertBanner("Módulo administrativo activado. Proceda con los requerimientos.");
                }}
                className="w-1/2 py-3 bg-pink-500 hover:bg-pink-600 text-white text-xs font-black uppercase rounded-2xl transition shadow-md cursor-pointer"
              >
                Aceptar Guía
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL SLOT DELETION ALERT OVERLAY */}
      {slotToDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-slate-950 border-2 border-red-500 p-6 rounded-3xl max-w-sm w-full space-y-4 text-center shadow-2xl relative select-none">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-950/50 flex items-center justify-center border border-red-500 text-red-500 text-2xl animate-bounce">
              🗑️
            </div>
            <div className="space-y-1">
              <h4 className="text-md font-black text-slate-100 uppercase">🚨 ¿Borrar Slot {slotToDeleteConfirm}?</h4>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed text-center">
                Esta acción es permanente e irreversible. Se perderá todo el progreso acumulado, dinero y mejoras de este slot.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setSlotToDeleteConfirm(null)}
                className="w-1/2 py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl font-bold text-xs uppercase text-slate-400 tracking-wider transition cursor-pointer"
              >
                No, Cancelar
              </button>
              <button
                onClick={() => {
                  const slot = slotToDeleteConfirm;
                  setSlotToDeleteConfirm(null);
                  handleDeleteSaveSlot(slot);
                }}
                className="w-1/2 py-2.5 bg-red-650 hover:bg-red-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-[0_3px_0_rgb(185,28,28)] active:translate-y-0.5 active:shadow-none border border-red-600"
              >
                Sí, Borrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXIT TO MAIN MENU CONFIRMATION OVERLAY */}
      {showExitToMenuConfirm && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-slate-950 border-2 border-amber-500 p-6 rounded-3xl max-w-sm w-full space-y-4 text-center shadow-2xl relative select-none">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-950/50 flex items-center justify-center border border-amber-500 text-amber-500 text-2xl animate-bounce">
              🚪
            </div>
            <div className="space-y-1">
              <h4 className="text-md font-black text-slate-100 uppercase">🚪 ¿Salir al Menú?</h4>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed text-center">
                Asegúrate de haber guardado tu progreso antes de salir. Todo progreso que no se haya guardado se perderá definitivamente.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowExitToMenuConfirm(false)}
                className="w-1/2 py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl font-bold text-xs uppercase text-slate-400 tracking-wider transition cursor-pointer"
              >
                No, Cancelar
              </button>
              <button
                onClick={() => {
                  setShowExitToMenuConfirm(false);
                  setIsPaused(false);
                  setGameState('menu');
                  setMenuScreen('main');
                }}
                className="w-1/2 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-[0_3px_0_rgb(146,64,14)] active:translate-y-0.5 active:shadow-none border border-amber-400"
              >
                Sí, Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHAPTER 3 TRANSITION OVERLAY */}
      {showChapter3Transition && (
        <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-xl z-[100] flex flex-col items-center justify-center p-6 select-none overflow-hidden font-sans">
          {/* Animated matrix / radial background glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12)_0%,rgba(0,0,0,0)_70%)] animate-pulse pointer-events-none" />
          <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent top-1/2 animate-pulse" />

          {/* Core Content Box with gorgeous cinematic presentation */}
          <div className="max-w-xl w-full text-center space-y-8 z-10 animate-fade-in">
            {/* Spinning global/hologram icon represent world domain */}
            <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-ping" />
              <div className="absolute inset-1.5 rounded-full border border-sky-400/20 animate-spin [animation-duration:8s]" />
              <div className="absolute inset-3 rounded-full bg-cyan-950/40 border-2 border-cyan-400/80 shadow-[0_0_24px_rgba(34,211,238,0.3)] flex items-center justify-center text-5xl">
                🌐
              </div>
            </div>

            {/* Title blocks */}
            <div className="space-y-2.5">
              <div className="text-cyan-400 font-extrabold tracking-[0.25em] text-xs uppercase animate-pulse">
                CAPÍTULO 3
              </div>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-150 tracking-widest font-serif uppercase bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                DOMINIO MUNDIAL
              </h2>
            </div>

            {/* Divider */}
            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mx-auto rounded-full" />

            {/* Description quote */}
            <p className="text-sm sm:text-base text-slate-350 italic font-medium leading-relaxed max-w-md mx-auto">
              "Has conquistado la isla. Es hora de expandir tu empresa y convertirte en una potencia mundial."
            </p>

            {/* Loading / Fading global lines status indicator */}
            <div className="pt-4 flex flex-col items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-bounce" />
              </div>
              <p className="text-[10px] text-cyan-600 font-black uppercase tracking-widest">
                CONECTANDO RED GLOBAL... ESPERE
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TERRITORY LANDING OVERLAY */}
      {landingRegionId !== null && (
        (() => {
          const reg = TERRITORIES.find(r => r.id === landingRegionId);
          if (!reg) return null;
          return (
            <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-xl z-[100] flex flex-col items-center justify-center p-6 select-none overflow-hidden font-sans">
              {/* Radial glow styled with region accent/color */}
              <div 
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(circle at center, ${reg.color} 0%, rgba(0,0,0,0) 75%)`,
                  animation: 'pulse 3s infinite'
                }}
              />
              <div 
                className="absolute inset-x-0 h-0.5 opacity-30"
                style={{
                  background: `linear-gradient(to right, transparent, ${reg.accent}, transparent)`,
                  top: '50%',
                  animation: 'pulse 1.5s infinite'
                }}
              />

              {/* Core Content Container */}
              <div className="max-w-md w-full text-center space-y-6 z-10 animate-fade-in">
                {/* Helicopter / Landing gear visual */}
                <div 
                  className="relative mx-auto w-24 h-24 flex items-center justify-center rounded-full border-4 animate-spin [animation-duration:6s]"
                  style={{ borderColor: reg.color, boxShadow: `0 0 20px ${reg.color}40` }}
                >
                  <span className="text-3.5xl">🚁</span>
                </div>

                <div className="space-y-2">
                  <div 
                    className="font-extrabold tracking-[0.25em] text-[10px] sm:text-xs uppercase"
                    style={{ color: reg.accent }}
                  >
                    SISTEMA DE NAVEGACIÓN GPS INDIVIDUAL
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-black text-white tracking-widest uppercase font-serif">
                    {reg.name}
                  </h2>
                  <p className="text-[10px] text-slate-450 font-extrabold tracking-widest uppercase">
                    CORRELACIÓN: ({reg.cx}N, {reg.cy}E)
                  </p>
                </div>

                {/* Elegant loading progress bar */}
                <div className="space-y-2 w-72 mx-auto">
                  <div className="w-full h-2 bg-slate-900 rounded-[99px] overflow-hidden border border-slate-800 p-0.5">
                    <div 
                      className="h-full rounded-[99px]"
                      style={{ 
                        backgroundColor: reg.color, 
                        boxShadow: `0 0 10px ${reg.accent}`,
                        animation: 'fillProgress 2.6s ease-out forwards'
                      }}
                    />
                  </div>
                  <p className="text-[10px] font-black text-slate-350 uppercase tracking-widest animate-pulse">
                    ATERRIZANDO EN LA REGIÓN...
                  </p>
                </div>

                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                  Estableciendo base de operaciones temporal <br />
                  y configurando canal de entrega local
                </div>
              </div>
            </div>
          );
        })()
      )}

    </div>
  );
}
