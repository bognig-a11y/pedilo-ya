/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Car, ArrowRight, Check, Lock, Sparkles, Navigation } from 'lucide-react';
import { VehicleId, Vehicle } from '../types';
import { audio } from '../utils/audio';

interface ConcesionarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVehicleId: VehicleId;
  money: number;
  onBuyVehicle: (vehicleId: VehicleId, price: number) => void;
  tutorialStep?: string;
}

export const VEHICLES_LIST: Vehicle[] = [
  {
    id: 'pie',
    name: 'A Pie',
    speed: 38,
    price: 0,
    emoji: '🏃‍♂️',
    description: 'Tus propios pies. Cansador y lento, ¡pero gratis!',
    color: '#94A3B8',
  },
  {
    id: 'skateboard',
    name: 'Patineta deportiva',
    speed: 60,
    price: 250,
    emoji: '🛹',
    description: '🛹 Una patineta urbana. Buena aceleración por las veredas.',
    color: '#FB923C',
  },
  {
    id: 'bicicleta',
    name: 'Bici Veloz',
    speed: 95,
    price: 750,
    emoji: '🚲',
    description: '🚲 Bicicleta de velocidades. Una alternativa ecológica e inteligente.',
    color: '#60A5FA',
  },
  {
    id: 'moto',
    name: 'Moto Reparto Pro',
    speed: 150,
    price: 1800,
    emoji: '🛵',
    description: '🛵 Scooter clásico de delivery. ¡Cruza la ciudad volando!',
    color: '#F87171',
  },
  {
    id: 'auto',
    name: 'Auto Eléctrico',
    speed: 210,
    price: 4200,
    emoji: '🚗',
    description: '🚗 Auto compacto muy ágil. Potencia silenciosa para tu reparto urbano.',
    color: '#34D399',
  },
  {
    id: 'camion',
    name: 'Camión Duplicador',
    speed: 210, // Same speed as auto
    price: 9000,
    emoji: '🚚',
    description: '🚚 ¡Camión Duplicador! Su potente caja comercial duplica todo el dinero cobrado por cada entrega.',
    color: '#A78BFA',
  },
  {
    id: 'helicoptero',
    name: 'Helicóptero Privado',
    speed: 320,
    price: 20000,
    emoji: '🚁',
    description: '🚁 ¡El rey de la isla! Puede volar e ignorar colisiones. Nota: Debido a su tamaño, solo se usa para movimiento rápido por la isla; al realizar entregas se estacionará automáticamente y usarás el Camión Duplicador de repuesto.',
    color: '#F472B6',
  },
];

