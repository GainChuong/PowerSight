'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Sparkles, Plus, Trash2, MessageSquare, Home, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export default function Chatbot() {
  const { employeeId } = useAuth();

  // State: Sessions
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // State: Messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Fetch sessions on load
  useEffect(() => {
    if (!employeeId) return;
    fetchSessions();
  }, [employeeId]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`/api/chat/sessions?empId=${employeeId}`);
      const data = await res.json();
      if (data.sessions) setSessions(data.sessions);
    } catch (e) {
      console.error('Error fetching sessions:', e);
    }
  };

  // Load messages when clicking a session
  const loadSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setMessages([]);
    try {
      const res = await fetch(`/api/chat/messages?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages.map((m: any) => ({ role: m.role, content: m.content })));
      }
    } catch (e) {
      console.error('Error loading session:', e);
    }
  };

  // Start new chat
  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
  };

  // Delete session
  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat/sessions?sessionId=${sessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        startNewChat();
      }
    } catch (e) {
      console.error('Error deleting session:', e);
    }
  };

  // Send message
  const handleSend = async (textOverride?: string) => {
    const messageText = textOverride || input;
    if (!messageText.trim() || isTyping) return;

    const userMsg: ChatMessage = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          message: messageText,
          employeeId
        }),
      });

      const data = await response.json();

      if (data.reply) {
        setMessages(prev => [...prev, { role: 'model', content: data.reply }]);
      }

      // Cập nhật sessionId nếu là phiên mới
      if (data.sessionId && !activeSessionId) {
        setActiveSessionId(data.sessionId);
        fetchSessions(); // Refresh sidebar
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'model', content: 'Lỗi kết nối mạng. Vui lòng thử lại.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const quickActions = [
    { label: '📊 Hiệu suất', cmd: 'phân tích hiệu suất làm việc của tôi trong năm nay' },
    { label: '🎯 Mục tiêu KPI', cmd: 'mục tiêu KPI của tôi tháng này là bao nhiêu' },
    { label: '💰 Lợi nhuận', cmd: 'lợi nhuận ròng trung bình mỗi đơn của tôi' },
    { label: '⚠️ Vi phạm', cmd: 'tôi có những vi phạm nào gần đây không?' },
    { label: '📧 Soạn email', cmd: 'hãy soạn giúp tôi một email khiếu nại về dữ liệu sai lệch' }
  ];

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Vừa xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
    return d.toLocaleDateString('vi-VN');
  };

  return (
    <div className="animate-fade-in" style={{ height: 'calc(100vh - 40px)', display: 'flex', gap: '0' }}>

      {/* ===== SIDEBAR ===== */}
      <div style={{
        width: sidebarOpen ? '280px' : '0px',
        minWidth: sidebarOpen ? '280px' : '0px',
        backgroundColor: '#0f172a',
        borderRight: sidebarOpen ? '1px solid #1e293b' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      }}>
        {/* Sidebar Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #1e293b' }}>
          <button
            onClick={startNewChat}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              backgroundColor: '#3b82f6', color: 'white', border: 'none',
              padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
              fontSize: '14px', fontWeight: '600',
              transition: 'background 0.2s',
            }}
            onMouseOver={e => (e.currentTarget.style.backgroundColor = '#2563eb')}
            onMouseOut={e => (e.currentTarget.style.backgroundColor = '#3b82f6')}
          >
            <Plus size={18} />
            Cuộc trò chuyện mới
          </button>
        </div>

        {/* Session List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {sessions.length === 0 && (
            <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px 10px' }}>
              Chưa có cuộc trò chuyện nào. Hãy bắt đầu!
            </p>
          )}
          {sessions.map(session => (
            <div
              key={session.id}
              onClick={() => loadSession(session.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                backgroundColor: activeSessionId === session.id ? '#1e293b' : 'transparent',
                border: activeSessionId === session.id ? '1px solid #334155' : '1px solid transparent',
                marginBottom: '4px',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={e => {
                if (activeSessionId !== session.id) e.currentTarget.style.backgroundColor = '#1e293b50';
              }}
              onMouseOut={e => {
                if (activeSessionId !== session.id) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <MessageSquare size={16} color="#64748b" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <p style={{
                  color: activeSessionId === session.id ? '#e2e8f0' : '#94a3b8',
                  fontSize: '13px', margin: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {session.title}
                </p>
                <p style={{ color: '#475569', fontSize: '11px', margin: '2px 0 0 0' }}>
                  {formatTime(session.updated_at)}
                </p>
              </div>
              <button
                onClick={(e) => deleteSession(session.id, e)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '4px', borderRadius: '4px', opacity: 0.4,
                  transition: 'opacity 0.2s',
                }}
                onMouseOver={e => (e.currentTarget.style.opacity = '1')}
                onMouseOut={e => (e.currentTarget.style.opacity = '0.4')}
              >
                <Trash2 size={14} color="#ef4444" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ===== MAIN CHAT AREA ===== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#1e293b', padding: '12px 20px',
          borderBottom: '2px solid #3b82f6',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
            >
              {sidebarOpen ? <PanelLeftClose size={20} color="#94a3b8" /> : <PanelLeft size={20} color="#94a3b8" />}
            </button>
            <div style={{ background: '#3b82f6', padding: '8px', borderRadius: '50%' }}>
              <Sparkles color="white" size={18} />
            </div>
            <div>
              <h1 style={{ color: 'white', fontSize: '15px', fontWeight: 'bold', margin: 0 }}>PowerSight Assistant</h1>
              <p style={{ color: '#94a3b8', fontSize: '11px', margin: 0 }}>Hỗ trợ: {employeeId}</p>
            </div>
          </div>
          <Link href="/" style={{
            backgroundColor: '#334155', color: '#cbd5e1', padding: '6px 14px',
            borderRadius: '6px', fontSize: '13px', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Home size={14} /> Dashboard
          </Link>
        </div>

        {/* Chat Messages */}
        <div ref={scrollRef} style={{
          flex: 1, padding: '20px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '16px',
          backgroundColor: '#0f172a',
        }}>
          {/* Welcome State */}
          {messages.length === 0 && !isTyping && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                padding: '20px', borderRadius: '50%',
              }}>
                <Sparkles color="white" size={36} />
              </div>
              <h2 style={{ color: '#e2e8f0', fontSize: '20px', margin: 0, fontWeight: '600' }}>
                Xin chào, {employeeId}!
              </h2>
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0, textAlign: 'center', maxWidth: '400px' }}>
                Tôi là PowerSight Assistant. Hãy hỏi tôi bất cứ điều gì về hiệu suất, KPI, vi phạm, hoặc soạn email hỗ trợ.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(action.cmd)}
                    style={{
                      backgroundColor: '#1e293b', color: '#cbd5e1',
                      border: '1px solid #334155', padding: '8px 16px',
                      borderRadius: '20px', fontSize: '13px', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.backgroundColor = '#334155'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                    onMouseOut={e => { e.currentTarget.style.backgroundColor = '#1e293b'; e.currentTarget.style.borderColor = '#334155'; }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message Bubbles */}
          {messages.map((msg, idx) => (
            <div key={idx} style={{
              display: 'flex', gap: '12px', alignItems: 'flex-start',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              maxWidth: '80%',
            }}>
              <div style={{
                background: msg.role === 'user' ? '#334155' : '#3b82f6',
                padding: '8px', borderRadius: '50%', flexShrink: 0,
              }}>
                {msg.role === 'user' ? <User size={16} color="white" /> : <Bot size={16} color="white" />}
              </div>
              <div style={{
                background: msg.role === 'user' ? '#2563eb' : '#1e293b',
                color: 'white', padding: '12px 16px', borderRadius: '12px',
                borderBottomLeftRadius: msg.role === 'model' ? '2px' : '12px',
                borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                lineHeight: '1.7', fontSize: '14px',
                overflowWrap: 'break-word', width: '100%',
                border: msg.role === 'model' ? '1px solid #334155' : 'none',
              }} className="markdown-body">
                {msg.role === 'user' ? (
                  <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p style={{ margin: '0 0 8px 0' }}>{children}</p>,
                      ul: ({ children }) => <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ paddingLeft: '20px', margin: '8px 0' }}>{children}</ol>,
                      li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                      strong: ({ children }) => <strong style={{ color: '#60a5fa' }}>{children}</strong>,
                      h3: ({ children }) => <h3 style={{ color: '#93c5fd', margin: '12px 0 6px 0', fontSize: '15px' }}>{children}</h3>,
                      code: ({ children }) => <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', color: '#f472b6' }}>{children}</code>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', alignSelf: 'flex-start' }}>
              <div style={{ background: '#3b82f6', padding: '8px', borderRadius: '50%' }}>
                <Bot size={16} color="white" />
              </div>
              <div style={{
                background: '#1e293b', padding: '12px 18px', borderRadius: '12px',
                border: '1px solid #334155',
                display: 'flex', gap: '6px', alignItems: 'center',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', animation: 'pulse 1.4s infinite' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', animation: 'pulse 1.4s infinite 0.2s' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', animation: 'pulse 1.4s infinite 0.4s' }} />
                <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '8px' }}>Đang phân tích...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions (only visible when there ARE messages) */}
        {messages.length > 0 && (
          <div style={{
            padding: '8px 20px', display: 'flex', gap: '6px',
            overflowX: 'auto', borderTop: '1px solid #1e293b',
            backgroundColor: '#0f172a',
          }}>
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => handleSend(action.cmd)}
                style={{
                  backgroundColor: '#1e293b', color: '#94a3b8',
                  border: '1px solid #334155', padding: '5px 12px',
                  borderRadius: '16px', fontSize: '11px', whiteSpace: 'nowrap', cursor: 'pointer',
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div style={{ padding: '16px 20px', backgroundColor: '#0f172a', borderTop: '1px solid #1e293b' }}>
          <div style={{
            display: 'flex', gap: '10px',
            background: '#1e293b', padding: '8px 16px',
            borderRadius: '12px', border: '1px solid #334155',
            transition: 'border-color 0.2s',
          }}>
            <input
              type="text"
              placeholder="Hỏi về hiệu suất, vi phạm, hoặc soạn email..."
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: 'white', outline: 'none', fontSize: '14px',
              }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={isTyping}
            />
            <button
              onClick={() => handleSend()}
              disabled={isTyping || !input.trim()}
              style={{
                background: input.trim() ? '#3b82f6' : '#334155',
                border: 'none', color: 'white', padding: '8px 12px',
                borderRadius: '8px', cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
