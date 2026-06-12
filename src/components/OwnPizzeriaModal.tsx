/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Pizza, 
  Clock, 
  DollarSign, 
  PlaySquare, 
  Hammer, 
  Users, 
  TrendingUp, 
  Sparkles, 
  Briefcase, 
  ChevronRight, 
  Zap, 
  ShieldAlert, 
  Award,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Order, House, VehicleId } from '../types';
import { audio } from '../utils/audio';

interface OwnPizzeriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableOrders: Order[];
  activeOrders: Order[];
  onAcceptOrder: (order: Order) => void;
  houses: House[];
  currentVehicleId: VehicleId;
  money: number;
  
  // Custom business expansion states
  renovationLevel: number;
  onUpgradeRenovation: (level: number, cost: number) => void;
  employeeLevel: number;
  onUpgradeEmployee: (level: number, cost: number) => void;
  playerMarketShare: number;
  rivalMarketShare: number;
  rivalPassiveRate: number;
  businessDaysHeld: number;
  pizzeriaName: string;
  pizzeriaColor: string;

  // Business tutorial integrations
  businessTutorialStep?: 'off' | 'prompt' | 'upgrades' | 'competition' | 'staff' | 'completed';
  onSetBusinessTutorialStep?: (step: 'off' | 'prompt' | 'upgrades' | 'competition' | 'staff' | 'completed') => void;
}

