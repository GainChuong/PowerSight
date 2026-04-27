"use client";

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
import { useTracking } from '@/context/TrackingContext';

const DAYS_VN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTHS_VN = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

interface WorkEvent {
  date: string; // YYYY-MM-DD
  hours: number;
  tasks: number;
  violations: number;
}

// Mock work data for current month
const generateMockEvents = (): WorkEvent[] => {
  const events: WorkEvent[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  for (let day = 1; day <= now.getDate(); day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = new Date(year, month, day).getDay();
    if (dow === 0 || dow === 6) continue; // Skip weekends

    events.push({
      date: dateStr,
      hours: parseFloat((Math.random() * 4 + 4).toFixed(1)),
      tasks: Math.floor(Math.random() * 20) + 5,
      violations: Math.floor(Math.random() * 3),
    });
  }
  return events;
};

const mockEvents = generateMockEvents();

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { pastSessions } = useTracking();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getEvent = (day: number): WorkEvent | undefined => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return mockEvents.find(e => e.date === dateStr);
  };

  const getHourColor = (hours: number) => {
    if (hours >= 7.5) return 'var(--success)';
    if (hours >= 5) return 'var(--accent-primary)';
    if (hours >= 3) return 'var(--warning)';
    return 'var(--danger)';
  };

  const selectedEvent = selectedDate ? mockEvents.find(e => e.date === selectedDate) : null;

  // Build calendar grid
  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} style={{ padding: '10px' }} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const event = getEvent(day);
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;
    const isWeekend = new Date(year, month, day).getDay() === 0 || new Date(year, month, day).getDay() === 6;

    cells.push(
      <div
        key={day}
        onClick={() => setSelectedDate(dateStr)}
        style={{
          padding: '8px',
          borderRadius: '10px',
          cursor: 'pointer',
          background: isSelected
            ? 'rgba(59, 130, 246, 0.25)'
            : isToday
            ? 'rgba(59, 130, 246, 0.1)'
            : 'transparent',
          border: isToday ? '1px solid var(--accent-primary)' : '1px solid transparent',
          transition: 'all 0.2s ease',
          minHeight: '80px',
          position: 'relative' as const,
          opacity: isWeekend ? 0.4 : 1,
        }}
      >
        <div style={{
          fontSize: '0.85rem',
          fontWeight: isToday ? 'bold' : 'normal',
          color: isToday ? 'var(--accent-primary)' : 'var(--text-main)',
          marginBottom: '6px',
        }}>
          {day}
        </div>
        {event && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{
              fontSize: '0.7rem',
              padding: '2px 6px',
              borderRadius: '4px',
              background: `color-mix(in srgb, ${getHourColor(event.hours)} 20%, transparent)`,
              color: getHourColor(event.hours),
              fontWeight: 'bold',
            }}>
              {event.hours}h
            </div>
            {event.violations > 0 && (
              <div style={{
                fontSize: '0.65rem',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--danger)',
              }}>
                ⚠ {event.violations}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Lịch làm việc</h1>
          <p className="page-subtitle">Theo dõi lịch sử thời gian làm việc theo ngày</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        {/* Calendar Grid */}
        <div className="glass-card" style={{ padding: '24px' }}>
          {/* Month Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px', color: 'var(--text-muted)' }}>
              <ChevronLeft size={20} />
            </button>
            <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)' }}>
              {MONTHS_VN[month]} {year}
            </h2>
            <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px', color: 'var(--text-muted)' }}>
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Day Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
            {DAYS_VN.map(day => (
              <div key={day} style={{
                textAlign: 'center',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                color: 'var(--text-muted)',
                padding: '8px 0',
              }}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {cells}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '20px', marginTop: '20px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--success)' }} /> ≥7.5h
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--accent-primary)' }} /> ≥5h
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--warning)' }} /> ≥3h
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--danger)' }} /> &lt;3h
            </div>
          </div>
        </div>

        {/* Side Panel: Day Detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-main)', fontSize: '1.1rem' }}>
              {selectedDate
                ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })
                : 'Chọn ngày để xem chi tiết'
              }
            </h3>

            {selectedEvent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Giờ làm việc</span>
                  <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: getHourColor(selectedEvent.hours) }}>{selectedEvent.hours}h</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Đơn hoàn thành</span>
                  <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--accent-primary)' }}>{selectedEvent.tasks}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Vi phạm</span>
                  <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: selectedEvent.violations > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {selectedEvent.violations > 0 ? selectedEvent.violations : '✓'}
                  </span>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Nhấn vào ngày bất kỳ trên lịch để xem chi tiết số giờ làm việc, đơn hàng đã hoàn thành, và các vi phạm trong ngày đó.
              </p>
            )}
          </div>

          {/* Today's Sessions Summary */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
              <Clock size={18} color="var(--accent-primary)" />
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Phiên hôm nay</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pastSessions.map((session, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  borderLeft: '3px solid var(--accent-primary)',
                  fontSize: '0.85rem',
                }}>
                  <span style={{ color: 'var(--text-main)' }}>{session.start} – {session.end}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{session.duration}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
