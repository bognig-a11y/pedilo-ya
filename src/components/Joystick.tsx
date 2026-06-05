/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChevronUp, ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react';

interface JoystickProps {
  onDirectionChange: (dir: { x: number; y: number }) => void;
  onActionClick?: () => void;
  actionLabel?: string;
}

export const Joystick: React.FC<JoystickProps> = ({
  onDirectionChange,
  onActionClick,
  actionLabel = "ENTRAR",
}) => {
  const [activeKeys, setActiveKeys] = React.useState({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const updateDirection = (keys: typeof activeKeys) => {
    let x = 0;
    let y = 0;
    if (keys.left) x = -1;
    if (keys.right) x = 1;
    if (keys.up) y = -1;
    if (keys.down) y = 1;

    // Normalize
    if (x !== 0 && y !== 0) {
      const len = Math.sqrt(x * x + y * y);
      x /= len;
      y /= len;
    }

    onDirectionChange({ x, y });
  };

  const handleTouchStart = (dir: 'up' | 'down' | 'left' | 'right') => {
    setActiveKeys(prev => {
      const next = { ...prev, [dir]: true };
      updateDirection(next);
      return next;
    });
  };

  const handleTouchEnd = (dir: 'up' | 'down' | 'left' | 'right') => {
    setActiveKeys(prev => {
      const next = { ...prev, [dir]: false };
      updateDirection(next);
      return next;
    });
  };

  return (
    <div id="virtual-gamepad-overlay" className="fixed bottom-6 left-6 z-40 bg-slate-900/40 backdrop-blur-md p-4 rounded-3xl border border-white/20 select-none hidden sm:flex items-center gap-6 shadow-xl leading-none">
      {/* Directional Pad */}
      <div id="dpad-container" className="relative w-32 h-32 flex items-center justify-center">
        {/* Background cross */}
        <div className="absolute w-28 h-10 bg-slate-800/80 rounded-full" />
        <div className="absolute w-10 h-28 bg-slate-800/80 rounded-full" />

        {/* Up Button */}
        <button
          id="dpad-up"
          type="button"
          onMouseDown={() => handleTouchStart('up')}
          onMouseUp={() => handleTouchEnd('up')}
          onMouseLeave={() => handleTouchEnd('up')}
          onTouchStart={() => handleTouchStart('up')}
          onTouchEnd={() => handleTouchEnd('up')}
          className="absolute top-0 w-10 h-10 bg-slate-700 active:bg-amber-400 text-white active:text-slate-950 rounded-xl flex items-center justify-center transition shadow-md border border-slate-600 cursor-pointer"
        >
          <ChevronUp className="w-6 h-6" />
        </button>

        {/* Down Button */}
        <button
          id="dpad-down"
          type="button"
          onMouseDown={() => handleTouchStart('down')}
          onMouseUp={() => handleTouchEnd('down')}
          onMouseLeave={() => handleTouchEnd('down')}
          onTouchStart={() => handleTouchStart('down')}
          onTouchEnd={() => handleTouchEnd('down')}
          className="absolute bottom-0 w-10 h-10 bg-slate-700 active:bg-amber-400 text-white active:text-slate-950 rounded-xl flex items-center justify-center transition shadow-md border border-slate-600 cursor-pointer"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* Left Button */}
        <button
          id="dpad-left"
          type="button"
          onMouseDown={() => handleTouchStart('left')}
          onMouseUp={() => handleTouchEnd('left')}
          onMouseLeave={() => handleTouchEnd('left')}
          onTouchStart={() => handleTouchStart('left')}
          onTouchEnd={() => handleTouchEnd('left')}
          className="absolute left-0 w-10 h-10 bg-slate-700 active:bg-amber-400 text-white active:text-slate-950 rounded-xl flex items-center justify-center transition shadow-md border border-slate-600 cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Right Button */}
        <button
          id="dpad-right"
          type="button"
          onMouseDown={() => handleTouchStart('right')}
          onMouseUp={() => handleTouchEnd('right')}
          onMouseLeave={() => handleTouchEnd('right')}
          onTouchStart={() => handleTouchStart('right')}
          onTouchEnd={() => handleTouchEnd('right')}
          className="absolute right-0 w-10 h-10 bg-slate-700 active:bg-amber-400 text-white active:text-slate-950 rounded-xl flex items-center justify-center transition shadow-md border border-slate-600 cursor-pointer"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Center hub */}
        <div className="absolute w-6 h-6 bg-slate-950 rounded-full border border-slate-500 shadow-inner" />
      </div>

      {onActionClick && (
        <div className="flex flex-col gap-1 items-center">
          <button
            id="hud-action-button-virt"
            onClick={onActionClick}
            className="w-16 h-16 bg-red-500 active:bg-red-650 hover:bg-red-550 rounded-full border-4 border-white text-white font-black text-xs shadow-lg flex items-center justify-center cursor-pointer transition transform active:scale-90"
          >
            {actionLabel}
          </button>
          <span className="text-[9px] text-slate-350 font-semibold font-mono tracking-wide uppercase">O pulsa [Espacio]</span>
        </div>
      )}
    </div>
  );
};
