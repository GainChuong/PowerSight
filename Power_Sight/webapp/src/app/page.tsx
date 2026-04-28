"use client";

import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend } from 'recharts';
import { Filter, AlertTriangle, Clock, ShoppingCart, CheckCircle, Sparkles, Loader } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function KPIDashboard() {
  const { employeeId } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState('01/2026'); // Mặc định có data theo script
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard?employeeId=${employeeId}&month=${selectedMonth}`);
        const data = await res.json();
        if (res.ok) {
          setDailyData(data.dailyData);
          setMetrics(data.metrics);
        } else {
          console.error(data.error);
        }
      } catch (err) {
        console.error('Lỗi khi lấy dữ liệu dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [employeeId, selectedMonth]);

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
              {/* Sinh các tháng cho năm 2026 */}
              {Array.from({ length: 12 }, (_, i) => {
                const m = (i + 1).toString().padStart(2, '0');
                return <option key={`2026-${m}`} value={`${m}/2026`} style={{ background: '#1e293b' }}>Tháng {m}/2026</option>;
              }).reverse()}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <Loader size={32} className="animate-spin" color="var(--accent-primary)" />
        </div>
      ) : (
        <>
          {/* AI Tổng quan Feedback */}
          <div className="glass-card" style={{ padding: '20px', marginBottom: '30px', display: 'flex', gap: '15px', alignItems: 'center', background: 'linear-gradient(90deg, rgba(59,130,246,0.1), transparent)' }}>
            <Sparkles color="var(--accent-primary)" size={24} />
            <div>
              <h4 style={{ margin: 0, color: 'var(--accent-primary)' }}>AI Đánh giá kỳ {selectedMonth}: Cập nhật từ dữ liệu!</h4>
              <p style={{ margin: 0, marginTop: '4px', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                Tỷ lệ hoàn thành KPI đạt {metrics?.completionRate || 0}%. Bạn có {metrics?.totalFraud || 0} lỗi vi phạm được ghi nhận.
                {metrics?.completionRate >= 90 ? " Duy trì phong độ rất tốt!" : " Cần tập trung hơn để cải thiện hiệu suất."}
              </p>
            </div>
          </div>

          {/* Phần trên: 4 Thống kê mini */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
            <MiniCard title="Tổng đơn hàng" value={(metrics?.totalOrders || 0).toLocaleString()} icon={ShoppingCart} color="var(--accent-primary)" />
            <MiniCard title="Tổng giờ làm việc" value={`${metrics?.totalHours || 0}h`} icon={Clock} color="var(--accent-secondary)" />
            <MiniCard title="Tổng lần vi phạm" value={(metrics?.totalFraud || 0).toLocaleString()} icon={AlertTriangle} color="var(--danger)" />
            <MiniCard title="Đơn đã hoàn thành" value={(metrics?.completedOrders || 0).toLocaleString()} icon={CheckCircle} color="var(--success)" />
          </div>

          {/* Phần dưới: 4 biểu đồ lớn */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <ChartCard title="Số lần vi phạm theo ngày">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
                  <Bar dataKey="violations" name="Vi phạm" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Doanh thu & Lợi nhuận">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dailyData}>
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
                <AreaChart data={dailyData}>
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
                  <Area type="monotone" dataKey="ordersCompleted" name="Đơn hoàn thành" stroke="var(--success)" fillOpacity={1} fill="url(#colorO)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Số giờ làm việc">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
                  <Bar dataKey="hoursWorked" name="Giờ làm" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function MiniCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: React.ElementType; color: string }) {
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <h3 style={{ marginBottom: '20px', fontSize: '1.1rem', color: 'var(--text-main)' }}>{title}</h3>
      {children}
    </div>
  );
}
