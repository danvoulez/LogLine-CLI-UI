import { ImageResponse } from 'next/og';

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
          background: 'linear-gradient(145deg, #202020 0%, #2d2d2d 100%)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '96px',
          color: '#ffffff',
          fontSize: 220,
          fontWeight: 700,
        }}
      >
        L
      </div>
    ),
    {
      ...size,
    }
  );
}