export const OwnPizzeriaModal: React.FC<OwnPizzeriaModalProps> = ({
  isOpen,
  onClose,
  availableOrders,
  activeOrders,
  onAcceptOrder,
  houses,
  currentVehicleId,
  money,
  renovationLevel,
  onUpgradeRenovation,
  employeeLevel,
  onUpgradeEmployee,
  playerMarketShare,
  rivalMarketShare,
  rivalPassiveRate,
  businessDaysHeld,
  pizzeriaName,
  pizzeriaColor,
  businessTutorialStep = 'off',
  onSetBusinessTutorialStep,
}) => {
  const [activeTab, setActiveTab] = useState<'pedidos' | 'renovacion' | 'empleados'>('pedidos');

  // Automatically adjust active business tab based on tutorial progress to keep the flow intuitive
  React.useEffect(() => {
    if (isOpen) {
      if (businessTutorialStep === 'upgrades') {
        setActiveTab('renovacion');
      } else if (businessTutorialStep === 'staff') {
        setActiveTab('empleados');
      }
    }
  }, [isOpen, businessTutorialStep]);

  if (!isOpen) return null;

  const isTruck = currentVehicleId === 'camion';
  const maxActive = 1;
  const canAcceptMore = activeOrders.length < maxActive;

  // Renovations structure: level, cost, title, benefits, description, icon
  const RENOVATIONS_LIST = [
    {
      level: 1,
      cost: 10000,
      title: 'Reparación Estructural',
      desc: 'Soluciona muros agrietados y pon un cartel corporativo luminoso.',
      benefit: 'Los pedidos pagan el 100% de su valor (sin penalización por aspecto deteriorado).',
      icon: Hammer,
    },
    {
      level: 2,
      cost: 20000,
      title: 'Apertura Comercial',
      desc: 'Hornos profesionales e inicio de campañas de marketing local.',
      benefit: 'Tus pedidos manuales aumentan mucho más tu cuota de mercado al entregarlos (+1%).',
      icon: Sparkles,
    },
    {
      level: 3,
      cost: 30000,
      title: 'Negocio Operativo',
      desc: 'Panel automatizado y red para habilitar personal e ingresos automáticos.',
      benefit: 'Ingresos automáticos pasivos (+$200 y +2% de mercado cada 30s) y desbloquea pestaña de Personal.',
      icon: TrendingUp,
    }
  ];

  // Employees details: level, cost, name, passive benefits, requirement
  const EMPLOYEES_LIST = [
    {
      level: 1,
      cost: 3000,
      name: 'Repartidor Novato',
      benefit: 'Cada 30s: +3% Cuota de Mercado y +$300 de ingresos pasivos',
      perSec: 'Cada 30s',
      income: '$300',
      share: '+3%'
    },
    {
      level: 2,
      cost: 4000,
      name: 'Repartidor Experimentado',
      benefit: 'Cada 30s: +4% Cuota de Mercado y +$400 de ingresos pasivos',
      perSec: 'Cada 30s',
      income: '$400',
      share: '+4%'
    },
    {
      level: 3,
      cost: 5000,
      name: 'Distribuidor Profesional',
      benefit: 'Cada 30s: +5% Cuota de Mercado y +$500 de ingresos pasivos',
      perSec: 'Cada 30s',
      income: '$500',
      share: '+5%'
    },
    {
      level: 4,
      cost: 7500,
      name: 'Súper Repartidor Experto',
      benefit: 'Cada 30s: +5% Cuota de Mercado y +$1000 de ingresos pasivos',
      perSec: 'Cada 30s',
      income: '$1000',
      share: '+5%'
    },
    {
      level: 5,
      cost: 10000,
      name: 'Flota Máxima Experto+',
      benefit: 'Cada 15s: +5% Cuota de Mercado y +$1000 de ingresos pasivos',
      perSec: 'Cada 15s',
      income: '$1000',
      share: '+5%'
    }
  ];

  return (
    <div id="own-pizzeria-modal-overlay" className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div 
        id="own-pizzeria-modal-container"
        className="bg-slate-900 rounded-[28px] shadow-2xl max-w-4xl w-full overflow-hidden text-slate-150 flex flex-col h-[580px] border-2 transition-all duration-200"
        style={{ borderColor: pizzeriaColor }}
      >
        {/* Header - Friendly & Vibrant */}
        <div className="bg-slate-950 p-5 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl text-slate-950 flex items-center justify-center" style={{ backgroundColor: pizzeriaColor }}>
              <Pizza className="w-6 h-6 fill-slate-950" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight uppercase" style={{ color: pizzeriaColor }}>{pizzeriaName}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tablero de Gestión e Inversión</p>
            </div>
          </div>
          <button 
            id="close-own-pizzeria-btn"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 p-2 px-4 rounded-xl transition font-bold text-xs cursor-pointer"
          >
            Volver al Mapa ✕
          </button>
        </div>

        {/* Unified Status & Market Share Panel - Highly Visual, Simple, Friendly */}
        <div className="bg-slate-950/40 p-4 px-6 border-b border-slate-800 flex flex-col md:flex-row items-center gap-4 justify-between">
          {/* Dual Market Share Progress Bar */}
          <div className="flex-1 w-full flex flex-col gap-1">
            <div className="flex justify-between items-center text-[11px] font-extrabold uppercase tracking-wide">
              <span className="text-emerald-400 flex items-center gap-1">🟢 Tu Cuota de Mercado ({playerMarketShare}%)</span>
              <span className="text-red-400 flex items-center gap-1">🔴 Rival ({rivalMarketShare}%)</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex shadow-inner">
              <div style={{ width: `${playerMarketShare}%` }} className="bg-emerald-500 h-full transition-all duration-500 ease-out" />
              <div style={{ width: `${rivalMarketShare}%` }} className="bg-red-500 h-full transition-all duration-500 ease-out" />
            </div>
            <p className="text-[9px] text-slate-400 font-medium">⚠️ ¡Si la barra roja llega al 100%, tu pizzería quebrará y perderás!</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-slate-950/80 border border-slate-800 p-2 px-3 rounded-lg text-xs font-semibold">
              <span className="text-slate-400 mr-1.5 font-bold">💵 Capital:</span>
              <strong className="text-yellow-400 font-mono">${money}</strong>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-2 px-3 rounded-lg text-xs font-semibold">
              <span className="text-slate-400 mr-1.5 font-bold">🏢 Local:</span>
              <strong className="text-amber-400">Nivel {renovationLevel}/3</strong>
            </div>
          </div>
        </div>

        {/* Main Body - Redesigned Tab Navigation and Contents */}
        <div className="flex flex-1 overflow-hidden">
          {/* Side Tabs navigation */}
          <div className="w-48 bg-slate-950/60 border-r border-slate-800 p-3 space-y-1 shrink-0 flex flex-col justify-between">
            <div className="space-y-1">
              <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest pl-2 mb-2">Menú de Gestión</p>
              
              <button
                onClick={() => { audio.playUpgrade(); setActiveTab('pedidos'); }}
                className={`w-full flex items-center gap-2 p-2.5 rounded-xl transition text-xs font-bold text-left ${
                  activeTab === 'pedidos' 
                    ? 'bg-amber-500 text-slate-950 font-black' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Briefcase className="w-4 h-4 shrink-0" />
                <span>Despachar Pedidos</span>
              </button>

              <button
                onClick={() => { audio.playUpgrade(); setActiveTab('renovacion'); }}
                className={`w-full flex items-center gap-2 p-2.5 rounded-xl transition text-xs font-bold text-left ${
                  activeTab === 'renovacion' 
                    ? 'bg-amber-500 text-slate-950 font-black' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Hammer className="w-4 h-4 shrink-0" />
                <span>Mejoras del Local</span>
              </button>

              <button
                disabled={renovationLevel < 3}
                onClick={() => { if (renovationLevel >= 3) { audio.playUpgrade(); setActiveTab('empleados'); } }}
                className={`w-full flex items-center gap-2 p-2.5 rounded-xl transition text-xs font-bold text-left relative ${
                  activeTab === 'empleados' 
                    ? 'bg-amber-500 text-slate-950 font-black' 
                    : renovationLevel < 3
                      ? 'text-slate-600 cursor-not-allowed opacity-50'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Personal Autónomo</span>
                {renovationLevel < 3 && <Lock className="w-3 h-3 absolute right-3 text-slate-600" />}
              </button>
            </div>

            <div className="p-2.5 bg-slate-950/80 border border-slate-800/60 rounded-xl text-[10px] text-slate-400 space-y-0.5">
              <p className="font-extrabold uppercase text-slate-500 text-[8px] tracking-wider mb-1">Rendimiento</p>
              <p>Avance Rival: <span className="text-red-400">+{rivalPassiveRate}% /min</span></p>
              <p className="text-[9px] text-slate-500 leading-tight">Cada entrega exitosa frena al rival.</p>
            </div>
          </div>

          {/* Tab Display Area */}
          <div className="flex-1 p-5 bg-slate-900/40 overflow-y-auto">
            
            {/* COMPACT FLOATING TUTORIAL INNER BANNER */}
            {businessTutorialStep === 'upgrades' && (
              <div className="bg-pink-950/80 border border-pink-500/50 p-3 rounded-xl text-left text-xs mb-4 flex flex-col gap-1.5 shadow-md">
                <div className="flex items-center gap-1 text-pink-400 font-extrabold">
                  <span>🛠️</span>
                  <span>TUTORIAL 1: ADQUIERE TU PRIMERA MEJORA</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Mejora el edificio para aumentar las ganancias y desbloquear funciones. Comienza comprando la <strong>Reparación Estructural (Nivel 1)</strong> para quitar la penalización de ganancias.
                </p>
                <div className="flex justify-end mt-1 border-t border-slate-800/40 pt-1.5">
                  <button 
                    onClick={() => {
                      audio.playUpgrade();
                      onSetBusinessTutorialStep?.('competition');
                    }}
                    className="px-2.5 py-1 bg-pink-500 hover:bg-pink-400 text-slate-950 font-bold uppercase text-[9px] rounded-lg shadow cursor-pointer transition flex items-center gap-0.5"
                  >
                    Entendido, Siguiente <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {businessTutorialStep === 'competition' && (
              <div className="bg-pink-955 bg-pink-950/80 border border-pink-500/50 p-3 rounded-xl text-left text-xs mb-4 flex flex-col gap-1.5 shadow-md">
                <div className="flex items-center gap-1 text-pink-400 font-extrabold">
                  <span>📊</span>
                  <span>TUTORIAL 2: PARTICIPACIÓN DE MERCADO Y RIVAL</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Mira la barra superior. Si tu competidor alcanza el 100%, pierdes. {renovationLevel < 3 ? (
                    <span>Para desbloquear la contratación de personal, debes adquirir la <strong>Reforma Avanzada Nivel 3 (Negocio Operativo)</strong> en la pestaña 'Mejoras del Local'.</span>
                  ) : (
                    <span>¡Excelente! Has alcanzado el Nivel 3. Puedes ver la pestaña 'Personal Autónomo' ahora para automatizar compras.</span>
                  )}
                </p>
                <div className="flex justify-end mt-1 border-t border-slate-800/40 pt-1.5">
                  {renovationLevel >= 3 ? (
                    <button 
                      onClick={() => {
                        audio.playUpgrade();
                        onSetBusinessTutorialStep?.('staff');
                      }}
                      className="px-2.5 py-1 bg-pink-500 hover:bg-pink-400 text-slate-950 font-bold uppercase text-[9px] rounded-lg shadow cursor-pointer transition flex items-center gap-0.5"
                    >
                      Paso Final: Personal <ChevronRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">👉 Ve a 'Mejoras del Local' para habilitar el Paso 3</span>
                  )}
                </div>
              </div>
            )}

            {businessTutorialStep === 'staff' && (
              <div className="bg-emerald-950/80 border border-emerald-500/50 p-3 rounded-xl text-left text-xs mb-4 flex flex-col gap-1.5 shadow-md animate-pulse">
                <div className="flex items-center gap-1 text-emerald-400 font-extrabold">
                  <span>👥</span>
                  <span>TUTORIAL 3: CONTRATA PERSONAL AUTOMATIZADO</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  ¡Habilitaste el piloto automático! Compra repartidores autónomos para que circulen por el mapa, devuelvan pedidos y sumen ganancias de forma pasiva cada 30 segundos.
                </p>
                <div className="flex justify-end mt-1 border-t border-slate-800/40 pt-1.5">
                  <button 
                    onClick={() => {
                      audio.playSuccess();
                      onSetBusinessTutorialStep?.('completed');
                    }}
                    className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold uppercase text-[9px] rounded-lg shadow cursor-pointer transition flex items-center gap-0.5"
                  >
                    Completar Guía ✓
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: PEDIDOS */}
            {activeTab === 'pedidos' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                    <Pizza className="w-4 h-4 text-amber-500" /> Despacho de Pedidos
                  </h3>
                  <span className="text-[10px] bg-amber-500/15 text-amber-400 p-0.5 px-2 rounded-md font-bold">
                    Equipaje: {activeOrders.length} / {maxActive}
                  </span>
                </div>

                {isTruck && (
                  <div className="bg-emerald-950/40 border border-emerald-500/35 rounded-xl p-2.5 text-[11px] text-emerald-300 flex items-center gap-1.5">
                    <span>🚚</span>
                    <p>¡Camión Activo! Las ganancias de los despachos manuales son de <strong>Doble Recompensa (x2)</strong>.</p>
                  </div>
                )}

                {renovationLevel === 0 && (
                  <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-2.5 text-[11px] text-red-300 flex items-center gap-1.5">
                    <span>🏚️</span>
                    <p><strong>Edificio deteriorado (Nivel 0)</strong>: Solo recaudas el <strong>50%</strong> del valor. Mejora el local para cobrar el 100%.</p>
                  </div>
                )}

                {/* Simplified orders list */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableOrders.map((order) => {
                    const house = houses.find(h => h.id === order.houseId);
                    if (!house) return null;

                    const difficultyColors = {
                      facil: 'text-emerald-400 bg-emerald-505/10 border-emerald-500/20',
                      medio: 'text-sky-400 bg-sky-505/10 border-sky-500/20',
                      dificil: 'text-rose-450 bg-rose-505/10 border-rose-500/20',
                    };

                    const rawReward = order.reward;
                    const finalRew = renovationLevel === 0 ? Math.round(rawReward * 0.5) : rawReward;

                    return (
                      <div key={order.id} className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 flex flex-col justify-between hover:border-slate-700 transition">
                        <div>
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${difficultyColors[order.difficulty]}`}>
                              {order.difficulty}
                            </span>
                          </div>

                          <h4 className="font-extrabold text-xs text-slate-200">Casa {house.number} ({house.name})</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">Límite de tiempo: {order.timeLimit} segundos</p>
                        </div>

                        <div className="flex justify-between items-center mt-3 border-t border-slate-800/40 pt-2.5">
                          <span className="text-emerald-400 text-xs font-black">
                            Pago: ${isTruck ? finalRew * 2 : finalRew}
                          </span>
                          <button
                            disabled={!canAcceptMore}
                            onClick={() => {
                              audio.playRentPay();
                              onAcceptOrder(order);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                              canAcceptMore
                                ? 'bg-amber-500 text-slate-950 hover:bg-amber-450 font-black'
                                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                            }`}
                          >
                            Cargar Pedido
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {availableOrders.length === 0 && (
                  <div className="text-center py-8 bg-slate-950/10 rounded-xl border border-slate-800/80 border-dashed">
                    <p className="text-slate-400 text-xs font-bold">No hay pedidos de la central listos.</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Se están cocinando nuevas comandas en el horno...</p>
                  </div>
                )}

                {activeOrders.length > 0 && (
                  <div className="bg-slate-950/70 rounded-xl border border-slate-800 p-3 mt-4 text-xs font-semibold">
                    <p className="text-amber-400 font-extrabold text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" /> Despacho en camino:
                    </p>
                    {activeOrders.map((ord) => {
                      const tgt = houses.find(h => h.id === ord.houseId);
                      return (
                        <div key={ord.id} className="flex justify-between items-center p-2 bg-slate-900 rounded-lg border border-slate-800/60 mt-1">
                          <div>
                            <p className="text-slate-200">Casa {tgt?.number} ({tgt?.name})</p>
                          </div>
                          <span className="font-mono text-[10px] text-red-400 bg-red-950/40 border border-red-900/50 p-1 rounded font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-red-500" />
                            {Math.ceil(ord.timeLeft)}s...
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: UPGRADES */}
            {activeTab === 'renovacion' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5 pb-1.5 border-b border-slate-800">
                  <Hammer className="w-4 h-4 text-amber-500" /> Mejoras del Local Comercial
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Reformar las instalaciones del edificio activa grandes cualidades competitivas:</p>

                <div className="space-y-3 pt-1">
                  {RENOVATIONS_LIST.map((ren) => {
                    const isPurchased = renovationLevel >= ren.level;
                    const isLocked = ren.level > renovationLevel + 1;
                    const canAfford = money >= ren.cost;
                    const isNextToBuy = renovationLevel === ren.level - 1;

                    return (
                      <div 
                        key={ren.level}
                        className={`border rounded-xl p-3 flex justify-between items-center gap-4 transition ${
                          isPurchased 
                            ? 'border-emerald-500/25 bg-emerald-950/5' 
                            : isNextToBuy 
                              ? 'border-amber-500/30 bg-slate-950/30' 
                              : 'border-slate-850 bg-slate-950/10 opacity-30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg border shrink-0 ${
                            isPurchased 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-405' 
                              : isNextToBuy 
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-405' 
                                : 'bg-slate-800 border-slate-700 text-slate-600'
                          }`}>
                            <ren.icon className="w-5 h-5" />
                          </div>
                          <div className="text-left font-medium">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-extrabold text-xs text-slate-100">{ren.title}</h4>
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded ${
                                isPurchased 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                {isPurchased ? 'Completado' : `Nivel ${ren.level}`}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{ren.desc}</p>
                            <p className="text-[10px] text-emerald-450 font-bold mt-1.5 flex items-center gap-1">
                              <Award className="w-3 h-3 text-emerald-450" /> Ventaja: {ren.benefit}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          {isPurchased ? (
                            <span className="flex items-center gap-1 text-emerald-400 font-extrabold text-[10px] bg-emerald-500/15 border border-emerald-500/20 p-1.5 px-3 rounded-lg cursor-default select-none">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Adquirido
                            </span>
                          ) : isLocked ? (
                            <span className="flex items-center gap-0.5 text-slate-600 font-bold text-[10px] p-1.5 px-3 rounded select-none cursor-not-allowed">
                              <Lock className="w-3 h-3" /> Cerrado
                            </span>
                          ) : (
                            <button
                              disabled={!canAfford}
                              onClick={() => {
                                onUpgradeRenovation(ren.level, ren.cost);
                              }}
                              className={`py-2 px-3 rounded-lg font-bold text-[10px] transition uppercase flex items-center justify-center gap-1 cursor-pointer ${
                                canAfford
                                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-450 font-black shadow-sm'
                                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                              }`}
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              {canAfford ? `$${ren.cost}` : `Falta Dinero ($${ren.cost})`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT: EMPLEADOS */}
            {activeTab === 'empleados' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5 pb-1.5 border-b border-slate-800">
                  <Users className="w-4 h-4 text-amber-500" /> Reclutar Personal Automatizado
                </h3>

                {renovationLevel < 3 ? (
                  <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-2xl text-center select-none space-y-3 my-4">
                    <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-755 flex items-center justify-center mx-auto text-slate-500 shadow-inner">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-300 uppercase tracking-wide">Módulo de Personal Bloqueado</h4>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1 leading-normal">Se necesita alcanzar la <strong>Reforma Avanzada Nivel 3 (Negocio Operativo)</strong> para habilitar el reclutamiento físico de repartidores.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-[11px] text-emerald-300">
                      <p className="font-bold">¡Automatización en Marcha!</p>
                      <p className="text-slate-450 font-medium mt-0.5">El personal contratado generará fondos y aumentará tu cuota de mercado en piloto automático.</p>
                    </div>

                    <div className="space-y-3 font-medium">
                      {EMPLOYEES_LIST.map((emp) => {
                        const isPurchased = employeeLevel >= emp.level;
                        const isLocked = emp.level > employeeLevel + 1;
                        const canAfford = money >= emp.cost;
                        const isNextToBuy = employeeLevel === emp.level - 1;

                        return (
                          <div 
                            key={emp.level}
                            className={`border rounded-xl p-3 flex justify-between items-center gap-3 transition ${
                              isPurchased 
                                ? 'border-emerald-500/20 bg-emerald-950/5' 
                                : isNextToBuy 
                                  ? 'border-amber-500/25 bg-slate-950/30' 
                                  : 'border-slate-850 bg-slate-95a/20 opacity-30 hover:none'
                            }`}
                          >
                            <div className="text-left font-medium">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-extrabold text-xs text-slate-150">{emp.name}</h4>
                                <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded ${
                                  isPurchased 
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {isPurchased ? 'Contratado' : `Rango ${emp.level}`}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">{emp.benefit}</p>
                            </div>

                            <div className="shrink-0 text-right">
                              {isPurchased ? (
                                <span className="flex items-center gap-1 text-emerald-400 font-extrabold text-[10px] bg-emerald-500/15 border border-emerald-500/20 p-1.5 px-3 rounded-lg select-none">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Activo
                                </span>
                              ) : isLocked ? (
                                <span className="flex items-center gap-0.5 text-slate-655 font-bold text-[10px] p-1.5 px-3 rounded select-none cursor-not-allowed">
                                  <Lock className="w-3.5 h-3.5" /> Cerrado
                                </span>
                              ) : (
                                <button
                                  disabled={!canAfford}
                                  onClick={() => {
                                    onUpgradeEmployee(emp.level, emp.cost);
                                  }}
                                  className={`py-2 px-3 rounded-lg font-bold text-[10px] transition uppercase flex items-center justify-center gap-1 cursor-pointer ${
                                    canAfford
                                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-450 font-black shadow-sm'
                                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                                  }`}
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  {canAfford ? `$${emp.cost}` : `Falta dinero ($${emp.cost})`}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 px-5 py-3 flex justify-between items-center border-t border-slate-805 text-[10px] text-slate-500">
          <p className="font-extrabold uppercase tracking-wide">Pasantía e Imperio Comercial v1.3</p>
          <button 
            id="close-own-pizzeria-footer-btn"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition border border-slate-705 uppercase cursor-pointer"
          >
            Cerrar Tablero
          </button>
        </div>
      </div>
    </div>
  );
};
