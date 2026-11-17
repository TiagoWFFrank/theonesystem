import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Save } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { useUnsavedGuard } from '@/platform/hooks';
import { uid } from '@/platform/format';
import { Field, PageHeader } from '@/ui/core';
import { useToast } from '@/ui/toast';
import { ForbiddenInline } from '@/pages/NotFound';
import { EQ_TYPES } from './meta';
import type { Equipment } from '@/platform/types';

const prefix = { azime: 'AZ', alinare: 'AL', novitah: 'NV' } as const;

export default function CadastroForm() {
  const { data, company, can, update, me, touchRecent } = useDemo();
  const nav = useNavigate();
  const toast = useToast();
  const [v, setV] = useState({ patrimonio: '', descricao: '', tipo: '', marcaModelo: '', serie: '', localizacao: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = Object.values(v).some(Boolean) && !saving;
  const { guard, release } = useUnsavedGuard(dirty);
  if (!can('inventario', 'cadastrar')) return <ForbiddenInline />;

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: '' }));
  };
  const pat = v.patrimonio.trim().toUpperCase();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const er: Record<string, string> = {};
    if (!pat) er.patrimonio = 'Informe o número de patrimônio.';
    else if (!new RegExp(`^${prefix[company]}-\\d{4}$`).test(pat)) er.patrimonio = `Use o formato ${prefix[company]}-0000 neste ambiente.`;
    else if (data.equipments.some((x) => x.patrimonio === pat)) er.patrimonio = `O patrimônio ${pat} já está cadastrado.`;
    if (!v.descricao.trim()) er.descricao = 'Descreva o equipamento.';
    if (!v.tipo) er.tipo = 'Selecione o tipo.';
    if (!v.serie.trim()) er.serie = 'Informe o número de série.';
    setErrors(er);
    if (Object.keys(er).length) {
      document.getElementById(Object.keys(er)[0])?.focus();
      return;
    }
    setSaving(true);
    setTimeout(() => {
      const id = uid('e');
      const now = new Date().toISOString();
      update((d) => {
        d.equipments.push({ id, companyId: company, patrimonio: pat, descricao: v.descricao.trim(), tipo: v.tipo as Equipment['tipo'], marcaModelo: v.marcaModelo.trim() || '—', serie: v.serie.trim(), status: 'disponivel', localizacao: v.localizacao.trim() || 'Sala de TI', aquisicao: now, ultimaMov: now, docs: [] });
        d.events.push({ id: uid('ev'), ts: now, companyId: company, module: 'inventario', recordId: id, recordLabel: pat, action: 'Equipamento cadastrado', actorId: me!.id });
      });
      touchRecent({ module: 'inventario', recordId: id, label: `${pat} · ${v.descricao.trim()}`, action: 'Cadastrado', link: `/inventario/equipamentos/${id}` });
      release();
      toast(<>Equipamento <b>{pat}</b> cadastrado como disponível.</>);
      nav(`/inventario/equipamentos/${id}`, { replace: true });
    }, 700);
  };

  return (
    <div className="content narrow" style={{ padding: 0 }}>
      {guard}
      <PageHeader crumbs={[{ label: 'Inventário', to: '/inventario/equipamentos' }, { label: 'Cadastrar equipamento' }]}
        title="Cadastrar equipamento" sub="O equipamento entra como Disponível e pode ser entregue em seguida." />
      <form className="card" onSubmit={submit} noValidate>
        <div className="form-section">
          <h3>Identificação</h3>
          <p className="section-desc">Campos com <span className="req">*</span> são obrigatórios.</p>
          <div className="form-grid">
            <Field label="Patrimônio" required error={errors.patrimonio} help={`Formato ${prefix[company]}-0000`} htmlFor="patrimonio">
              <input id="patrimonio" className="input tnum" value={v.patrimonio} onChange={set('patrimonio')} aria-invalid={!!errors.patrimonio} placeholder={`${prefix[company]}-0120`} />
            </Field>
            <Field label="Tipo" required error={errors.tipo} htmlFor="tipo">
              <select id="tipo" className="select" value={v.tipo} onChange={set('tipo')} aria-invalid={!!errors.tipo}>
                <option value="">Selecione</option>
                {EQ_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Descrição" required error={errors.descricao} className="full" htmlFor="descricao">
              <input id="descricao" className="input" value={v.descricao} onChange={set('descricao')} aria-invalid={!!errors.descricao} placeholder="Ex.: Notebook Dell Latitude 5440" />
            </Field>
          </div>
        </div>
        <div className="form-section">
          <h3>Dados técnicos</h3>
          <p className="section-desc">Informações usadas para conferência e assistência técnica.</p>
          <div className="form-grid">
            <Field label="Marca e modelo" htmlFor="marcaModelo"><input id="marcaModelo" className="input" value={v.marcaModelo} onChange={set('marcaModelo')} /></Field>
            <Field label="Número de série" required error={errors.serie} htmlFor="serie"><input id="serie" className="input mono" value={v.serie} onChange={set('serie')} aria-invalid={!!errors.serie} /></Field>
            <Field label="Localização inicial" className="full" help="Se vazio, será registrado como Sala de TI." htmlFor="localizacao"><input id="localizacao" className="input" value={v.localizacao} onChange={set('localizacao')} /></Field>
          </div>
        </div>
        <div className="form-actions sticky">
          <button type="button" className="btn btn-secondary" onClick={() => nav(-1)}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><Loader2 size={17} className="spin" />Salvando…</> : <><Save size={17} />Cadastrar equipamento</>}</button>
        </div>
      </form>
    </div>
  );
}
