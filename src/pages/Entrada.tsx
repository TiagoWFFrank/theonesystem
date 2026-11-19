// Entrada com conta corporativa Microsoft (SIMULADA) e seleção dos ambientes autorizados.
// Regra: só entra quem foi previamente liberado pela TI. Na etapa funcional: Microsoft Entra ID (OIDC) → Supabase Auth.
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, MailCheck, Moon, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { collectWork } from '@/platform/work';
import { ROLE_LABEL } from '@/platform/permissions';
import { Avatar, Field } from '@/ui/core';
import { Ambient, COMPANIES, Logo, Monogram } from '@/ui/brand';
import type { BrandId, User } from '@/platform/types';

export function MicrosoftMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function BrandPanel() {
  const { company } = useDemo();
  const serif = company !== 'azime';
  return (
    <div className="entry-brand" aria-hidden>
      <div className="art-shape" style={{ width: 640, height: 640, right: -200, top: -180, border: '1px solid color-mix(in srgb, var(--art-text) 22%, transparent)' }} />
      <div className="art-shape" style={{ width: 440, height: 440, right: -100, top: -80, border: '1px solid color-mix(in srgb, var(--art-text) 14%, transparent)' }} />
      <div className="art-shape" style={{ width: 300, height: 300, right: 10, top: 20, background: 'radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--art-accent) 34%, transparent), transparent 70%)' }} />
      <div className="art-shape" style={{ width: 900, height: 900, left: -440, bottom: -640, background: 'color-mix(in srgb, var(--art-accent) 8%, transparent)' }} />
      <div style={{ position: 'relative', fontFamily: serif ? 'var(--font-display)' : 'var(--font)', letterSpacing: '.26em', fontSize: 18, fontWeight: serif ? 400 : 700 }}>{COMPANIES[company].name.toUpperCase()}</div>
      <div style={{ position: 'relative', maxWidth: 480 }}>
        <div style={{ fontFamily: serif ? 'var(--font-display)' : 'var(--font)', fontSize: serif ? 52 : 44, lineHeight: 1.06, fontWeight: serif ? 400 : 600, letterSpacing: '-0.025em' }}>
          Todo o trabalho do grupo, em um só lugar.
        </div>
        <p style={{ marginTop: 18, color: 'var(--art-muted)', maxWidth: 420 }}>Inventário, reversos, viagens e as próximas funcionalidades, com a identidade de cada ambiente e os acessos definidos pela TI.</p>
      </div>
      <div className="xs" style={{ position: 'relative', color: 'var(--art-muted)' }}>The One System · AZIME, Alinare e Novitah</div>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { session, setSession, company } = useDemo();
  return (
    <>
      <Ambient />
      <div className="entry">
        <BrandPanel />
        <div className="entry-panel glass-strong">
          <div className="row">
            <Logo brand={company} />
            <span className="spacer" />
            <button className="icon-btn" aria-label={session.theme === 'light' ? 'Usar aparência escura' : 'Usar aparência clara'} onClick={() => setSession({ theme: session.theme === 'light' ? 'dark' : 'light' })}>
              {session.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
          <div className="inner page-enter">{children}</div>
          <p className="xs muted" style={{ textAlign: 'center' }}>Ambiente de demonstração · autenticação simulada</p>
        </div>
      </div>
    </>
  );
}

type Step = 'start' | 'accounts' | 'connecting' | 'blocked' | 'env';

export function Login() {
  const { data, setSession, session } = useDemo();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState<Step>('start');
  const [user, setUser] = useState<User | null>(null);
  const [other, setOther] = useState('');
  const [otherErr, setOtherErr] = useState('');
  const [pick, setPick] = useState<BrandId | null>(null);
  const [remember, setRemember] = useState(true);
  const accounts = data.users.filter((u) => u.persona || u.status === 'aguardando');

  const choose = (u: User | undefined, email?: string) => {
    setStep('connecting');
    setTimeout(() => {
      if (!u) { setUser({ id: 'x', name: email ?? '', email: email ?? '', sector: '', companies: [], roles: [], status: 'aguardando' }); setStep('blocked'); return; }
      setUser(u);
      if (u.status !== 'ativo') { setStep('blocked'); return; }
      const first = session.defaultCompany && u.companies.includes(session.defaultCompany) ? session.defaultCompany : u.companies.includes(session.companyId) ? session.companyId : u.companies[0];
      setPick(first);
      setSession({ companyId: first });
      setStep('env');
    }, 900);
  };
  const enter = () => {
    if (!user || !pick) return;
    setSession({ userId: user.id, companyId: pick, ...(remember ? { defaultCompany: pick } : {}) });
    const back = params.get('voltar');
    nav(back && back !== '/' ? back : '/inicio', { replace: true });
  };
  const previewEnv = (b: BrandId) => { setPick(b); setSession({ companyId: b }); };

  return (
    <Frame>
      {step === 'start' && (
        <>
          <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8 }}>Acesse a plataforma</h1>
          <p className="muted" style={{ marginBottom: 28 }}>Entre com sua conta corporativa Microsoft. Seu acesso é liberado previamente pela TI.</p>
          {params.get('motivo') === 'sessao' && <div className="banner banner-info" style={{ marginBottom: 20 }}><span className="b-text">Sua sessão foi encerrada. Entre novamente para continuar.</span></div>}
          <button className="ms-btn" onClick={() => setStep('accounts')}><MicrosoftMark />Entrar com Microsoft</button>
          <div className="stack-sm" style={{ marginTop: 28 }}>
            {[['Conta única', 'O mesmo login corporativo do e-mail e do Teams.'], ['Acesso por ambiente', 'Você escolhe entre os ambientes que a TI liberou para você.']].map(([t, d]) => (
              <div key={t} className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                <span className="step-num done"><Check size={13} /></span>
                <span><span className="strong small" style={{ display: 'block' }}>{t}</span><span className="xs muted">{d}</span></span>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 'accounts' && (
        <>
          <div className="row" style={{ marginBottom: 18, gap: 10 }}><MicrosoftMark size={18} /><span className="strong">Microsoft</span><span className="xs muted">· simulação</span></div>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Escolha uma conta</h1>
          <div style={{ maxHeight: 360, overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
            {accounts.map((u) => (
              <button key={u.id} className="account" onClick={() => choose(u)}>
                <Avatar name={u.name} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="strong" style={{ display: 'block' }}>{u.name}</span>
                  <span className="xs muted">{u.email}</span>
                </span>
                <span className="xs muted">{u.persona ?? 'não liberado'}</span>
              </button>
            ))}
          </div>
          <form className="row" style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); if (!/^\S+@\S+\.\S+$/.test(other)) { setOtherErr('Informe um e-mail corporativo válido.'); return; } choose(data.users.find((u) => u.email === other.trim().toLowerCase()), other.trim()); }}>
            <div style={{ flex: 1 }}><Field label="" error={otherErr}><input className="input" type="email" inputMode="email" aria-label="Usar outra conta" placeholder="Usar outra conta (e-mail)" value={other} onChange={(e) => { setOther(e.target.value); setOtherErr(''); }} /></Field></div>
            <button className="btn btn-secondary" aria-label="Continuar com outra conta"><ArrowRight size={17} /></button>
          </form>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => setStep('start')}><ArrowLeft size={15} />Voltar</button>
        </>
      )}

      {step === 'connecting' && (
        <div className="state" style={{ padding: '48px 0' }}>
          <div className="state-icon"><Loader2 size={24} className="spin" /></div>
          <h3>Conectando à Microsoft…</h3>
          <p>Verificando sua conta e os ambientes liberados pela TI.</p>
        </div>
      )}

      {step === 'blocked' && user && (
        <div className="stack">
          <div className="state-icon" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}><Lock size={24} /></div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>{user.status === 'bloqueado' ? 'Acesso suspenso' : 'Seu acesso ainda não foi liberado'}</h1>
          <p className="muted">
            {user.status === 'bloqueado'
              ? <>A conta <b>{user.email}</b> está com o acesso suspenso. Seus registros continuam preservados.</>
              : <>A conta <b>{user.email}</b> foi reconhecida pela Microsoft, mas a TI ainda não liberou o acesso à plataforma. Peça ao seu líder para solicitar a liberação; a TI aplica a alteração.</>}
          </p>
          <div className="banner banner-info"><ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span className="b-text">Contato: TI · Elisa Moura · ramal 2040 (exemplo)</span></div>
          <button className="btn btn-secondary" onClick={() => setStep('accounts')}><ArrowLeft size={16} />Usar outra conta</button>
        </div>
      )}

      {step === 'env' && user && (
        <>
          <div className="row" style={{ gap: 12, marginBottom: 18 }}>
            <Avatar name={user.name} />
            <div><div className="strong">{user.name}</div><div className="xs muted">{user.email} · {user.roles.filter((r) => r !== 'colaborador').map((r) => ROLE_LABEL[r]).join(', ') || 'Colaborador'}</div></div>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 6 }}>Escolha o ambiente</h1>
          <p className="muted small" style={{ marginBottom: 18 }}>{user.companies.length > 1 ? `Você tem acesso a ${user.companies.length} ambientes. É possível trocar a qualquer momento pelo cabeçalho.` : 'Você tem acesso a um ambiente.'}</p>
          <div role="radiogroup" aria-label="Ambientes autorizados">
            {user.companies.map((b) => {
              const n = collectWork(data, user, b).reduce((s, q) => s + q.items.filter((i) => i.stage === 'acao' || i.stage === 'aprovacao').length, 0);
              return (
                <button key={b} className="env-card" role="radio" aria-checked={pick === b} aria-pressed={pick === b} onClick={() => previewEnv(b)} onDoubleClick={enter}>
                  <Monogram brand={b} size={44} />
                  <span>
                    <span className="strong" style={{ display: 'block', fontSize: 16 }}>{COMPANIES[b].name}</span>
                    <span className="xs muted">{COMPANIES[b].tagline}{n ? ` · ${n} ${n === 1 ? 'item precisa' : 'itens precisam'} de você` : ' · nada pendente'}</span>
                  </span>
                  <span className="env-swatch" aria-hidden>{COMPANIES[b].swatches.map((c) => <i key={c} style={{ background: c }} />)}</span>
                </button>
              );
            })}
          </div>
          <label className="check small" style={{ margin: '16px 0' }}><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Abrir neste ambiente nas próximas vezes</label>
          <button className="btn btn-primary btn-block" style={{ height: 50 }} onClick={enter} disabled={!pick}>Entrar em {pick ? COMPANIES[pick].name : '…'}<ArrowRight size={17} /></button>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setStep('accounts')}><UserRound size={15} />Trocar de conta</button>
        </>
      )}
    </Frame>
  );
}

