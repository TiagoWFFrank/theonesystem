// Comunicados e notícias da intranet (SharePoint · sistema interno), via adaptador SIMULADO.
// Publicação e administração continuam no processo existente da intranet.
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight, Boxes, FileCog, Gem, Newspaper, PartyPopper, ShieldAlert } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { useUrlState } from '@/platform/hooks';
import { fmtDate, fmtRelative } from '@/platform/format';
import { postsFor, reachLabel, inReach } from '@/platform/sources';
import { integration, sharepointLink } from '@/platform/integrations';
import { BackToList, EmptyState, PageHeader } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { SourceNotice, SyncStamp } from '@/ui/source';
import { NotFoundInline } from './NotFound';
import type { IntranetPost } from '@/platform/types';

const ART: Record<NonNullable<IntranetPost['imagem']>, { bg: string; icon: typeof Gem }> = {
  festa: { bg: 'linear-gradient(135deg, #2f2463 0%, #a3427a 55%, #f0a35e 100%)', icon: PartyPopper },
  seguranca: { bg: 'linear-gradient(135deg, #0f2f4a 0%, #1f6aa0 60%, #6fb6e8 100%)', icon: ShieldAlert },
  procedimento: { bg: 'linear-gradient(135deg, #2b3640 0%, #5d6b77 60%, #a9b4bd 100%)', icon: FileCog },
  colecao: { bg: 'linear-gradient(135deg, #6f3f39 0%, #a46f69 55%, #d7b79b 100%)', icon: Gem },
  inventario: { bg: 'linear-gradient(135deg, #111113 0%, #3a3c42 60%, #8a8d96 100%)', icon: Boxes },
};

export function PostImage({ kind, size = 44, className = 'p-img' }: { kind?: IntranetPost['imagem']; size?: number; className?: string }) {
  if (!kind) return null;
  const a = ART[kind]; const I = a.icon;
  return (
    <div className={className} style={{ background: a.bg }} role="img" aria-label="Imagem ilustrativa da publicação">
      <span style={{ position: 'absolute', width: '70%', aspectRatio: '1', right: '-20%', top: '-40%', borderRadius: '50%', border: '1px solid rgb(255 255 255 / .25)' }} />
      <span style={{ position: 'absolute', width: '40%', aspectRatio: '1', left: '-10%', bottom: '-25%', borderRadius: '50%', background: 'rgb(255 255 255 / .1)' }} />
      <I size={size} strokeWidth={1.5} style={{ position: 'relative' }} />
    </div>
  );
}

export function PostCard({ p, featured, onOpen }: { p: IntranetPost; featured?: boolean; onOpen?: () => void }) {
  const inner = (
    <>
      <PostImage kind={p.imagem} size={featured ? 64 : 40} />
      <div className="p-body">
        <span className="p-cat">{p.categoria} · {p.area}</span>
        <h3>{p.titulo}</h3>
        <p>{p.resumo}</p>
        <div className="p-foot"><span>{fmtRelative(p.publicadoEm)}</span><span>·</span><span>{p.autor}</span><span>·</span><span>{reachLabel(p.alcance, COMPANIES)}</span></div>
      </div>
    </>
  );
  return onOpen
    ? <button className={`post interactive ${featured ? 'featured' : ''}`} onClick={onOpen}>{inner}</button>
    : <Link to={`/intranet/${p.id}`} className={`post interactive ${featured ? 'featured' : ''}`}>{inner}</Link>;
}

export function IntranetList() {
  const { data, company, me } = useDemo();
  const [f, setF] = useUrlState({ cat: '' });
  const posts = postsFor(data, company, me);
  const cats = Array.from(new Set(posts.map((p) => p.categoria)));
  const shown = posts.filter((p) => !f.cat || p.categoria === f.cat);
  return (
    <>
      <PageHeader crumbs={[{ label: 'Início', to: '/inicio' }, { label: 'Intranet' }]} title="Comunicados e notícias"
        sub={<>Publicações da intranet (SharePoint) com alcance para o ambiente {COMPANIES[company].name} ou para todo o grupo. <SyncStamp id="sharepoint" /></>} />
      <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
        <SourceNotice id="sharepoint" label="A intranet" />
        <div className="list-tools">
          <div className="seg-filter" role="group" aria-label="Categoria">
            <button aria-pressed={!f.cat} onClick={() => setF({ cat: '' })}>Todas<span className="n">{posts.length}</span></button>
            {cats.map((c) => <button key={c} aria-pressed={f.cat === c} onClick={() => setF({ cat: c })}>{c}<span className="n">{posts.filter((p) => p.categoria === c).length}</span></button>)}
          </div>
        </div>
      </div>
      {shown.length === 0 ? <div className="card"><EmptyState icon={<Newspaper size={22} />} title="Nenhuma publicação para este ambiente" /></div> : (
        <div className="posts">{shown.map((p, i) => <PostCard key={p.id} p={p} featured={i === 0 && !f.cat && p.destaque} />)}</div>
      )}
    </>
  );
}

export function IntranetPostPage() {
  const { id } = useParams();
  const { data, company, me, markRead } = useDemo();
  const p = data.posts.find((x) => x.id === id);
  useEffect(() => {
    if (!p || !me) return;
    const ids = data.notifications.filter((n) => n.userId === me.id && n.recordId === p.id && !n.read).map((n) => n.id);
    if (ids.length) markRead(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id]);
  if (!p || !inReach(p.alcance, company, me)) return <NotFoundInline what="publicação neste ambiente" back="/intranet" />;
  const link = p.url ?? sharepointLink(p.id);
  return (
    <div className="content narrow" style={{ padding: 0 }}>
      <nav className="crumbs" aria-label="Você está em"><Link to="/inicio">Início</Link><span aria-hidden>›</span><Link to="/intranet">Intranet</Link><span aria-hidden>›</span><span aria-current="page">{p.categoria}</span></nav>
      <article className="card" style={{ overflow: 'hidden' }}>
        <SourceNotice id="sharepoint" label="A intranet" cachedNote="Exibindo a versão salva desta publicação" />
        {p.imagem && <PostImage kind={p.imagem} size={84} className="post-hero" />}
        <div className="card-body" style={{ paddingTop: p.imagem ? 4 : 24 }}>
          <span className="p-cat xs strong muted" style={{ textTransform: 'uppercase', letterSpacing: '.07em' }}>{p.categoria} · {p.area}</span>
          <h1 className="page-title" style={{ margin: '8px 0 10px' }}>{p.titulo}</h1>
          <p className="muted small" style={{ marginBottom: 22 }}>Publicado em {fmtDate(p.publicadoEm)} por {p.autor} · alcance: <b>{reachLabel(p.alcance, COMPANIES)}</b></p>
          <div className="article">{p.conteudo.map((t, i) => <p key={i}>{t}</p>)}</div>
        </div>
        <div className="form-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span className="row small" style={{ gap: 8 }}><Newspaper size={16} className="muted" /><span><b>Origem:</b> Intranet AZIME · SharePoint (sistema interno). Publicação e administração seguem o processo da intranet.</span></span>
          <span className="row">
            <BackToList fallback="/intranet" />
            {link ? <a className="btn btn-primary" href={link} target="_blank" rel="noreferrer"><ArrowUpRight size={16} />Abrir no SharePoint</a>
              : <button className="btn btn-secondary" disabled title={`Endereço do SharePoint não configurado (${integration('sharepoint').mode})`}><ArrowUpRight size={16} />Abrir no SharePoint · não configurado</button>}
          </span>
        </div>
      </article>
    </div>
  );
}
