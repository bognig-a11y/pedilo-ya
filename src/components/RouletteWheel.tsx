/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

// Real European roulette board numbers and colors
export const ROULETTE_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

export const getRouletteColor = (num: number): 'rojo' | 'negro' | 'verde' => {
  if (num === 0) return 'verde';
  // Standard red/black definitions
  const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return reds.includes(num) ? 'rojo' : 'negro';
};

interface RouletteWheelProps {
  isSpinning: boolean;
  targetNumber: number | null;
  onAnimationComplete: (num: number) => void;
}

export const RouletteWheel: React.FC<RouletteWheelProps> = ({
  isSpinning,
  targetNumber,
  onAnimationComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Keep track of spinning states to prevent effect locks
  const stateRef = useRef({
    isSpinning,
    targetNumber,
    wheelAngle: 0,
    wheelSpeed: 0.08,
    ballAngle: Math.PI,
    ballSpeed: -0.22,
    ballRadius: 105,
    bounceCount: 0,
    phase: 'idle' as 'idle' | 'spinning' | 'falling' | 'bouncing' | 'captured',
    capturedIndex: -1,
    lerpT: 0,
    startTime: 0,
  });

  // Sync props to stateRef
  useEffect(() => {
    stateRef.current.isSpinning = isSpinning;
    if (isSpinning && targetNumber !== null) {
      stateRef.current.targetNumber = targetNumber;
      stateRef.current.phase = 'spinning';
      stateRef.current.wheelSpeed = 0.12 + Math.random() * 0.04;
      stateRef.current.ballSpeed = -(0.25 + Math.random() * 0.06);
      stateRef.current.ballRadius = 105;
      stateRef.current.bounceCount = 0;
      stateRef.current.lerpT = 0;
      stateRef.current.startTime = Date.now();
      
      const targetIdx = ROULETTE_ORDER.indexOf(targetNumber);
      stateRef.current.capturedIndex = targetIdx >= 0 ? targetIdx : 0;
    } else if (!isSpinning) {
      stateRef.current.phase = 'idle';
    }
  }, [isSpinning, targetNumber]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localFrame = 0;

    const render = () => {
      localFrame++;
      const width = canvas.width;
      const height = canvas.height;
      const center = width / 2;
      const radius = Math.min(width, height) / 2 - 8;

      ctx.clearRect(0, 0, width, height);

      const state = stateRef.current;

      // --- 1. Physics Engine for Spin ---
      if (state.phase !== 'idle') {
        const elapsed = Date.now() - state.startTime;

        // Slow wheel speed gradually down to a slow crawl
        state.wheelAngle += state.wheelSpeed;
        state.wheelSpeed *= 0.992;
        if (state.wheelSpeed < 0.012) state.wheelSpeed = 0.012;

        // Ball physics
        if (state.phase === 'spinning') {
          state.ballAngle += state.ballSpeed;
          state.ballSpeed *= 0.985;
          // After 2.2 seconds, make ball fall
          if (elapsed > 2200 || Math.abs(state.ballSpeed) < 0.06) {
            state.phase = 'falling';
          }
        } else if (state.phase === 'falling') {
          // Ball loses outer orbit radius
          state.ballAngle += state.ballSpeed;
          state.ballSpeed *= 0.96;
          state.ballRadius -= 1.8;
          if (state.ballRadius <= 74) {
            state.ballRadius = 74;
            state.phase = 'bouncing';
          }
        } else if (state.phase === 'bouncing') {
          // Ball hit pocket division pins, make a few random bounces
          state.ballAngle += state.ballSpeed;
          state.ballSpeed = state.wheelSpeed + (Math.random() - 0.5) * 0.05;
          state.ballRadius = 74 + Math.sin(localFrame * 0.8) * 4;
          state.bounceCount++;
          if (state.bounceCount > 35) {
            state.phase = 'captured';
          }
        } else if (state.phase === 'captured') {
          // Ball settles and locks into the specific sector
          const sectorArc = (2 * Math.PI) / 37;
          // The winning wedge is centered at ROULETTE_ORDER[capturedIndex]
          // Angle of winning wedge is: index * sectorArc + wheelAngle
          // We must orient it correctly so we flip or offset by PI/2 as per drawing rotation
          const targetWedgeAngle = state.capturedIndex * sectorArc + state.wheelAngle - Math.PI / 2;
          
          state.lerpT += 0.08;
          if (state.lerpT >= 1) {
            state.lerpT = 1;
            // Animation complete!
            state.phase = 'idle';
            onAnimationComplete(state.targetNumber!);
          }

          // Smoothly lerp ball angle and radius to the slot center
          state.ballAngle = state.ballAngle * (1 - state.lerpT) + targetWedgeAngle * state.lerpT;
          state.ballRadius = state.ballRadius * (1 - state.lerpT) + 70 * state.lerpT;
        }
      } else {
        // Just slow passive rotating when idle
        state.wheelAngle += 0.002;
        const sectorArc = (2 * Math.PI) / 37;
        const targetWedgeAngle = state.capturedIndex * sectorArc + state.wheelAngle - Math.PI / 2;
        state.ballAngle = targetWedgeAngle;
        state.ballRadius = 70;
      }

      // --- 2. Drawing functions ---
      ctx.save();
      ctx.translate(center, height / 2);

      // A. Outer wooden mahogany rim
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#450a0a'; // Rich dark reddish mahogany wood
      ctx.strokeStyle = '#d97706'; // Gold accent border
      ctx.lineWidth = 6;
      ctx.fill();
      ctx.stroke();

      // B. Inner gold track ring
      ctx.beginPath();
      ctx.arc(0, 0, radius - 10, 0, 2 * Math.PI);
      ctx.strokeStyle = '#b45309'; // Brass yellow/gold
      ctx.lineWidth = 4;
      ctx.stroke();

      // C. Spinner center wheel rotating at wheelAngle
      ctx.save();
      ctx.rotate(state.wheelAngle);

      const numSectors = 37;
      const sectorArc = (2 * Math.PI) / numSectors;

      // Draw each color slice and numbers
      for (let i = 0; i < numSectors; i++) {
        const angleStart = i * sectorArc - sectorArc / 2 - Math.PI / 2;
        const angleEnd = i * sectorArc + sectorArc / 2 - Math.PI / 2;
        const val = ROULETTE_ORDER[i];
        const color = getRouletteColor(val);

        // Slice wedge
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius - 15, angleStart, angleEnd);
        ctx.closePath();

        if (color === 'verde') ctx.fillStyle = '#16a34a';
        else if (color === 'rojo') ctx.fillStyle = '#dc2626';
        else ctx.fillStyle = '#1e293b'; // Slate 800 black
        ctx.fill();

        // Slice borders in gold/silver
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Write number radially
        ctx.save();
        ctx.rotate(i * sectorArc - Math.PI / 2);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Adjust 0 to draw a little more proudly
        if (val === 0) {
          ctx.fillStyle = '#eab308'; // Golden zero
          ctx.font = 'extrabold 11px monospace';
        }
        ctx.fillText(val.toString(), 0, -(radius - 28));
        ctx.restore();
      }

      // Draw inner brass center cone
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.44, 0, 2 * Math.PI);
      ctx.fillStyle = '#1e1b4b'; // Deep navy cone center
      ctx.fill();
      ctx.strokeStyle = '#eab308'; // Gold accent
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw center golden turret / handle
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.16, 0, 2 * Math.PI);
      ctx.fillStyle = '#f59e0b'; // Gold center block
      ctx.fill();

      // Draw handles / metal star spokes
      for (let s = 0; s < 4; s++) {
        ctx.save();
        ctx.rotate((s * Math.PI) / 2);
        ctx.fillStyle = '#b45309';
        ctx.fillRect(-2, -radius * 0.35, 4, radius * 0.35);
        ctx.beginPath();
        ctx.arc(0, -radius * 0.35, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.restore();
      }

      ctx.restore(); // Restore wheel rotation ctx

      // D. Draw the Ivory Ball at ballAngle & ballRadius
      const ballX = Math.cos(state.ballAngle) * state.ballRadius;
      const ballY = Math.sin(state.ballAngle) * state.ballRadius;

      ctx.beginPath();
      ctx.arc(ballX, ballY, 6, 0, 2 * Math.PI);
      // Ivory effect: radial gradient
      const ballGrad = ctx.createRadialGradient(ballX - 2, ballY - 2, 1, ballX, ballY, 6);
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(0.8, '#fefefe');
      ballGrad.addColorStop(1, '#cbd5e1');
      ctx.fillStyle = ballGrad;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 2;
      ctx.fill();

      // Clear shadow context
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Outer golden track bezel border shiny accents
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [onAnimationComplete]);

  return (
    <div className="relative inline-block mx-auto min-h-[210px] w-full flex items-center justify-center p-1">
      <div className="absolute inset-0 bg-yellow-500/5 filter blur-2xl rounded-full pointer-events-none" />
      <canvas
        ref={canvasRef}
        width={270}
        height={270}
        className="w-[200px] h-[200px] rounded-full shadow-2xl relative z-10 select-none border border-amber-500/25 bg-slate-950/80 p-0.5"
      />
    </div>
  );
};
