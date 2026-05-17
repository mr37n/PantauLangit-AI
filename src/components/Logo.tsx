import React from 'react';
import { cn } from '../lib/utils';

export const Logo = ({ className }: { className?: string }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={cn("w-10 h-10", className)}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Cityscape Silhouette - Updated to Red */}
      <path 
        d="M25 60 V50 H30 V40 H35 V30 H42 V55 H48 V45 H55 V60 H25" 
        stroke="#EF4444" 
        strokeWidth="1.2" 
        strokeOpacity="0.8" 
      />
      <path 
        d="M65 60 V52 H70 V58 H75 V48 H80 V60 H65" 
        stroke="#EF4444" 
        strokeWidth="1.2" 
        strokeOpacity="0.8" 
      />
      
      {/* Baseline */}
      <line x1="24" y1="60" x2="76" y2="60" stroke="#2DD4BF" strokeWidth="1" />
      
      {/* Arc */}
      <path 
        d="M30 60 Q50 35 70 60" 
        stroke="#2DD4BF" 
        strokeWidth="2.5" 
        strokeLinecap="round"
      />
      
      {/* Dots on Arc */}
      <circle cx="30" cy="60" r="1.5" fill="#2DD4BF" />
      <circle cx="70" cy="60" r="1.5" fill="#2DD4BF" />
      <circle cx="50" cy="47.5" r="1.5" fill="#2DD4BF" />
      
      {/* Center Dashed Line */}
      <line 
        x1="50" y1="47.5" x2="50" y2="60" 
        stroke="#2DD4BF" 
        strokeWidth="1" 
        strokeDasharray="2 2" 
      />
      
      {/* Square Frame Braces */}
      <path d="M15 30 V20 Q15 15 20 15 H30" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M70 15 H80 Q85 15 85 20 V30" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M85 70 V80 Q85 85 80 85 H70" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M30 85 H20 Q15 85 15 80 V70" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      
      {/* Mid lines */}
      <line x1="45" y1="15" x2="55" y2="15" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="45" y1="85" x2="55" y2="85" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
};
