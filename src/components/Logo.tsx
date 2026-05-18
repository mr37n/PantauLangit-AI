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
      <defs>
        <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="redGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer Cyan Border */}
      <rect 
        x="6" y="6" width="88" height="88" rx="14" 
        stroke="#22D3EE" strokeWidth="2.5" strokeOpacity="0.6" 
        filter="url(#cyanGlow)"
      />

      {/* Viewfinder Corners - Cyan */}
      <path d="M18 38 V22 Q18 18 22 18 H38" stroke="#22D3EE" strokeWidth="3.5" strokeLinecap="round" filter="url(#cyanGlow)" />
      <path d="M62 18 H78 Q82 18 82 22 V38" stroke="#22D3EE" strokeWidth="3.5" strokeLinecap="round" filter="url(#cyanGlow)" />
      <path d="M82 62 V78 Q82 82 78 82 H62" stroke="#22D3EE" strokeWidth="3.5" strokeLinecap="round" filter="url(#cyanGlow)" />
      <path d="M38 82 H22 Q18 82 18 78 V62" stroke="#22D3EE" strokeWidth="3.5" strokeLinecap="round" filter="url(#cyanGlow)" />

      {/* Red Baseline */}
      <line x1="10" y1="63.5" x2="90" y2="63.5" stroke="#F43F5E" strokeWidth="2" filter="url(#redGlow)" />

      {/* Left Cityscape - Red */}
      <path 
        d="M12 63.5 V52 H18 V46 H24 V58 L27 34 L32 48 H36 V42 H40 V54 H44 V63.5" 
        stroke="#F43F5E" 
        strokeWidth="2" 
        strokeLinejoin="round"
        filter="url(#redGlow)"
      />
      
      {/* Right Cityscape - Red */}
      <path 
        d="M62 63.5 H67 V53 H72 V42 H76 V56 L79 42 H84 V63.5 M84 63.5 H88 V54 H92 V63.5" 
        stroke="#F43F5E" 
        strokeWidth="2" 
        strokeLinejoin="round"
        filter="url(#redGlow)"
      />

      {/* Cyan Scanning Arc */}
      <path 
        d="M21 63.5 Q50 28 79 63.5" 
        stroke="#22D3EE" 
        strokeWidth="3.5" 
        strokeLinecap="round"
        filter="url(#cyanGlow)"
      />

      {/* Vertical Dashed Line */}
      <line 
        x1="50" y1="63.5" x2="50" y2="45.5" 
        stroke="#22D3EE" 
        strokeWidth="2.5" 
        strokeDasharray="3 3"
        filter="url(#cyanGlow)"
      />

      {/* Nodes (Dots) - Cyan */}
      <circle cx="21" cy="63.5" r="2.5" fill="#22D3EE" filter="url(#cyanGlow)" />
      <circle cx="79" cy="63.5" r="2.5" fill="#22D3EE" filter="url(#cyanGlow)" />
      <circle cx="50" cy="45.5" r="2.5" fill="#22D3EE" filter="url(#cyanGlow)" />
    </svg>
  );
};