export const ConcesionarioModal: React.FC<ConcesionarioModalProps> = ({
  isOpen,
  onClose,
  currentVehicleId,
  money,
  onBuyVehicle,
  tutorialStep,
}) => {
  if (!isOpen) return null;

  // Find index of current vehicle
  const currentIndex = VEHICLES_LIST.findIndex(v => v.id === currentVehicleId);

  return (
    <div id="concesionario-modal-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
         id="concesionario-modal-container"
        className="bg-white rounded-[32px] shadow-2xl max-w-4xl w-full border-4 border-sky-400 overflow-hidden transform scale-100 transition-all duration-300"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-400 to-blue-500 p-6 flex items-center justify-between text-white font-sans">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2.5 rounded-2xl shadow-md animate-bounce border border-sky-100">
              <Car className="w-8 h-8 text-sky-500" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white font-serif">Concesionario "Motores de la Isla"</h2>
              <p className="text-xs font-semibold opacity-90">¡Adquiere vehículos de alta gama para dominar el pavimiento!</p>
            </div>
          </div>
          <button 
            id="close-concesionario-btn"
            onClick={onClose}
            className="bg-white/25 hover:bg-white/35 text-white border border-white/30 p-2 px-4 rounded-xl transition font-black text-xs cursor-pointer"
          >
            Volver (X)
          </button>
        </div>

        {/* Current status banner */}
        <div className="bg-blue-50 border-b-2 border-blue-150 px-6 py-4 flex items-center justify-between text-xs text-blue-900 font-medium">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-600 animate-spin" />
            <span>Vehículo actual: <strong>{VEHICLES_LIST[currentIndex]?.emoji} {VEHICLES_LIST[currentIndex]?.name}</strong></span>
          </div>
          <div className="bg-white border border-blue-300 rounded-full px-3 py-1 font-bold flex items-center gap-1">
            <span className="text-green-600">$</span>
            <span>Efectivo: <strong>{money}</strong></span>
          </div>
        </div>

        {/* Vehicle list timeline / cards */}
        <div className="p-6 max-h-[500px] overflow-y-auto bg-gray-50 space-y-4">
          {tutorialStep === 'concesionario' && (
            <div className="bg-sky-100 text-sky-950 p-4 rounded-2xl border-2 border-sky-300 flex items-center gap-3 animate-pulse">
              <span className="text-3xl shrink-0">🚲</span>
              <div className="text-xs">
                <h4 className="font-extrabold uppercase tracking-wider text-sky-900">Paso 3: Tienda de Vehículos</h4>
                <p className="mt-1 font-semibold leading-normal">
                  ¡Excelente trabajo al llegar! Aquí puedes adquirir mejoras de velocidad (patinetas, bicicletas, motos, autos e incluso un helicóptero) que harán que tus entregas sean instantáneas y divertidas. Adquiere alguno si te alcanza el dinero, o simplemente cierra esta ventana para avanzar al <strong className="text-sky-900">Paso 4 (Casino)</strong>.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {VEHICLES_LIST.map((vehicle, index) => {
              const isOwned = index <= currentIndex;
              const isNext = index === currentIndex + 1;
              const isLocked = index > currentIndex + 1;
              const canAfford = money >= vehicle.price;

              return (
                <div 
                  key={vehicle.id}
                  id={`vehicle-card-${vehicle.id}`}
                  className={`border-2 rounded-2xl p-4 relative overflow-hidden transition duration-200 flex flex-col justify-between ${
                    isOwned 
                      ? 'border-green-300 bg-green-50/40 shadow-inner' 
                      : isNext 
                        ? 'border-blue-400 bg-white hover:shadow-md hover:border-blue-500' 
                        : 'border-gray-200 bg-gray-100 opacity-60'
                  }`}
                >
                  {/* Status indicator badge */}
                  <div className="absolute top-2 right-2 flex items-center">
                    {isOwned && (
                      <span className="bg-green-150 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-green-300">
                        <Check className="w-3 h-3" /> Adquirido
                      </span>
                    )}
                    {isNext && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-blue-300 animate-pulse">
                        <Sparkles className="w-3 h-3" /> ¡A comprar!
                      </span>
                    )}
                    {isLocked && (
                      <span className="bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-gray-300">
                        <Lock className="w-3 h-3" /> Bloqueado
                      </span>
                    )}
                  </div>

                  <div>
                    {/* Basic Info */}
                    <div className="flex items-center gap-3 mb-2.5">
                      <span className="text-3.5xl p-1 bg-white rounded-xl shadow-sm border border-gray-150 relative block leading-none">
                        {vehicle.emoji}
                      </span>
                      <div>
                        <h3 className="font-extrabold text-base text-gray-800 leading-tight">
                          {vehicle.name}
                        </h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                          NIVEL {index + 1} DE 7
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 font-medium leading-relaxed mb-4 min-h-[38px]">
                      {vehicle.description}
                    </p>

                    {/* Vehicle speed benchmark bar */}
                    <div className="space-y-1 mb-4">
                      <div className="flex justify-between items-center text-[10px] font-semibold text-gray-500">
                        <span>Velocidad Máxima</span>
                        <span className="font-bold text-gray-700 font-mono">{vehicle.speed} km/h</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 rounded-full" 
                          style={{ width: `${(vehicle.speed / 320) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions and Pricing */}
                  <div className="mt-auto border-t border-gray-150/80 pt-3 flex items-center justify-between">
                    <div>
                      {vehicle.price > 0 ? (
                        <p className="text-xs text-gray-400 font-medium">Precio:</p>
                      ) : (
                        <p className="text-xs text-gray-400 font-medium">Costo de Inicio:</p>
                      )}
                      <p className="font-mono text-lg font-black text-gray-800 leading-none">
                        {vehicle.price > 0 ? `$${vehicle.price}` : 'GRATIS'}
                      </p>
                    </div>

                    {isOwned ? (
                      <div className="bg-green-100 text-green-700 p-2 rounded-xl text-xs font-bold leading-none select-none flex items-center gap-1 border border-green-200">
                        {currentVehicleId === vehicle.id ? 'Equipado Activo' : 'Comprado'}
                      </div>
                    ) : isNext ? (
                      <button
                        id={`buy-vehicle-btn-${vehicle.id}`}
                        disabled={!canAfford}
                        onClick={() => {
                          audio.playUpgrade();
                          onBuyVehicle(vehicle.id, vehicle.price);
                        }}
                        className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-150 flex items-center gap-1.5 ${
                          canAfford 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-[0_3px_0_rgb(29,78,216)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_rgb(29,78,216)] border border-blue-700 cursor-pointer' 
                            : 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed'
                        }`}
                      >
                        Comprar Vehículo
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-gray-150 p-2 rounded-xl">
                        Debes comprar anterior
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info showing sequentially block */}
        <div className="bg-gray-100 px-6 py-4 flex items-center justify-between border-t border-gray-200 text-xs text-gray-500 font-medium">
          <span>* Los vehículos deben adquirirse estrictamente en secuencia de progresión.</span>
          <button 
            id="close-concesionario-footer-btn"
            onClick={onClose}
            className="px-5 py-2 hover:bg-gray-200 text-gray-650 rounded-xl text-xs font-black transition border border-gray-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
