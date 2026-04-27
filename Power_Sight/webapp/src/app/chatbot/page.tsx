'use client';

import { useState } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';

export default function Chatbot() {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Xin chào! Tôi là Trợ lý AI Phân tích Hiệu suất. Bạn muốn tìm hiểu biểu đồ hiệu suất của mình hay cần đề xuất lộ trình phát triển?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const apiMessages = [...messages, userMsg]
        .filter((m, i) => !(i === 0 && m.sender === 'bot')) // Bỏ câu chào đầu tiên để history hợp lệ
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }]
        }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: apiMessages
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error:", errorText);
        setMessages(prev => [...prev, { sender: 'bot', text: 'Xin lỗi, có lỗi xảy ra từ máy chủ AI.' }]);
        return;
      }
      
      const data = await response.json();
      
      if (data.reply) {
        setMessages(prev => [...prev, { sender: 'bot', text: data.reply }]);
      }

    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">AI Chatbot</h1>
          <p className="page-subtitle">Trợ lý ảo hỗ trợ nâng cao hiệu suất cá nhân</p>
        </div>
      </div>

      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: 'var(--accent-glow)', padding: '10px', borderRadius: '50%' }}>
            <Sparkles color="var(--accent-primary)" size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-main)' }}>NexGen Assistant</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Trực tuyến</span>
          </div>
        </div>

        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              gap: '12px', 
              alignItems: 'flex-end',
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
              maxWidth: '80%'
            }}>
              <div style={{ 
                background: msg.sender === 'user' ? 'rgba(255,255,255,0.1)' : 'var(--accent-glow)', 
                padding: '8px', borderRadius: '50%', flexShrink: 0 
              }}>
                 {msg.sender === 'user' ? <User size={16} color="var(--text-main)" /> : <Bot size={16} color="var(--accent-primary)" />}
              </div>
              <div style={{ 
                background: msg.sender === 'user' ? 'linear-gradient(135deg, var(--accent-primary), #2563eb)' : 'rgba(30, 41, 59, 0.8)',
                color: 'var(--text-main)',
                padding: '12px 16px', borderRadius: '16px',
                borderBottomLeftRadius: msg.sender === 'bot' ? '4px' : '16px',
                borderBottomRightRadius: msg.sender === 'user' ? '4px' : '16px',
                lineHeight: '1.5'
              }}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', alignSelf: 'flex-start' }}>
               <div style={{ background: 'var(--accent-glow)', padding: '8px', borderRadius: '50%', flexShrink: 0 }}>
                 <Bot size={16} color="var(--accent-primary)" />
               </div>
               <div style={{ background: 'rgba(30, 41, 59, 0.8)', padding: '12px 16px', borderRadius: '16px', borderBottomLeftRadius: '4px', display: 'flex', gap: '4px' }}>
                 <span style={{ animation: 'fadeIn 1s infinite' }}>.</span>
                 <span style={{ animation: 'fadeIn 1s infinite 0.2s' }}>.</span>
                 <span style={{ animation: 'fadeIn 1s infinite 0.4s' }}>.</span>
               </div>
            </div>
          )}
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <input 
              type="text" 
              placeholder="Hỏi AI về biểu đồ hoặc đề xuất..." 
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '1rem', padding: '0 10px' }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button className="btn-primary" style={{ padding: '10px', borderRadius: '8px' }} onClick={handleSend}>
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
