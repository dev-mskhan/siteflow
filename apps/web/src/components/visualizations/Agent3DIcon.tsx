import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface Agent3DIconProps {
  Icon: LucideIcon;
  name: string;
  description: string;
  delay?: number;
}

export const Agent3DIcon: React.FC<Agent3DIconProps> = ({ Icon, name, description, delay = 0 }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="group relative"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <div className="relative bg-[var(--paper)] p-6 border border-[var(--hairline-2)] transition-all duration-300 hover:bg-[var(--surface-2)] hover:border-[var(--ink)] hover:shadow-lg overflow-hidden">
        {/* Animated background gradient */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(255,30,0,0.04) 0%, transparent 70%)',
          }}
        />

        {/* 3D Icon Container */}
        <motion.div
          className="relative mb-4 flex h-16 w-16 items-center justify-center"
          animate={{
            rotateY: isHovered ? 15 : 0,
            rotateX: isHovered ? -5 : 0,
            scale: isHovered ? 1.05 : 1,
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            transformStyle: 'preserve-3d',
            perspective: '1000px',
          }}
        >
          {/* Back layer (shadow effect) */}
          <motion.div
            className="absolute inset-0 rounded border border-[var(--action)]/20 bg-[var(--action)]/5"
            style={{
              transform: 'translateZ(-10px)',
            }}
          />

          {/* Middle layer */}
          <motion.div
            className="absolute inset-0 rounded border border-[var(--hairline-2)] bg-[var(--surface-2)] transition-colors group-hover:border-[var(--action)] group-hover:bg-[var(--action)]/10"
            style={{
              transform: 'translateZ(0px)',
            }}
          />

          {/* Front layer (icon) */}
          <motion.div
            className="relative z-10 flex items-center justify-center"
            animate={{
              translateZ: isHovered ? 20 : 0,
            }}
            transition={{ duration: 0.3 }}
          >
            <Icon
              className="h-7 w-7 transition-colors group-hover:text-[var(--action)]"
              strokeWidth={1.6}
            />
          </motion.div>

          {/* Floating particles */}
          {isHovered && (
            <>
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute h-1 w-1 rounded-full bg-[var(--action)]"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                    x: [0, (Math.random() - 0.5) * 30],
                    y: [0, (Math.random() - 0.5) * 30],
                  }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.2,
                    repeat: Infinity,
                    repeatDelay: 0.5,
                  }}
                />
              ))}
            </>
          )}
        </motion.div>

        {/* Content */}
        <div className="relative z-10">
          <h3 className="text-sm font-medium tracking-[-0.02em]">{name}</h3>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{description}</p>
        </div>

        {/* Hover indicator */}
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-[var(--action)]"
          initial={{ width: '0%' }}
          animate={{ width: isHovered ? '100%' : '0%' }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );
};
