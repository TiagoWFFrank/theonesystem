import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ChevronRight, Inbox, RotateCw, SearchX, X } from 'lucide-react';
import { initials } from '@/platform/format';
import { useDemo } from '@/platform/store';
import { navDepth } from '@/platform/hooks';

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'accent';

export function Badge({ tone, children, plain }: { tone: Tone; children: ReactNode; plain?: boolean }) {
  return <span className={`badge badge-${tone}${plain ? ' plain' : ''}`}>{children}</span>;
}

export function PageHeader({ crumbs, title, sub, actions, eyebrow }: {
  crumbs?: { label: string; to?: string }[]; title: ReactNode; sub?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode;
}) {
  return (
    <>
      {crumbs && crumbs.length > 0 && (
        <nav className="crumbs" aria-label="Você está em">
          {crumbs.map((c, i) => (
            <span key={i} className="row" style={{ gap: 6 }}>
              {i > 0 && <ChevronRight size={14} aria-hidden />}
              {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          {eyebrow}
          <h1 className="page-title">{title}</h1>
          {sub && <p className="page-sub">{sub}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </>
  );
}

export function Avatar({ name, lg, sm }: { name: string; lg?: boolean; sm?: boolean }) {
  return <span className={`avatar${lg ? ' lg' : ''}${sm ? ' sm' : ''}`} aria-hidden>{initials(name)}</span>;
}

export function Field({ label, required, help, error, children, className, htmlFor }: {
  label: string; required?: boolean; help?: ReactNode; error?: string; children: ReactNode; className?: string; htmlFor?: string;
}) {
  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={htmlFor}>{label}{required && <span className="req" aria-hidden>*</span>}{required && <span className="sr-only"> (obrigatório)</span>}</label>
      {children}
      {error ? <span className="error-msg" role="alert"><AlertCircle size={14} />{error}</span> : help ? <span className="help">{help}</span> : null}
    </div>
  );
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {items.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>
      ))}
    </dl>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" className="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>
          {t.label}{t.count != null && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------- Overlays ----------
function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => { window.removeEventListener('keydown', h); prev?.focus?.(); };
  }, [open, onClose]);
}

export function Dialog({ open, onClose, title, desc, children, footer, size, icon }: {
  open: boolean; onClose: () => void; title: string; desc?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: 'wide' | 'xwide'; icon?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useEffect(() => {
    if (open) setTimeout(() => ref.current?.querySelector<HTMLElement>('input, select, textarea, button.btn-primary, button')?.focus(), 30);
  }, [open]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog glass-strong ${size ?? ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="dialog-head">
          {icon}
          <div style={{ flex: 1 }}>
            <h2>{title}</h2>
            {desc && <p className="muted small" style={{ marginTop: 4 }}>{desc}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        {children && <div className="dialog-body">{children}</div>}
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, side, footer, wide, label }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; side?: 'left'; footer?: ReactNode; wide?: boolean; label?: string }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className={`drawer glass-strong ${side ?? ''} ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
        <div className="drawer-head">
          <div style={{ flex: 1, fontWeight: 600 }}>{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar painel"><X size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>
  );
}

export function Confirm({ open, title, desc, confirmLabel, danger, onConfirm, onClose, children }: {
  open: boolean; title: string; desc?: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void | Promise<void>; onClose: () => void; children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try { await onConfirm(); onClose(); }
    catch { /* the caller reports the failure in its own context */ }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} title={title} desc={desc}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className={`btn ${danger ? 'btn btn-danger' : 'btn btn-primary'}`} onClick={() => void confirm()} disabled={busy}>{busy ? 'Aplicando…' : confirmLabel}</button>
      </>}>
      {children}
    </Dialog>
  );
}

// ---------- Estados ----------
export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="state">
      <div className="state-icon">{icon ?? <Inbox size={24} />}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}
export function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState icon={<SearchX size={24} />} title="Nenhum resultado com esses filtros"
      text="Revise os termos da busca ou remova filtros para ampliar a pesquisa."
      action={<button className="btn btn-secondary btn-sm" onClick={onClear}>Limpar filtros</button>} />
  );
}
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="state">
      <div className="state-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><AlertCircle size={24} /></div>
      <h3>Não foi possível carregar os registros</h3>
      <p>A conexão com o serviço deste módulo falhou. Os demais módulos continuam disponíveis.</p>
      <button className="btn btn-secondary btn-sm" onClick={onRetry}><RotateCw size={15} />Tentar novamente</button>
    </div>
  );
}
export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ padding: 16 }} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          {Array.from({ length: cols }).map((__, j) => <div key={j} className="skel" style={{ height: 14, width: `${60 + ((i + j) % 4) * 10}%` }} />)}
        </div>
      ))}
    </div>
  );
}

/** Simula carregamento e permite que o painel do apresentador force estados (carregando/erro/vazio). */
export function useSimLoad(delay = 420) {
  const { session } = useDemo();
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading');
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    setPhase('loading');
    const t = setTimeout(() => setPhase('ready'), delay);
    return () => clearTimeout(t);
  }, [delay, nonce]);
  const sim = session.sim;
  const state: 'loading' | 'error' | 'empty' | 'ready' =
    sim === 'carregando' || phase === 'loading' ? 'loading' : sim === 'erro' ? 'error' : sim === 'vazio' ? 'empty' : 'ready';
  return { state, retry: () => setNonce((n) => n + 1) };
}

export function Pager({ page, pages, total, onPage, label }: { page: number; pages: number; total: number; onPage: (p: number) => void; label: string }) {
  return (
    <div className="pager">
      <span className="tnum">{total} {label}</span>
      <span className="spacer" />
      <span className="tnum">Página {page} de {Math.max(pages, 1)}</span>
      <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
      <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Próxima</button>
    </div>
  );
}

/** Volta para a lista preservando filtros (histórico do navegador) */
export function BackToList({ label = 'Voltar', fallback }: { label?: string; fallback?: string }) {
  const nav = useNavigate();
  const canGoBack = navDepth.current > 0;
  return (
    <button className="btn btn-secondary" onClick={() => (canGoBack || !fallback ? nav(-1) : nav(fallback))}>
      <ArrowLeft size={17} />{label}
    </button>
  );
}
