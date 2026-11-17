import { useState } from 'react';
import { ArrowLeft, Download, Eye, FileText, History, Paperclip } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { fmtDate, fmtDateTime, fmtMoney } from '@/platform/format';
import type { Attachment, HistoryEvent } from '@/platform/types';
import { Dialog, EmptyState } from './core';
import { COMPANIES } from './brand';
import { useToast } from './toast';

export function Timeline({ events, highlightId }: { events: HistoryEvent[]; highlightId?: string }) {
  const { userName } = useDemo();
  const sorted = [...events].sort((a, b) => b.ts.localeCompare(a.ts));
  if (!sorted.length) return <EmptyState icon={<History size={22} />} title="Sem histórico" text="As alterações deste registro aparecerão aqui." />;
  return (
    <ol className="timeline">
      {sorted.map((e) => (
        <li key={e.id}>
          <span className="dot"><History size={14} /></span>
          <div className={e.id === highlightId ? 'new' : ''} style={{ padding: '2px 6px', margin: '-2px -6px' }}>
            <div style={{ fontWeight: 500 }}>{e.action}</div>
            <div className="when">{userName(e.actorId)} · {fmtDateTime(e.ts)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function AttachmentList({ ids, empty }: { ids: string[]; empty?: string }) {
  const { data } = useDemo();
  const toast = useToast();
  const [open, setOpen] = useState<Attachment | null>(null);
  const list = ids.map((id) => data.attachments.find((a) => a.id === id)).filter(Boolean) as Attachment[];
  if (!list.length)
    return <EmptyState icon={<Paperclip size={22} />} title="Nenhum anexo" text={empty ?? 'Os documentos incluídos neste registro aparecerão aqui.'} />;
  return (
    <>
      {list.map((a) => (
        <div className="att" key={a.id}>
          <span className={`att-icon ${a.tipo === 'PNG' ? 'png' : ''}`}>{a.tipo}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</div>
            <div className="xs muted">{a.tipo} · {a.tamanho} · {fmtDate(a.em)}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(a)}><Eye size={15} /><span className="hide-mobile">Visualizar</span></button>
          <button className="btn btn-ghost btn-sm" onClick={() => toast(`Download simulado: ${a.nome}`, { tone: 'info' })} aria-label={`Baixar ${a.nome}`}><Download size={15} /></button>
        </div>
      ))}
      <DocViewer att={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** Visualizador de documentos de exemplo. O conteúdo é gerado a partir do registro relacionado. */
export function DocViewer({ att, onClose }: { att: Attachment | null; onClose: () => void }) {
  const { data, userName } = useDemo();
  if (!att) return null;
  const eq = data.equipments.find((e) => e.id === att.ref);
  const rv = data.reversos.find((r) => r.id === att.ref);
  const vg = data.viagens.find((v) => v.id === att.ref);
  let body: JSX.Element = <p>Documento de exemplo.</p>;
  if (att.kind === 'termo' && eq) {
    body = (
      <>
        <h1>Termo de responsabilidade de uso de equipamento</h1>
        <p style={{ color: '#666' }}>{COMPANIES[eq.companyId].legal} · documento de demonstração</p>
        <table><tbody>
          <tr><td>Patrimônio</td><td><b>{eq.patrimonio}</b></td></tr>
          <tr><td>Equipamento</td><td>{eq.descricao}</td></tr>
          <tr><td>Nº de série</td><td>{eq.serie}</td></tr>
          <tr><td>Colaborador</td><td>{userName(eq.responsavelId)}</td></tr>
          <tr><td>Data</td><td>{fmtDate(att.em)}</td></tr>
        </tbody></table>
        <p>Declaro ter recebido o equipamento acima em perfeito estado de funcionamento, comprometendo-me a zelar por sua guarda e conservação e a devolvê-lo quando solicitado.</p>
        <p style={{ marginTop: 40 }}>______________________________<br />Assinatura do colaborador</p>
      </>
    );
  } else if (att.kind === 'etiqueta' && rv) {
    body = (
      <div style={{ border: '2px solid #111', padding: 20, fontFamily: 'ui-monospace, monospace' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>LOGÍSTICA REVERSA · AUTORIZAÇÃO DE POSTAGEM</div>
        <div style={{ margin: '12px 0', height: 56, background: 'repeating-linear-gradient(90deg,#111 0 2px,#fff 2px 4px,#111 4px 7px,#fff 7px 9px)' }} />
        <div><b>{rv.rastreio ?? 'BR000000000BR'}</b> · {rv.numero}</div>
        <div style={{ marginTop: 10 }}>REMETENTE: {rv.clienteNome}<br />{rv.endereco}</div>
        <div style={{ marginTop: 10 }}>DESTINATÁRIO: {COMPANIES[rv.companyId].legal}<br />Centro de distribuição · São Paulo/SP</div>
      </div>
    );
  } else if (vg) {
    body = (
      <>
        <h1>{att.kind === 'nota' ? 'Voucher de hospedagem' : 'Bilhete eletrônico'}</h1>
        <p style={{ color: '#666' }}>{vg.codigo} · {userName(vg.viajanteId)} · documento de demonstração</p>
        {att.kind === 'nota' && vg.hospedagem ? (
          <table><tbody>
            <tr><td>Hotel</td><td>{vg.hospedagem.hotel}</td></tr>
            <tr><td>Check-in</td><td>{fmtDateTime(vg.hospedagem.checkin)}</td></tr>
            <tr><td>Check-out</td><td>{fmtDateTime(vg.hospedagem.checkout)}</td></tr>
          </tbody></table>
        ) : (
          <table><tbody>
            {vg.trechos.map((t) => (
              <tr key={t.tipo}><td>{t.tipo === 'ida' ? 'Ida' : 'Volta'}</td><td>{t.cia} {t.voo} · {t.origem} → {t.destino} · {fmtDateTime(t.data)} · Loc. {t.localizador} · {fmtMoney(t.valor)}</td></tr>
            ))}
          </tbody></table>
        )}
      </>
    );
  }
  return (
    <Dialog open onClose={onClose} title={att.nome} size="wide" icon={<FileText size={22} style={{ marginTop: 4 }} />}
      desc="Visualizador de documentos · conteúdo de exemplo"
      footer={<button className="btn btn-secondary" onClick={onClose}><ArrowLeft size={16} />Voltar à ficha</button>}>
      <div className="doc-wrap"><div className="doc-paper">{body}</div></div>
    </Dialog>
  );
}
