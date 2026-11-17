// Disponibilidade das fontes NA ÁREA AFETADA (o restante da tela continua utilizável).
// O aviso descreve exatamente o que a plataforma faz: conteúdo em cache com horário, tentativas automáticas
// agendadas (com contagem, pausa e retomada), nova tentativa manual e retorno visual na reconexão.
import { useEffect, useState } from 'react';
import { CheckCircle2, CloudOff, Loader2, Pause, Play, RotateCw } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { fmtTime, fmtRelative } from '@/platform/format';
import { healthLabel } from '@/platform/registry';
import { integrationStatus, type IntegrationId } from '@/platform/integrations';
import type { HealthId } from '@/platform/types';
import { Badge } from './core';

/** Relógio de 1 s, ativo apenas quando necessário. */
export function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

const RESTORED_VISIBLE = 8000;

export function SourceNotice(props: { id: HealthId; cachedNote?: string; label?: string; boxed?: boolean }) {
  const n = <SourceNoticeInner {...props} />;
  return props.boxed ? <BoxedNotice id={props.id}>{n}</BoxedNotice> : n;
}
function BoxedNotice({ id, children }: { id: HealthId; children: React.ReactNode }) {
  const { health } = useDemo();
  const h = health[id];
  if (!h || (h.status === 'ok' && (!h.restoredAt || Date.now() - h.restoredAt >= RESTORED_VISIBLE))) return <>{children}</>;
  return <div className="card" style={{ overflow: 'hidden', marginTop: 12 }}>{children}</div>;
}
function SourceNoticeInner({ id, cachedNote, label }: { id: HealthId; cachedNote?: string; label?: string }) {
  const { health, data, checkNow, setAutoRetry } = useDemo();
  const h = health[id];
  const recent = !!h?.restoredAt && Date.now() - h.restoredAt < RESTORED_VISIBLE;
  const now = useNow(!!h && (h.status !== 'ok' || recent));
  const name = label ?? healthLabel(id);
  if (!h) return null;
  if (h.status === 'ok') {
    if (!h.restoredAt || now - h.restoredAt >= RESTORED_VISIBLE) return null;
    return (
      <div className="source-note ok" role="status" data-source={id}>
        <CheckCircle2 size={17} style={{ color: 'var(--ok)', flexShrink: 0 }} />
        <span className="b-text"><b>{name} voltou a responder.</b> Conexão restabelecida às {fmtTime(new Date(h.restoredAt).toISOString())}; conteúdo atualizado.</span>
      </div>
    );
  }
  const at = data.sync[id];
  const secs = h.nextAt ? Math.max(0, Math.ceil((h.nextAt - now) / 1000)) : null;
  const checking = h.status === 'checking';
  return (
    <div className="source-note" role="status" data-source={id}>
      <CloudOff size={17} style={{ color: 'var(--warn)', flexShrink: 0 }} />
      <span className="b-text">
        <b>{name} está indisponível.</b>{' '}
        {at ? `Conteúdo em cache de ${fmtTime(at)} (${fmtRelative(at)}).` : 'Sem conteúdo em cache.'} {cachedNote ?? 'Exibindo o que foi carregado anteriormente.'}
        <span className="retry-line" aria-live="polite">
          {checking ? <><Loader2 size={13} className="spin" />Verificando a conexão…</>
            : h.auto && secs !== null ? <>Nova tentativa automática em <b className="tnum">{secs} s</b>{h.attempts > 0 ? ` · ${h.attempts} ${h.attempts === 1 ? 'tentativa sem resposta' : 'tentativas sem resposta'}` : ''}.</>
            : <>Tentativas automáticas pausadas{h.attempts > 0 ? ` · ${h.attempts} sem resposta` : ''}.</>}
        </span>
      </span>
      <span className="row-wrap" style={{ gap: 6, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-xs" disabled={checking} onClick={() => checkNow(id)}>{checking ? <Loader2 size={13} className="spin" /> : <RotateCw size={13} />}Tentar agora</button>
        {!checking && (h.auto
          ? <button className="btn btn-ghost btn-xs" onClick={() => setAutoRetry(id, false)}><Pause size={13} />Pausar automáticas</button>
          : <button className="btn btn-ghost btn-xs" onClick={() => setAutoRetry(id, true)}><Play size={13} />Retomar automáticas</button>)}
      </span>
    </div>
  );
}

export function SyncStamp({ id }: { id: HealthId }) {
  const { data, down } = useDemo();
  const at = data.sync[id];
  if (!at || down(id)) return null;
  return <span className="stale" title={`Sincronizado às ${fmtTime(at)}`}>Atualizado {fmtRelative(at)}</span>;
}

/** Identificação da integração com o adaptador EFETIVAMENTE em uso. */
export function IntegrationTag({ id, compact }: { id?: string; compact?: boolean }) {
  const { validations } = useDemo();
  if (!id) return null;
  const st = integrationStatus(id, validations[id as IntegrationId]);
  if (compact) return <span className="xs muted integ-tag" data-integration={id} data-state={st.state} title={st.detail}>{st.state === 'simulado' ? 'Adaptador simulado · dados demonstrativos' : `${st.label} · adaptador ${st.adapter}`}</span>;
  return <span className="row" style={{ gap: 6 }} data-integration={id} data-state={st.state} title={st.detail}><Badge tone={st.tone} plain>{st.label}</Badge><span className="xs muted">adaptador {st.adapter}</span></span>;
}
