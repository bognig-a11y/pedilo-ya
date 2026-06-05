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
