'use client';

import { useEffect, useRef } from 'react';

export default function AbstractWavesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let time = 0;
    let globalOpacity = 1;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleScroll = () => {
        const scrollTop = window.scrollY;
        const viewportHeight = window.innerHeight;
        const newOpacity = 1 - Math.min(scrollTop / (viewportHeight * 0.8), 1);
        globalOpacity = Math.max(0, newOpacity);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);

    const animate = () => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      if (globalOpacity <= 0.01) {
          requestAnimationFrame(animate);
          return;
      }

      // LOCKED CONFIGURATION: "Standard" (Current favorite)
      const config = { 
          layers: 6, 
          yOffset: 0, 
          spacing: 140, 
          amplitude: 1.0, 
          speed: 0.0 // STOP ANIMATION
      };
      
      time += 0.0015 * config.speed;
      
      for (let i = 0; i < config.layers; i++) {
          // Depth: 0 = Back/Far, 1 = Front/Close
          const depth = i / (config.layers - 1 || 1); 
          
          // Parallax
          const layerTime = time * (1 + depth * 0.2);

          ctx.beginPath();
          
          // Curved spacing to simulate perspective (closer layers spread more)
          const perspectiveSpacing = config.spacing * (0.8 + depth * 0.4);
          const yBase = height/2 + config.yOffset + (i - config.layers/2) * perspectiveSpacing;
          
          // Start off-screen (-50) and end off-screen (width + 50) to hide vertical connecting lines
          for(let x=-50; x<=width+50; x+=15) { 
              const y = yBase + 
                        (Math.sin(x*0.002 + layerTime + i) * (100 + i * 10) + 
                        Math.sin(x*0.005 - layerTime*2) * 50) * config.amplitude;
              if (x === -50) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
          }
          
          // Extend fill shape well below the screen
          ctx.lineTo(width+50, height+100);
          ctx.lineTo(-50, height+100);
          
          // Drop Shadow
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 40;
          ctx.shadowOffsetY = 20;

          const grad = ctx.createLinearGradient(0, yBase - 100, 0, yBase + 250);
          
          // BALANCED CONTRAST:
          // Highlight Ridge (Top)
          const ridgeLightness = 19 + depth * 9; // Lower base to 19 (from 24) to darken back waves. increased multiplier to keep front waves similar.
          grad.addColorStop(0, `rgba(${ridgeLightness}, ${ridgeLightness+3}, ${ridgeLightness+5}, ${(0.2 + depth * 0.1) * globalOpacity})`); 
          
          // Body (Mid)
          const bodyLightness = 7 + depth * 3; // Lower base to 7 (from 9).
          grad.addColorStop(0.3, `rgba(${bodyLightness}, ${bodyLightness}, ${bodyLightness+4}, ${(0.5 + depth * 0.2) * globalOpacity})`);
          
          // Deep Shadow (Bottom)
          grad.addColorStop(1, `rgba(0, 0, 0, ${1 * globalOpacity})`);
          
          // Draw base wave with shadow
          ctx.fillStyle = grad;
          ctx.fill();
          
          // Reset shadow for overlay/stroke
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          // Darken right side of upper waves (back layers)
          // Only apply if we are NOT drawing near the chat panel area (approx. right center) to avoid overlapping its glow
          if (depth < 0.5) {
            ctx.save();
            ctx.clip(); // Clip to the current wave path
            
            // Gradient from 50% width to 100% width (right side)
            const darkGrad = ctx.createLinearGradient(width * 0.4, 0, width, 0);
            darkGrad.addColorStop(0, 'transparent');
            
            // Make the shadow fade out before it hits the far right edge where the chat might be, or just keep it generally dark
            // BUT crucial fix: ensure z-index is correct. The canvas is -z-10, so it should naturally be behind.
            // The issue might be visual density. Let's reduce the darkness intensity slightly.
            darkGrad.addColorStop(1, `rgba(0, 0, 0, ${0.6 * (1 - depth) * globalOpacity})`);
            
            ctx.fillStyle = darkGrad;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
          }

          // Edge Highlight - Only visible on bottom/front layers
          // Use power 3 to make top layers (low depth) very faint but present
          const edgeLightness = Math.floor(140 + depth * 80); 
          
          // Specifically darken the edge of the very last (frontmost) wave
          let edgeAlpha = (Math.pow(depth, 3) * 0.3) * globalOpacity;
          if (i === config.layers - 1) {
              edgeAlpha *= 0.8; // Reduce opacity for the last layer
          }
          
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = `rgba(${edgeLightness}, ${edgeLightness}, ${edgeLightness}, ${edgeAlpha})`;
          ctx.stroke();
      }
      
      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none bg-black"
    />
  );
}
