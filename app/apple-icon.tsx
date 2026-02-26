import { ImageResponse } from 'next/og';

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
          background: 'linear-gradient(145deg, #202020 0%, #2d2d2d 100%)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '38px',
          color: '#ffffff',
          fontSize: 84,
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
