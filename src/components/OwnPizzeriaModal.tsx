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
  Lock
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
}) => {
  const [activeTab, setActiveTab] = useState<'pedidos' | 'renovacion' | 'empleados'>('pedidos');

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
      desc: 'Soluciona muros agrietados, reemplaza los cristales rotos de la fachada e instala un cartel corporativo luminoso.',
      benefit: 'Los pedidos manuales pagan ahora el 100% de su valor (antes pagaban el 50% por la apariencia dilapidada).',
      icon: Hammer,
    },
    {
      level: 2,
      cost: 20000,
      title: 'Apertura Comercial',
      desc: 'Equipa la cocina con hornos profesionales, abre las puertas al público de la isla e inicia campañas de marketing local.',
      benefit: 'Los pedidos aumentan en +1.0% la competencia (en lugar del +0.2%). El porcentaje se redondea al entero más cercano tras el primer pedido.',
      icon: Sparkles,
    },
    {
      level: 3,
      cost: 30000,
      title: 'Negocio Operativo',
      desc: 'Centraliza un panel automatizado de pedidos y habilita la red logística de despacho rápido.',
      benefit: 'Cada 30s de juego: Obtienes +2.0% de participación de mercado y +$200 de ingreso automático. ¡Desbloquea el panel de Empleados!',
      icon: TrendingUp,
    }
  ];

  // Employees details: level, cost, name, passive benefits, requirement
  const EMPLOYEES_LIST = [
    {
      level: 1,
      cost: 3000,
      name: 'Repartidor Novato',
      benefit: 'Cada 30 Segundos: +3% Competencia y +$300 Cash pasivo',
      perSec: 'Cada 30s',
      income: '$300',
      share: '+3%'
    },
    {
      level: 2,
      cost: 4000,
      name: 'Repartidor Experimentado',
      benefit: 'Cada 30 Segundos: +4% Competencia y +$400 Cash pasivo',
      perSec: 'Cada 30s',
      income: '$400',
      share: '+4%'
    },
    {
      level: 3,
      cost: 5000,
      name: 'Distribuidor Profesional',
      benefit: 'Cada 30 Segundos: +5% Competencia y +$500 Cash pasivo',
      perSec: 'Cada 30s',
      income: '$500',
      share: '+5%'
    },
    {
      level: 4,
      cost: 7500,
      name: 'Súper Repartidor Experto',
      benefit: 'Cada 30 Segundos: +5% Competencia y +$1000 Cash pasivo',
      perSec: 'Cada 30s',
      income: '$1000',
      share: '+5%'
    },
    {
      level: 5,
      cost: 10000,
      name: 'Flota Máxima Experto+',
      benefit: 'Cada 15 Segundos: +5% Competencia y +$1000 Cash pasivo',
      perSec: 'Cada 15s',
      income: '$1000',
      share: '+5%'
    }
  ];

  const currentRenovation = RENOVATIONS_LIST.find(r => r.level === renovationLevel + 1);
  const nextEmployee = EMPLOYEES_LIST.find(e => e.level === employeeLevel + 1);

  return (
    <div id="own-pizzeria-modal-overlay" className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div 
        id="own-pizzeria-modal-container"
        className="bg-slate-900 rounded-[32px] shadow-25 max-w-4xl w-full overflow-hidden text-slate-100 flex flex-col h-[600px] transform scale-100 transition-all duration-305 border-4"
        style={{ borderColor: pizzeriaColor }}
      >
        {/* Header - Corporate Theme */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 p-6 flex justify-between items-center border-b-2 border-slate-800">
          <div className="flex items-center gap-3">
            <div className="text-slate-950 p-3 rounded-2xl shadow-lg relative animate-pulse" style={{ backgroundColor: pizzeriaColor }}>
              <Pizza className="w-8 h-8 fill-slate-950" />
              <Zap className="w-4 h-4 absolute -bottom-1 -right-1 text-red-700 bg-white rounded-full p-0.5" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight font-serif uppercase" style={{ color: pizzeriaColor }}>{pizzeriaName}</h2>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Despacho Central de Distribución y Negocios</p>
            </div>
          </div>
          <button 
            id="close-own-pizzeria-btn"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 p-2.5 px-5 rounded-2xl transition font-black text-xs cursor-pointer uppercase"
          >
            Volver al Mapa (X)
          </button>
        </div>

        {/* Corporate Status Sub-Banner */}
        <div className="bg-slate-950/90 py-3 px-6 flex flex-wrap justify-between items-center text-xs border-b border-slate-800 gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5" title="Cuota que domina tu marca">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Participación de Mercado: <strong className="text-emerald-400 text-sm font-mono font-black">{playerMarketShare}%</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-rose-455" title="Cuota de la competencia rival">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span>Pizzería Rival: <strong className="text-red-400 text-sm font-mono font-black">{rivalMarketShare}%</strong></span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="bg-slate-800 p-1 px-2.5 rounded-lg border border-slate-700 text-slate-350">
              Efectivo: <strong className="text-yellow-400 font-mono font-bold">${money}</strong>
            </span>
            <span className="bg-slate-800 p-1 px-2.5 rounded-lg border border-slate-700 text-slate-350">
              Edificio: <strong className="text-amber-400 font-bold">Nivel {renovationLevel}</strong>
            </span>
          </div>
        </div>

        {/* Main Body - Left Sidebar Tabs & Right Dashboard Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-52 bg-slate-950 border-r border-slate-800 p-4 space-y-2 shrink-0">
            <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest pl-2 mb-3">Secciones Tycoon</p>
            
            <button
              onClick={() => { audio.playUpgrade(); setActiveTab('pedidos'); }}
              className={`w-full flex items-center gap-2.5 p-3 rounded-xl transition text-xs font-black uppercase text-left ${
                activeTab === 'pedidos' 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              <span>Pedidos Activos</span>
            </button>

            <button
              onClick={() => { audio.playUpgrade(); setActiveTab('renovacion'); }}
              className={`w-full flex items-center gap-2.5 p-3 rounded-xl transition text-xs font-black uppercase text-left ${
                activeTab === 'renovacion' 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
            >
              <Hammer className="w-4 h-4 shrink-0" />
              <span>Reformas Base</span>
            </button>

            <button
              onClick={() => { audio.playUpgrade(); setActiveTab('empleados'); }}
              className={`w-full flex items-center gap-2.5 p-3 rounded-xl transition text-xs font-black uppercase text-left relative ${
                activeTab === 'empleados' 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              } ${renovationLevel < 3 ? 'opacity-50' : ''}`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Habilitar Personal</span>
              {renovationLevel < 3 && <Lock className="w-3 h-3 absolute right-3 text-slate-500" />}
            </button>

            <div className="pt-6 border-t border-slate-850 space-y-2 mt-4 select-none">
              <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest pl-2">Estándar Rival</p>
              <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800 text-[10px] text-slate-400 font-semibold font-sans">
                <p>Crecimiento rival: <strong className="text-red-400">+{rivalPassiveRate}% /m</strong></p>
                <p className="mt-1">Efecto: ¡Si la tasa rival alcanza el 100%, pierdes!</p>
              </div>
            </div>
          </div>

          {/* Right Panel Main View Area */}
          <div className="flex-1 p-6 bg-slate-900/60 overflow-y-auto">
            
            {/* TAB: MANUAL PEDIDOS */}
            {activeTab === 'pedidos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                    <Pizza className="w-5 h-5 text-amber-500" /> Despachar Pedidos Manuales
                  </h3>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 p-1 px-2.5 rounded-lg font-bold border border-amber-500/20">
                    Capacidad: {activeOrders.length} / {maxActive}
                  </span>
                </div>

                {isTruck && (
                  <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-2xl p-3 flex items-center gap-2.5 text-emerald-300 text-xs shadow-md">
                    <span className="text-xl animate-bounce">🚚</span>
                    <p className="font-semibold">¡Tienes el Camión activo! El dinero final cobrado de cada despacho manual se <strong>multiplicará automáticamente por x2</strong>.</p>
                  </div>
                )}

                {renovationLevel === 0 && (
                  <div className="bg-red-950/80 border border-red-500/40 rounded-2xl p-3 flex items-center gap-2.5 text-red-300 text-xs shadow-md">
                    <span className="text-xl animate-pulse">🏚️</span>
                    <p className="font-semibold"><strong>Pizzería Deteriorada (Nivel 0)</strong>: Por la mala imagen comercial, las ganancias de pedidos manuales se reducen un <strong className="text-red-400">50%</strong>. Realiza la reforma para cobrar el 100%.</p>
                  </div>
                )}

                {/* Orders Grid Display */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {availableOrders.map((order, i) => {
                    const house = houses.find(h => h.id === order.houseId);
                    if (!house) return null;

                    const colorsMap = {
                      facil: 'border-emerald-500/20 bg-emerald-950/20 text-emerald-400 badge-emerald',
                      medio: 'border-sky-500/20 bg-sky-950/20 text-sky-400 badge-sky',
                      dificil: 'border-rose-500/20 bg-rose-950/20 text-rose-450 badge-rose',
                    };
                    const typeColor = colorsMap[order.difficulty];

                    // Payout modified if Nivel 0
                    const rawReward = order.reward;
                    const finalRew = renovationLevel === 0 ? Math.round(rawReward * 0.5) : rawReward;

                    return (
                      <div key={order.id} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeColor}`}>
                              {order.difficulty}
                            </span>
                            <span className="text-slate-600 font-mono text-xs">#0{i+1}</span>
                          </div>

                          <h4 className="font-bold text-sm text-slate-100">Casa {house.number}</h4>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: house.color }} />
                            <span className="text-[11px] text-slate-400 truncate capitalize font-medium">{house.name}</span>
                          </div>

                          <hr className="my-3 border-dashed border-slate-800" />

                          <div className="space-y-1 text-xs select-none">
                            <div className="flex items-center gap-2 text-slate-400 font-medium">
                              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>Tiempo: <strong className="text-slate-250 font-mono">{order.timeLimit}s</strong></span>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-400 font-bold">
                              <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>Pago: <strong className="text-emerald-300 font-mono text-sm">${isTruck ? finalRew * 2 : finalRew}</strong></span>
                            </div>
                          </div>
                        </div>

                        <button
                          disabled={!canAcceptMore}
                          onClick={() => {
                            audio.playRentPay();
                            onAcceptOrder(order);
                          }}
                          className={`w-full mt-4 py-2 px-3 rounded-xl font-bold text-[11px] transition uppercase cursor-pointer flex items-center justify-center gap-1 shrink-0 ${
                            canAcceptMore
                              ? 'bg-amber-500 text-slate-950 hover:bg-amber-450 shadow-md font-black'
                              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                          }`}
                        >
                          <PlaySquare className="w-4 h-4" />
                          {canAcceptMore ? 'Aceptar' : 'Ocupado'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {availableOrders.length === 0 && (
                  <div className="text-center py-10 bg-slate-950/20 rounded-2xl border border-slate-855 border-dashed">
                    <p className="text-slate-400 font-bold mb-1">No hay pedidos disponibles de la central.</p>
                    <p className="text-[10px] text-slate-500">Se están horneando nuevas comandas de forma automática...</p>
                  </div>
                )}

                {activeOrders.length > 0 && (
                  <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-4 mt-6">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-ping" /> Pedido Cargado en el Repartidor:
                    </h4>
                    {activeOrders.map((ord, idx) => {
                      const targetH = houses.find(h => h.id === ord.houseId);
                      return (
                        <div key={ord.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold text-slate-200">Casa {targetH?.number} ({targetH?.name})</p>
                            <p className="text-slate-500 text-[10px] font-semibold mt-0.5">Destino final del GPS del vehículo</p>
                          </div>
                          <span className="font-mono bg-red-950/50 text-red-400 p-1 px-3.5 rounded-lg font-black border border-red-900/50 flex items-center gap-1.5 shadow-sm">
                            <Clock className="w-3.5 h-3.5 text-red-500" />
                            {idx === 1 ? 'Pausado' : `${Math.ceil(ord.timeLeft)}s...`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: REFORMAS BASE */}
            {activeTab === 'renovacion' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-amber-400 flex items-center gap-2 pb-2 border-b border-slate-800">
                  <Hammer className="w-5 h-5 text-amber-500" /> Inversión y Reformas del Establecimiento
                </h3>
                <p className="text-xs text-slate-400 leading-normal font-medium">Invierte el capital que lograste acumular para reactivar de forma profesional este espacio. Cada nivel habilita notables progresiones físicas y económicas:</p>

                <div className="space-y-4 pt-2">
                  {RENOVATIONS_LIST.map((ren) => {
                    const isPurchased = renovationLevel >= ren.level;
                    const isLocked = ren.level > renovationLevel + 1;
                    const canAfford = money >= ren.cost;
                    const isNextToBuy = renovationLevel === ren.level - 1;

                    return (
                      <div 
                        key={ren.level}
                        className={`border rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition ${
                          isPurchased 
                            ? 'border-emerald-500/40 bg-emerald-950/15' 
                            : isNextToBuy 
                              ? 'border-amber-500/40 bg-slate-950/40' 
                              : 'border-slate-800 bg-slate-950/20 opacity-40'
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className={`p-3 rounded-xl border shrink-0 ${
                            isPurchased 
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                              : isNextToBuy 
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                                : 'bg-slate-800 border-slate-700 text-slate-500'
                          }`}>
                            <ren.icon className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-extrabold text-sm text-slate-100">{ren.title}</h4>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isPurchased 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                {isPurchased ? 'Completa' : `Nivel ${ren.level}`}
                              </span>
                            </div>
                            <p className="text-xs text-slate-450 font-semibold mt-1 leading-normal">{ren.desc}</p>
                            <p className="text-xs text-emerald-400/90 font-bold mt-2 flex items-center gap-1.5">
                              <Award className="w-3.5 h-3.5" /> Efecto: {ren.benefit}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 w-full md:w-auto">
                          {isPurchased ? (
                            <span className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-xs bg-emerald-500/10 border border-emerald-500/30 p-2 px-4 rounded-xl cursor-default select-none">
                              <CheckCircle2 className="w-4 h-4" /> Comprado
                            </span>
                          ) : isLocked ? (
                            <span className="flex items-center gap-1 text-slate-500 font-black text-xs p-2 px-4 rounded-xl select-none cursor-not-allowed">
                              <Lock className="w-3.5 h-3.5" /> Bloqueado
                            </span>
                          ) : (
                            <button
                              disabled={!canAfford}
                              onClick={() => {
                                onUpgradeRenovation(ren.level, ren.cost);
                              }}
                              className={`w-full py-3 px-5 rounded-xl font-bold text-xs transition uppercase flex items-center justify-center gap-1.5 shadow-md ${
                                canAfford
                                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-450 cursor-pointer font-black'
                                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                              }`}
                            >
                              <DollarSign className="w-4 h-4" />
                              {canAfford ? `Comprar ($${ren.cost})` : `Poco Capital ($${ren.cost})`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB: EMPLEADOS */}
            {activeTab === 'empleados' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-amber-400 flex items-center gap-2 pb-2 border-b border-slate-800">
                  <Users className="w-5 h-5 text-amber-500" /> Contratación y Capas de Empleados Automatizados
                </h3>

                {renovationLevel < 3 ? (
                  <div className="bg-slate-950/80 border-2 border-slate-800 p-8 rounded-3xl text-center select-none space-y-4 my-6">
                    <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center mx-auto text-slate-500 shadow-inner">
                      <Lock className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-300 uppercase tracking-wide">Módulo de Empleados Bloqueado</h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-normal">Para poder alojar y automatizar despachos mediante empleados dedicados, necesitas reformar totalmente las instalaciones operativas del edificio alcanzando primero la <strong>Reforma Avanzada Nivel 3 (Negocio Operativo)</strong>.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <p className="text-xs text-slate-400 leading-normal font-medium">Contrata y profesionaliza tu personal automovilístico para automatizar por completo la pizzería principal de la isla. Tus empleados conducirán y despacharán generando ingresos de forma totalmente pasiva y autónoma:</p>

                    <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between text-xs text-emerald-300">
                      <div>
                        <p className="font-bold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-emerald-405" /> ¡Suministro Automatizado en Marcha!</p>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">Tus reclutados visibles recorrerán el vecindario de la isla sumando flujos financieros.</p>
                      </div>
                      <span className="bg-emerald-500/10 border border-emerald-500/30 p-1 px-3 rounded-lg font-mono font-bold">
                        Rango de plantilla actual: Level {employeeLevel} / 5
                      </span>
                    </div>

                    <div className="space-y-4">
                      {EMPLOYEES_LIST.map((emp) => {
                        const isPurchased = employeeLevel >= emp.level;
                        const isLocked = emp.level > employeeLevel + 1;
                        const canAfford = money >= emp.cost;
                        const isNextToBuy = employeeLevel === emp.level - 1;

                        return (
                          <div 
                            key={emp.level}
                            className={`border rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition ${
                              isPurchased 
                                ? 'border-emerald-500/45 bg-emerald-950/10' 
                                : isNextToBuy 
                                  ? 'border-amber-500/40 bg-slate-950/40' 
                                  : 'border-slate-800 bg-slate-950/10 opacity-35'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-extrabold text-sm text-slate-100">{emp.name}</h4>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  isPurchased 
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                                    : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {isPurchased ? 'Activo' : `Upgrade Tier ${emp.level}`}
                                </span>
                              </div>
                              <p className="text-xs text-slate-450 font-semibold mt-1">Efecto: <strong className="text-emerald-400/90">{emp.benefit}</strong></p>
                              <div className="flex items-center gap-4 mt-2.5 text-[10px] text-slate-400">
                                <span className="bg-slate-950/80 p-1 px-2 rounded border border-slate-800 font-semibold">Tasa: <strong className="text-amber-400">{emp.perSec}</strong></span>
                                <span className="bg-slate-950/80 p-1 px-2 rounded border border-slate-800 font-semibold">Ganancia: <strong className="text-green-405">{emp.income}</strong></span>
                                <span className="bg-slate-950/80 p-1 px-2 rounded border border-slate-800 font-semibold">Competencia: <strong className="text-sky-400">{emp.share}</strong></span>
                              </div>
                            </div>

                            <div className="shrink-0 w-full md:w-auto">
                              {isPurchased ? (
                                <span className="flex items-center gap-1.5 text-emerald-450 font-extrabold text-xs bg-emerald-500/10 border border-emerald-500/30 p-2 px-4 rounded-xl select-none cursor-default">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Contratado
                                </span>
                              ) : isLocked ? (
                                <span className="flex items-center gap-1 text-slate-500 font-black text-xs p-2.5 px-4 rounded-xl select-none cursor-not-allowed">
                                  <Lock className="w-3.5 h-3.5" /> Bloqueado
                                </span>
                              ) : (
                                <button
                                  disabled={!canAfford}
                                  onClick={() => {
                                    onUpgradeEmployee(emp.level, emp.cost);
                                  }}
                                  className={`w-full py-3 px-5 rounded-xl font-bold text-xs transition uppercase flex items-center justify-center gap-1 shadow-md ${
                                    canAfford
                                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-450 cursor-pointer font-black'
                                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                                  }`}
                                >
                                  <DollarSign className="w-4 h-4" />
                                  {canAfford ? `Contratar ($${emp.cost})` : `Poco Capital ($${emp.cost})`}
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

        {/* Modal Footer Panel */}
        <div className="bg-slate-950 px-6 py-4 flex justify-between items-center border-t border-slate-850 text-xs text-slate-500 select-none">
          <p className="font-semibold uppercase tracking-wider text-[10px]">Administrador de Imperios v1.2</p>
          <div className="flex gap-2">
            <button 
              id="close-own-pizzeria-footer-btn"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-black transition border border-slate-705 uppercase cursor-pointer"
            >
              Cerrar Tablero
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
