/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Pizza, Clock, DollarSign, RotateCcw, PlaySquare } from 'lucide-react';
import { Order, House, VehicleId } from '../types';
import { audio } from '../utils/audio';

interface PizzeriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableOrders: Order[];
  activeOrders: Order[];
  onAcceptOrder: (order: Order) => void;
  houses: House[];
  currentVehicleId: VehicleId;
}

export const PizzeriaModal: React.FC<PizzeriaModalProps> = ({
  isOpen,
  onClose,
  availableOrders,
  activeOrders,
  onAcceptOrder,
  houses,
  currentVehicleId,
}) => {
  if (!isOpen) return null;

  const isTruck = currentVehicleId === 'camion';
  const maxActive = isTruck ? 2 : 1;
  const canAcceptMore = activeOrders.length < maxActive;

  return (
    <div id="pizzeria-modal-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        id="pizzeria-modal-container"
        className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full border-4 border-orange-400 overflow-hidden transform scale-100 transition-all duration-300"
      >
        {/* Header with pizzero vibes */}
        <div className="bg-gradient-to-r from-red-500 to-orange-400 p-6 flex items-center justify-between text-white font-sans">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2.5 rounded-2xl shadow-md animate-bounce border border-orange-100">
              <Pizza className="w-8 h-8 text-red-550 fill-red-100" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white font-serif">Pizzería "El Horno Feliz"</h2>
              <p className="text-xs font-semibold opacity-90">¡Calientes, rápidas y deliciosas! Reparte y gana efectivo.</p>
            </div>
          </div>
          <button 
            id="close-pizzeria-btn"
            onClick={onClose}
            className="bg-white/20 hover:bg-white/30 text-white border border-white/35 p-2 px-4 rounded-xl transition font-black text-xs cursor-pointer"
          >
            Volver al Mapa (X)
          </button>
        </div>

        {/* Info panel */}
        <div className="bg-orange-50 border-b-2 border-orange-100 px-6 py-4 flex items-center justify-between text-xs text-orange-950 font-bold">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
            <span>Capacidad de reparto activa: <strong className="text-orange-900">{activeOrders.length} / {maxActive} ({isTruck ? 'Camión: Doble Pedido' : 'Individual'})</strong></span>
          </div>
          {isTruck && (
            <span className="text-orange-750 bg-orange-200/50 p-1 px-2.5 rounded-lg text-[10px] font-black border border-orange-300">
              🚚 ¡El 2do temporizador se pausará hasta entregar el 1ero!
            </span>
          )}
        </div>

        {/* Content list */}
        <div className="p-6 max-h-[460px] overflow-y-auto space-y-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableOrders.map((order, index) => {
              const destHouse = houses.find(h => h.id === order.houseId);
              if (!destHouse) return null;

              const levelColors = {
                facil: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-800 border-green-300' },
                medio: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
                dificil: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
              };

              const colors = levelColors[order.difficulty];

              return (
                <div 
                  key={order.id}
                  id={`order-card-${order.id}`}
                  className={`border-2 rounded-2xl p-4 flex flex-col justify-between transition hover:shadow-md transform hover:-translate-y-1 bg-white`}
                >
                  <div>
                    {/* Header Card */}
                    <div className="flex justify-between items-start mb-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${colors.badge}`}>
                        {order.difficulty}
                      </span>
                      <span className="text-xs font-mono font-bold text-gray-400">#0{index + 1}</span>
                    </div>

                    {/* Destination details */}
                    <h3 className="font-extrabold text-base text-gray-800 leading-tight mb-2">
                      Casa {destHouse.number}
                    </h3>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-4 h-4 rounded-full border shadow-sm" style={{ backgroundColor: destHouse.color }} />
                      <p className="text-xs text-gray-500 font-semibold truncate leading-none capitalize">
                        {destHouse.name}
                      </p>
                    </div>

                    <hr className="my-2.5 border-dashed border-gray-200" />

                    {/* Meta stats */}
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Tiempo: <strong className="text-gray-800 font-bold">{order.timeLimit}s</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold">
                        <DollarSign className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <span>Recompensa: <strong className="text-green-700 text-sm font-semibold">${order.reward}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Accept Button */}
                  <button
                    id={`accept-order-btn-${order.id}`}
                    disabled={!canAcceptMore}
                    onClick={() => {
                      audio.playUpgrade();
                      onAcceptOrder(order);
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl font-bold font-sans text-xs transition-all duration-200 flex items-center justify-center gap-1 shrink-0 ${
                      canAcceptMore 
                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_3px_0_rgb(185,28,28)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_rgb(185,28,28)] cursor-pointer' 
                        : 'bg-gray-200 text-gray-450 border border-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <PlaySquare className="w-4 h-4" />
                    {canAcceptMore ? 'Aceptar Pedido' : 'Capacidad Llena'}
                  </button>
                </div>
              );
            })}
          </div>

          {activeOrders.length > 0 && (
            <div className="mt-6 bg-amber-50 rounded-2xl border-2 border-amber-200 p-4">
              <h4 className="text-sm font-bold text-amber-900 mb-2">Pedidos en Curso:</h4>
              <div className="space-y-2">
                {activeOrders.map((order, i) => {
                  const house = houses.find(h => h.id === order.houseId);
                  return (
                    <div key={order.id} className="bg-white border border-amber-200 rounded-xl p-3 flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-800 bg-amber-100 p-1 px-2 rounded-lg">P{i+1}</span>
                        <div>
                          <p className="font-bold text-gray-800">Casa {house?.number || ''} ({house?.name || ''})</p>
                          <p className="text-gray-500 font-semibold text-[10px]">Recompensa base: ${order.reward}</p>
                        </div>
                      </div>
                      <span className="font-mono bg-red-50 text-red-700 p-1 px-2.5 rounded-lg font-bold border border-red-100 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {i === 1 ? 'Pausado (En cola)' : `${Math.ceil(order.timeLeft)}s...`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {availableOrders.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 font-bold mb-2">¡No hay pedidos abiertos en este momento!</p>
              <p className="text-xs text-gray-400">Si fallaste o completaste pedidos, deberían auto-generarse al instante.</p>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="bg-gray-100 px-6 py-4 flex justify-end gap-2 border-t border-gray-200">
          <button 
            id="close-pizzeria-footer-btn"
            onClick={onClose}
            className="px-5 py-2 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-black transition border border-gray-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
