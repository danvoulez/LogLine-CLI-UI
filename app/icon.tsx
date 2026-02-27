import { ImageResponse } from 'next/og';
import { LoglineMark } from '@/components/brand/LoglineMark';

export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: '96px',
        }}
      >
        <LoglineMark size={368} inverse />
      </div>
    ),
    {
      ...size,
    }
  );
}
