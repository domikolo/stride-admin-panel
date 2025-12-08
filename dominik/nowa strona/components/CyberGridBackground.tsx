'use client';

import { useEffect, useRef } from 'react';

export default function CyberGridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const setSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setSize();

    let width = canvas.width;
    let height = canvas.height;
    let time = 0;
    const speed = 1.5;

    const handleResize = () => {
      setSize();
      width = canvas.width;
      height = canvas.height;
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      // Clear (Black background)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      const horizonY = height / 2;
      time += speed;

      // Vertical Lines
      const numVLines = 30;
      for (let i = -numVLines; i <= numVLines; i++) {
        const xBottom = width/2 + i * 80; 
        const xHorizon = width/2 + i * 3; 
        
        const gradient = ctx.createLinearGradient(0, horizonY, 0, height);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xHorizon, horizonY);
        ctx.lineTo(xBottom, height);
        ctx.stroke();
      }

      // Horizontal Lines
      const numHLines = 20;
      for (let i = 0; i < numHLines; i++) {
        const rawT = (time * 0.008 + i / numHLines) % 1;
        const perspectiveT = Math.pow(rawT, 2.5); 
        const y = horizonY + perspectiveT * (height - horizonY);
        const opacity = Math.sin(Math.PI * perspectiveT) * 0.4;
        
        if (opacity > 0.02) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
      }

      // Particles
      const numParticles = 30;
      for (let i = 0; i < numParticles; i++) {
        const pTime = time * 0.05 + i * 100;
        const x = (Math.sin(i * 123.45 + pTime * 0.1) * 0.5 + 0.5) * width;
        const y = (Math.cos(i * 67.89 + pTime * 0.1) * 0.5 + 0.5) * height;
        const size = Math.random() * 1.5 + 0.5;
        const alpha = Math.random() * 0.5 + 0.2;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
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
