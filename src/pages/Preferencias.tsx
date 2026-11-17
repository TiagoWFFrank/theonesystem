import { Moon, Sun } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { ROLE_LABEL } from '@/platform/permissions';
import { Avatar, Field, KV, PageHeader } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { useToast } from '@/ui/toast';
import type { BrandId } from '@/platform/types';

export default function Preferencias() {
  const { me, session, setSession } = useDemo();
  const toast = useToast();
  if (!me) return null;
  return (
    <div className="content narrow" style={{ padding: 0 }}>
      <PageHeader crumbs={[{ label: 'Início', to: '/inicio' }, { label: 'Preferências' }]} title="Preferências" sub="A marca acompanha o ambiente escolhido. A aparência acompanha você." />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="row" style={{ gap: 16, marginBottom: 20 }}><Avatar name={me.name} lg /><div><div className="strong" style={{ fontSize: 18 }}>{me.name}</div><div className="muted small">{me.email}</div></div></div>
          <KV items={[['Setor', me.sector], ['Perfis', me.roles.map((r) => ROLE_LABEL[r]).join(', ')], ['Ambientes', me.companies.map((c) => COMPANIES[c].name).join(', ')]]} />
        </div>
      </div>
      <div className="card">
        <div className="form-section">
          <h3>Ambiente padrão</h3>
          <p className="section-desc">Contexto aberto ao entrar na plataforma.</p>
          <Field label="Ambiente" htmlFor="pref-emp">
            <select id="pref-emp" className="select" style={{ maxWidth: 320 }} value={session.defaultCompany ?? me.companies[0]}
              onChange={(e) => { setSession({ defaultCompany: e.target.value as BrandId }); toast('Ambiente padrão atualizada.'); }}>
              {me.companies.map((c) => <option key={c} value={c}>{COMPANIES[c].name}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-section">
          <h3>Aparência</h3>
          <p className="section-desc">Aplicada em todos os ambientes.</p>
          <div className="radio-cards" style={{ maxWidth: 420, gridTemplateColumns: '1fr 1fr' }} role="radiogroup" aria-label="Aparência">
            <label className="radio-card"><input type="radio" name="theme" checked={session.theme === 'light'} onChange={() => setSession({ theme: 'light' })} /><Sun size={16} />Claro</label>
            <label className="radio-card"><input type="radio" name="theme" checked={session.theme === 'dark'} onChange={() => setSession({ theme: 'dark' })} /><Moon size={16} />Escuro</label>
          </div>
          <div className="stack-sm" style={{ marginTop: 18 }}>
            <label className="check"><input type="checkbox" checked={!!session.reduceTransparency} onChange={(e) => setSession({ reduceTransparency: e.target.checked })} /><span>Reduzir transparência<br /><span className="xs muted">Menus, navegação e diálogos ficam opacos. Também segue a preferência do sistema.</span></span></label>
            <label className="check"><input type="checkbox" checked={!!session.reduceMotion} onChange={(e) => setSession({ reduceMotion: e.target.checked })} /><span>Reduzir movimento<br /><span className="xs muted">Remove animações de abertura e mudança de contexto.</span></span></label>
          </div>
        </div>
      </div>
    </div>
  );
}
