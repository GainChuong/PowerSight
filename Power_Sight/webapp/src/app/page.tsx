"use client";

import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend } from 'recharts';
import { Filter, AlertTriangle, Clock, ShoppingCart, CheckCircle, Sparkles } from 'lucide-react';

const deterministicRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const mockDailyData = Array.from({ length: 30 }, (_, i) => ({
  day: `Ngày ${i + 1}`,
  violations: Math.floor(deterministicRandom(i) * 5),
  revenue: Math.floor(deterministicRandom(i + 1) * 5000) + 1000,
  profit: Math.floor(deterministicRandom(i + 2) * 2000) + 500,
  ordersCompleted: Math.floor(deterministicRandom(i + 3) * 50) + 10,
  hoursWorked: (deterministicRandom(i + 4) * 4 + 4).toFixed(1),
}));

export default function KPIDashboard() {
  const [selectedMonth, setSelectedMonth] = useState('04/2026');

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Dashboard KPI</h1>
          <p className="page-subtitle">Phân tích chuyên sâu về hiệu suất của bạn</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="glass-card" style={{ padding: '8px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', cursor: 'pointer' }}
            >
              <option value="04/2026" style={{ background: '#1e293b' }}>Tháng 04/2026</option>
              <option value="03/2026" style={{ background: '#1e293b' }}>Tháng 03/2026</option>
              <option value="02/2026" style={{ background: '#1e293b' }}>Tháng 02/2026</option>
            </select>
          </div>
        </div>
      </div>

      {/* AI Tổng quan Feedback */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '30px', display: 'flex', gap: '15px', alignItems: 'center', background: 'linear-gradient(90deg, rgba(59,130,246,0.1), transparent)' }}>
        <Sparkles color="var(--accent-primary)" size={24} />
        <div>
          <h4 style={{ margin: 0, color: 'var(--accent-primary)' }}>AI Đánh giá kỳ {selectedMonth}: Xuất sắc!</h4>
          <p style={{ margin: 0, marginTop: '4px', color: 'var(--text-main)', fontSize: '0.95rem' }}>
            Bạn đang duy trì tỷ lệ hoàn thành đơn hàng rất tốt (đạt mục tiêu 95%). Tuy nhiên có 3 lỗi vi phạm quy trình cần lưu ý vào giữa tháng. Tiếp tục phát huy hiệu suất này!
          </p>
        </div>
      </div>

      {/* Phần trên: 4 Thống kê mini */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
        <MiniCard title="Tổng đơn hàng" value="1,245" icon={ShoppingCart} color="var(--accent-primary)" />
        <MiniCard title="Tổng giờ làm việc" value="160.5h" icon={Clock} color="var(--accent-secondary)" />
        <MiniCard title="Tổng lần gian lận/lỗi" value="3" icon={AlertTriangle} color="var(--danger)" />
        <MiniCard title="Đơn đã hoàn thành" value="1,180" icon={CheckCircle} color="var(--success)" />
      </div>

      {/* Phần dưới: 4 biểu đồ lớn */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <ChartCard title="Số lần vi phạm theo ngày">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={mockDailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <RechartsTooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
              <Bar dataKey="violations" fill="var(--danger)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Doanh thu & Lợi nhuận">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={mockDailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <RechartsTooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="var(--accent-primary)" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="profit" name="Lợi nhuận" stroke="var(--success)" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Số đơn hàng hoàn thành">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={mockDailyData}>
              <defs>
                <linearGradient id="colorO" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--success)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <RechartsTooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="ordersCompleted" stroke="var(--success)" fillOpacity={1} fill="url(#colorO)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Số giờ làm việc">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={mockDailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <RechartsTooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
              <Bar dataKey="hoursWorked" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function MiniCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>{title}</div>
        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{value}</div>
      </div>
      <div style={{ padding: '12px', background: `color-mix(in srgb, ${color} 15%, transparent)`, borderRadius: '12px' }}>
        <Icon size={24} color={color} />
      </div>
    </div >
  );
}

function ChartCard({ title, children }: any) {
  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <h3 style={{ marginBottom: '20px', fontSize: '1.1rem', color: 'var(--text-main)' }}>{title}</h3>
      {children}
    </div>
  );
}
