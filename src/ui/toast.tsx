import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';

interface Toast { id: number; text: ReactNode; tone: 'ok' | 'info'; action?: { label: string; run: () => void } }
const ToastCtx = createContext<(text: ReactNode, opts?: { tone?: 'ok' | 'info'; action?: Toast['action'] }) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const dismiss = (id: number) => setItems((l) => l.filter((t) => t.id !== id));
  const push = useCallback((text: ReactNode, opts?: { tone?: 'ok' | 'info'; action?: Toast['action'] }) => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l.slice(-2), { id, text, tone: opts?.tone ?? 'ok', action: opts?.action }]);
    setTimeout(() => dismiss(id), 5200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast glass-strong">
            <span className={`t-ic ${t.tone === 'info' ? 'info' : ''}`}>{t.tone === 'ok' ? <CheckCircle2 size={17} /> : <Info size={17} />}</span>
            <span>{t.text}</span>
            {t.action && <button className="link" onClick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>}
            <button className="link" aria-label="Fechar aviso" onClick={() => dismiss(t.id)} style={{ textDecoration: 'none', opacity: .7 }}><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
