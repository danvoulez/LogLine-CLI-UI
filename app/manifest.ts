import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LogLine Ops',
    short_name: 'LogLine',
    description: 'LogLine observability and operations surface across devices.',
    start_url: '/',
    display: 'standalone',
    background_color: '#202020',
    theme_color: '#202020',
    orientation: 'portrait',
    icons: [
      {
        src: '/brand/logline-mark-light.svg',
        sizes: '1024x1024',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon?size=192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon?size=512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
