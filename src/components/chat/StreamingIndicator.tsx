import React from 'react';
import { motion } from 'framer-motion';

interface StreamingIndicatorProps {
  agentName: string;
}

export const StreamingIndicator: React.FC<StreamingIndicatorProps> = ({ agentName }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 text-gray-500 text-xs ml-12"
    >
      <motion.div
        className="flex gap-1"
        initial={{ opacity: 0.3 }}
        animate={{ opacity: 1 }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: "easeInOut"
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
      </motion.div>
      <span className="text-primary">{agentName} is typing...</span>
    </motion.div>
  );
};
