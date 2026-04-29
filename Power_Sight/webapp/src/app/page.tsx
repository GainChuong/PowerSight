"use client";

import { useState, useEffect, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import { Loader } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function KPIDashboard() {
  const { employeeId } = useAuth();
  const [selectedYear, setSelectedYear] = useState('2026');
  const [fromMonth, setFromMonth] = useState(1);
  const [toMonth, setToMonth] = useState(12);
  
  const [rawMonthlyData, setRawMonthlyData] = useState<any[]>([]);
  const [rawMetrics, setRawMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard?employeeId=${employeeId}&year=${selectedYear}`);
        const data = await res.json();
        if (res.ok) {
          setRawMonthlyData(data.monthlyData);
          setRawMetrics(data.metrics);
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
  }, [employeeId, selectedYear]);

  // Logic lọc dữ liệu theo khoảng tháng (Client-side filtering)
  const { filteredData, filteredMetrics } = useMemo(() => {
    if (!rawMonthlyData.length) return { filteredData: [], filteredMetrics: null };

    // Đảm bảo from <= to
    const start = Math.min(fromMonth, toMonth);
    const end = Math.max(fromMonth, toMonth);

    const data = rawMonthlyData.slice(start - 1, end);
    
    // Tính toán lại metrics dựa trên khoảng lọc
    const totalOrders = data.reduce((sum, m) => sum + m.totalOrders, 0);
    const completedOrders = data.reduce((sum, m) => sum + m.completedOrders, 0);
    const totalHours = data.reduce((sum, m) => sum + m.hoursWorked, 0);
    const totalFraud = data.reduce((sum, m) => sum + m.fraudTotal, 0);
    const criticalFraud = data.reduce((sum, m) => sum + m.fraudCritical, 0);
    const warningFraud = data.reduce((sum, m) => sum + m.fraudWarning, 0);
    const totalProfit = data.reduce((sum, m) => sum + m.profit, 0);
    const kpiTarget = data.reduce((sum, m) => sum + m.target, 0);
    
    const completionRate = kpiTarget > 0 ? ((completedOrders / kpiTarget) * 100).toFixed(1) : "0.0";

    return {
      filteredData: data,
      filteredMetrics: {
        totalOrders,
        completedOrders,
        totalHours: Number(totalHours.toFixed(1)),
        totalFraud,
        criticalFraud,
        warningFraud,
        totalProfit,
        kpiTarget,
        completionRate
      }
    };
  }, [rawMonthlyData, fromMonth, toMonth]);

  const pieData = filteredMetrics ? [
    { name: 'Completed', value: filteredMetrics.completedOrders },
    { name: 'Remaining', value: Math.max(0, filteredMetrics.kpiTarget - filteredMetrics.completedOrders) }
  ] : [];
  const PIE_COLORS = ['#10b981', '#334155'];

  return (
    <div className="animate-fade-in" style={{ backgroundColor: '#0f172a', minHeight: '100vh', padding: '20px' }}>
      
      {/* Header - Minimalized (No Icons) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: '15px 20px', borderRadius: '8px', borderBottom: '2px solid #3b82f6', marginBottom: '20px' }}>
        <h1 style={{ color: 'white', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
          {employeeId || "EM001"} - PERFORMANCE DASHBOARD
        </h1>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ color: '#94a3b8', fontSize: '14px' }}>Year:</div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="custom-select"
          >
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>

          <div style={{ color: '#94a3b8', fontSize: '14px', marginLeft: '10px' }}>From:</div>
          <select value={fromMonth} onChange={(e) => setFromMonth(Number(e.target.value))} className="custom-select">
            {MONTH_NAMES.map((name, i) => <option key={i} value={i+1}>{name}</option>)}
          </select>

          <div style={{ color: '#94a3b8', fontSize: '14px' }}>To:</div>
          <select value={toMonth} onChange={(e) => setToMonth(Number(e.target.value))} className="custom-select">
            {MONTH_NAMES.map((name, i) => <option key={i} value={i+1}>{name}</option>)}
          </select>

          <button onClick={() => setSelectedYear(selectedYear)} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '10px' }}>
            RELOAD
          </button>
        </div>
      </div>


      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <Loader size={32} className="animate-spin" color="#3b82f6" />
        </div>
      ) : (
        <>
          {/* KPI Cards Row */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '10px', border: '1px solid #334155', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 15px 0' }}>KEY PERFORMANCE INDICATORS</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px' }}>
              
              <KPICard title="ORDER COMPLETION" value={(filteredMetrics?.completedOrders || 0).toLocaleString()} color="#3b82f6" 
                subtitle={`Completed: ${filteredMetrics?.completedOrders || 0} / Total: ${filteredMetrics?.totalOrders || 0}`} />
              
              <KPICard title="TOTAL HOURS" value={filteredMetrics?.totalHours || "0"} color="#10b981" 
                subtitle={`${filteredMetrics?.totalHours > 0 ? (filteredMetrics.completedOrders / filteredMetrics.totalHours).toFixed(2) : 0} orders/hour`} />
              
              <KPICard title="FRAUD EVENTS" value={filteredMetrics?.totalFraud || "0"} color="#ef4444" 
                subtitle={`Critical: ${filteredMetrics?.criticalFraud || 0} | Warning: ${filteredMetrics?.warningFraud || 0}`} />
              
              <KPICard title="KPI RATE" value={`${filteredMetrics?.completionRate || 0}%`} color="#8b5cf6" 
                subtitle={`${filteredMetrics?.completedOrders || 0}/${filteredMetrics?.kpiTarget || 0} orders`} 
                progress={Number(filteredMetrics?.completionRate || 0)} />
              
              <KPICard title="TOTAL PROFIT" value={(filteredMetrics?.totalProfit || 0).toLocaleString()} color="#f59e0b" 
                subtitle={`Avg: ${filteredMetrics?.completedOrders > 0 ? Math.round(filteredMetrics.totalProfit / filteredMetrics.completedOrders).toLocaleString() : 0} VND`} />
            
            </div>
          </div>

          {/* Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            <ChartBox title="ORDERS BY MONTH">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="monthName" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: 'white' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: 'white' }} />
                  <Line type="monotone" dataKey="totalOrders" name="Total Orders" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="completedOrders" name="Completed" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>

            <ChartBox title="WORKING HOURS BY MONTH">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="monthName" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: 'white' }} />
                  <Bar dataKey="hoursWorked" name="Hours" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>

            <ChartBox title="FRAUD EVENTS BY MONTH">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="monthName" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: 'white' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: 'white' }} />
                  <Bar dataKey="fraudCritical" name="Critical" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="fraudWarning" name="Warning" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>

            <ChartBox title="KPI COMPLETION RATE">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    labelLine={false}
                    label={({ name, percent }) => percent > 0 ? `${name}` : ''}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: 'white' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', marginTop: '10px' }}>
                {filteredMetrics?.completedOrders || 0} / {filteredMetrics?.kpiTarget || 0} orders ({filteredMetrics?.completionRate || 0}%)
              </div>
            </ChartBox>

            <div style={{ gridColumn: '1 / -1' }}>
              <ChartBox title="REVENUE vs PROFIT COMPARISON">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={filteredData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="monthName" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: 'white' }} formatter={(value: number) => new Intl.NumberFormat('vi-VN').format(value) + ' VND'} />
                    <Legend wrapperStyle={{ fontSize: '12px', color: 'white' }} />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="profit" name="Profit" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartBox>
            </div>

          </div>
        </>
      )}

      {/* Global CSS for custom selects */}
      <style jsx global>{`
        .custom-select {
          background-color: #1e293b;
          color: white;
          border: 1px solid #334155;
          padding: 5px 10px;
          border-radius: 4px;
          outline: none;
          cursor: pointer;
        }
        .custom-select:hover {
          border-color: #3b82f6;
        }
      `}</style>
    </div>
  );
}

function KPICard({ title, value, color, subtitle, progress }: { title: string, value: string | number, color: string, subtitle: string, progress?: number }) {
  return (
    <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '140px' }}>
      <div style={{ color: color, fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>{title}</div>
      <div style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', marginBottom: '10px' }}>{value}</div>
      <div style={{ color: '#94a3b8', fontSize: '11px', textAlign: 'center', marginBottom: progress !== undefined ? '10px' : '0' }}>{subtitle}</div>
      {progress !== undefined && (
        <div style={{ width: '100%', height: '6px', backgroundColor: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: 'linear-gradient(90deg, #ef4444, #f59e0b, #10b981)', borderRadius: '3px' }}></div>
        </div>
      )}
    </div>
  );
}

function ChartBox({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '15px' }}>
      <h3 style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 15px 0', paddingLeft: '5px' }}>{title}</h3>
      {children}
    </div>
  );
}
