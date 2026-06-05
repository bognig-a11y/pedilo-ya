/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shuffle, Coins, DollarSign, HelpCircle, RefreshCw, XCircle, ChevronUp, ChevronDown, Award } from 'lucide-react';
import { Upgrades } from '../types';
import { audio } from '../utils/audio';

interface CasinoModalProps {
  isOpen: boolean;
  onClose: () => void;
  money: number;
  upgrades: Upgrades;
  onAddMoney: (amount: number) => void;
}

type Mode = 'menu' | 'ruleta' | 'slots' | 'hilo';

interface Card {
  suit: '♥' | '♦' | '♣' | '♠';
  value: number; // 2-14 (Jack=11, Queen=12, King=13, Ace=14)
}

const SUITS: Card['suit'][] = ['♥', '♦', '♣', '♠'];
const SUIT_COLORS = {
  '♥': 'text-red-500',
  '♦': 'text-red-500',
  '♣': 'text-gray-800',
  '♠': 'text-gray-800',
};

export const CasinoModal: React.FC<CasinoModalProps> = ({
  isOpen,
  onClose,
  money,
  upgrades,
  onAddMoney,
}) => {
  const [activeMode, setActiveMode] = useState<Mode>('menu');

  // General Slots State
  const [slotBet, setSlotBet] = useState(50);
  const [reels, setReels] = useState(['🍒', '🍒', '🍒']);
  const [isSpinningSlots, setIsSpinningSlots] = useState(false);
  const [slotsResult, setSlotsResult] = useState<string | null>(null);

  // Roulette States
  const [rouletteBet, setRouletteBet] = useState(50);
  const [rouletteBetType, setRouletteBetType] = useState<'rojo' | 'negro' | 'par' | 'impar' | 'siete'>('rojo');
  const [isSpinningRoulette, setIsSpinningRoulette] = useState(false);
  const [rouletteRoll, setRouletteRoll] = useState<{ number: number; color: 'rojo' | 'negro' | 'verde' } | null>(null);
  const [rouletteResult, setRouletteResult] = useState<string | null>(null);

  // Hi-Lo Poker States
  const [hiloBet, setHiloBet] = useState(50);
  const [hiloActive, setHiloActive] = useState(false);
  const [hiloCard, setHiloCard] = useState<Card>({ suit: '♥', value: 8 });
  const [hiloStreak, setHiloStreak] = useState(0);
  const [hiloAccumulated, setHiloAccumulated] = useState(0);
  const [lastLostAmount, setLastLostAmount] = useState<number>(0);
  const [hiloFeedback, setHiloFeedback] = useState<string | null>(null);

  // Initialize random cards
  const getRandomCard = (excludeVal?: number): Card => {
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    let value = Math.floor(Math.random() * 13) + 2;
    if (excludeVal && value === excludeVal) {
      value = value === 14 ? 13 : value + 1;
    }
    return { suit, value };
  };

  const getCardName = (val: number): string => {
    if (val <= 10) return val.toString();
    if (val === 11) return 'J';
    if (val === 12) return 'Q';
    if (val === 13) return 'K';
    return 'A';
  };

  // Luck Multiplier
  const luckBoost = upgrades.suerte * 0.025; // max 25% extra probability offset

  // Clean state when changing tabs
  useEffect(() => {
    setSlotsResult(null);
    setRouletteResult(null);
    setHiloFeedback(null);
  }, [activeMode]);

  // Handle exiting the entire casino
  const handleExitCasino = () => {
    // Reset Hi-Lo penalty
    setLastLostAmount(0);
    onClose();
  };

  // --- SLOT MACHINE ENGINE ---
  const spinSlots = () => {
    if (money < slotBet) {
      audio.playFail();
      setSlotsResult('¡No tienes suficiente dinero!');
      return;
    }

    onAddMoney(-slotBet);
    setIsSpinningSlots(true);
    setSlotsResult(null);
    audio.playCasinoCoin();

    const emojis = ['🍒', '🍋', 'Orange', '🍇', '🔔', '7️⃣'];
    let count = 0;
    const interval = setInterval(() => {
      setReels([
        emojis[Math.floor(Math.random() * emojis.length)],
        emojis[Math.floor(Math.random() * emojis.length)],
        emojis[Math.floor(Math.random() * emojis.length)],
      ]);
      count++;
      if (count % 4 === 0) {
        audio.playCasinoCoin();
      }
      if (count > 15) {
        clearInterval(interval);
        evaluateSlots();
      }
    }, 80);
  };

  const evaluateSlots = () => {
    const emojis = ['🍒', '🍋', '🍊', '🍇', '🔔', '7️⃣'];
    let finalReels = [
      emojis[Math.floor(Math.random() * emojis.length)],
      emojis[Math.floor(Math.random() * emojis.length)],
      emojis[Math.floor(Math.random() * emojis.length)],
    ];

    // Luck boost re-roll algorithm
    const hasThree = finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2];
    const hasTwo = finalReels[0] === finalReels[1] || finalReels[1] === finalReels[2] || finalReels[0] === finalReels[2];

    if (!hasThree && Math.random() < luckBoost) {
      // Re-roll luck! Force a winning layout
      const luckyEmoji = finalReels[Math.floor(Math.random() * 3)];
      if (Math.random() < 0.2) {
        // Force Triple!
        finalReels = [luckyEmoji, luckyEmoji, luckyEmoji];
      } else {
        // Force Double!
        finalReels[0] = luckyEmoji;
        finalReels[1] = luckyEmoji;
      }
    }

    setReels(finalReels);
    setIsSpinningSlots(false);

    const [r1, r2, r3] = finalReels;
    if (r1 === r2 && r2 === r3) {
      // Match 3!
      let mult = 12;
      if (r1 === '7️⃣') mult = 50;
      else if (r1 === '🔔') mult = 25;
      
      const prize = slotBet * mult;
      onAddMoney(prize);
      audio.playCasinoWin();
      setSlotsResult(`🎰 ¡TRIPLE MATCH! Ganaste $${prize} (${mult}x)`);
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      // Match 2!
      const prize = Math.round(slotBet * 2.5);
      onAddMoney(prize);
      audio.playCasinoWin();
      setSlotsResult(`🍒 ¡Doble! Ganaste $${prize} (2.5x)`);
    } else {
      audio.playCasinoLose();
      setSlotsResult('Has perdido la apuesta. Inténtalo de nuevo.');
    }
  };


  // --- ROULETTE ENGINE ---
  const spinRoulette = () => {
    if (money < rouletteBet) {
      audio.playFail();
      setRouletteResult('¡No tienes suficiente dinero!');
      return;
    }

    onAddMoney(-rouletteBet);
    setIsSpinningRoulette(true);
    setRouletteResult(null);

    let rotations = 0;
    const interval = setInterval(() => {
      // Pick a random number between 0 and 36
      const num = Math.floor(Math.random() * 37);
      const col = num === 0 ? 'verde' : (num % 2 === 0 ? 'negro' : 'rojo');
      setRouletteRoll({ number: num, color: col });
      rotations++;
      if (rotations % 5 === 0) audio.playCasinoCoin();

      if (rotations > 18) {
        clearInterval(interval);
        evaluateRoulette();
      }
    }, 70);
  };

  const evaluateRoulette = () => {
    let rolledNumber = Math.floor(Math.random() * 37);
    
    // Luck adjustment: if losing is close, occasionally nudge color to match bet
    if (Math.random() < luckBoost) {
      if (rouletteBetType === 'rojo' && rolledNumber % 2 === 0 && rolledNumber !== 0) {
        rolledNumber = (rolledNumber + 1) % 37; // Shift to an odd number (Red usually)
        if (rolledNumber === 0) rolledNumber = 3;
      } else if (rouletteBetType === 'negro' && rolledNumber % 2 !== 0) {
        rolledNumber = (rolledNumber + 1) % 37; // Shift to even (Black usually)
        if (rolledNumber === 0) rolledNumber = 2;
      }
    }

    const rolledColor = rolledNumber === 0 ? 'verde' : (rolledNumber % 2 === 0 ? 'negro' : 'rojo');
    setRouletteRoll({ number: rolledNumber, color: rolledColor });
    setIsSpinningRoulette(false);

    let isWin = false;
    let multiplier = 2;

    if (rouletteBetType === 'rojo' && rolledColor === 'rojo') {
      isWin = true;
    } else if (rouletteBetType === 'negro' && rolledColor === 'negro') {
      isWin = true;
    } else if (rouletteBetType === 'par' && rolledNumber > 0 && rolledNumber % 2 === 0) {
      isWin = true;
    } else if (rouletteBetType === 'impar' && rolledNumber % 2 !== 0) {
      isWin = true;
    } else if (rouletteBetType === 'siete' && rolledNumber === 7) {
      isWin = true;
      multiplier = 35; // 35x payout for Lucky 7!
    }

    if (isWin) {
      const prize = rouletteBet * multiplier;
      onAddMoney(prize);
      audio.playCasinoWin();
      setRouletteResult(`🎉 ¡Ganaste! Salió ${rolledColor.toUpperCase()} ${rolledNumber}. Cobras $${prize} (${multiplier}x)`);
    } else {
      audio.playCasinoLose();
      setRouletteResult(`😔 Perdiste. Cayó ${rolledColor.toUpperCase()} ${rolledNumber}. Mejor suerte la próxima.`);
    }
  };


  // --- HIGH / LOW POWER GAME ---
  const startHilo = () => {
    if (money < hiloBet) {
      audio.playFail();
      setHiloFeedback('¡No tienes suficiente efectivo para apostar!');
      return;
    }

    onAddMoney(-hiloBet);
    setHiloCard(getRandomCard());
    setHiloStreak(0);
    setHiloAccumulated(hiloBet);
    setHiloActive(true);
    setHiloFeedback(null);
    audio.playCasinoCoin();
  };

  const playHiloGuess = (guess: 'mayor' | 'menor') => {
    if (!hiloActive) return;

    const nextCard = getRandomCard(hiloCard.value);
    const isCorrect = (guess === 'mayor' && nextCard.value > hiloCard.value) ||
                      (guess === 'menor' && nextCard.value < hiloCard.value);

    // Apply some slight Luck Boost to let players slip through ties or close values
    const nearValue = Math.abs(nextCard.value - hiloCard.value) === 1;
    let finalOutcome = isCorrect;
    if (!isCorrect && nearValue && Math.random() < luckBoost) {
      finalOutcome = true; // Save by luck!
    }

    if (finalOutcome) {
      // Streak gains!
      const nextStreak = hiloStreak + 1;
      // Increment payout by 1.8x per successful card
      const nextAccum = Math.round(hiloAccumulated * 1.6);
      
      setHiloCard(nextCard);
      setHiloStreak(nextStreak);
      setHiloAccumulated(nextAccum);
      setHiloFeedback(`✨ ¡Acertaste! Salió ${getCardName(nextCard.value)}${nextCard.suit}. Pila acumulada: $${nextAccum}`);
      audio.playSuccess();
    } else {
      // Failed!
      // "Si falla: Pierde toda la ganancia acumulada de esa racha."
      const lostRachaAmt = hiloAccumulated;
      setLastLostAmount(lostRachaAmt);

      setHiloFeedback(`💥 ¡Fallaste! Salió ${getCardName(nextCard.value)}${nextCard.suit}. Perdiste toda tu ganancia acumulada de $${lostRachaAmt}.`);
      setHiloCard(nextCard);
      setHiloAccumulated(0);
      setHiloStreak(0);
      setHiloActive(false);
      audio.playFail();
    }
  };

  const handleHiloConsecutiveLoss = () => {
    // "Si vuelve a fallar posteriormente (desde el menú principal / sin racha activa): pierde nuevamente la misma cantidad que perdió la última vez."
    if (lastLostAmount <= 0) {
      setHiloFeedback('Aún no tienes una penalización registrada.');
      return;
    }

    if (money < lastLostAmount) {
      audio.playFail();
      setHiloFeedback(`¡No puedes pagar la penalización de $${lastLostAmount} para reintentar!`);
      return;
    }

    onAddMoney(-lastLostAmount);
    setHiloFeedback(`💸 ¡Penalizado! Perdiste $${lastLostAmount} debido al fallo anterior. La penalización se reinicia al salir del Casino.`);
    setHiloCard(getRandomCard());
    setHiloStreak(0);
    setHiloAccumulated(0);
    setHiloActive(false);
    audio.playFail();
  };

  const cashoutHilo = () => {
    if (!hiloActive || hiloAccumulated <= 0) return;
    onAddMoney(hiloAccumulated);
    audio.playCasinoWin();
    setHiloFeedback(`💰 ¡Has cobrado la racha! Añadido $${hiloAccumulated} a tu inventario.`);
    setHiloActive(false);
    setHiloAccumulated(0);
    setHiloStreak(0);
  };


  if (!isOpen) return null;

  return (
    <div id="casino-modal-overlay" className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        id="casino-modal-container"
        className="bg-slate-900 rounded-[32px] shadow-2xl max-w-3xl w-full border-4 border-yellow-400 overflow-hidden text-slate-100 flex flex-col max-h-[92vh] animate-fade-in"
      >
        {/* Neon Casino Header */}
        <div className="bg-gradient-to-r from-red-650 via-purple-900 to-amber-700 p-6 flex justify-between items-center border-b-2 border-amber-500">
          <div className="flex items-center gap-3">
            <div className="bg-amber-400 p-2.5 rounded-2xl shadow-lg border-2 border-white animate-pulse">
              <Coins className="w-8 h-8 text-yellow-950 fill-amber-700" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-widest text-amber-300 font-serif uppercase">Isla Fortune Casino</h2>
              <p className="text-xs font-semibold text-amber-100 opacity-90 font-mono">¡Multiplica tu capital de delivery! Suerte actual: +{(upgrades.suerte * 2.5).toFixed(1)}%</p>
            </div>
          </div>
          <button 
            id="close-casino-btn"
            onClick={handleExitCasino}
            className="text-amber-100 hover:text-white bg-slate-800/80 hover:bg-red-500/85 p-2 px-4 rounded-xl border border-amber-500/30 font-black text-sm transition"
          >
            Salir Casino (X)
          </button>
        </div>

        {/* Casino navigation menu if in a game */}
        {activeMode !== 'menu' && (
          <div className="bg-slate-850 p-2 border-b border-slate-800 flex justify-between items-center px-6">
            <button
              onClick={() => setActiveMode('menu')}
              className="text-xs bg-slate-800 hover:bg-slate-700 font-bold py-1 px-3 rounded-lg border border-slate-700 flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Cambiar de Juego
            </button>
            <div className="text-sm font-bold flex items-center gap-1 bg-slate-800 px-3 py-1 rounded-full border border-slate-750">
              <span className="text-yellow-400">$</span>
              <span>Fondos: <strong className="text-white font-mono">{money}</strong></span>
            </div>
          </div>
        )}

        {/* MAIN BODY AREA */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-950 font-sans">
          
          {/* MENU VIEW */}
          {activeMode === 'menu' && (
            <div className="space-y-6">
              {/* Pocket Info */}
              <div className="bg-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center border border-slate-800 gap-3">
                <div>
                  <h3 className="font-bold text-yellow-400 text-sm">¿Te sientes con suerte hoy?</h3>
                  <p className="text-xs text-slate-400">Invierte parte de tu sueldo para obtener ganancias colosales.</p>
                </div>
                <div className="text-2xl font-serif font-black text-yellow-300 bg-slate-950 p-2 px-6 rounded-xl border border-yellow-500/30 flex items-center gap-1">
                  <span className="text-green-500 text-xl font-sans">$</span>
                  <span className="font-mono">{money}</span>
                </div>
              </div>

              {/* Three selection panels */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Roulette */}
                <div className="bg-slate-900 border border-red-500/40 rounded-2xl p-5 flex flex-col justify-between hover:border-red-500 hover:shadow-lg transition">
                  <div className="space-y-2">
                    <div className="bg-red-500/10 text-red-400 p-2 rounded-xl w-10 h-10 flex items-center justify-center font-bold font-serif text-lg border border-red-500/20">
                      R
                    </div>
                    <h3 className="font-bold text-base text-white">Ruleta Clásica</h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">Bet on colors, evens, or hit the jackpot placing a single bet on Lucky 7 (remunera 35x)!</p>
                  </div>
                  <button
                    onClick={() => setActiveMode('ruleta')}
                    className="mt-5 w-full bg-red-650 hover:bg-red-700 text-white py-2 rounded-xl text-xs font-bold font-sans transition-all border border-red-500"
                  >
                    Girar la Ruleta
                  </button>
                </div>

                {/* 2. Slots */}
                <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between hover:border-amber-500 hover:shadow-lg transition">
                  <div className="space-y-2">
                    <div className="bg-amber-500/10 text-amber-400 p-2 rounded-xl w-10 h-10 flex items-center justify-center font-bold text-base border border-amber-500/20">
                      777
                    </div>
                    <h3 className="font-bold text-base text-white">Tragamonedas</h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">Prueba la máquina de frutas. ¡Dos iguales multiplican, y tres campanas o sietes pagan asombrosamente!</p>
                  </div>
                  <button
                    onClick={() => setActiveMode('slots')}
                    className="mt-5 w-full bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-xl text-xs font-bold font-sans transition-all border border-amber-500"
                  >
                    Jugar Slots (Tragamonedas)
                  </button>
                </div>

                {/* 3. Hi-Lo */}
                <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-5 flex flex-col justify-between hover:border-purple-500 hover:shadow-lg transition">
                  <div className="space-y-2">
                    <div className="bg-purple-500/10 text-purple-400 p-2 rounded-xl w-10 h-10 flex items-center justify-center font-bold text-base border border-purple-500/20">
                      K♠
                    </div>
                    <h3 className="font-bold text-base text-white">Mayor o Menor</h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">Adivina si la siguiente carta es superior o inferior. ¡Genera rachas locas! Pierde todo si fallas.</p>
                  </div>
                  <button
                    onClick={() => setActiveMode('hilo')}
                    className="mt-5 w-full bg-purple-650 hover:bg-purple-700 text-white py-2 rounded-xl text-xs font-bold font-sans transition-all border border-purple-500"
                  >
                    Jugar Mayor/Menor
                  </button>
                </div>
              </div>

              {lastLostAmount > 0 && (
                <div className="bg-purple-950/40 border border-purple-500/30 rounded-2xl p-4 text-center">
                  <p className="text-xs text-purple-300 font-semibold">
                    ⚠️ Tienes un registro de última pérdida en Mayor o Menor: <strong className="text-white">${lastLostAmount}</strong>.
                  </p>
                  <p className="text-[10px] text-purple-400">Si vuelves a arrancar el juego y sales perdiendo, se te cobrará esta suma de penalización.</p>
                </div>
              )}
            </div>
          )}


          {/* 1. RULETA VIEW */}
          {activeMode === 'ruleta' && (
            <div className="space-y-6 max-w-md mx-auto text-center">
              <h3 className="text-lg font-serif text-amber-400 uppercase tracking-wide">Mesa de Ruleta de la Suerte</h3>
              
              {/* Spinner animation look */}
              <div className="h-28 bg-slate-910 rounded-2xl border-2 border-red-500/30 flex items-center justify-center relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
                {isSpinningRoulette ? (
                  <div className="space-y-2">
                    <div className="text-3xl font-black font-mono tracking-wider animate-bounce text-red-400">
                      {rouletteRoll ? rouletteRoll.number : '...'}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono animate-pulse">¡BOLILLA GIRANDO EN EL TAMBOR!</p>
                  </div>
                ) : rouletteRoll ? (
                  <div className="text-center space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">RESULTADOS</span>
                    <span className={`text-4xl font-black px-6 py-2 rounded-2xl inline-block ${
                      rouletteRoll.color === 'verde' ? 'bg-green-600 text-white' : (rouletteRoll.color === 'rojo' ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-white')
                    }`}>
                      {rouletteRoll.number}
                    </span>
                    <span className="text-xs block font-bold uppercase text-slate-300 opacity-90">
                      Color: {rouletteRoll.color.toUpperCase()}
                    </span>
                  </div>
                ) : (
                  <div className="text-slate-400 text-sm font-semibold">Prepara tu ficha y haz girar la rueda</div>
                )}
              </div>

              {/* Bets configuration */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3 text-left">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-300">Monto del Bet ($):</label>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setRouletteBet(Math.max(10, rouletteBet - 10))}
                      className="bg-slate-800 hover:bg-slate-700 text-white p-1 px-2.5 rounded-lg text-xs font-black font-mono"
                    >
                      -10
                    </button>
                    <span className="font-mono font-bold bg-slate-950 p-1 px-4 rounded text-sm text-yellow-300 border border-slate-800">${rouletteBet}</span>
                    <button 
                      onClick={() => setRouletteBet(Math.min(1000, rouletteBet + 15))}
                      className="bg-slate-800 hover:bg-slate-700 text-white p-1 px-2.5 rounded-lg text-xs font-black font-mono"
                    >
                      +15
                    </button>
                  </div>
                </div>

                <hr className="border-slate-800" />

                {/* Bet Types */}
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-300 mb-1">Tipo de Apuesta:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'rojo', label: 'Rojo (x2)', color: 'bg-red-650 hover:bg-red-700 border-red-500' },
                      { id: 'negro', label: 'Negro (x2)', color: 'bg-slate-800 hover:bg-slate-750 border-slate-650' },
                      { id: 'par', label: 'Números Par (x2)', color: 'bg-blue-900/60 hover:bg-blue-800 border-blue-500' },
                      { id: 'impar', label: 'Números Impar (x2)', color: 'bg-amber-900/60 hover:bg-amber-800 border-amber-500' },
                      { id: 'siete', label: 'Siete de Oro (x35!)', color: 'bg-yellow-600 hover:bg-yellow-700 border-yellow-400' },
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setRouletteBetType(type.id as any)}
                        className={`text-xs py-2 px-1 rounded-xl font-bold border-2 transition ${type.color} ${
                          rouletteBetType === type.id 
                            ? 'ring-4 ring-yellow-400 text-white border-white scale-[1.03]' 
                            : 'text-slate-200'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feedback text */}
              {rouletteResult && (
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-bold text-amber-300">
                  {rouletteResult}
                </div>
              )}

              {/* Spin command */}
              <button
                id="spin-roulette-btn"
                disabled={isSpinningRoulette}
                onClick={spinRoulette}
                className={`w-full py-3 rounded-2xl font-black tracking-wider text-sm transition-all border ${
                  isSpinningRoulette 
                    ? 'bg-gray-700 border-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-yellow-500 hover:bg-yellow-650 text-slate-950 border-yellow-400 hover:shadow-lg transform active:scale-95'
                }`}
              >
                {isSpinningRoulette ? '¡Girando Baliza!' : '🔴 GIRAR RULETA 🔴'}
              </button>
            </div>
          )}


          {/* 2. SLOTS VIEW */}
          {activeMode === 'slots' && (
            <div className="space-y-6 max-w-sm mx-auto text-center">
              <h3 className="text-lg font-serif text-amber-400 uppercase tracking-wide">Tragamonedas "El Kiwi de Oro"</h3>

              {/* Reels Display */}
              <div className="bg-gradient-to-b from-slate-950 to-slate-900 p-4 rounded-3xl border-4 border-amber-500 shadow-xl relative">
                {/* Neon lighting */}
                <div className="absolute inset-x-0 top-1 h-1 bg-amber-400 shadow-lg blur-xs" />
                <div className="flex justify-center gap-3 py-4">
                  {reels.map((symbol, idx) => (
                    <div 
                      key={idx}
                      className="w-18 h-20 bg-white rounded-2xl text-4xl flex items-center justify-center border-4 border-slate-700 shadow-inner select-none transform transition font-black relative"
                    >
                      <span className="block leading-none">{symbol}</span>
                      {/* Reflection effects */}
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-transparent rounded-xl" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Bet Controls */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center text-left">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase font-mono">Apuesta por palanca</span>
                  <p className="text-sm font-black font-mono text-yellow-300">${slotBet}</p>
                </div>
                <div className="flex gap-1">
                  {[20, 50, 100, 200, 500].map(val => (
                    <button
                      key={val}
                      onClick={() => setSlotBet(val)}
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition border ${
                        slotBet === val 
                          ? 'bg-amber-500 text-slate-950 border-white' 
                          : 'bg-slate-800 text-slate-350 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Results */}
              {slotsResult && (
                <div className="p-3 bg-slate-900 border border-slate-800 text-xs font-bold rounded-xl text-yellow-400">
                  {slotsResult}
                </div>
              )}

              {/* Pull handle */}
              <button
                id="spin-slots-btn"
                disabled={isSpinningSlots}
                onClick={spinSlots}
                className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition duration-200 border ${
                  isSpinningSlots 
                    ? 'bg-gray-700 border-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-650 hover:to-yellow-500 text-slate-950 border-yellow-300 shadow-md hover:shadow-yellow-400/20 active:scale-95'
                }`}
              >
                {isSpinningSlots ? '🎰 Tirando engranajes...' : '🍒 TIRAR PALANCA (GIRAR) 🍒'}
              </button>
            </div>
          )}


          {/* 3. MAYOR O MENOR CARD VIEW */}
          {activeMode === 'hilo' && (
            <div className="space-y-6 max-w-md mx-auto text-center">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-serif text-purple-400 uppercase tracking-widest font-bold">Instinto Mayor o Menor</h3>
                <div className="bg-purple-900/60 p-1 px-3 rounded-lg text-xs font-mono font-bold text-purple-300 border border-purple-500/20">
                  Racha activa: <strong className="text-white text-sm">{hiloStreak}</strong>
                </div>
              </div>

              {/* Card stage */}
              <div className="bg-slate-910 p-5 rounded-3xl border-2 border-purple-500/30 flex justify-center items-center gap-6 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
                {/* Active Card */}
                <div className="w-28 h-40 bg-white rounded-2xl border-4 border-slate-300 shadow-2xl relative flex flex-col justify-between p-3 select-none text-slate-950 transform hover:scale-105 transition">
                  <div className={`text-xl font-black leading-none text-left ${SUIT_COLORS[hiloCard.suit]}`}>
                    {getCardName(hiloCard.value)}
                    <span className="block text-xs font-serif">{hiloCard.suit}</span>
                  </div>
                  
                  <div className={`text-5xl text-center font-bold ${SUIT_COLORS[hiloCard.suit]}`}>
                    {hiloCard.suit}
                  </div>

                  <div className={`text-xl font-black leading-none text-right scale-y-[-1] scale-x-[-1] ${SUIT_COLORS[hiloCard.suit]}`}>
                    {getCardName(hiloCard.value)}
                    <span className="block text-xs font-serif">{hiloCard.suit}</span>
                  </div>
                </div>

                {/* Stats panel on card right */}
                <div className="text-left space-y-1.5 min-w-[150px]">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Acumulando Multiplicador</p>
                  {hiloActive ? (
                    <>
                      <div className="text-2xl font-black text-green-400 font-mono leading-none">
                        ${hiloAccumulated}
                      </div>
                      <p className="text-[10px] text-slate-450">Si aciertas, tu bolsa se multiplicará.</p>
                      
                      <button
                        onClick={cashoutHilo}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-black text-[11px] py-1.5 px-3 rounded-lg border border-green-500 transition shadow"
                      >
                        📥 Cobrar y Salvar
                      </button>
                    </>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-slate-400 text-xs">Alinea tu racha de predicciones físicas.</p>
                      <button
                        onClick={startHilo}
                        className="w-full bg-purple-600 hover:bg-purple-750 text-white font-black text-xs py-2 px-3 rounded-xl border border-purple-400 transition shadow"
                      >
                        Jugar Próxima Ronda
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Guesses control elements */}
              {hiloActive && (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => playHiloGuess('mayor')}
                    className="bg-emerald-600 hover:bg-emerald-650 text-white font-heavy flex items-center justify-center flex-col py-3.5 rounded-2xl transition border-2 border-emerald-500 transform active:scale-95 shadow font-bold text-xs"
                  >
                    <ChevronUp className="w-5 h-5 animate-bounce" />
                    ¿Siguiente es MAYOR?
                  </button>

                  <button
                    onClick={() => playHiloGuess('menor')}
                    className="bg-red-600 hover:bg-red-650 text-white font-heavy flex items-center justify-center flex-col py-3.5 rounded-2xl transition border-2 border-red-500 transform active:scale-95 shadow font-bold text-xs"
                  >
                    <ChevronDown className="w-5 h-5 animate-bounce" />
                    ¿Siguiente es MENOR?
                  </button>
                </div>
              )}


              {/* Additional option: Pay last failed fine to bypass */}
              {!hiloActive && lastLostAmount > 0 && (
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-left space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-350">⚠️ ¿Hacer un pago de re-enganche?</span>
                    <strong className="text-red-400 text-xs font-mono font-bold">${lastLostAmount}</strong>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">Pagas el seguro compensatorio idéntico al último pozo para limpiar tu historial o continuar.</p>
                  <button
                    onClick={handleHiloConsecutiveLoss}
                    className="w-full bg-red-900/60 hover:bg-red-900 text-red-200 border border-red-500/30 text-xs py-2 rounded-xl transition font-semibold"
                  >
                    Pagar Penalización para Reintentar
                  </button>
                </div>
              )}

              {/* Hilo feedback text */}
              {hiloFeedback && (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-purple-300 tracking-wide text-left">
                  {hiloFeedback}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Rules explanation in bottom */}
        <div className="bg-slate-900 py-3 px-6 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400 font-mono">
          <span>* El juego responsable es obligatorio de acuerdo a los decretos de la Isla.</span>
          <button 
            id="casino-close-bottom-btn"
            onClick={handleExitCasino}
            className="text-slate-300 hover:text-white bg-slate-800 px-3 py-1 rounded border border-slate-700 transition"
          >
            Cerrar Casino
          </button>
        </div>
      </div>
    </div>
  );
};
