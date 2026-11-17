import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Search, Send, Trash2 } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { useUnsavedGuard } from '@/platform/hooks';
import { uid } from '@/platform/format';
import { Field, PageHeader } from '@/ui/core';
import { useToast } from '@/ui/toast';
import { ForbiddenInline } from '@/pages/NotFound';
import { CLIENTES, MOTIVOS, MOTIVO_EXIGE_JUST, SETORES } from './meta';

export default function NovaSolicitacao() {
  const { data, company, can, update, me, notify, touchRecent } = useDemo();
  const nav = useNavigate();
  const toast = useToast();
  const [v, setV] = useState({ setor: me?.sector ?? '', clienteCodigo: '', clienteNome: '', endereco: '', motivo: '', justificativa: '' });
  const [itens, setItens] = useState([{ descricao: '', ref: '', qtd: 1 }]);
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = (!!v.clienteCodigo || !!v.motivo || !!v.justificativa || itens.some((i) => i.descricao)) && !saving;
  const { guard, release } = useUnsavedGuard(dirty);
  if (!can('reverso', 'abrir')) return <ForbiddenInline />;

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: '' }));
  };
  const consultar = () => {
    const code = v.clienteCodigo.trim().toUpperCase();
    if (!code) { setErrors((x) => ({ ...x, clienteCodigo: 'Informe o código do cliente para consultar.' })); return; }
    setLookup('loading');
    setTimeout(() => {
      const c = CLIENTES.find((x) => x.codigo === code && x.companyId === company);
      if (c) { setV((x) => ({ ...x, clienteCodigo: code, clienteNome: c.nome, endereco: c.endereco })); setLookup('found'); setErrors((x) => ({ ...x, clienteCodigo: '' })); }
      else { setLookup('notfound'); setErrors((x) => ({ ...x, clienteCodigo: `Cliente ${code} não encontrado neste ambiente.` })); }
    }, 600);
  };
  const exigeJust = MOTIVO_EXIGE_JUST.has(v.motivo);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const er: Record<string, string> = {};
    if (!v.setor) er.setor = 'Selecione o setor solicitante.';
    if (!v.clienteCodigo.trim()) er.clienteCodigo = 'Informe o código do cliente.';
    else if (lookup !== 'found') er.clienteCodigo = 'Consulte o cliente para confirmar os dados.';
    if (!v.endereco.trim()) er.endereco = 'Informe o endereço de postagem.';
    if (!v.motivo) er.motivo = 'Selecione o motivo da devolução.';
    if (exigeJust && v.justificativa.trim().length < 15) er.justificativa = `Para “${v.motivo}”, descreva a justificativa (mínimo de 15 caracteres).`;
    if (!itens.some((i) => i.descricao.trim())) er.itens = 'Inclua ao menos um item.';
    setErrors(er);
    if (Object.keys(er).length) { document.getElementById(Object.keys(er)[0])?.focus(); return; }
    setSaving(true);
    setTimeout(() => {
      const id = uid('r');
      const seq = 153 + data.reversos.filter((r) => !/^r\d$/.test(r.id)).length;
      const numero = `REV-2026-0${seq}`;
      const aprovador = me!.managerId ?? 'u2';
      const now = new Date().toISOString();
      update((d) => {
        d.reversos.push({ id, numero, companyId: company, solicitanteId: me!.id, setor: v.setor, clienteCodigo: v.clienteCodigo.trim().toUpperCase(), clienteNome: v.clienteNome, endereco: v.endereco.trim(), motivo: v.motivo, justificativa: v.justificativa.trim() || undefined, itens: itens.filter((i) => i.descricao.trim()), status: 'aguardando_aprovacao', criadoEm: now, aprovadorId: aprovador, docs: [] });
        d.events.push({ id: uid('ev'), ts: now, companyId: company, module: 'reverso', recordId: id, recordLabel: numero, action: 'Solicitação aberta', actorId: me!.id });
      });
      notify({ userId: aprovador, module: 'reverso', title: 'Aprovação aguardando sua decisão', subject: `${numero} · ${v.motivo}`, link: `/reverso/solicitacoes/${id}` });
      touchRecent({ module: 'reverso', recordId: id, label: `${numero} · ${v.clienteNome}`, action: 'Solicitação aberta', link: `/reverso/solicitacoes/${id}` });
      release();
      toast(<>Solicitação <b>{numero}</b> enviada para aprovação.</>);
      nav(`/reverso/solicitacoes/${id}`, { replace: true });
    }, 800);
  };

  return (
    <div className="content narrow" style={{ padding: 0 }}>
      {guard}
      <PageHeader crumbs={[{ label: 'Reverso', to: '/reverso/solicitacoes' }, { label: 'Nova solicitação' }]} title="Abrir solicitação de reverso"
        sub="A solicitação segue para o aprovador do seu setor e, depois, para a expedição." />
      <form className="card" onSubmit={submit} noValidate>
        <div className="form-section">
          <h3>Solicitante e cliente</h3>
          <p className="section-desc">Consulte o cliente pelo código para preencher nome e endereço.</p>
          <div className="form-grid">
            <Field label="Setor" required error={errors.setor} htmlFor="setor">
              <select id="setor" className="select" value={v.setor} onChange={set('setor')} aria-invalid={!!errors.setor}>
                <option value="">Selecione</option>{SETORES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Código do cliente" required error={errors.clienteCodigo} htmlFor="clienteCodigo"
              help={company === 'alinare' ? 'Exemplos: C-20871, C-22010' : company === 'novitah' ? 'Exemplos: N-08812, N-09215' : 'Sem clientes de exemplo neste ambiente'}>
              <div className="row">
                <input id="clienteCodigo" className="input tnum" value={v.clienteCodigo} aria-invalid={!!errors.clienteCodigo}
                  onChange={(e) => { set('clienteCodigo')(e); setLookup('idle'); }} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), consultar())} />
                <button type="button" className="btn btn-secondary" onClick={consultar} disabled={lookup === 'loading'}>
                  {lookup === 'loading' ? <Loader2 size={16} className="spin" /> : <Search size={16} />}Consultar
                </button>
              </div>
            </Field>
            {lookup === 'found' && (
              <div className="full banner banner-ok"><span className="b-text"><b>{v.clienteNome}</b> · dados carregados da base local de demonstração.</span></div>
            )}
            <Field label="Endereço de postagem" required error={errors.endereco} className="full" help="Confirme ou ajuste o endereço de coleta." htmlFor="endereco">
              <textarea id="endereco" className="textarea" style={{ minHeight: 72 }} value={v.endereco} onChange={set('endereco')} aria-invalid={!!errors.endereco} />
            </Field>
          </div>
        </div>
        <div className="form-section">
          <h3>Motivo</h3>
          <p className="section-desc">Mercadoria errada, defeito e outros motivos exigem justificativa.</p>
          <div className="form-grid">
            <Field label="Motivo" required error={errors.motivo} htmlFor="motivo">
              <select id="motivo" className="select" value={v.motivo} onChange={set('motivo')} aria-invalid={!!errors.motivo}>
                <option value="">Selecione</option>{MOTIVOS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <div />
            <Field label="Justificativa" required={exigeJust} error={errors.justificativa} className="full" htmlFor="justificativa"
              help={exigeJust ? 'Descreva o ocorrido e, se possível, o número do pedido ou da nota fiscal.' : 'Opcional para este motivo.'}>
              <textarea id="justificativa" className="textarea" value={v.justificativa} onChange={set('justificativa')} aria-invalid={!!errors.justificativa} />
            </Field>
          </div>
        </div>
        <div className="form-section">
          <h3>Itens</h3>
          <p className="section-desc">Mercadorias que retornarão.</p>
          <div className="stack-sm" id="itens" tabIndex={-1}>
            {itens.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,3fr) minmax(0,1.4fr) 80px 40px', gap: 8, alignItems: 'end' }}>
                <Field label={i === 0 ? 'Descrição' : ''}><input className="input" aria-label="Descrição do item" value={it.descricao} onChange={(e) => setItens((l) => l.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x))} /></Field>
                <Field label={i === 0 ? 'Referência' : ''}><input className="input" aria-label="Referência" value={it.ref} onChange={(e) => setItens((l) => l.map((x, j) => j === i ? { ...x, ref: e.target.value } : x))} /></Field>
                <Field label={i === 0 ? 'Qtd.' : ''}><input className="input tnum" type="number" min={1} aria-label="Quantidade" value={it.qtd} onChange={(e) => setItens((l) => l.map((x, j) => j === i ? { ...x, qtd: Number(e.target.value) } : x))} /></Field>
                <button type="button" className="icon-btn" aria-label="Remover item" disabled={itens.length === 1} onClick={() => setItens((l) => l.filter((_, j) => j !== i))}><Trash2 size={17} /></button>
              </div>
            ))}
            {errors.itens && <span className="error-msg" role="alert">{errors.itens}</span>}
            <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setItens((l) => [...l, { descricao: '', ref: '', qtd: 1 }])}><Plus size={15} />Adicionar item</button></div>
          </div>
        </div>
        <div className="form-actions sticky">
          <button type="button" className="btn btn-secondary" onClick={() => nav(-1)}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><Loader2 size={17} className="spin" />Enviando…</> : <><Send size={16} />Enviar para aprovação</>}</button>
        </div>
      </form>
    </div>
  );
}
