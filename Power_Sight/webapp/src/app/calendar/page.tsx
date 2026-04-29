"use client";

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Clock, Plus, Check, Trash2, X, CalendarDays, ListTodo, Repeat, Flag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const DAYS_VN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTHS_VN = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

const CATEGORIES = [
  { value: 'meeting', label: 'Họp', color: '#3b82f6' },
  { value: 'sap', label: 'SAP', color: '#f59e0b' },
  { value: 'admin', label: 'Admin', color: '#8b5cf6' },
  { value: 'training', label: 'Đào tạo', color: '#06b6d4' },
  { value: 'deadline', label: 'Deadline', color: '#ef4444' },
  { value: 'review', label: 'Review', color: '#10b981' },
  { value: 'development', label: 'Dev', color: '#f97316' },
  { value: 'other', label: 'Khác', color: '#64748b' },
];

const PRIORITIES = [
  { value: 'low', label: 'Thấp', color: '#64748b' },
  { value: 'medium', label: 'Trung bình', color: '#3b82f6' },
  { value: 'high', label: 'Cao', color: '#f59e0b' },
  { value: 'urgent', label: 'Khẩn cấp', color: '#ef4444' },
];

interface CalendarEvent {
  id: string;
  emp_id: string;
  title: string;
  description?: string;
  category: string;
  event_date: string;
  start_time: string;
  end_time: string;
  color: string;
  is_recurring: boolean;
  recurrence_type?: string;
  recurrence_end_date?: string;
  is_generated?: boolean;
  assigned_by?: string;
}

interface CalendarTask {
  id: string;
  emp_id: string;
  task_date: string;
  title: string;
  description?: string;
  category: string;
  is_completed: boolean;
  priority: string;
  sort_order: number;
  assigned_by?: string;
}

function getCategoryInfo(cat: string) {
  return CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];
}

function getPriorityInfo(p: string) {
  return PRIORITIES.find(pr => pr.value === p) || PRIORITIES[1];
}

