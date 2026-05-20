import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export default function Autocomplete({ type, value, onChange, placeholder }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!value || value.length < 1) { setItems([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.autocomplete(type, value);
        setItems(res.suggestions || []);
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [value, type]);

  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="autocomplete" ref={wrapRef}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        style={{ width: '100%' }}
      />
      {open && items.length > 0 && (
        <div className="autocomplete-list">
          {items.map((s) => (
            <div key={s} onClick={() => { onChange(s); setOpen(false); }}>{s}</div>
          ))}
        </div>
      )}
    </div>
  );
}
