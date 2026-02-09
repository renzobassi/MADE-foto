
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

export default function Logo({ className, height = 40 }) {
  // SVG representation of the MADE logo blocks
  return (
    <svg 
      viewBox="0 0 440 100" 
      height={height} 
      className={className}
      fill="none" 
      stroke="currentColor" 
      strokeWidth="6"
      strokeLinecap="square"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* M - Square with X */}
      <g transform="translate(0,0)">
        <rect x="3" y="3" width="94" height="94" />
        <line x1="3" y1="3" x2="97" y2="97" />
        <line x1="97" y1="3" x2="3" y2="97" />
      </g>
      
      {/* A - Triangle with vertical center line */}
      <g transform="translate(110,0)">
        <path d="M3 97 L50 3 L97 97 Z" />
        <line x1="50" y1="3" x2="50" y2="97" />
      </g>
      
      {/* D - Square/Rectangle and Semicircle */}
      <g transform="translate(220,0)">
        <rect x="3" y="3" width="47" height="94" />
        <path d="M50 3 A 47 47 0 0 1 50 97" />
        <line x1="50" y1="3" x2="50" y2="97" />
      </g>
      
      {/* E - Square with grid lines */}
      <g transform="translate(330,0)">
        <rect x="3" y="3" width="94" height="94" />
        <line x1="50" y1="3" x2="50" y2="97" />
        <line x1="3" y1="35" x2="97" y2="35" />
        <line x1="3" y1="65" x2="97" y2="65" />
      </g>
    </svg>
  );
}
