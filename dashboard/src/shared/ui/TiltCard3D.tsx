import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { type MouseEvent, type ReactNode, useRef, useState } from "react";

export interface TiltCard3DProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  maxTilt?: number;
  scale?: number;
  glare?: boolean;
  glareOpacity?: number;
  disabled?: boolean;
  onClick?: () => void;
}

function checkPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return isTouch || isReduced;
}

export function TiltCard3D({
  children,
  className = "",
  containerClassName = "",
  maxTilt = 7,
  scale = 1.015,
  glare = true,
  glareOpacity = 0.14,
  disabled = false,
  onClick,
}: TiltCard3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [prefersReducedMotion] = useState(checkPrefersReducedMotion);

  // Normalized mouse coords: -0.5 (left/top) to +0.5 (right/bottom)
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth spring physics for natural tactile feel
  const springX = useSpring(x, { damping: 24, stiffness: 300 });
  const springY = useSpring(y, { damping: 24, stiffness: 300 });

  // Convert to 3D rotation angles
  const rotateX = useTransform(springY, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-maxTilt, maxTilt]);

  // Dynamic glare coordinates (0% to 100%)
  const glareX = useTransform(springX, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(springY, [-0.5, 0.5], ["0%", "100%"]);
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0) 65%)`;

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled || prefersReducedMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    x.set(mouseX / rect.width - 0.5);
    y.set(mouseY / rect.height - 0.5);
  };

  const handleMouseEnter = () => {
    if (!disabled && !prefersReducedMotion) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  if (prefersReducedMotion || disabled) {
    return (
      <div className={containerClassName} onClick={onClick}>
        <div className={className}>{children}</div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`relative [perspective:1200px] ${containerClassName}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        animate={{
          scale: isHovered ? scale : 1,
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`relative h-full w-full ${className}`}
      >
        {children}

        {glare && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-30 rounded-[inherit] overflow-hidden transition-opacity duration-300"
            style={{
              opacity: isHovered ? glareOpacity : 0,
              background: glareBackground,
            }}
          />
        )}
      </motion.div>
    </div>
  );
}
