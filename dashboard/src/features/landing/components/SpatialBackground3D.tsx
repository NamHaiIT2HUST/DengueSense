import { useEffect, useRef } from "react";

interface Point3D {
  x: number;
  y: number;
  z: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  size: number;
  color: string;
}

export function SpatialBackground3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check reduced motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;

    // Grid of 3D spatial points
    const points: Point3D[] = [];
    const rows = 14;
    const cols = 22;
    const spacingX = 140;
    const spacingZ = 90;

    const colors = [
      "rgba(14, 165, 233, ", // cyan
      "rgba(37, 99, 235, ", // blue
      "rgba(99, 102, 241, ", // indigo
      "rgba(239, 68, 68, ", // red/accent
    ];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - cols / 2) * spacingX;
        const z = (r - rows / 2) * spacingZ;
        const y = Math.sin((c + r) * 0.4) * 35;
        const color = colors[(r + c) % colors.length]!;

        points.push({
          x,
          y,
          z,
          baseX: x,
          baseY: y,
          baseZ: z,
          size: Math.random() * 1.8 + 1.2,
          color,
        });
      }
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const normX = e.clientX / window.innerWidth - 0.5;
      const normY = e.clientY / window.innerHeight - 0.5;
      targetRotY = normX * 0.35;
      targetRotX = -normY * 0.25;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    let time = 0;
    const focalLength = 480;

    const render = () => {
      time += 0.015;

      // Smooth camera interpolation
      currentRotX += (targetRotX - currentRotX) * 0.05;
      currentRotY += (targetRotY - currentRotY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const cosY = Math.cos(currentRotY);
      const sinY = Math.sin(currentRotY);
      const cosX = Math.cos(currentRotX + 0.38); // tilted down perspective
      const sinX = Math.sin(currentRotX + 0.38);

      const projectedPoints: {
        x: number;
        y: number;
        scale: number;
        alpha: number;
        color: string;
      }[] = [];

      for (let i = 0; i < points.length; i++) {
        const pt = points[i]!;

        // 3D Wave elevation
        if (!prefersReducedMotion) {
          pt.y = pt.baseY + Math.sin(time + (pt.baseX + pt.baseZ) * 0.003) * 30;
        }

        // Rotate Y
        let rx = pt.x * cosY - pt.z * sinY;
        let rz = pt.x * sinY + pt.z * cosY;

        // Rotate X
        let ry = pt.y * cosX - rz * sinX;
        rz = pt.y * sinX + rz * cosX;

        // Camera distance translation
        rz += 650;

        if (rz > 10) {
          const scale = focalLength / rz;
          const px = rx * scale + width / 2;
          const py = ry * scale + height * 0.48; // position slightly above center
          const alpha = Math.max(0, Math.min(1, 1 - rz / 1400));

          projectedPoints.push({
            x: px,
            y: py,
            scale,
            alpha,
            color: pt.color,
          });
        }
      }

      // Draw spatial telemetry connection lines along grid columns and rows
      ctx.lineWidth = 0.75;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const p1 = projectedPoints[idx];
          if (!p1 || p1.alpha <= 0.05) continue;

          // Connect to right neighbor
          if (c < cols - 1) {
            const p2 = projectedPoints[idx + 1];
            if (p2 && p2.alpha > 0.05) {
              const lineAlpha = Math.min(p1.alpha, p2.alpha) * 0.22;
              ctx.strokeStyle = `rgba(14, 165, 233, ${lineAlpha})`;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }

          // Connect to bottom neighbor
          if (r < rows - 1) {
            const p3 = projectedPoints[idx + cols];
            if (p3 && p3.alpha > 0.05) {
              const lineAlpha = Math.min(p1.alpha, p3.alpha) * 0.18;
              ctx.strokeStyle = `rgba(37, 99, 235, ${lineAlpha})`;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p3.x, p3.y);
              ctx.stroke();
            }
          }
        }
      }

      // Draw particle nodes with depth glow
      for (let i = 0; i < projectedPoints.length; i++) {
        const p = projectedPoints[i]!;
        if (p.alpha <= 0.05) continue;

        const radius = Math.max(0.6, 2.2 * p.scale);
        ctx.fillStyle = `${p.color}${p.alpha * 0.85})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing glow for larger nodes
        if (radius > 1.4 && p.alpha > 0.4) {
          ctx.fillStyle = `${p.color}${p.alpha * 0.25})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius * 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-60 dark:opacity-75 transition-opacity duration-700"
    />
  );
}
