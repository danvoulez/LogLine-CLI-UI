import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css'; // Global styles
import { Providers } from './providers';
import { PWARegister } from '@/components/pwa/PWARegister';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'LogLine Ops',
  description: 'LogLine observability and operations surface across devices.',
  manifest: '/manifest.webmanifest',
  applicationName: 'LogLine Ops',
  appleWebApp: {
    capable: true,
    title: 'LogLine Ops',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#202020',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning className="font-sans antialiased">
        <PWARegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
