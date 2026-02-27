import React from 'react';

type LoglineMarkProps = {
  size?: number | string;
  inverse?: boolean;
  className?: string;
};

export function LoglineMark({ size = 100, inverse = false, className }: LoglineMarkProps) {
  const disk = inverse ? '#f4f4f5' : '#0f0f12';
  const cut = inverse ? '#0f0f12' : '#f4f4f5';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <clipPath id="logline-mark-disk">
          <circle cx="50" cy="50" r="38" />
        </clipPath>
      </defs>

      <circle cx="50" cy="50" r="38" fill={disk} />

      <g clipPath="url(#logline-mark-disk)" stroke={cut} strokeWidth="4.8" strokeLinecap="square">
        <line x1="12" y1="78" x2="78" y2="12" />
        <line x1="20" y1="86" x2="86" y2="20" />
        <line x1="4" y1="70" x2="70" y2="4" />

        <line x1="22" y1="12" x2="88" y2="78" />
        <line x1="14" y1="20" x2="80" y2="86" />
        <line x1="30" y1="4" x2="96" y2="70" />

        <line x1="35" y1="13" x2="59" y2="37" />
        <line x1="13" y1="35" x2="37" y2="59" />
        <line x1="63" y1="41" x2="87" y2="65" />
        <line x1="41" y1="63" x2="65" y2="87" />
      </g>
    </svg>
  );
}
