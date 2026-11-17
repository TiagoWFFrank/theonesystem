import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Monitor, Presentation, RotateCcw, Smartphone } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { Confirm, Drawer } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { useToast } from '@/ui/toast';
import type { BrandId, SimMode } from '@/platform/types';

/** Roteiro da reunião (12–15 min). Cada passo prepara perfil, ambiente e tela. */
const SCRIPT: { t: string; label: string; msg: string; user?: string; company?: BrandId; to?: string; logout?: boolean }[] = [
  { t: '0–2', label: 'Entrar com Microsoft e escolher o ambiente', msg: 'Só entra quem a TI liberou; cada pessoa vê seus ambientes.', logout: true, to: '/entrar' },
  { t: '2–3', label: 'Ana: Início com Meu trabalho', msg: 'A primeira tela mostra o trabalho acontecendo.', user: 'u1', company: 'azime', to: '/inicio' },
  { t: '3–4', label: 'Trocar ambiente e aparência', msg: 'Mesma estrutura, três identidades; a posição é preservada.' },
  { t: '4–7', label: 'TI: AZ-0107 → registrar entrega para Ana', msg: 'Fluxo de referência: lista, ficha, formulário e histórico.', user: 'u5', company: 'azime', to: '/inventario/equipamentos?q=AZ-0107' },
  { t: '7–8', label: 'Ana: conferir a entrega no Meu trabalho', msg: 'A operação de um setor vira tarefa de outro.', user: 'u1', company: 'azime', to: '/inicio' },
  { t: '8–9', label: 'Líder: aprovar REV-2026-0148', msg: 'Módulos diferentes compartilham o mesmo padrão.', user: 'u2', company: 'alinare', to: '/reverso/solicitacoes/r1' },
  { t: '9–10', label: 'Compras: compra externa para Ana (VG-0418)', msg: 'O resultado chega ao viajante.', user: 'u3', company: 'azime', to: '/viagens/compras/nova' },
  { t: '10–11', label: 'TI: aplicar acesso ACS-0014 pedido pelo líder', msg: 'Líder solicita, TI aplica: permissão individual.', user: 'u5', company: 'alinare', to: '/admin/acessos/ar2' },
  { t: '11–12', label: 'Gerência: configurar exportação', msg: 'Exportação controlada; registros sempre preservados.', user: 'u6', company: 'azime', to: '/admin/exportacoes' },
  { t: '12–13', label: 'TI: instalar Reservas de salas', msg: 'Um plugin entra em menus, permissões e funcionalidades.', user: 'u5', company: 'azime', to: '/admin/plugins/reservas' },
  { t: '13–15', label: 'Mostrar no celular e recolher decisões', msg: 'Abra uma janela com 390 px de largura.' },
];

export function PresenterPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, session, setSession, reset, update, me } = useDemo();
  const nav = useNavigate();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const personas = data.users.filter((u) => u.persona);
  const rev = data.plugins.find((p) => p.id === 'reverso')!;

  const go = (s: (typeof SCRIPT)[number]) => {
    if (s.logout) setSession({ userId: null });
    else if (s.user || s.company) setSession({ ...(s.user ? { userId: s.user } : {}), ...(s.company ? { companyId: s.company } : {}) });
    if (s.to) nav(s.to);
    onClose();
  };

  return (
    <>
      <Drawer open={open} onClose={onClose} title={<span className="row"><Presentation size={18} />Painel do apresentador</span>}
        footer={<button className="btn btn-secondary btn-block" onClick={() => setConfirmReset(true)}><RotateCcw size={16} />Restaurar demonstração</button>}>
        <div className="stack" style={{ gap: 22 }}>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Perfil</div>
            <select className="select" value={me?.id} onChange={(e) => { setSession({ userId: e.target.value }); nav('/inicio'); }} aria-label="Perfil de demonstração">
              {personas.map((u) => <option key={u.id} value={u.id}>{u.persona} · {u.name}</option>)}
            </select>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Ambiente</div>
            <div className="seg" role="group" aria-label="Marca">
              {(Object.keys(COMPANIES) as BrandId[]).map((b) => <button key={b} aria-pressed={session.companyId === b} onClick={() => setSession({ companyId: b })}>{COMPANIES[b].name}</button>)}
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Aparência</div>
            <div className="seg" role="group" aria-label="Tema">
              <button aria-pressed={session.theme === 'light'} onClick={() => setSession({ theme: 'light' })}>Claro</button>
              <button aria-pressed={session.theme === 'dark'} onClick={() => setSession({ theme: 'dark' })}>Escuro</button>
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Estados e acessibilidade</div>
            <div className="seg" role="group" aria-label="Estado simulado">
              {(['normal', 'carregando', 'erro', 'vazio'] as SimMode[]).map((m) => <button key={m} aria-pressed={session.sim === m} onClick={() => setSession({ sim: m })} style={{ textTransform: 'capitalize' }}>{m}</button>)}
            </div>
            <label className="check small" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={rev.maintenance} onChange={() => update((d) => { const p = d.plugins.find((x) => x.id === 'reverso')!; p.maintenance = !p.maintenance; })} />
              Reverso em manutenção
            </label>
            <label className="check small" style={{ marginTop: 8 }}><input type="checkbox" checked={!!session.reduceTransparency} onChange={(e) => setSession({ reduceTransparency: e.target.checked })} />Reduzir transparência</label>
            <label className="check small" style={{ marginTop: 8 }}><input type="checkbox" checked={!!session.reduceMotion} onChange={(e) => setSession({ reduceMotion: e.target.checked })} />Reduzir movimento</label>
            <p className="xs muted" style={{ marginTop: 8 }}>Edição pendente: preencha um formulário e tente sair ou trocar de ambiente.</p>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Roteiro da reunião</div>
            {SCRIPT.map((s, i) => (
              <div className="script-step" key={i}>
                <span className="xs muted tnum strong">{s.t} min</span>
                <div>
                  <div className="strong">{s.label}</div>
                  <div className="xs muted">{s.msg}</div>
                  {(s.to || s.user) && <button className="btn btn-ghost btn-sm" style={{ marginTop: 4, marginLeft: -12 }} onClick={() => go(s)}>Preparar e abrir<ArrowRight size={14} /></button>}
                  {i === SCRIPT.length - 1 && <div className="row xs muted" style={{ marginTop: 4 }}><Smartphone size={13} />360 / 390 px · <Monitor size={13} />1280 / 1440 px</div>}
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Telas de entrada</div>
            <div className="stack-sm small">
              <Link to="/entrar?motivo=sessao" onClick={() => setSession({ userId: null })}>Login · sessão encerrada</Link>
              <Link to="/entrar" onClick={() => setSession({ userId: null })}>Entrada · conta não liberada (João Victor)</Link>
              <Link to="/recuperar-acesso" onClick={() => setSession({ userId: null })}>Senha gerenciada pela Microsoft</Link>
              <Link to="/rota-que-nao-existe" onClick={onClose}>Endereço inválido</Link>
            </div>
          </div>
        </div>
      </Drawer>
      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} title="Restaurar demonstração?" confirmLabel="Restaurar dados iniciais"
        desc="Todos os registros voltam ao cenário inicial. A preferência de tema é mantida."
        onConfirm={() => { reset(); setSession({ userId: 'u1', companyId: 'azime' }); nav('/inicio'); onClose(); toast('Demonstração restaurada.'); }} />
    </>
  );
}
