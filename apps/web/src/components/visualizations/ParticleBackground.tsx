import React, { useCallback, useMemo } from 'react';
import Particles from 'react-tsparticles';
import type { Engine } from 'tsparticles';

interface ParticleBackgroundProps {
  variant?: 'subtle' | 'connections' | 'floating';
}

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({ variant = 'subtle' }) => {
  const particlesInit = useCallback(async (engine: Engine) => {
    // Load only slim bundle for performance
    // The engine is already initialized, we don't need to load additional features
  }, []);

  const particlesConfig = useMemo(() => {
    const baseConfig = {
      fullScreen: false,
      fpsLimit: 60,
      particles: {
        number: {
          value: variant === 'subtle' ? 40 : variant === 'connections' ? 60 : 80,
          density: {
            enable: true,
            area: 1000,
          },
        },
        color: {
          value: 'rgba(255, 30, 0, 0.15)',
        },
        shape: {
          type: variant === 'floating' ? ['circle', 'triangle'] : 'circle',
        },
        opacity: {
          value: { min: 0.1, max: 0.3 },
          animation: {
            enable: true,
            speed: 0.5,
            sync: false,
          },
        },
        size: {
          value: { min: 1, max: variant === 'floating' ? 4 : 2 },
        },
        move: {
          enable: true,
          speed: variant === 'subtle' ? 0.5 : 1,
          direction: 'none',
          random: true,
          straight: false,
          outModes: {
            default: 'bounce',
          },
        },
      },
      interactivity: {
        detectsOn: 'canvas',
        events: {
          onHover: {
            enable: true,
            mode: variant === 'connections' ? 'connect' : 'grab',
          },
          resize: {
            enable: true,
          },
        },
        modes: {
          grab: {
            distance: 140,
            links: {
              opacity: 0.2,
            },
          },
          connect: {
            distance: 120,
            links: {
              opacity: 0.3,
            },
          },
        },
      },
      detectRetina: true,
    };

    if (variant === 'connections') {
      return {
        ...baseConfig,
        particles: {
          ...baseConfig.particles,
          links: {
            enable: true,
            distance: 150,
            color: 'rgba(255, 30, 0, 0.1)',
            opacity: 0.15,
            width: 1,
          },
        },
      };
    }

    return baseConfig;
  }, [variant]);

  return (
    <Particles
      id={`tsparticles-${variant}`}
      init={particlesInit}
      options={particlesConfig}
      className="absolute inset-0 pointer-events-none"
    />
  );
};
