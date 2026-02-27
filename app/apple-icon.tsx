import { ImageResponse } from 'next/og';
import { LoglineMark } from '@/components/brand/LoglineMark';

export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #111114 0%, #1a1a20 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '38px',
        }}
      >
        <LoglineMark size={132} inverse />
      </div>
    ),
    {
      ...size,
    }
  );
}
