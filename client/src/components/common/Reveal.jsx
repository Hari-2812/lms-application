import { motion } from 'framer-motion';

/**
 * Scroll-triggered fade-up used for landing page sections.
 * Animates once, respects reduced-motion via Framer's global setting.
 */
export default function Reveal({ children, delay = 0, y = 16, className = '', as = 'div' }) {
  const MotionTag = motion[as] || motion.div;

  return (
    <MotionTag
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`min-w-0 ${className}`}
    >
      {children}
    </MotionTag>
  );
}
