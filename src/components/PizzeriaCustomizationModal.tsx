/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { audio } from '../utils/audio';

interface PizzeriaCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, color: string) => void;
  initialName?: string;
  initialColor?: string;
}

export const COLOR_PRESETS = [
  { name: 'Verde Esmeralda', hex: '#10B981', text: 'text-emerald-400', bg: 'bg-emerald-500' },
  { name: 'Azul Deportivo', hex: '#2563EB', text: 'text-blue-400', bg: 'bg-blue-600' },
  { name: 'Violeta Cyberpunk', hex: '#8B5CF6', text: 'text-purple-400', bg: 'bg-purple-500' },
  { name: 'Naranja Flameante', hex: '#F97316', text: 'text-orange-400', bg: 'bg-orange-500' },
  { name: 'Rosa Neón', hex: '#EC4899', text: 'text-pink-400', bg: 'bg-pink-500' },
];

export const PizzeriaCustomizationModal: React.FC<PizzeriaCustomizationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialName = 'Pizzería Imperio',
  initialColor = '#10B981',
}) => {
  const [nameInput, setNameInput] = useState(initialName);
  const [selectedColor, setSelectedColor] = useState(initialColor);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim() || 'Pizzería Imperio';
    audio.playCasinoWin();
    onSave(cleanName, selectedColor);
    onClose();
  };

  return (
    <div id="custom-brand-modal-overlay" className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div 
        id="custom-brand-modal-container"
        className="bg-slate-900 border-4 border-amber-400 rounded-[32px] p-6 max-w-md w-full shadow-2xl text-slate-100 flex flex-col gap-4 animate-fade-in"
      >
        <div className="text-center">
          <div className="bg-slate-950 p-3 rounded-full w-14 h-14 flex items-center justify-center mx-auto border-2 border-amber-450 animate-bounce">
            <Sparkles className="w-7 h-7 text-amber-400 fill-amber-305" />
          </div>
          <h3 className="text-xl font-black text-amber-400 font-sans uppercase mt-3">🎨 Personaliza tu Marca</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Define la identidad de tu imperio corporativo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Text Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-350">
              Nombre de tu Pizzería
            </label>
            <input
              type="text"
              maxLength={22}
              required
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Ej: Pizza Súper Sónica"
              className="w-full bg-slate-950 border-2 border-slate-800 focus:border-amber-500 rounded-xl p-3 px-4 text-sm text-slate-105 font-bold transition focus:outline-none placeholder-slate-600"
            />
          </div>

          {/* Color Presets Picker */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-350">
              Color Distintivo Corporativo
            </label>
            <p className="text-[10px] text-slate-405 leading-normal font-semibold">Este color vestirá tus edificios, tus vehículos, tus empleados y coloreará la barra de cobertura de mercado.</p>
            
            <div className="grid grid-cols-5 gap-3 pt-1">
              {COLOR_PRESETS.map((color) => {
                const isSelected = selectedColor === color.hex;
                return (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => {
                      audio.playUpgrade();
                      setSelectedColor(color.hex);
                    }}
                    className={`h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer relative ${color.bg} ${
                      isSelected 
                        ? 'ring-4 ring-offset-2 ring-amber-400 ring-offset-slate-900 scale-108' 
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {isSelected && <Check className="w-5 h-5 text-white stroke-[3px]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accept / Save Action */}
          <button
            type="submit"
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black text-xs uppercase transition shadow-lg tracking-wider active:scale-98"
          >
            Confirmar Marca e Iniciar Imperio 🍕
          </button>
        </form>
      </div>
    </div>
  );
};
