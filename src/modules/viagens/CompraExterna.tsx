import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, FileUp, Loader2, ScanText, Sparkles } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { flash, useUnsavedGuard } from '@/platform/hooks';
import { fmtDateShort, fmtMoney, uid } from '@/platform/format';
import { Field, PageHeader } from '@/ui/core';
import { useToast } from '@/ui/toast';
import { ForbiddenInline } from '@/pages/NotFound';
import type { Viagem } from '@/platform/types';

const toLocal = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

type Fields = { cia: string; vooIda: string; dataIda: string; vooVolta: string; dataVolta: string; origem: string; destino: string; localizador: string; valor: string };
const EMPTY: Fields = { cia: '', vooIda: '', dataIda: '', vooVolta: '', dataVolta: '', origem: '', destino: '', localizador: '', valor: '' };

export default function CompraExterna() {
  const { data, company, can, update, me, notify, touchRecent, userName } = useDemo();
  const nav = useNavigate();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [viajante, setViajante] = useState('');
  const [vinculo, setVinculo] = useState('');
  const [arquivo, setArquivo] = useState('');
  const [reading, setReading] = useState<'idle' | 'reading' | 'done'>('idle');
  const [f, setF] = useState<Fields>(EMPTY);
  const [filled, setFilled] = useState<Set<keyof Fields>>(new Set());
  const [motivo, setMotivo] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = (!!viajante || !!arquivo || !!motivo) && !saving;
  const { guard, release } = useUnsavedGuard(dirty);

  const travelers = useMemo(() => data.users.filter((u) => u.status === 'ativo' && u.companies.includes(company)), [data.users, company]);
  const pending = data.viagens.filter((v) => v.companyId === company && v.viajanteId === viajante && v.status === 'aguardando_emissao');
  if (!can('viagens', 'registrar_compra')) return <ForbiddenInline />;

  const pickTraveler = (id: string) => {
    setViajante(id);
    const p = data.viagens.find((v) => v.companyId === company && v.viajanteId === id && v.status === 'aguardando_emissao');
    setVinculo(p ? p.id : 'nova');
    setErrors((e) => ({ ...e, viajante: '' }));
  };

  /** Simulação de leitura do documento: preenche campos preparados para o cenário. */
  const ler = (nome: string) => {
    setArquivo(nome);
    setReading('reading');
    setErrors((e) => ({ ...e, arquivo: '' }));
    setTimeout(() => {
      const link = data.viagens.find((v) => v.id === vinculo);
      const ida = link ? new Date(link.inicio) : new Date(Date.now() + 20 * 86400000);
      const volta = link ? new Date(link.fim) : new Date(Date.now() + 22 * 86400000);
      ida.setHours(6, 35, 0, 0); volta.setHours(20, 10, 0, 0);
      const destino = link?.trechos[0]?.destino ?? 'REC';
      const next: Fields = { cia: 'LATAM', vooIda: 'LA 3312', dataIda: toLocal(ida.toISOString()), vooVolta: 'LA 3327', dataVolta: toLocal(volta.toISOString()), origem: 'GRU', destino, localizador: 'QX7T2M', valor: '1874.90' };
      setF(next);
      setFilled(new Set(Object.keys(next) as (keyof Fields)[]));
      setReading('done');
    }, 1600);
  };
  const setField = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    setFilled((s) => { const n = new Set(s); n.delete(k); return n; });
    setErrors((x) => ({ ...x, [k]: '' }));
  };
  const hint = (k: keyof Fields) => (filled.has(k) ? <span className="row xs" style={{ gap: 4, color: 'var(--info)' }}><Sparkles size={12} />Lido do documento · confira</span> : undefined);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const er: Record<string, string> = {};
    if (!viajante) er.viajante = 'Selecione o viajante.';
    if (!arquivo) er.arquivo = 'Anexe a passagem comprada.';
    if (reading === 'done') {
      if (!f.cia.trim()) er.cia = 'Informe a companhia.';
      if (!/^[A-Z0-9]{6}$/.test(f.localizador.trim().toUpperCase())) er.localizador = 'O localizador tem 6 caracteres.';
      if (!f.dataIda) er.dataIda = 'Informe a data da ida.';
      if (f.dataVolta && f.dataIda && f.dataVolta < f.dataIda) er.dataVolta = 'A volta deve ser depois da ida.';
      if (!(Number(f.valor) > 0)) er.valor = 'Informe o valor pago.';
    }
    if (motivo.trim().length < 10) er.motivo = 'Explique por que a compra foi feita por exceção (mínimo de 10 caracteres).';
    setErrors(er);
    if (Object.keys(er).length) { document.getElementById(Object.keys(er)[0])?.focus(); return; }
    setSaving(true);
    setTimeout(() => {
      const now = new Date().toISOString();
      const isNew = vinculo === 'nova' || !vinculo;
      const vid = isNew ? uid('v') : vinculo;
      const evId = uid('ev');
      const attId = uid('a');
      const loc = f.localizador.trim().toUpperCase();
      const half = Math.round((Number(f.valor) / 2) * 100) / 100;
      const trechos: Viagem['trechos'] = [
        { tipo: 'ida', cia: f.cia, voo: f.vooIda, origem: f.origem.toUpperCase(), destino: f.destino.toUpperCase(), data: new Date(f.dataIda).toISOString(), localizador: loc, valor: half },
        ...(f.dataVolta ? [{ tipo: 'volta' as const, cia: f.cia, voo: f.vooVolta, origem: f.destino.toUpperCase(), destino: f.origem.toUpperCase(), data: new Date(f.dataVolta).toISOString(), localizador: loc, valor: Number(f.valor) - half }] : []),
      ];
      let codigo = '';
      update((d) => {
        let v = d.viagens.find((x) => x.id === vid);
        if (!v) {
          codigo = `VG-0${421 + d.viagens.length - 7}`;
          v = { id: vid, codigo, companyId: company, viajanteId: viajante, destino: f.destino.toUpperCase(), motivo: 'Compra por exceção', inicio: trechos[0].data, fim: trechos[trechos.length - 1].data, status: 'emitida', trechos, docs: [] };
          d.viagens.push(v);
        } else {
          codigo = v.codigo;
          v.trechos = trechos; v.status = 'emitida'; v.inicio = trechos[0].data; v.fim = trechos[trechos.length - 1].data;
        }
        v.compraExterna = { por: me!.id, em: now };
        d.attachments.push({ id: attId, nome: `Bilhete ${f.cia} — ${codigo}.pdf`, tipo: 'PDF', tamanho: '209 KB', em: now, kind: 'bilhete', ref: vid });
        v.docs.unshift(attId);
        d.events.push({ id: evId, ts: now, companyId: company, module: 'viagens', recordId: vid, recordLabel: codigo, action: `Compra externa registrada (exceção): ${motivo.trim()}`, actorId: me!.id });
      });
      notify({ userId: viajante, module: 'viagens', title: 'Documento de viagem incluído', subject: `Bilhete ${f.cia} · localizador ${loc}`, link: `/viagens/${vid}` });
      touchRecent({ module: 'viagens', recordId: vid, label: `Compra externa · ${userName(viajante)}`, action: 'Compra externa registrada', link: `/viagens/${vid}` });
      release();
      flash.set(vid, { tab: 'historico', highlight: evId });
      toast(<>Compra externa registrada para <b>{userName(viajante)}</b>. O viajante foi notificado.</>);
      nav(`/viagens/${vid}`, { replace: true });
    }, 900);
  };

  return (
    <div className="content narrow" style={{ padding: 0 }}>
      {guard}
      <PageHeader crumbs={[{ label: 'Viagens', to: '/viagens/minhas' }, { label: 'Registrar compra externa' }]} title="Registrar compra externa"
        sub="Use quando a passagem foi comprada fora do fluxo padrão. O registro fica identificado como compra por exceção." />
      <form className="card" onSubmit={submit} noValidate>
        <div className="form-section">
          <h3>Viajante</h3>
          <p className="section-desc">Selecione quem viaja e, se existir, a solicitação de viagem correspondente.</p>
          <div className="form-grid">
            <Field label="Viajante" required error={errors.viajante} htmlFor="viajante">
              <select id="viajante" className="select" value={viajante} onChange={(e) => pickTraveler(e.target.value)} aria-invalid={!!errors.viajante}>
                <option value="">Selecione</option>
                {travelers.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.sector}</option>)}
              </select>
            </Field>
            <Field label="Vincular à viagem" htmlFor="vinculo" help={viajante && !pending.length ? 'Sem solicitações pendentes: será criada uma nova viagem.' : undefined}>
              <select id="vinculo" className="select" value={vinculo} onChange={(e) => setVinculo(e.target.value)} disabled={!viajante}>
                {pending.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.destino} · {fmtDateShort(p.inicio)}</option>)}
                <option value="nova">Nova viagem</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="form-section">
          <h3>Passagem</h3>
          <p className="section-desc">Anexe o bilhete. Os campos são preenchidos por leitura do documento <b>(simulada nesta demonstração)</b> e podem ser corrigidos.</p>
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg" hidden onChange={(e) => e.target.files?.[0] && ler(e.target.files[0].name)} />
          <div id="arquivo" tabIndex={-1} className="att" style={{ borderStyle: arquivo ? 'solid' : 'dashed', borderColor: errors.arquivo ? 'var(--danger)' : undefined, flexWrap: 'wrap' }}>
            <span className="att-icon">{reading === 'reading' ? <Loader2 size={18} className="spin" /> : arquivo ? 'PDF' : <FileUp size={18} />}</span>
            <div style={{ flex: '1 1 200px' }}>
              <div className="strong">{arquivo || 'Nenhum arquivo anexado'}</div>
              <div className="xs muted">{reading === 'reading' ? 'Lendo o documento…' : reading === 'done' ? 'Leitura concluída · confira os campos abaixo' : 'PDF ou imagem do bilhete'}</div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={reading === 'reading'}>Escolher arquivo</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => ler('Bilhete LATAM — exemplo.pdf')} disabled={reading === 'reading'}><ScanText size={15} />Usar bilhete de exemplo</button>
          </div>
          {errors.arquivo && <span className="error-msg" role="alert" style={{ marginTop: 6 }}>{errors.arquivo}</span>}

          {reading === 'done' && (
            <div className="form-grid" style={{ marginTop: 20 }}>
              <Field label="Companhia" required error={errors.cia} help={hint('cia')} htmlFor="cia"><input id="cia" className="input" value={f.cia} onChange={setField('cia')} aria-invalid={!!errors.cia} /></Field>
              <Field label="Localizador" required error={errors.localizador} help={hint('localizador')} htmlFor="localizador"><input id="localizador" className="input mono" value={f.localizador} onChange={setField('localizador')} aria-invalid={!!errors.localizador} /></Field>
              <Field label="Origem" help={hint('origem')} htmlFor="origem"><input id="origem" className="input" value={f.origem} onChange={setField('origem')} /></Field>
              <Field label="Destino" help={hint('destino')} htmlFor="destino"><input id="destino" className="input" value={f.destino} onChange={setField('destino')} /></Field>
              <Field label="Voo de ida" help={hint('vooIda')} htmlFor="vooIda"><input id="vooIda" className="input" value={f.vooIda} onChange={setField('vooIda')} /></Field>
              <Field label="Data e hora da ida" required error={errors.dataIda} help={hint('dataIda')} htmlFor="dataIda"><input id="dataIda" type="datetime-local" className="input" value={f.dataIda} onChange={setField('dataIda')} aria-invalid={!!errors.dataIda} /></Field>
              <Field label="Voo de volta" help={hint('vooVolta')} htmlFor="vooVolta"><input id="vooVolta" className="input" value={f.vooVolta} onChange={setField('vooVolta')} /></Field>
              <Field label="Data e hora da volta" error={errors.dataVolta} help={hint('dataVolta')} htmlFor="dataVolta"><input id="dataVolta" type="datetime-local" className="input" value={f.dataVolta} onChange={setField('dataVolta')} aria-invalid={!!errors.dataVolta} /></Field>
              <Field label="Valor total pago (R$)" required error={errors.valor} help={hint('valor') ?? (Number(f.valor) > 0 ? fmtMoney(Number(f.valor)) : undefined)} htmlFor="valor"><input id="valor" type="number" step="0.01" className="input tnum" value={f.valor} onChange={setField('valor')} aria-invalid={!!errors.valor} /></Field>
            </div>
          )}
        </div>

        <div className="form-section">
          <h3>Exceção</h3>
          <p className="section-desc">A compra por exceção aparece no registro e no indicador de Compras.</p>
          <Field label="Motivo da compra por exceção" required error={errors.motivo} htmlFor="motivo" help="Ex.: tarifa promocional disponível apenas no site da companhia.">
            <textarea id="motivo" className="textarea" value={motivo} onChange={(e) => { setMotivo(e.target.value); setErrors((x) => ({ ...x, motivo: '' })); }} aria-invalid={!!errors.motivo} />
          </Field>
        </div>
        <div className="form-actions sticky">
          <button type="button" className="btn btn-secondary" onClick={() => nav(-1)}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving || reading === 'reading'}>{saving ? <><Loader2 size={17} className="spin" />Registrando…</> : <><Check size={17} />Registrar compra externa</>}</button>
        </div>
      </form>
    </div>
  );
}
