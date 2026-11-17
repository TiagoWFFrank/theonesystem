// Aviso de indisponibilidade na ÁREA AFETADA: o restante da tela continua utilizável.
import { useState } from 'react';
import { CloudOff, Loader2, RotateCw } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { fmtTime, fmtRelative } from '@/platform/format';
import type { ModuleId, SourceId } from '@/platform/types';
import { useToast } from './toast';

export function SourceNotice({ id, label, cachedNote = 'Exibindo o conteúdo carregado anteriormente' }: { id: SourceId | ModuleId; label: string; cachedNote?: string }) {
  const { down, data, update } = useDemo();
  const toast = useToast();
  const [trying, setTrying] = useState(false);
  if (!down(id)) return null;
  const at = data.sync[id];
  const retry = () => {
    setTrying(true);
    setTimeout(() => {
      setTrying(false);
      // consulta o estado atual (o apresentador pode ter restabelecido a fonte)
      const still = document.documentElement.dataset[`down${id}`] === '1';
      if (still) toast(`${label} continua indisponível. Uma nova tentativa automática ocorre em 1 minuto.`, { tone: 'info' });
      else { update((d) => { d.sync[id] = new Date().toISOString(); }); toast(`${label} disponível novamente.`); }
    }, 900);
  };
  return (
    <div className="source-note" role="status">
      <CloudOff size={17} style={{ color: 'var(--warn)', flexShrink: 0 }} />
      <span className="b-text"><b>{label} indisponível no momento.</b> {at ? `${cachedNote}, atualizado às ${fmtTime(at)} (${fmtRelative(at)}).` : 'Sem conteúdo em cache.'}</span>
      <button className="btn btn-secondary btn-xs" disabled={trying} onClick={retry}>{trying ? <Loader2 size={13} className="spin" /> : <RotateCw size={13} />}Tentar novamente</button>
    </div>
  );
}

export function SyncStamp({ id }: { id: SourceId | ModuleId }) {
  const { data, down } = useDemo();
  const at = data.sync[id];
  if (!at || down(id)) return null;
  return <span className="stale" title={`Sincronizado às ${fmtTime(at)}`}>Atualizado {fmtRelative(at)}</span>;
}
