/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, Trophy, ShieldAlert, Award, Star, Zap } from 'lucide-react';
import { Upgrades } from '../types';
import { audio } from '../utils/audio';

interface UpgradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  upgrades: Upgrades;
  money: number;
  onBuyUpgrade: (stat: keyof Upgrades, cost: number) => void;
}

export const UPGRADE_COSTS = [120, 240, 450, 750, 1200, 1800, 2600, 3800, 5500, 8000]; // levels 0 to 9 upgrading to levels 1 to 10

export const UpgradesModal: React.FC<UpgradesModalProps> = ({
  isOpen,
  onClose,
  upgrades,
  money,
  onBuyUpgrade,
}) => {
  if (!isOpen) return null;

  const statsList = [
    {
      key: 'ganancia' as keyof Upgrades,
      name: 'Ganancia (Bono de Pago)',
      icon: <Trophy className="w-6 h-6 text-yellow-500" />,
      description: 'Aumenta el dinero recibido al completar repartos. El bono se aplica en secreto al entregar la pizza.',
      benefit: (lvl: number) => `+${lvl * 12}% de recompensa final`,
      nextBenefit: (lvl: number) => lvl < 10 ? `+${(lvl + 1) * 12}% en nivel ${lvl + 1}` : 'Nivel Máximo',
      color: 'bg-yellow-500',
    },
    {
      key: 'suerte' as keyof Upgrades,
      name: 'Suerte (Mejores Apuestas)',
      icon: <Star className="w-6 h-6 text-amber-500 fill-amber-300" />,
      description: 'Aumenta un 25% (máx) tus probabilidades de ganar en todos los minijuegos del Casino de la isla.',
      benefit: (lvl: number) => `+${(lvl * 2.5).toFixed(1)}% de probabilidades favorables`,
      nextBenefit: (lvl: number) => lvl < 10 ? `+${((lvl + 1) * 2.5).toFixed(1)}% en nivel ${lvl + 1}` : 'Nivel Máximo',
      color: 'bg-amber-500',
    },
    {
      key: 'fuerza' as keyof Upgrades,
      name: 'Fuerza (Mitigación de Paros)',
      icon: <Zap className="w-6 h-6 text-purple-500" />,
      description: 'Reduce la inmovilización de choques con vehículos (desde 2.5s base) y el retraso del lodo. En nivel 10 dura solo 1 segundo.',
      benefit: (lvl: number) => `Choque inmoviliza: ${(2.5 - (lvl * 0.15)).toFixed(2)}s | Trabas de lodo muy ligeras`,
      nextBenefit: (lvl: number) => lvl < 10 ? `Inmovilidad a ${(2.5 - ((lvl + 1) * 0.15)).toFixed(2)}s` : 'Nivel Máximo',
      color: 'bg-purple-500',
    },
  ];

  return (
    <div id="upgrades-modal-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        id="upgrades-modal-container"
        className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full border-4 border-pink-400 overflow-hidden transform scale-100 transition-all duration-300"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-rose-400 p-6 flex items-center justify-between text-white font-sans">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2.5 rounded-2xl shadow-md animate-bounce border border-pink-100">
              <Sparkles className="w-8 h-8 text-pink-500 fill-pink-100" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white font-serif">Mejoras de Estadísticas</h2>
              <p className="text-xs font-semibold opacity-90">¡Sube de nivel tus habilidades humanas con dinero acumulado!</p>
            </div>
          </div>
          <button 
            id="close-upgrades-btn"
            onClick={onClose}
            className="bg-white/20 hover:bg-white/30 text-white border border-white/35 p-2 px-4 rounded-xl transition font-black text-xs cursor-pointer"
          >
            Cerrar (X)
          </button>
        </div>

        {/* Status banner */}
        <div className="bg-pink-50 border-b-2 border-pink-100 px-6 py-4 flex items-center justify-between text-xs text-pink-950 font-bold">
          <span>¡Cada nivel otorga beneficios continuos súper potentes!</span>
          <div className="bg-white border-2 border-pink-200 rounded-full px-3 py-1 font-bold">
            <span className="text-green-500">$</span>
            <span>Efectivo: <strong className="text-pink-600">{money}</strong></span>
          </div>
        </div>

        {/* Content list */}
        <div className="p-6 space-y-5 bg-gray-50 max-h-[450px] overflow-y-auto">
          {statsList.map((stat) => {
            const currentLevel = upgrades[stat.key];
            const isMax = currentLevel >= 10;
            const nextLvlCost = isMax ? 0 : UPGRADE_COSTS[currentLevel];
            const canAfford = !isMax && money >= nextLvlCost;

            return (
              <div 
                key={stat.key}
                id={`stat-card-${stat.key}`}
                className="bg-white border text-gray-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover:shadow-md border-gray-200"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-orange-50 shrink-0">
                      {stat.icon}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-gray-800 flex items-center gap-2">
                        {stat.name}
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-500 font-mono font-bold">
                          Lvl {currentLevel}/10
                        </span>
                      </h3>
                      <p className="text-xs text-gray-500 font-medium leading-relaxed max-w-md">
                        {stat.description}
                      </p>
                    </div>
                  </div>

                  {/* Visual Progress Bar (0 to 10 bars) */}
                  <div className="flex gap-1 pt-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-2 flex-1 rounded-full ${
                          i < currentLevel 
                            ? stat.color 
                            : 'bg-gray-200'
                        }`} 
                      />
                    ))}
                  </div>

                  {/* Statistics details */}
                  <div className="flex flex-col sm:flex-row sm:gap-4 text-[11px] font-semibold">
                    <span className="text-gray-600">
                      Actual: <strong className="text-emerald-600">{stat.benefit(currentLevel)}</strong>
                    </span>
                    {!isMax && (
                      <span className="text-gray-400">
                        Siguiente: <strong className="text-blue-600">{stat.nextBenefit(currentLevel)}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Price and Action Button */}
                <div className="shrink-0 md:text-right flex md:flex-col items-center md:items-end justify-between w-full md:w-auto border-t md:border-t-0 border-gray-100 pt-3 md:pt-0">
                  {!isMax ? (
                    <>
                      <div className="mb-1.5 mr-4 md:mr-0">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Costo de Mejora</span>
                        <strong className="text-base font-black font-mono text-gray-800">${nextLvlCost}</strong>
                      </div>
                      <button
                        id={`upgrade-btn-${stat.key}`}
                        disabled={!canAfford}
                        onClick={() => {
                          audio.playUpgrade();
                          onBuyUpgrade(stat.key, nextLvlCost);
                        }}
                        className={`px-4 py-2.5 rounded-xl font-bold font-sans text-xs transition-all duration-200 ${
                          canAfford 
                            ? 'bg-pink-500 hover:bg-pink-600 text-white shadow-[0_3px_0_rgb(190,24,93)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_rgb(190,24,93)] cursor-pointer' 
                            : 'bg-gray-200 text-gray-400 border border-gray-250 cursor-not-allowed'
                        }`}
                      >
                        Mejorar Nivel
                      </button>
                    </>
                  ) : (
                    <div className="bg-green-100 text-green-700 font-bold text-xs p-2.5 rounded-xl flex items-center gap-1 border border-green-200 w-full md:w-auto justify-center">
                      <Award className="w-4 h-4 text-green-600" /> MAXIMIZADO
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-gray-100 px-6 py-4 flex justify-end gap-2 border-t border-gray-200 text-xs">
          <button 
            id="close-upgrades-footer-btn"
            onClick={onClose}
            className="px-5 py-2 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-black transition border border-gray-300"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
};
