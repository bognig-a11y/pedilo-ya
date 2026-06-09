/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shuffle, Coins, DollarSign, HelpCircle, RefreshCw, XCircle, ChevronUp, ChevronDown, Award } from 'lucide-react';
import { Upgrades } from '../types';
import { audio } from '../utils/audio';
import { RouletteWheel, ROULETTE_ORDER, getRouletteColor } from './RouletteWheel';

interface CasinoModalProps {
  isOpen: boolean;
  onClose: () => void;
  money: number;
  upgrades: Upgrades;
  onAddMoney: (amount: number) => void;
}

type Mode = 'menu' | 'ruleta' | 'slots' | 'blackjack';

interface BJCard {
  suit: '♥' | '♦' | '♣' | '♠';
  value: string; // '2'-'10', 'J', 'Q', 'K', 'A'
}

// Sub-components for Blackjack Cards UI
const BJCardFace: React.FC<{ card: BJCard; animateIdx: number }> = ({ card, animateIdx }) => {
  const isRed = ['♥', '♦'].includes(card.suit);
  return (
    <div 
      className="w-16 h-24 sm:w-20 sm:h-28 bg-white rounded-xl border-2 border-slate-300 shadow-xl flex flex-col justify-between p-2 select-none text-slate-900 animate-fade-in relative transition-all duration-300 transform hover:scale-110 shrink-0"
      style={{ animationDelay: `${animateIdx * 150}ms` }}
    >
      <div className={`text-sm sm:text-base font-black leading-none text-left ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {card.value}
        <span className="block text-xs font-serif">{card.suit}</span>
      </div>
      <div className={`text-3xl sm:text-4xl text-center font-bold ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {card.suit}
      </div>
      <div className={`text-base font-black leading-none text-right scale-y-[-1] scale-x-[-1] ${isRed ? 'text-red-100' : 'text-slate-100'} opacity-25 absolute bottom-1 right-1`}>
        {card.value}
      </div>
    </div>
  );
};

const BJCardBack: React.FC = () => {
  return (
    <div className="w-16 h-24 sm:w-20 sm:h-28 bg-gradient-to-br from-indigo-900 via-indigo-950 to-indigo-900 rounded-xl border-2 border-amber-400 shadow-xl flex items-center justify-center p-1 select-none transform hover:scale-105 transition duration-150 relative animate-pulse shrink-0">
      <div className="absolute inset-1.5 border border-dashed border-amber-500/30 rounded-lg flex items-center justify-center">
        <Coins className="w-6 h-6 text-amber-500/40" />
      </div>
    </div>
  );
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

  // Improved Roulette States
  const [rouletteBet, setRouletteBet] = useState(50);
  const [rouletteBetType, setRouletteBetType] = useState<
    'rojo' | 'negro' | 'par' | 'impar' | 'bajo' | 'alto' | 'docena1' | 'docena2' | 'docena3' | 'numero'
  >('rojo');
  const [rouletteBetNumber, setRouletteBetNumber] = useState<number>(0);
  const [isSpinningRoulette, setIsSpinningRoulette] = useState(false);
  const [rouletteRoll, setRouletteRoll] = useState<{ number: number; color: 'rojo' | 'negro' | 'verde' } | null>(null);
  const [rouletteResult, setRouletteResult] = useState<string | null>(null);
  const [animatedTargetNum, setAnimatedTargetNum] = useState<number | null>(null);

  // Blackjack States
  const [bjBet, setBjBet] = useState(50);
  const [bjPlayerHand, setBjPlayerHand] = useState<BJCard[]>([]);
  const [bjDealerHand, setBjDealerHand] = useState<BJCard[]>([]);
  const [bjDeck, setBjDeck] = useState<BJCard[]>([]);
  const [bjStatus, setBjStatus] = useState<'idle' | 'playing' | 'dealer_turn' | 'player_bust' | 'dealer_win' | 'player_win' | 'push'>('idle');
  const [isDealerRevealed, setIsDealerRevealed] = useState(false);
  const [bjFeedback, setBjFeedback] = useState<string | null>(null);

  // Luck Multiplier
  const luckBoost = upgrades.suerte * 0.025; // max 25% extra probability offset

  // Clean state when changing tabs
  useEffect(() => {
    setSlotsResult(null);
    setRouletteResult(null);
    setRouletteRoll(null);
    setAnimatedTargetNum(null);
    setBjFeedback(null);
    setBjStatus('idle');
  }, [activeMode]);

  // Handle exiting the entire casino
  const handleExitCasino = () => {
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

    const emojis = ['🍒', '🍋', '🍊', '🍇', '🔔', '7️⃣'];
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


  // --- IMPROVED ROULETTE ENGINE ---
  const checkRouletteWin = (num: number, type: typeof rouletteBetType, targetNum: number): boolean => {
    const color = getRouletteColor(num);
    if (num === 0) {
      if (type === 'numero' && targetNum === 0) return true;
      return false; // Zero loses all other bets!
    }
    
    switch (type) {
      case 'rojo': return color === 'rojo';
      case 'negro': return color === 'negro';
      case 'par': return num % 2 === 0;
      case 'impar': return num % 2 !== 0;
      case 'bajo': return num >= 1 && num <= 18;
      case 'alto': return num >= 19 && num <= 36;
      case 'docena1': return num >= 1 && num <= 12;
      case 'docena2': return num >= 13 && num <= 24;
      case 'docena3': return num >= 25 && num <= 36;
      case 'numero': return num === targetNum;
      default: return false;
    }
  };

  const spinRoulette = () => {
    if (money < rouletteBet) {
      audio.playFail();
      setRouletteResult('¡No tienes suficiente dinero!');
      return;
    }

    onAddMoney(-rouletteBet);
    setIsSpinningRoulette(true);
    setRouletteResult(null);
    setRouletteRoll(null);

    // Calculate winning number immediately
    let finalNumber = Math.floor(Math.random() * 37);

    // Apply luckBoost under the hood!
    if (Math.random() < luckBoost) {
      const isWinning = checkRouletteWin(finalNumber, rouletteBetType, rouletteBetNumber);
      if (!isWinning) {
        // Search for a winning number that wins for the player!
        const winningNumbers = ROULETTE_ORDER.filter(n => checkRouletteWin(n, rouletteBetType, rouletteBetNumber));
        if (winningNumbers.length > 0) {
          finalNumber = winningNumbers[Math.floor(Math.random() * winningNumbers.length)];
        }
      }
    }

    setAnimatedTargetNum(finalNumber);
  };

  const evaluateRouletteValue = (winNum: number) => {
    const winColor = getRouletteColor(winNum);
    setRouletteRoll({ number: winNum, color: winColor });
    setIsSpinningRoulette(false);
    setAnimatedTargetNum(null);

    const isWin = checkRouletteWin(winNum, rouletteBetType, rouletteBetNumber);
    let multiplier = 2; // Default 1 to 1 payout (returns 2x)
    
    if (rouletteBetType === 'numero') {
      multiplier = 36; // 35 to 1 payout (returns 36x)
    } else if (['docena1', 'docena2', 'docena3'].includes(rouletteBetType)) {
      multiplier = 3; // 2 to 1 payout (returns 3x)
    }

    if (isWin) {
      const prize = rouletteBet * multiplier;
      onAddMoney(prize);
      audio.playCasinoWin();
      
      let betLabel = '';
      if (rouletteBetType === 'numero') betLabel = `Número ${rouletteBetNumber}`;
      else if (rouletteBetType === 'rojo') betLabel = 'Color ROJO';
      else if (rouletteBetType === 'negro') betLabel = 'Color NEGRO';
      else if (rouletteBetType === 'par') betLabel = 'Par';
      else if (rouletteBetType === 'impar') betLabel = 'Impar';
      else if (rouletteBetType === 'bajo') betLabel = 'Rango Bajo (1-18)';
      else if (rouletteBetType === 'alto') betLabel = 'Rango Alto (19-36)';
      else if (rouletteBetType === 'docena1') betLabel = 'Primera Docena (1-12)';
      else if (rouletteBetType === 'docena2') betLabel = 'Segunda Docena (13-24)';
      else if (rouletteBetType === 'docena3') betLabel = 'Tercera Docena (25-36)';

      setRouletteResult(`🎉 ¡Felicidades! Salió ${winColor.toUpperCase()} ${winNum}. Tu apuesta a "${betLabel}" ganó $${prize} (${multiplier - 1}:1)!`);
    } else {
      audio.playCasinoLose();
      setRouletteResult(`😔 Sin éxito esta vez. Cayó ${winColor.toUpperCase()} ${winNum}. Tu apuesta ha perdido.`);
    }
  };


  // --- BLACKJACK ENGINE ---
  const createBJShoe = (): BJCard[] => {
    const suits: BJCard['suit'][] = ['♥', '♦', '♣', '♠'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck: BJCard[] = [];
    
    // 4 decks for standard shoe
    for (let deckCount = 0; deckCount < 4; deckCount++) {
      for (const suit of suits) {
        for (const value of values) {
          deck.push({ suit, value });
        }
      }
    }

    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  };

  const calculatePoints = (hand: BJCard[]): number => {
    let total = 0;
    let aces = 0;
    for (const card of hand) {
      if (card.value === 'A') {
        aces++;
        total += 11;
      } else if (['J', 'Q', 'K'].includes(card.value)) {
        total += 10;
      } else {
        total += parseInt(card.value, 10);
      }
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total;
  };

  const startBJGame = () => {
    if (money < bjBet) {
      audio.playFail();
      setBjFeedback('¡No tienes suficiente dinero!');
      return;
    }

    onAddMoney(-bjBet);
    setBjFeedback(null);
    setBjStatus('playing');
    setIsDealerRevealed(false);

    // Create fresh shoe
    const freshDeck = createBJShoe();
    const pHand = [freshDeck.shift()!, freshDeck.shift()!];
    const dHand = [freshDeck.shift()!, freshDeck.shift()!];

    setBjPlayerHand(pHand);
    setBjDealerHand(dHand);
    setBjDeck(freshDeck);

    audio.playCasinoCoin();

    const pPoints = calculatePoints(pHand);
    const dPoints = calculatePoints(dHand);

    // Check for natural Blackjack!
    if (pPoints === 21) {
      setIsDealerRevealed(true);
      if (dPoints === 21) {
        // Double blackjack is a push!
        setBjStatus('push');
        setBjFeedback(`🤝 ¡DOBLE BLACKJACK! Ambos tienen 21. Empate (Push), recuperas tu apuesta de $${bjBet}.`);
        onAddMoney(bjBet);
        audio.playSuccess();
      } else {
        // Natural pays 2.5x
        const prize = Math.round(bjBet * 2.5);
        setBjStatus('player_win');
        setBjFeedback(`👑 ¡BLACKJACK NATURAL! Tienes 21. Cobras $${prize} (3:2 de pago)!`);
        onAddMoney(prize);
        audio.playCasinoWin();
      }
    }
  };

  const playBJHit = () => {
    if (bjStatus !== 'playing') return;

    let localDeck = [...bjDeck];
    let card = localDeck.shift() || { suit: '♥' as const, value: 'A' };
    let tempPlayerHand = [...bjPlayerHand, card];

    // Luck influence: If player was about to bust, we can occasionally replace the card with a safe one
    if (calculatePoints(tempPlayerHand) > 21 && Math.random() < luckBoost) {
      for (let retries = 0; retries < 25; retries++) {
        const altCard = localDeck[Math.floor(Math.random() * localDeck.length)];
        const altHand = [...bjPlayerHand, altCard];
        if (calculatePoints(altHand) <= 21) {
          card = altCard;
          // Extract it from deck
          localDeck = localDeck.filter(c => c !== altCard);
          tempPlayerHand = [...bjPlayerHand, card];
          break;
        }
      }
    }

    setBjPlayerHand(tempPlayerHand);
    setBjDeck(localDeck);
    audio.playCasinoCoin();

    const points = calculatePoints(tempPlayerHand);
    if (points > 21) {
      setBjStatus('player_bust');
      setBjFeedback(`💥 ¡TE PASASTE! Sumaste ${points} puntos. El Crupier gana tu apuesta.`);
      audio.playCasinoLose();
    } else if (points === 21) {
      // Auto stand at perfect 21
      playBJStandCustom(tempPlayerHand, localDeck);
    }
  };

  const playBJStand = () => {
    if (bjStatus !== 'playing') return;
    playBJStandCustom(bjPlayerHand, bjDeck);
  };

  const playBJStandCustom = (currentPlayerHand: BJCard[], currentDeck: BJCard[]) => {
    setBjStatus('dealer_turn');
    setIsDealerRevealed(true);

    const playerPoints = calculatePoints(currentPlayerHand);
    let dealerHandTemp = [...bjDealerHand];
    let localDeck = [...currentDeck];

    const dealerNextStep = () => {
      const dPoints = calculatePoints(dealerHandTemp);
      if (dPoints < 17) {
        // Draw card for dealer
        let card = localDeck.shift() || { suit: '♥' as const, value: 'A' };
        
        // Luck influence: if dealer draws and gets a good hand, try to make them bust if they are lucky but luck boosts
        if (Math.random() < luckBoost) {
          const wouldBePoints = calculatePoints([...dealerHandTemp, card]);
          if (wouldBePoints >= playerPoints && wouldBePoints <= 21) {
            // Find a card that would bust or is less optimal
            for (let retries = 0; retries < 20; retries++) {
              const altCard = localDeck[Math.floor(Math.random() * localDeck.length)];
              const altPoints = calculatePoints([...dealerHandTemp, altCard]);
              if (altPoints > 21 || altPoints < wouldBePoints) {
                card = altCard;
                localDeck = localDeck.filter(c => c !== altCard);
                break;
              }
            }
          }
        }

        dealerHandTemp.push(card);
        setBjDealerHand([...dealerHandTemp]);
        setBjDeck(localDeck);
        audio.playCasinoCoin();

        // Stagger to simulate physical speed
        setTimeout(dealerNextStep, 800);
      } else {
        // Evaluate winner!
        finalizeBJGame(playerPoints, dPoints);
      }
    };

    setTimeout(dealerNextStep, 500);
  };

  const playBJDoubleDown = () => {
    if (bjStatus !== 'playing' || bjPlayerHand.length !== 2) return;
    if (money < bjBet) {
      audio.playFail();
      return;
    }

    // Deduct double-down amount
    onAddMoney(-bjBet);

    let localDeck = [...bjDeck];
    let card = localDeck.shift() || { suit: '♥' as const, value: 'A' };
    let tempPlayerHand = [...bjPlayerHand, card];

    // Luck influence:
    if (calculatePoints(tempPlayerHand) > 21 && Math.random() < luckBoost) {
      for (let retries = 0; retries < 25; retries++) {
        const altCard = localDeck[Math.floor(Math.random() * localDeck.length)];
        const altHand = [...bjPlayerHand, altCard];
        if (calculatePoints(altHand) <= 21) {
          card = altCard;
          localDeck = localDeck.filter(c => c !== altCard);
          tempPlayerHand = [...bjPlayerHand, card];
          break;
        }
      }
    }

    setBjPlayerHand(tempPlayerHand);
    setBjDeck(localDeck);
    audio.playCasinoCoin();

    const playerPoints = calculatePoints(tempPlayerHand);
    if (playerPoints > 21) {
      setBjStatus('player_bust');
      setBjFeedback(`💥 ¡TE PASASTE! Sumaste ${playerPoints} puntos en doblada. Perdiste la apuesta doble de $${bjBet * 2}.`);
      audio.playCasinoLose();
    } else {
      // Automatic stand with doubled bet payout!
      setBjStatus('dealer_turn');
      setIsDealerRevealed(true);

      let dealerHandTemp = [...bjDealerHand];
      const dealerNextStep = () => {
        const dPoints = calculatePoints(dealerHandTemp);
        if (dPoints < 17) {
          let card = localDeck.shift() || { suit: '♥' as const, value: 'A' };
          
          if (Math.random() < luckBoost) {
            const wouldBePoints = calculatePoints([...dealerHandTemp, card]);
            if (wouldBePoints >= playerPoints && wouldBePoints <= 21) {
              for (let retries = 0; retries < 20; retries++) {
                const altCard = localDeck[Math.floor(Math.random() * localDeck.length)];
                const altPoints = calculatePoints([...dealerHandTemp, altCard]);
                if (altPoints > 21 || altPoints < wouldBePoints) {
                  card = altCard;
                  localDeck = localDeck.filter(c => c !== altCard);
                  break;
                }
              }
            }
          }

          dealerHandTemp.push(card);
          setBjDealerHand([...dealerHandTemp]);
          setBjDeck(localDeck);
          audio.playCasinoCoin();
          setTimeout(dealerNextStep, 800);
        } else {
          // Finalize with doubled bet payouts
          finalizeBJGame(playerPoints, dPoints, true);
        }
      };

      setTimeout(dealerNextStep, 500);
    }
  };

  const finalizeBJGame = (pPoints: number, dPoints: number, isDouble = false) => {
    let finalBet = isDouble ? bjBet * 2 : bjBet;
    let finalStatus: typeof bjStatus = 'idle';
    let profit = 0;
    let feedback = '';

    if (dPoints > 21) {
      finalStatus = 'player_win';
      profit = finalBet * 2;
      feedback = `🏆 ¡EL CRUPIER SE PASÓ con ${dPoints}! Ganaste tu apuesta${isDouble ? ' doble' : ''} y recuperas $${profit}.`;
      onAddMoney(profit);
      audio.playCasinoWin();
    } else if (pPoints > dPoints) {
      finalStatus = 'player_win';
      profit = finalBet * 2;
      feedback = `🏆 ¡GANASTE! Sumas ${pPoints} frente a los ${dPoints} del Crupier. Cobras $${profit}.`;
      onAddMoney(profit);
      audio.playCasinoWin();
    } else if (pPoints < dPoints) {
      finalStatus = 'dealer_win';
      feedback = `😔 PERDISTE EL COMBATE. El Crupier tiene ${dPoints} puntos contra tus ${pPoints}.`;
      audio.playCasinoLose();
    } else {
      finalStatus = 'push';
      profit = finalBet;
      feedback = `🤝 EMPATE (PUSH). Ambos lograron ${pPoints} puntos. Se devuelve tu apuesta de $${profit}.`;
      onAddMoney(profit);
      audio.playSuccess();
    }

    setBjStatus(finalStatus);
    setBjFeedback(feedback);
  };


  if (!isOpen) return null;

  return (
    <div id="casino-modal-overlay" className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div 
        id="casino-modal-container"
        className="bg-slate-900 rounded-[32px] shadow-2xl max-w-3xl w-full border-4 border-yellow-400 overflow-hidden text-slate-100 flex flex-col max-h-[92vh] my-4 animate-fade-in"
      >
        {/* Neon Casino Header */}
        <div className="bg-gradient-to-r from-red-650 via-purple-900 to-amber-700 p-5 flex justify-between items-center border-b-2 border-amber-500">
          <div className="flex items-center gap-3">
            <div className="bg-amber-400 p-2 rounded-2xl shadow-lg border-2 border-white animate-pulse">
              <Coins className="w-7 h-7 text-yellow-950 fill-amber-700 shrink-0" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-widest text-amber-300 font-serif uppercase">Isla Fortune Casino</h2>
              <p className="text-[11px] font-semibold text-amber-100 opacity-90 font-mono leading-none mt-1">¡Multiplica tu capital! Amuleto de Suerte: +{(upgrades.suerte * 2.5).toFixed(1)}% de favor</p>
            </div>
          </div>
          <button 
            id="close-casino-btn"
            onClick={handleExitCasino}
            className="text-amber-100 hover:text-white bg-slate-800/80 hover:bg-red-500 p-2 px-3 sm:px-4 rounded-xl border border-amber-500/30 font-black text-xs sm:text-sm transition ml-2 shrink-0"
          >
            Salir Casino (X)
          </button>
        </div>

        {/* Casino navigation menu within a game */}
        {activeMode !== 'menu' && (
          <div className="bg-slate-850 p-2 sm:p-2.5 border-b border-slate-800 flex justify-between items-center px-4 sm:px-6">
            <button
              onClick={() => setActiveMode('menu')}
              className="text-[11px] sm:text-xs bg-slate-800 hover:bg-slate-700 font-bold py-1 px-2.5 sm:px-3 rounded-lg border border-slate-700 flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Cambiar de Juego
            </button>
            <div className="text-xs sm:text-sm font-bold flex items-center gap-1 bg-slate-800 px-3 py-1 rounded-full border border-slate-750">
              <span className="text-yellow-400 font-mono font-black">$</span>
              <span>Efectivo: <strong className="text-white font-mono">{money}</strong></span>
            </div>
          </div>
        )}

        {/* MAIN BODY AREA */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-950 font-sans">
          
          {/* MENU VIEW */}
          {activeMode === 'menu' && (
            <div className="space-y-6">
              {/* Pocket Info */}
              <div className="bg-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center border border-slate-800 gap-3">
                <div>
                  <h3 className="font-bold text-yellow-400 text-sm">¿Te sientes con suerte hoy?</h3>
                  <p className="text-xs text-slate-400">Invierte parte de tu sueldo para obtener ganancias colosales.</p>
                </div>
                <div className="text-xl sm:text-2xl font-serif font-black text-yellow-300 bg-slate-950 p-2 px-6 rounded-xl border border-yellow-500/30 flex items-center gap-1">
                  <span className="text-green-500 text-lg sm:text-xl font-sans">$</span>
                  <span className="font-mono">{money}</span>
                </div>
              </div>

              {/* Three selection panels */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Roulette */}
                <div className="bg-slate-900 border border-red-500/40 rounded-2xl p-5 flex flex-col justify-between hover:border-red-500 hover:shadow-lg transition">
                  <div className="space-y-2">
                    <div className="bg-red-500/10 text-red-400 p-2 rounded-xl w-10 h-10 flex items-center justify-center font-bold font-serif text-lg border border-red-500/20 shadow-md">
                      R
                    </div>
                    <h3 className="font-bold text-base text-white">Ruleta Francesa</h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">Ajusta tus jugadas a Rojo, Negro, Par/Impar, Rango de número o apuesta precisa que remunera 35 a 1.</p>
                  </div>
                  <button
                    onClick={() => setActiveMode('ruleta')}
                    className="mt-5 w-full bg-red-650 hover:bg-red-700 text-white py-2 rounded-xl text-xs font-bold font-sans transition-all border border-red-500 shadow-lg active:scale-95"
                  >
                    Giras la Rueda
                  </button>
                </div>

                {/* 2. Slots */}
                <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between hover:border-amber-500 hover:shadow-lg transition">
                  <div className="space-y-2">
                    <div className="bg-amber-500/10 text-amber-400 p-2 rounded-xl w-10 h-10 flex items-center justify-center font-bold text-base border border-amber-500/20 shadow-md">
                      777
                    </div>
                    <h3 className="font-bold text-base text-white">Tragamonedas</h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">Prueba la máquina de frutas. ¡Dos iguales multiplican, y tres campanas o sietes pagan asombrosamente!</p>
                  </div>
                  <button
                    onClick={() => setActiveMode('slots')}
                    className="mt-5 w-full bg-amber-650 hover:bg-amber-700 text-white py-2 rounded-xl text-xs font-bold font-sans transition-all border border-amber-500 shadow-lg active:scale-95"
                  >
                    Jugar Slots (Tragamonedas)
                  </button>
                </div>

                {/* 3. Blackjack */}
                <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500 hover:shadow-lg transition">
                  <div className="space-y-2">
                    <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl w-10 h-10 flex items-center justify-center font-bold text-base border border-emerald-500/20 shadow-md">
                      21
                    </div>
                    <h3 className="font-bold text-base text-white">Blackjack 21</h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">¡Llega a 21 sin pasarte del límite! El Crupier te desafía a plantarte o pedir. ¡Vence la banca con tu estrategia!</p>
                  </div>
                  <button
                    onClick={() => setActiveMode('blackjack')}
                    className="mt-5 w-full bg-emerald-650 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-bold font-sans transition-all border border-emerald-500 shadow-lg active:scale-95"
                  >
                    Jugar al Blackjack
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* 1. RULETA VIEW */}
          {activeMode === 'ruleta' && (
            <div className="space-y-6 max-w-2xl mx-auto text-center">
              <h3 className="text-base sm:text-lg font-serif text-amber-400 uppercase tracking-wide">Mesa de Ruleta de la Isla</h3>
              
              {/* Spinner animation look using Canvas component */}
              <RouletteWheel
                isSpinning={isSpinningRoulette}
                targetNumber={animatedTargetNum}
                onAnimationComplete={evaluateRouletteValue}
              />

              {/* Bets configuration */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-4 text-left shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                  <label className="text-xs font-bold text-slate-300">Apuesta por jugada ($):</label>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setRouletteBet(Math.max(10, rouletteBet - 10))}
                      className="bg-slate-800 hover:bg-slate-700 text-white p-1 px-2.5 rounded-lg text-xs font-black font-mono border border-slate-750"
                    >
                      -10
                    </button>
                    <span className="font-mono font-bold bg-slate-950 p-1 px-4 rounded text-sm text-yellow-300 border border-slate-800">${rouletteBet}</span>
                    <button 
                      onClick={() => setRouletteBet(Math.min(1000, rouletteBet + 15))}
                      className="bg-slate-800 hover:bg-slate-700 text-white p-1 px-2.5 rounded-lg text-xs font-black font-mono border border-slate-750"
                    >
                      +15
                    </button>
                    <button 
                      onClick={() => setRouletteBet(Math.min(5000, rouletteBet + 100))}
                      className="bg-slate-800 hover:bg-slate-700 text-white p-1 px-2 rounded-lg text-[10px] font-black font-mono border border-slate-750"
                    >
                      +100
                    </button>
                  </div>
                </div>

                <hr className="border-slate-800" />

                {/* Bet Types */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-300">Selecciona tu categoría de apuesta:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { id: 'rojo', label: '🔴 Rojo (x2)' },
                      { id: 'negro', label: '⚫ Negro (x2)' },
                      { id: 'par', label: '🌗 Par (x2)' },
                      { id: 'impar', label: '🌑 Impar (x2)' },
                      { id: 'bajo', label: '📉 Bajo 1-18 (x2)' },
                      { id: 'alto', label: '📈 Alto 19-36 (x2)' },
                      { id: 'docena1', label: '📦 1ª Doc 1-12 (x3)' },
                      { id: 'docena2', label: '📦 2ª Doc 13-24 (x3)' },
                      { id: 'docena3', label: '📦 3ª Doc 25-36 (x3)' },
                      { id: 'numero', label: '🔢 Número (x36)' },
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          setRouletteBetType(type.id as any);
                          setRouletteResult(null);
                        }}
                        className={`text-[11px] py-2 px-1 rounded-xl font-bold border transition ${
                          rouletteBetType === type.id 
                            ? 'bg-amber-500 text-slate-950 border-white font-extrabold ring-2 ring-yellow-400 scale-[1.03]' 
                            : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-200'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Number selection grid is visible when 'numero' is selected */}
                {rouletteBetType === 'numero' && (
                  <div className="space-y-2 pt-1 animate-fade-in">
                    <p className="text-xs font-bold text-slate-300">Elige un número de la mesa (Pago 35:1):</p>
                    {/* The 0 and grid of 1-36 */}
                    <div className="space-y-1.5 max-w-md mx-auto">
                      <button
                        onClick={() => setRouletteBetNumber(0)}
                        className={`w-full py-2 rounded-xl text-xs font-black transition border ${
                          rouletteBetNumber === 0
                            ? 'bg-green-500 border-white text-white font-black shadow-lg ring-2 ring-green-300 scale-[1.02]'
                            : 'bg-green-950 hover:bg-green-800 border-green-700 text-green-300'
                        }`}
                      >
                        🟢 NÚMERO CERO (0)
                      </button>
                      <div className="grid grid-cols-6 gap-1">
                        {Array.from({ length: 36 }, (_, idx) => {
                          const num = idx + 1;
                          const color = getRouletteColor(num);
                          const isSelected = rouletteBetNumber === num;
                          return (
                            <button
                              key={num}
                              onClick={() => setRouletteBetNumber(num)}
                              className={`py-1.5 rounded-lg text-xs font-bold transition border ${
                                isSelected
                                  ? 'bg-amber-400 text-slate-950 font-black border-white ring-2 ring-yellow-400 scale-105 shadow'
                                  : color === 'rojo'
                                    ? 'bg-red-800 hover:bg-red-700 border-red-650 text-white'
                                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                              }`}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Feedback text */}
              {rouletteResult && (
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-bold text-amber-300 font-mono text-center shadow">
                  {rouletteResult}
                </div>
              )}

              {/* Spin command */}
              <button
                id="spin-roulette-btn"
                disabled={isSpinningRoulette}
                onClick={spinRoulette}
                className={`w-full py-3.5 rounded-2xl font-black tracking-wider text-sm transition-all border ${
                  isSpinningRoulette 
                    ? 'bg-gray-700 border-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-red-600 to-amber-600 hover:brightness-110 text-white border-red-500 hover:shadow-lg transform active:scale-95'
                }`}
              >
                {isSpinningRoulette ? '¡Bolilla en órbita descendente!' : '🔴 HACER GIRAR RULETA (APUESTAR) 🔴'}
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
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center text-left">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase font-mono leading-none mb-1">Apuesta por palanca</span>
                  <p className="text-sm font-black font-mono text-yellow-300 leading-none">${slotBet}</p>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {[20, 50, 100, 200, 500].map(val => (
                    <button
                      key={val}
                      onClick={() => setSlotBet(val)}
                      className={`px-2.5 py-1.5 rounded-lg font-mono text-[10px] sm:text-xs font-bold transition border ${
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
                <div className="p-3 bg-slate-900 border border-slate-800 text-xs font-bold rounded-xl text-yellow-400 shadow font-mono">
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


          {/* 3. BLACKJACK VIEW */}
          {activeMode === 'blackjack' && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="flex justify-between items-center bg-slate-900 p-3 rounded-2xl border border-slate-800">
                <h3 className="text-sm font-serif text-emerald-400 uppercase tracking-widest font-black">Felt Mesa de Blackjack</h3>
                <div className="text-xs font-mono font-bold text-slate-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5">
                  Mazo: <strong className="text-white font-mono">{bjDeck.length} cartas</strong>
                </div>
              </div>

              {bjStatus === 'idle' ? (
                /* Betting View (Start Game form) */
                <div className="bg-gradient-to-b from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-lg text-center">
                  <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center font-bold text-xl mx-auto shadow-md">
                    21
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-yellow-400 uppercase tracking-wide">Alinea tu Apuesta de Inicio</h4>
                    <p className="text-xs text-slate-400 mt-1">El crupier reparte 2 cartas. El pago regular es 1:1, y si logras 21 directo paga 3:2.</p>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-850">
                    <span className="text-xs font-extrabold text-slate-300">Cantidad ($):</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {[10, 20, 50, 100, 200, 500].map(val => (
                        <button
                          key={val}
                          onClick={() => setBjBet(val)}
                          className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-bold transition ${
                            bjBet === val
                              ? 'bg-emerald-500 border-white text-slate-950 shadow-md scale-105'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                          }`}
                        >
                          ${val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {bjFeedback && (
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-extrabold text-amber-300 leading-normal">
                      {bjFeedback}
                    </div>
                  )}

                  <button
                    onClick={startBJGame}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-emerald-400 shadow-md hover:shadow-emerald-500/20"
                  >
                    ♠️ REPARTIR MANO (${bjBet}) ♥️
                  </button>
                </div>
              ) : (
                /* Interactive playing Felt board */
                <div className="bg-gradient-to-b from-[#0f4d34] to-[#07321e] rounded-[32px] border-4 border-amber-500 p-4 sm:p-6 space-y-6 shadow-2xl relative select-none">
                  <div className="absolute top-2 right-4 text-[9px] text-amber-500/40 font-mono font-bold tracking-wide">VEGAS RULE SINGLE DECK SHUFFLED</div>

                  {/* Dealer area */}
                  <div className="text-center space-y-2 pb-2 border-b border-white/10">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase text-slate-300 tracking-wider">
                      <span>Mano del Crupier (Puntos: {isDealerRevealed ? calculatePoints(bjDealerHand) : '?'})</span>
                    </div>
                    
                    <div className="flex gap-3 justify-center py-2 overflow-x-auto min-h-[125px] items-center">
                      {bjDealerHand.map((card, idx) => {
                        const isHidden = idx === 1 && !isDealerRevealed;
                        if (isHidden) {
                          return <BJCardBack key={idx} />;
                        }
                        return <BJCardFace key={idx} card={card} animateIdx={idx} />;
                      })}
                    </div>
                  </div>

                  {/* Player area */}
                  <div className="text-center space-y-2 pt-2">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase text-amber-300 tracking-wider">
                      <span>Tu Mano (Puntos: {calculatePoints(bjPlayerHand)})</span>
                    </div>

                    <div className="flex gap-3 justify-center py-2 overflow-x-auto min-h-[125px] items-center">
                      {bjPlayerHand.map((card, idx) => (
                        <BJCardFace key={idx} card={card} animateIdx={idx} />
                      ))}
                    </div>
                  </div>

                  {/* Interactive Status Banner */}
                  {bjFeedback && (
                    <div className="bg-black/40 border border-amber-400/30 p-3 rounded-2xl text-xs font-serif font-black text-yellow-300 leading-normal text-center shadow animate-fade-in relative">
                      {bjFeedback}
                    </div>
                  )}

                  {/* Action Commands during active game */}
                  {bjStatus === 'playing' ? (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={playBJHit}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider py-3.5 rounded-2xl border-2 border-emerald-400/40 shadow transition transform hover:scale-[1.01] active:scale-95"
                      >
                        🃏 Pedir Carta (Hit)
                      </button>

                      <button
                        onClick={playBJStand}
                        className="bg-red-800 hover:bg-red-750 text-white font-black text-xs uppercase tracking-wider py-3.5 rounded-2xl border-2 border-red-700 shadow transition transform hover:scale-[1.01] active:scale-95"
                      >
                        🛑 Plantarse (Stand)
                      </button>

                      {bjPlayerHand.length === 2 && money >= bjBet && (
                        <button
                          onClick={playBJDoubleDown}
                          className="col-span-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs uppercase tracking-widest py-3 rounded-2xl border border-white shadow transition transform hover:scale-[1.01] active:scale-95"
                        >
                          💵 DOBLAR APUESTA (+${bjBet})
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Restart game layout */
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setBjStatus('idle');
                          setBjFeedback(null);
                        }}
                        className="w-full py-3.5 bg-yellow-500 hover:bg-yellow-600 border border-white text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl shadow transition transform active:scale-95"
                      >
                        NUEVA RONDA DE BLACKJACK
                      </button>
                    </div>
                  )}
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
            className="text-slate-300 hover:text-white bg-slate-800 px-3 py-1 rounded border border-slate-700 transition font-bold"
          >
            Cerrar Casino
          </button>
        </div>
      </div>
    </div>
  );
};
