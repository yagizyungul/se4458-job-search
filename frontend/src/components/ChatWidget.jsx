import { useState } from 'react';
import { api } from '../api.js';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Merhaba! Hangi pozisyonu ve şehri aramak istersin?' },
  ]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    const userMsg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setText('');
    setLoading(true);
    try {
      const apiMessages = next.map((m) => ({ role: m.role, content: m.content }));
      const res = await api.chat(apiMessages);
      setMessages([...next, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: `Hata: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="chat-fab" onClick={() => setOpen((o) => !o)} title="AI Asistan">
        {open ? '×' : '?'}
      </div>
      {open && (
        <div className="chat-window">
          <div className="chat-header">AI Asistan</div>
          <div className="chat-body">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>
            ))}
            {loading && <div className="chat-msg assistant">Yazıyor...</div>}
          </div>
          <div className="chat-input">
            <input
              value={text}
              placeholder="Bir şey sorun..."
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button onClick={send} disabled={loading}>Gönder</button>
          </div>
        </div>
      )}
    </>
  );
}
