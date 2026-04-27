'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, BarChart2, Calendar, MessageSquare, UserCircle, Mail, HardDrive, Database, Orbit, ExternalLink } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const predefinedTabs = [
    { path: '/tracker', name: 'Time Tracker', icon: Clock },
    { path: '/', name: 'Dashboard KPI', icon: BarChart2 },
    { path: '/calendar', name: 'Lịch làm việc', icon: Calendar },
    { path: '/chatbot', name: 'Chatbot', icon: MessageSquare },
  ];

  const allowedApps = [
    { id: 'gmail', name: 'Gmail', icon: Mail },
    { id: 'gdrive', name: 'Google Drive', icon: HardDrive },
    { id: 'sap', name: 'SAP', icon: Database },
  ];

  return (
    <div className="sidebar animate-fade-in">
      <div className="sidebar-logo">
         <Orbit color="var(--accent-primary)" />
         <span className="text-gradient" style={{ fontWeight: 'bold', fontSize: '1.2rem', marginLeft: '8px' }}>PowerSight</span>
      </div>

      <div style={{ padding: '0 12px', marginBottom: '10px', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Menu Chính
      </div>
      <ul className="nav-menu">
        {predefinedTabs.map((tab) => {
          const isActive = pathname === tab.path;
          return (
            <li key={tab.path}>
              <Link
                href={tab.path}
                className={`nav-item${isActive ? ' active' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <tab.icon size={18} />
                  {tab.name}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <div style={{ padding: '0 12px', marginTop: '30px', marginBottom: '10px', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Ứng dụng được phép
      </div>

      <ul className="nav-menu">
        {allowedApps.map((app) => {
          const isActive = pathname === `/viewer/${app.id}`;
          return (
            <li key={app.id}>
              <Link
                href={`/viewer/${app.id}`}
                className={`nav-item${isActive ? ' active' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <app.icon size={18} />
                  {app.name}
                </div>
                <ExternalLink size={14} color="var(--text-muted)" />
              </Link>
            </li>
          );
        })}
      </ul>

      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
         <div className="nav-item" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <UserCircle size={28} color="var(--text-muted)" />
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 'bold' }}>EMP-2026 (Bạn)</span>
                 <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Đang hoạt động</span>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