export function Recuperar() {
  return (
    <Frame>
      <div className="stack">
        <div className="state-icon"><MailCheck size={24} /></div>
        <h1 style={{ fontSize: 26, fontWeight: 600 }}>Senha gerenciada pela Microsoft</h1>
        <p className="muted">O acesso usa sua conta corporativa. Para redefinir a senha, use o portal da Microsoft ou fale com a TI.</p>
        <Link to="/entrar" className="btn btn-secondary"><ArrowLeft size={16} />Voltar para a entrada</Link>
      </div>
    </Frame>
  );
}

/** Mantido para compatibilidade com links antigos: o convite agora é a liberação feita pela TI. */
export function Convite() {
  const [params] = useSearchParams();
  const { setSession } = useDemo();
  const emp = (params.get('empresa') as BrandId) ?? 'novitah';
  useEffect(() => { if (COMPANIES[emp]) setSession({ companyId: emp }); }, [emp, setSession]);
  return (
    <Frame>
      <div className="stack">
        <div className="state-icon" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}><Check size={24} /></div>
        <h1 style={{ fontSize: 26, fontWeight: 600 }}>Acesso liberado</h1>
        <p className="muted">A TI liberou sua conta Microsoft para o ambiente {COMPANIES[emp]?.name}. Entre com sua conta corporativa.</p>
        <Link to="/entrar" className="btn btn-primary"><MicrosoftMark />Entrar com Microsoft</Link>
      </div>
    </Frame>
  );
}
