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
      {/* Cityscape Left - Red */}
      <path 
        d="M11 62.5 V54.5 H18 V50 H24 V60 L26 44 L31 32 V54.5 H35 V42.5 L39 40 V50 H43 V62.5 H11" 
        stroke="#FF4566" 
        strokeWidth="1.5" 
        strokeLinejoin="round"
      />
      
      {/* Cityscape Right - Red */}
      <path 
        d="M64.5 62.5 H69 V58 H71 V38.5 H74.5 V52 L76 38.5 H81 V62.5 H77.5 V59.5 H74.5 V62.5 L81 62.5 V48 H91 V58 L94 62.5 H64.5" 
        stroke="#FF4566" 
        strokeWidth="1.5" 
        strokeLinejoin="round"
      />
      
      {/* Baseline - Blue */}
      <line x1="8" y1="62.5" x2="92" y2="62.5" stroke="#67C6FF" strokeWidth="1.5" />
      
      {/* Main Scan Arc - Blue */}
      <path 
        d="M18.5 62.5 Q50 21 81.5 62.5" 
        stroke="#67C6FF" 
        strokeWidth="2.5" 
        strokeLinecap="round"
      />
      
      {/* Arc Nodes - Blue */}
      <circle cx="18.5" cy="62.5" r="2.5" fill="#67C6FF" stroke="#67C6FF" strokeWidth="1" />
      <circle cx="81.5" cy="62.5" r="2.5" fill="#67C6FF" stroke="#67C6FF" strokeWidth="1" />
      <circle cx="50" cy="38" r="2.5" fill="#67C6FF" stroke="#67C6FF" strokeWidth="1" />
      
      {/* Center Vertical Scanner - Blue */}
      <line 
        x1="50" y1="38" x2="50" y2="62.5" 
        stroke="#67C6FF" 
        strokeWidth="1.5" 
        strokeDasharray="2 3" 
      />
      
      {/* Outer Viewfinder Frame - Blue */}
      <path d="M16 23 V16 A3 3 0 0 1 19 13 H24" stroke="#67C6FF" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M76 13 H81 A3 3 0 0 1 84 16 V23" stroke="#67C6FF" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M84 77 V84 A3 3 0 0 1 81 87 H76" stroke="#67C6FF" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 87 H19 A3 3 0 0 1 16 84 V77" stroke="#67C6FF" strokeWidth="2.5" strokeLinecap="round" />
      
      {/* Mid Connectors - Blue */}
      <line x1="41" y1="8" x2="59" y2="8" stroke="#67C6FF" strokeWidth="3" strokeLinecap="round" />
      <line x1="7" y1="41" x2="7" y2="59" stroke="#67C6FF" strokeWidth="3" strokeLinecap="round" />
      <line x1="93" y1="41" x2="93" y2="59" stroke="#67C6FF" strokeWidth="3" strokeLinecap="round" />
      
      {/* Outer rounded border */}
      <rect x="6" y="6" width="88" height="88" rx="12" stroke="#67C6FF" strokeWidth="1.5" strokeOpacity="0.5" />
    </svg>
  );
};