export default function CalendarPage() {
  const { employeeId } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Event form state
  const [eventForm, setEventForm] = useState({
    title: '', description: '', category: 'meeting',
    start_time: '09:00', end_time: '10:00', color: '#3b82f6',
    is_recurring: false, recurrence_type: 'weekly', recurrence_end_date: '',
  });

  // Task form state
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', category: 'other', priority: 'medium',
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const fetchData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const m = String(month + 1);
      const y = String(year);
      const [evRes, tkRes] = await Promise.all([
        fetch(`/api/calendar/events?empId=${employeeId}&month=${m}&year=${y}`),
        fetch(`/api/calendar/tasks?empId=${employeeId}&month=${m}&year=${y}`),
      ]);
      const evData = await evRes.json();
      const tkData = await tkRes.json();
      setEvents(evData.events || []);
      setTasks(tkData.tasks || []);
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  }, [employeeId, month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(todayStr);
  };

  const eventsForDate = (dateStr: string) => events.filter(e => e.event_date === dateStr);
  const tasksForDate = (dateStr: string) => tasks.filter(t => t.task_date === dateStr);

  const selectedEvents = eventsForDate(selectedDate);
  const selectedTasks = tasksForDate(selectedDate);
  const completedCount = selectedTasks.filter(t => t.is_completed).length;

  // --- CRUD handlers ---
  const createEvent = async () => {
    if (!employeeId || !eventForm.title) return;
    try {
      await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_id: employeeId,
          event_date: selectedDate,
          ...eventForm,
          recurrence_end_date: eventForm.is_recurring ? eventForm.recurrence_end_date || null : null,
          recurrence_type: eventForm.is_recurring ? eventForm.recurrence_type : null,
        }),
      });
      setShowEventModal(false);
      setEventForm({ title: '', description: '', category: 'meeting', start_time: '09:00', end_time: '10:00', color: '#3b82f6', is_recurring: false, recurrence_type: 'weekly', recurrence_end_date: '' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const deleteEvent = async (id: string) => {
    try {
      await fetch(`/api/calendar/events?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const createTask = async () => {
    if (!employeeId || !taskForm.title) return;
    try {
      await fetch('/api/calendar/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emp_id: employeeId, task_date: selectedDate, ...taskForm }),
      });
      setShowTaskModal(false);
      setTaskForm({ title: '', description: '', category: 'other', priority: 'medium' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const quickAddTask = async () => {
    if (!employeeId || !newTaskTitle.trim()) return;
    try {
      await fetch('/api/calendar/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emp_id: employeeId, task_date: selectedDate, title: newTaskTitle.trim(), category: 'other', priority: 'medium' }),
      });
      setNewTaskTitle('');
      fetchData();
    } catch (err) { console.error(err); }
  };

  const toggleTask = async (task: CalendarTask) => {
    try {
      await fetch('/api/calendar/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, is_completed: !task.is_completed }),
      });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const deleteTask = async (id: string) => {
    try {
      await fetch(`/api/calendar/tasks?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  // Build calendar cells
  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="cal-cell cal-cell-empty" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = eventsForDate(dateStr);
    const dayTasks = tasksForDate(dateStr);
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;
    const isWeekend = new Date(year, month, day).getDay() === 0 || new Date(year, month, day).getDay() === 6;
    const tasksDone = dayTasks.filter(t => t.is_completed).length;
    const tasksTotal = dayTasks.length;

    cells.push(
      <div
        key={day}
        className={`cal-cell${isSelected ? ' cal-selected' : ''}${isToday ? ' cal-today' : ''}${isWeekend ? ' cal-weekend' : ''}`}
        onClick={() => setSelectedDate(dateStr)}
      >
        <div className={`cal-day-num${isToday ? ' cal-today-num' : ''}`}>{day}</div>
        <div className="cal-cell-events">
          {dayEvents.slice(0, 2).map(ev => (
            <div key={ev.id} className="cal-event-chip" style={{ borderLeftColor: getCategoryInfo(ev.category).color }}>
              <span className="cal-event-time">{ev.start_time?.slice(0, 5)}</span>
              <span className="cal-event-title-mini">{ev.title}</span>
            </div>
          ))}
          {dayEvents.length > 2 && (
            <div className="cal-more-events">+{dayEvents.length - 2} sự kiện</div>
          )}
          {tasksTotal > 0 && (
            <div className="cal-task-badge">
              <ListTodo size={10} />
              <span>{tasksDone}/{tasksTotal}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Lịch làm việc</h1>
          <p className="page-subtitle">Quản lý sự kiện & công việc hàng ngày</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={goToday}>
            <CalendarDays size={16} /> Hôm nay
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
        {/* Calendar Grid */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <button onClick={prevMonth} className="cal-nav-btn"><ChevronLeft size={20} /></button>
            <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)', fontWeight: 700 }}>
              {MONTHS_VN[month]} {year}
            </h2>
            <button onClick={nextMonth} className="cal-nav-btn"><ChevronRight size={20} /></button>
          </div>

          <div className="cal-header-row">
            {DAYS_VN.map(d => <div key={d} className="cal-header-cell">{d}</div>)}
          </div>

          <div className="cal-grid">
            {cells}
          </div>

          {/* Category Legend */}
          <div className="cal-legend">
            {CATEGORIES.slice(0, 6).map(c => (
              <div key={c.value} className="cal-legend-item">
                <div className="cal-legend-dot" style={{ background: c.color }} />
                <span>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Selected Date Header */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 4px 0', color: 'var(--text-main)', fontSize: '1.1rem' }}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
              <div className="cal-stat-pill">
                <CalendarDays size={14} /> {selectedEvents.length} sự kiện
              </div>
              <div className="cal-stat-pill">
                <ListTodo size={14} /> {completedCount}/{selectedTasks.length} task
              </div>
            </div>
          </div>

          {/* Events Section */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarDays size={16} color="var(--accent-primary)" /> Sự kiện
              </h4>
              <button className="cal-add-btn" onClick={() => setShowEventModal(true)}>
                <Plus size={14} /> Thêm
              </button>
            </div>
            {loading ? (
              <div className="cal-loading">Đang tải...</div>
            ) : selectedEvents.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Không có sự kiện nào</p>
            ) : (
              <div className="cal-events-list">
                {selectedEvents.map(ev => {
                  const cat = getCategoryInfo(ev.category);
                  return (
                    <div key={ev.id} className="cal-event-item" style={{ borderLeftColor: cat.color }}>
                      <div style={{ flex: 1 }}>
                        <div className="cal-event-item-title">{ev.title}</div>
                        <div className="cal-event-item-meta">
                          <Clock size={12} /> {ev.start_time?.slice(0, 5)} – {ev.end_time?.slice(0, 5)}
                          <span className="cal-cat-tag" style={{ background: `${cat.color}22`, color: cat.color }}>{cat.label}</span>
                          {ev.is_recurring && <Repeat size={12} color="var(--text-muted)" />}
                        </div>
                      </div>
                      {!ev.is_generated && (
                        <button className="cal-delete-btn" onClick={() => deleteEvent(ev.id)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tasks Section */}
          <div className="glass-card" style={{ padding: '20px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ListTodo size={16} color="var(--success)" /> Công việc
              </h4>
              <button className="cal-add-btn" onClick={() => setShowTaskModal(true)}>
                <Plus size={14} /> Chi tiết
              </button>
            </div>
            {loading ? (
              <div className="cal-loading">Đang tải...</div>
            ) : (
              <>
                <div className="cal-tasks-list">
                  {selectedTasks.map(task => {
                    const cat = getCategoryInfo(task.category);
                    const pri = getPriorityInfo(task.priority);
                    return (
                      <div key={task.id} className={`cal-task-item${task.is_completed ? ' cal-task-done' : ''}`}>
                        <button className={`cal-checkbox${task.is_completed ? ' checked' : ''}`} onClick={() => toggleTask(task)}>
                          {task.is_completed && <Check size={12} />}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="cal-task-title">{task.title}</div>
                          <div className="cal-task-meta">
                            <span className="cal-cat-tag" style={{ background: `${cat.color}22`, color: cat.color }}>{cat.label}</span>
                            <Flag size={10} color={pri.color} />
                          </div>
                        </div>
                        <button className="cal-delete-btn" onClick={() => deleteTask(task.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {/* Quick add */}
                <div className="cal-quick-add">
                  <input
                    type="text"
                    placeholder="+ Thêm công việc nhanh..."
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && quickAddTask()}
                    className="cal-quick-input"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showEventModal && (
        <div className="cal-modal-overlay" onClick={() => setShowEventModal(false)}>
          <div className="cal-modal glass-card" onClick={e => e.stopPropagation()}>
            <div className="cal-modal-header">
              <h3 style={{ margin: 0 }}>Tạo sự kiện mới</h3>
              <button className="cal-close-btn" onClick={() => setShowEventModal(false)}><X size={18} /></button>
            </div>
            <div className="cal-modal-body">
              <div className="cal-form-group">
                <label>Tiêu đề *</label>
                <input type="text" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Họp team buổi sáng" className="cal-input" />
              </div>
              <div className="cal-form-group">
                <label>Mô tả</label>
                <textarea value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} placeholder="Chi tiết..." className="cal-input" rows={2} />
              </div>
              <div className="cal-form-row">
                <div className="cal-form-group" style={{ flex: 1 }}>
                  <label>Bắt đầu *</label>
                  <input type="time" value={eventForm.start_time} onChange={e => setEventForm(f => ({ ...f, start_time: e.target.value }))} className="cal-input" />
                </div>
                <div className="cal-form-group" style={{ flex: 1 }}>
                  <label>Kết thúc *</label>
                  <input type="time" value={eventForm.end_time} onChange={e => setEventForm(f => ({ ...f, end_time: e.target.value }))} className="cal-input" />
                </div>
              </div>
              <div className="cal-form-group">
                <label>Phân loại</label>
                <div className="cal-cat-picker">
                  {CATEGORIES.map(c => (
                    <button key={c.value}
                      className={`cal-cat-option${eventForm.category === c.value ? ' active' : ''}`}
                      style={{ '--cat-color': c.color } as React.CSSProperties}
                      onClick={() => setEventForm(f => ({ ...f, category: c.value, color: c.color }))}
                    >{c.label}</button>
                  ))}
                </div>
              </div>
              <div className="cal-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={eventForm.is_recurring} onChange={e => setEventForm(f => ({ ...f, is_recurring: e.target.checked }))} />
                  <Repeat size={14} /> Lặp lại
                </label>
                {eventForm.is_recurring && (
                  <div className="cal-form-row" style={{ marginTop: '8px' }}>
                    <select value={eventForm.recurrence_type} onChange={e => setEventForm(f => ({ ...f, recurrence_type: e.target.value }))} className="cal-input">
                      <option value="daily">Hàng ngày</option>
                      <option value="weekly">Hàng tuần</option>
                      <option value="monthly">Hàng tháng</option>
                    </select>
                    <input type="date" value={eventForm.recurrence_end_date} onChange={e => setEventForm(f => ({ ...f, recurrence_end_date: e.target.value }))} className="cal-input" placeholder="Ngày kết thúc" />
                  </div>
                )}
              </div>
            </div>
            <div className="cal-modal-footer">
              <button className="cal-cancel-btn" onClick={() => setShowEventModal(false)}>Hủy</button>
              <button className="btn-primary" style={{ padding: '10px 24px' }} onClick={createEvent}>Tạo sự kiện</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showTaskModal && (
        <div className="cal-modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="cal-modal glass-card" onClick={e => e.stopPropagation()}>
            <div className="cal-modal-header">
              <h3 style={{ margin: 0 }}>Tạo công việc mới</h3>
              <button className="cal-close-btn" onClick={() => setShowTaskModal(false)}><X size={18} /></button>
            </div>
            <div className="cal-modal-body">
              <div className="cal-form-group">
                <label>Tiêu đề *</label>
                <input type="text" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Review PR #123" className="cal-input" />
              </div>
              <div className="cal-form-group">
                <label>Mô tả</label>
                <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} placeholder="Chi tiết..." className="cal-input" rows={2} />
              </div>
              <div className="cal-form-group">
                <label>Phân loại</label>
                <div className="cal-cat-picker">
                  {CATEGORIES.map(c => (
                    <button key={c.value}
                      className={`cal-cat-option${taskForm.category === c.value ? ' active' : ''}`}
                      style={{ '--cat-color': c.color } as React.CSSProperties}
                      onClick={() => setTaskForm(f => ({ ...f, category: c.value }))}
                    >{c.label}</button>
                  ))}
                </div>
              </div>
              <div className="cal-form-group">
                <label>Độ ưu tiên</label>
                <div className="cal-cat-picker">
                  {PRIORITIES.map(p => (
                    <button key={p.value}
                      className={`cal-cat-option${taskForm.priority === p.value ? ' active' : ''}`}
                      style={{ '--cat-color': p.color } as React.CSSProperties}
                      onClick={() => setTaskForm(f => ({ ...f, priority: p.value }))}
                    >{p.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="cal-modal-footer">
              <button className="cal-cancel-btn" onClick={() => setShowTaskModal(false)}>Hủy</button>
              <button className="btn-primary" style={{ padding: '10px 24px' }} onClick={createTask}>Tạo task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
