/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VehicleId = 'pie' | 'skateboard' | 'bicicleta' | 'moto' | 'auto' | 'camion' | 'helicoptero';

export interface Vehicle {
  id: VehicleId;
  name: string;
  speed: number; // units/sec
  price: number;
  emoji: string;
  description: string;
  color: string;
}

export interface Upgrades {
  ganancia: number; // 0 to 10
  suerte: number;   // 0 to 10
  fuerza: number;   // 0 to 10
}

export interface House {
  id: number;
  x: number;
  y: number;
  name: string;
  color: string;
  number: string;
  style: number; // randomized style index for rendering (shape, roof type)
}

export interface Order {
  id: string;
  houseId: number;
  timeLimit: number; // in seconds
  timeLeft: number;  // in seconds
  reward: number;    // base reward
  difficulty: 'facil' | 'medio' | 'dificil';
}

export interface Obstacle {
  id: string;
  type: 'tree' | 'mud' | 'car';
  x: number;
  y: number;
  size: number;
  // Car specific:
  vx?: number;
  vy?: number;
  angle?: number;
  color?: string;
  streetIndex?: number; // to keep them on streets
}

export interface Vagabond {
  id: string;
  x: number;
  y: number;
  speed: number;
}

export type GameState = 'menu' | 'playing' | 'gameover' | 'victory';

export interface SoundSettings {
  muted: boolean;
}

export interface Territory {
  id: number;
  name: string;
  color: string;
  cx: number;
  cy: number;
  accent: string;
}

export const TERRITORIES: Territory[] = [
  { id: 1, name: "Región 1 (Boxeo)", color: "#EF4444", cx: 220, cy: -320, accent: "#F87171" },
  { id: 2, name: "Región 2 (Aeropuerto)", color: "#64748B", cx: 550, cy: -320, accent: "#94A3B8" },
  { id: 3, name: "Región 3 (Disco)", color: "#8B5CF6", cx: 240, cy: 320, accent: "#A78BFA" },
  { id: 4, name: "Región 4 (Fútbol)", color: "#22C55E", cx: 520, cy: 340, accent: "#4ADE80" },
  { id: 5, name: "Región 5 (Karting)", color: "#EAB308", cx: 180, cy: 10, accent: "#FDE047" },
  { id: 6, name: "Región 6 (Casino)", color: "#F59E0B", cx: 480, cy: -90, accent: "#FBBF24" },
  { id: 7, name: "Región 7 (Mundo de Ingenio)", color: "#06B6D4", cx: 720, cy: -120, accent: "#22D3EE" },
  { id: 8, name: "Región 8 (CEO Final)", color: "#111827", cx: 740, cy: 220, accent: "#EF4444" },
];

export function getTerritoryAt(x: number, y: number): Territory | null {
  if (x < 10) return null; // Avoid left island threshold
  let bestDist = Infinity;
  let bestT: Territory | null = null;
  for (const t of TERRITORIES) {
    const d = (x - t.cx) ** 2 + (y - t.cy) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestT = t;
    }
  }
  return bestT;
}

export const REGION_MAP_OFFSET_X = 20000;
export const REGION_MAP_OFFSET_Y = 20000;

