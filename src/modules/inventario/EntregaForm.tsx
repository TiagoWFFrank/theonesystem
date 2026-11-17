import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, FileText, Loader2, PackageCheck, Search, UserCheck } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { flash, goBackOr, useUnsavedGuard } from '@/platform/hooks';
import { fmtDate, uid } from '@/platform/format';
import { Avatar, Badge, Field, PageHeader } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { useToast } from '@/ui/toast';
import { NotFoundInline, ForbiddenInline } from '@/pages/NotFound';
import { EQ_STATUS, TYPE_ICON } from './meta';
import type { BrandId } from '@/platform/types';

const today = () => new Date().toISOString().slice(0, 10);

export default function EntregaForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, company, can, update, userName, notify, touchRecent, me } = useDemo();
  const e = data.equipments.find((x) => x.id === id && x.companyId === company);

  const [colab, setColab] = useState('');
  const [q, setQ] = useState('');
  const [emp, setEmp] = useState<BrandId | ''>(company);
  const [date, setDate] = useState(today());
  const [local, setLocal] = useState('');
  const [obs, setObs] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<'edit' | 'saving' | 'done'>('edit');
  const dirty = !!(colab || local || obs) && phase === 'edit';
  const { guard, release } = useUnsavedGuard(dirty);

  const candidates = useMemo(() => data.users.filter((u) => u.status === 'ativo'
    && (!emp || u.companies.includes(emp))
    && (!q || u.name.toLowerCase().includes(q.toLowerCase()))), [data.users, emp, q]);

  if (!e) return <NotFoundInline what="equipamento" back="/inventario/equipamentos" />;
  if (!can('inventario', 'registrar_entrega')) return <ForbiddenInline />;
  if (e.status !== 'disponivel' && phase === 'edit') return <NotFoundInline what="entrega disponível para este equipamento" back={`/inventario/equipamentos/${e.id}`} />;

  const Ic = TYPE_ICON[e.tipo];
  const sel = data.users.find((u) => u.id === colab);
  const validate = () => {
    const er: Record<string, string> = {};
    if (!colab) er.colab = 'Selecione o colaborador que receberá o equipamento.';
    if (!date) er.date = 'Informe a data da entrega.';
    else if (date > today()) er.date = 'A data da entrega não pode ser futura.';
    if (!local.trim()) er.local = 'Informe onde o equipamento ficará.';
    setErrors(er);
    if (Object.keys(er).length) document.getElementById(er.colab ? 'busca-colab' : er.date ? 'dt' : 'local')?.focus();
    return Object.keys(er).length === 0;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (phase !== 'edit' || !validate()) return;
    setPhase('saving');
    setTimeout(() => {
      const evId = uid('ev');
      const attId = uid('a');
      const name = userName(colab);
      update((d) => {
        const eq = d.equipments.find((x) => x.id === e.id)!;
        eq.status = 'em_uso';
        eq.responsavelId = colab;
        eq.localizacao = local.trim();
        eq.ultimaMov = new Date(date + 'T12:00:00').toISOString();
        eq.aceitePendente = true;
        d.attachments.push({ id: attId, nome: `Termo de responsabilidade — ${e.patrimonio}.pdf`, tipo: 'PDF', tamanho: '186 KB', em: new Date().toISOString(), kind: 'termo', ref: e.id });
        eq.docs.unshift(attId);
        d.events.push({ id: evId, ts: new Date().toISOString(), companyId: company, module: 'inventario', recordId: e.id, recordLabel: e.patrimonio, action: `Entrega registrada para ${name}${obs ? ` — ${obs.trim()}` : ''}`, actorId: me!.id });
      });
      notify({ userId: colab, module: 'inventario', title: 'Confira a entrega do equipamento', subject: `${e.patrimonio} · ${e.descricao}`, link: `/inventario/equipamentos/${e.id}` });
      touchRecent({ module: 'inventario', recordId: e.id, label: `${e.patrimonio} · ${e.descricao}`, action: 'Entrega registrada', link: `/inventario/equipamentos/${e.id}` });
      release();
      setPhase('done');
      flash.set(e.id, { tab: 'mov', highlight: evId });
      flash.set('list:inventario', { highlight: e.id });
      setTimeout(() => {
        toast(<>Entrega de <b>{e.patrimonio}</b> registrada para {name}. Termo gerado e colaborador notificado.</>, { action: { label: 'Ver na lista', run: () => nav('/inventario/equipamentos') } });
        goBackOr(nav, `/inventario/equipamentos/${e.id}`);
      }, 1100);
    }, 800);
  };

  const steps = [!!e, !!colab, !!(date && local.trim())];
  return (
    <>
      {guard}
      <PageHeader
        crumbs={[{ label: 'Inventário', to: '/inventario/equipamentos' }, { label: e.patrimonio, to: `/inventario/equipamentos/${e.id}` }, { label: 'Registrar entrega' }]}
        title="Registrar entrega"
        sub="Vincule o equipamento a um colaborador. O termo de responsabilidade é gerado e o colaborador confirma o recebimento."
      />
      <form className="layout-form" onSubmit={submit} noValidate>
        <div className="card">
          <div className="form-section">
            <h3><span className={`step-num ${steps[0] ? 'done' : ''}`}>{steps[0] ? <Check size={13} /> : 1}</span>Equipamento</h3>
            <p className="section-desc">Item que será entregue.</p>
            <div className="att" style={{ background: 'var(--surface-2)' }}>
              <span className="asset-ic" style={{ width: 44, height: 44 }}><Ic size={20} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="strong">{e.patrimonio} · {e.descricao}</div>
                <div className="xs muted">Série <span className="mono">{e.serie}</span> · {e.localizacao}</div>
              </div>
              <Badge tone={EQ_STATUS.disponivel.tone}>{EQ_STATUS.disponivel.label}</Badge>
            </div>
          </div>

          <div className="form-section">
            <h3><span className={`step-num ${steps[1] ? 'done' : ''}`}>{steps[1] ? <Check size={13} /> : 2}</span>Colaborador</h3>
            <p className="section-desc">Busque por nome e filtre pelo ambiente de vínculo.</p>
            <div className="form-grid" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}>
              <div className="input-icon"><Search size={17} /><input id="busca-colab" className="input" placeholder="Nome do colaborador" aria-label="Buscar colaborador" value={q} onChange={(x) => setQ(x.target.value)} /></div>
              <select id="emp" className="select" aria-label="Ambiente" value={emp} onChange={(x) => setEmp(x.target.value as BrandId | '')}>
                <option value="">Todos os ambientes</option>
                {(Object.keys(COMPANIES) as BrandId[]).map((c) => <option key={c} value={c}>{COMPANIES[c].name}</option>)}
              </select>
              <div className="full">
                <div role="radiogroup" aria-label="Colaborador" aria-invalid={!!errors.colab}
                  style={{ border: `1px solid ${errors.colab ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 14, maxHeight: 264, overflowY: 'auto', padding: 4, background: 'var(--surface-solid)' }}>
                  {candidates.length === 0 && <p className="muted small" style={{ padding: 16 }}>Nenhum colaborador encontrado com esses critérios.</p>}
                  {candidates.map((u) => (
                    <label key={u.id} className="menu-item" aria-checked={colab === u.id} style={{ cursor: 'pointer' }}>
                      <input type="radio" name="colab" className="sr-only" value={u.id} checked={colab === u.id} onChange={() => { setColab(u.id); setErrors((x) => ({ ...x, colab: '' })); }} />
                      <Avatar name={u.name} />
                      <span style={{ flex: 1 }}><span className="strong">{u.name}</span><br /><span className="xs muted">{u.sector} · {u.companies.map((c) => COMPANIES[c].name).join(', ')}</span></span>
                      <span style={{ width: 22, height: 22, borderRadius: 11, display: 'grid', placeItems: 'center', border: `1.5px solid ${colab === u.id ? 'var(--primary)' : 'var(--border-strong)'}`, background: colab === u.id ? 'var(--primary)' : 'transparent', color: 'var(--on-primary)', transition: 'all var(--dur)' }}>{colab === u.id && <Check size={13} />}</span>
                    </label>
                  ))}
                </div>
                {errors.colab && <span className="error-msg" role="alert" style={{ marginTop: 6 }}>{errors.colab}</span>}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3><span className={`step-num ${steps[2] ? 'done' : ''}`}>{steps[2] ? <Check size={13} /> : 3}</span>Entrega</h3>
            <p className="section-desc">Data e local onde o equipamento ficará com o colaborador.</p>
            <div className="form-grid">
              <Field label="Data da entrega" required error={errors.date} htmlFor="dt">
                <input id="dt" type="date" className="input" value={date} max={today()} aria-invalid={!!errors.date} onChange={(x) => setDate(x.target.value)} />
              </Field>
              <Field label="Local" required error={errors.local} help="Ex.: Comercial · 3º andar" htmlFor="local">
                <input id="local" className="input" value={local} aria-invalid={!!errors.local} onChange={(x) => { setLocal(x.target.value); setErrors((er) => ({ ...er, local: '' })); }} />
              </Field>
              <Field label="Observações" className="full" htmlFor="obs" help="Acessórios entregues, estado de conservação etc.">
                <textarea id="obs" className="textarea" value={obs} onChange={(x) => setObs(x.target.value)} />
              </Field>
            </div>
          </div>
          <div className="form-actions sticky only-mobile-flex">
            <button type="button" className="btn btn-secondary" onClick={() => nav(-1)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={phase !== 'edit'}>{phase === 'saving' ? <><Loader2 size={17} className="spin" />Registrando…</> : <><PackageCheck size={17} />Registrar entrega</>}</button>
          </div>
        </div>

        {/* Resumo da operação */}
        <aside className="summary card" aria-live="polite">
          {phase === 'done' ? (
            <div className="state" style={{ padding: '40px 24px' }}>
              <span className="success-mark"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
              <h3>Entrega registrada</h3>
              <p>{e.patrimonio} agora está com {sel?.name}. Atualizando ficha, lista e histórico…</p>
            </div>
          ) : (
            <>
              <div className="card-head"><h3>Resumo da operação</h3></div>
              <div className="card-body stack" style={{ gap: 14 }}>
                <div className="row" style={{ gap: 12 }}><span className="asset-ic"><Ic size={17} /></span><div style={{ minWidth: 0 }}><div className="strong tnum">{e.patrimonio}</div><div className="xs muted">{e.descricao}</div></div></div>
                <div className="row" style={{ gap: 12 }}>
                  {sel ? <Avatar name={sel.name} /> : <span className="avatar" style={{ background: 'var(--surface-sunken)', color: 'var(--text-subtle)' }}>?</span>}
                  <div><div className="xs muted">Novo responsável</div><div className="strong">{sel?.name ?? <span className="subtle">Selecione um colaborador</span>}</div></div>
                </div>
                <dl className="kv" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ gridColumn: '1 / -1' }}><dt>Situação</dt><dd className="row" style={{ gap: 6 }}><Badge tone="ok">Disponível</Badge><span className="muted">→</span><Badge tone="info">Em uso</Badge></dd></div>
                  <div><dt>Data</dt><dd className="tnum">{date ? fmtDate(date + 'T12:00:00') : '—'}</dd></div>
                  <div><dt>Local</dt><dd>{local || <span className="subtle">—</span>}</dd></div>
                </dl>
                <div className="stack-sm" style={{ paddingTop: 12, borderTop: '1px dashed var(--border-strong)' }}>
                  <div className="xs muted strong" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>Ao confirmar</div>
                  <div className="row small"><FileText size={15} className="muted" />Termo de responsabilidade gerado (PDF)</div>
                  <div className="row small"><UserCheck size={15} className="muted" />{sel ? sel.name.split(' ')[0] : 'Colaborador'} recebe a tarefa “Conferir entrega”</div>
                  <div className="row small"><Check size={15} className="muted" />Ficha, lista e histórico atualizados</div>
                </div>
              </div>
              <div className="form-actions hide-mobile">
                <button type="button" className="btn btn-secondary" onClick={() => nav(-1)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={phase !== 'edit'} aria-busy={phase === 'saving'}>
                  {phase === 'saving' ? <><Loader2 size={17} className="spin" />Registrando…</> : <><PackageCheck size={17} />Registrar entrega</>}
                </button>
              </div>
            </>
          )}
        </aside>
      </form>
    </>
  );
}
