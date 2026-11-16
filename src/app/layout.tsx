import type { Metadata } from 'next';
import './globals.css';
import { FleetProvider } from '@/context/FleetContext';

export const metadata: Metadata = {
  title: 'OctoFleet — Yacht Inventory & Fleet Management Platform',
  description:
    'Enterprise superyacht inventory specification compliance, multi-vessel fleet oversight, and bidirectional Google Sheets synchronization.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#060B16] text-slate-100 antialiased">
        <FleetProvider>{children}</FleetProvider>
      </body>
    </html>
  );
}
