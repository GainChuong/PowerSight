import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SafeWorkspace from "@/components/SafeWorkspace";
import FloatingTrackerBar from "@/components/FloatingTrackerBar";
import { Providers } from "@/components/Providers";
import AuthGuard from "@/components/AuthGuard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PowerSight - Electronic Performance Monitoring",
  description: "Advanced performance tracking and safe workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="app-container">
          <Providers>
            <AuthGuard>
              <Sidebar />
              <div className="main-content" style={{ paddingTop: '60px' }}>
                <FloatingTrackerBar />
                <SafeWorkspace>
                  {children}
                </SafeWorkspace>
              </div>
            </AuthGuard>
          </Providers>
        </div>
      </body>
    </html>
  );
}
