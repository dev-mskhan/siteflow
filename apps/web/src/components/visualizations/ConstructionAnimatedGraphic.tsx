import React from 'react';
import { motion } from 'framer-motion';
import { HardHat, TrendingUp, FileCheck, Truck } from 'lucide-react';

export const ConstructionAnimatedGraphic: React.FC = () => {
  return (
    <div className="relative w-full aspect-square max-w-md mx-auto">
      {/* Central circle */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className="relative w-32 h-32 rounded-full border-2 border-[var(--action)] bg-[var(--action)]/5 flex items-center justify-center">
          <HardHat className="w-12 h-12 text-[var(--action)]" strokeWidth={1.5} />
          
          {/* Pulse effect */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-[var(--action)]"
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        </div>
      </motion.div>

      {/* Orbiting elements */}
      {[
        { Icon: FileCheck, angle: 0, delay: 0.2, label: 'BOQ' },
        { Icon: TrendingUp, angle: 120, delay: 0.4, label: 'Budget' },
        { Icon: Truck, angle: 240, delay: 0.6, label: 'Delivery' },
      ].map(({ Icon, angle, delay, label }, index) => {
        const radius = 140;
        const radian = (angle * Math.PI) / 180;
        const x = Math.cos(radian) * radius;
        const y = Math.sin(radian) * radius;

        return (
          <motion.div
            key={index}
            className="absolute top-1/2 left-1/2"
            style={{
              x: -20,
              y: -20,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              x: x - 20,
              y: y - 20,
            }}
            transition={{
              duration: 0.8,
              delay,
              ease: 'easeOut',
            }}
          >
            {/* Connection line */}
            <motion.svg
              className="absolute top-5 left-5 pointer-events-none"
              width={Math.abs(x)}
              height={Math.abs(y)}
              style={{
                left: x > 0 ? 0 : x,
                top: y > 0 ? 0 : y,
              }}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.2 }}
              transition={{ duration: 1, delay: delay + 0.3 }}
            >
              <motion.line
                x1={x > 0 ? 20 : Math.abs(x) + 20}
                y1={y > 0 ? 20 : Math.abs(y) + 20}
                x2={x > 0 ? Math.abs(x) : 20}
                y2={y > 0 ? Math.abs(y) : 20}
                stroke="var(--action)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            </motion.svg>

            {/* Icon container */}
            <motion.div
              className="relative w-20 h-20 rounded-lg border border-[var(--hairline-2)] bg-[var(--paper)] shadow-md flex items-center justify-center"
              whileHover={{
                scale: 1.1,
                borderColor: 'var(--action)',
                transition: { duration: 0.2 },
              }}
              animate={{
                y: [0, -8, 0],
              }}
              transition={{
                duration: 3,
                delay: delay + 1,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Icon className="w-8 h-8 text-[var(--action)]" strokeWidth={1.5} />
              
              {/* Label */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-wider text-[var(--muted)] whitespace-nowrap">
                {label}
              </div>
            </motion.div>

            {/* Glow effect on hover */}
            <motion.div
              className="absolute inset-0 rounded-lg bg-[var(--action)]/10 opacity-0"
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          </motion.div>
        );
      })}

      {/* Rotating construction grid background */}
      <motion.svg
        className="absolute inset-0 w-full h-full opacity-5"
        viewBox="0 0 400 400"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{
          duration: 60,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        <defs>
          <pattern
            id="construction-grid"
            x="0"
            y="0"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="var(--action)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="400" height="400" fill="url(#construction-grid)" />
      </motion.svg>
    </div>
  );
};
