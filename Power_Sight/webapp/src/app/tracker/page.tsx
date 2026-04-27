"use client";

import { useState } from 'react';
import { Play, Pause, Square, Sparkles, Clock, List, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { checkFacePolicy } from '@/lib/tracking/violationEngine';
import { useTracking } from '@/context/TrackingContext';

export default function TimeTracker() {
  const { isRunning, seconds, pastSessions, startTracking, pauseTracking, stopTracking } = useTracking();

  const GOAL_SECONDS = 8 * 3600;
  const TARGET_TASKS = 20;
  const COMPLETED_TASKS = 14; 
  const KPI_PERFORMANCE = 70;

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const hoursWorked = (seconds / 3600).toFixed(1);
  const timeProgress = (seconds / GOAL_SECONDS) * 100;
  
  const getAiFeedback = () => {
    if (KPI_PERFORMANCE >= 90) {
      return {
        text: "🔥 Tuyệt vời! Bạn đang làm việc cực kì hiệu quả và sắp hoàn thành mục tiêu ngày hôm nay. Tiếp tục giữ vững phong độ này nhé!",
        color: "var(--success)", glow: "rgba(16, 185, 129, 0.2)"
      };
    } else if (KPI_PERFORMANCE >= 50) {
      return {
        text: "📈 Bạn đang làm tốt! Tiến độ công việc ổn định. Cố gắng hoàn thiện nốt các đơn hàng ưu tiên cao trong buổi chiều nhé.",
        color: "var(--accent-primary)", glow: "var(--accent-glow)"
      };
    } else if (COMPLETED_TASKS < 5) {
      return {
        text: "⚠️ Cảnh báo: Tốc độ hoàn thành KPI đang chậm hơn so với dự kiến. Bạn cần tập trung xử lý dứt điểm các tác vụ tồn đọng.",
        color: "var(--danger)", glow: "rgba(239, 68, 68, 0.2)"
      };
    } else {
      return {
        text: "⚡ Cố lên nào! Bạn còn thiếu một chút nữa để đạt mốc an toàn. Đừng để các yếu tố bên ngoài làm xao nhãng.",
        color: "var(--warning)", glow: "rgba(245, 158, 11, 0.2)"
      };
    }
  };

  const aiFeedback = getAiFeedback();

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Time Tracker</h1>
          <p className="page-subtitle">Theo dõi phiên làm việc theo thời gian thực</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        
        {/* Khung Điều khiển & Sessions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
             <h3 style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>Phiên làm việc hiện tại</h3>
             <div style={{ fontSize: '4rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--text-main)', letterSpacing: '2px', textShadow: '0 0 20px var(--accent-glow)' }}>
               {formatTime(seconds)}
             </div>
             
             <div style={{ display: 'flex', gap: '16px', marginTop: '30px' }}>
               {!isRunning ? (
                 <button className="btn-primary" onClick={startTracking} style={{ padding: '12px 30px', background: 'linear-gradient(135deg, var(--success), #059669)' }}>
                   <Play size={20} /> Bắt đầu
                 </button>
               ) : (
                 <button onClick={pauseTracking} style={{ padding: '12px 30px', background: 'linear-gradient(135deg, var(--warning), #d97706)', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <Pause size={20} /> Tạm dừng
                 </button>
               )}
               <button className="btn-danger" onClick={stopTracking} style={{ padding: '12px 30px' }}>
                 <Square size={20} /> Kết thúc phiên
               </button>
             </div>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                <List size={20} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '1.1rem' }}>Lịch sử phiên làm việc hôm nay</h3>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pastSessions.map((session, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: '3px solid var(--accent-primary)' }}>
                     <div style={{ color: 'var(--text-main)' }}>{session.start} - {session.end}</div>
                     <div style={{ display: 'flex', gap: '20px', color: 'var(--text-muted)' }}>
                        <span>Tổng giờ: <strong>{session.duration}</strong></span>
                        <span>Đã làm: <strong>{session.tasks} đơn</strong></span>
                     </div>
                  </div>
                ))}
              </div>
           </div>

           <div className="glass-card" style={{ padding: '20px', border: '1px solid var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
             <h3 style={{ color: 'var(--danger)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} /> Giả lập AI Tracking (Test)
             </h3>
             <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => checkFacePolicy([], false)} className="btn-danger" style={{ flex: 1, padding: '10px' }}>
                   Mất khuôn mặt
                </button>
                <button onClick={() => checkFacePolicy([{id: 1}], false)} className="btn-danger" style={{ flex: 1, padding: '10px' }}>
                   Sai người
                </button>
             </div>
           </div>

        </div>

        {/* Khung AI Nhận xét & Mini Dashboard Dọc */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-card" style={{ padding: '30px', border: `1px solid ${aiFeedback.color}`, boxShadow: `0 0 30px ${aiFeedback.glow}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
               <Sparkles color={aiFeedback.color} size={24} />
               <h3 style={{ color: aiFeedback.color, margin: 0 }}>AI Đánh giá Nhanh</h3>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '20px', fontSize: '1.05rem', lineHeight: '1.6' }}>
               {aiFeedback.text}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <div className="flex-between">
              <span style={{ color: 'var(--text-muted)' }}>Mục tiêu thời gian ngày</span>
              <Clock size={18} color="var(--accent-primary)" />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '15px 0' }}>
              {hoursWorked} / 8 giờ
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(timeProgress, 100)}%`, height: '100%', background: 'var(--accent-primary)', transition: 'width 1s linear' }}></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px' }}>
              <div className="glass-card" style={{ padding: '20px', flex: 1, textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '10px', fontSize: '0.9rem' }}>Nhiệm vụ</div>
                <div style={{ width: '80px', height: '80px', margin: '0 auto' }}>
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie data={[{ value: COMPLETED_TASKS }, { value: TARGET_TASKS - COMPLETED_TASKS }]} cx="50%" cy="50%" innerRadius={25} outerRadius={40} dataKey="value" stroke="none">
                         <Cell fill="var(--success)" />
                         <Cell fill="rgba(255,255,255,0.1)" />
                       </Pie>
                     </PieChart>
                   </ResponsiveContainer>
                </div>
                <div style={{ marginTop: '10px', fontWeight: 'bold' }}>{COMPLETED_TASKS}/{TARGET_TASKS}</div>
              </div>

              <div className="glass-card" style={{ padding: '20px', flex: 1, textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '10px', fontSize: '0.9rem' }}>Thành tích</div>
                <div style={{ width: '80px', height: '80px', margin: '0 auto' }}>
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie data={[{ value: KPI_PERFORMANCE }, { value: 100 - KPI_PERFORMANCE }]} cx="50%" cy="50%" innerRadius={25} outerRadius={40} dataKey="value" stroke="none">
                         <Cell fill="var(--warning)" />
                         <Cell fill="rgba(255,255,255,0.1)" />
                       </Pie>
                     </PieChart>
                   </ResponsiveContainer>
                </div>
                <div style={{ marginTop: '10px', fontWeight: 'bold' }}>{KPI_PERFORMANCE}%</div>
              </div>
          </div>

        </div>

      </div>
    </div>
  );
}
