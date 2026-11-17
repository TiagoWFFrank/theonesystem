// Exportação configurada pela Gerência (formatos, campos e perfis). Exportar não altera nem remove registros.
import { useState } from 'react';
import { Download, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { Dialog } from './core';
import { useToast } from './toast';
import type { ModuleId } from '@/platform/types';

export interface ExportColumn<T> { key: string; label: string; get: (r: T) => string }

export function useCanExport(module: ModuleId) {
  const { data, me } = useDemo();
  const cfg = data.exportConfig[module];
  return !!cfg?.enabled && !!me && me.roles.some((r) => cfg.roles.includes(r));
}

export function ExportButton<T>({ module, rows, columns, name }: { module: ModuleId; rows: T[]; columns: ExportColumn<T>[]; name: string }) {
  const { data, log } = useDemo();
  const toast = useToast();
  const allowed = useCanExport(module);
  const [open, setOpen] = useState(false);
  const cfg = data.exportConfig[module];
  const [fmt, setFmt] = useState<string>(cfg?.formats[0] ?? 'CSV');
  if (!allowed || !cfg) return null;
  const cols = columns.filter((c) => cfg.fields.includes(c.key));
  const generate = () => {
    const sep = ';';
    const csv = [cols.map((c) => c.label).join(sep), ...rows.map((r) => cols.map((c) => `"${c.get(r).replace(/"/g, '""')}"`).join(sep))].join('\n');
    if (fmt === 'CSV') try {
      const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.csv` });
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { /* download indisponível no visualizador */ }
    log({ module: 'admin', recordId: `export-${module}`, recordLabel: `Exportação ${name}`, action: `Exportação ${fmt} · ${rows.length} registros · ${cols.length} campos` });
    toast(<>Arquivo <b>{name}.{fmt.toLowerCase()}</b> gerado com {rows.length} registros{fmt === 'CSV' ? '' : ' (simulação)'}. A exportação foi registrada no histórico.</>);
    setOpen(false);
  };
  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(true)}><Download size={17} />Exportar</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Exportar lista" size="wide" icon={<FileSpreadsheet size={22} style={{ marginTop: 4 }} />}
        desc={`${rows.length} registros com os filtros atuais · campos e formatos definidos pela Gerência`}
        footer={<><button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={generate}><Download size={16} />Gerar arquivo</button></>}>
        <div className="stack">
          <div className="seg" role="group" aria-label="Formato" style={{ width: 'auto', alignSelf: 'flex-start' }}>
            {cfg.formats.map((f) => <button key={f} aria-pressed={fmt === f} onClick={() => setFmt(f)} style={{ padding: '7px 18px' }}>{f}</button>)}
          </div>
          <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
            <table className="tbl" style={{ fontSize: 12.5 }}>
              <thead><tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>{rows.slice(0, 4).map((r, i) => <tr key={i} style={{ cursor: 'default' }}>{cols.map((c) => <td key={c.key} style={{ whiteSpace: 'nowrap' }}>{c.get(r)}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {rows.length > 4 && <p className="xs muted">Prévia das 4 primeiras linhas de {rows.length}.</p>}
          <div className="banner banner-info"><ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span className="b-text">Todos os registros são preservados. A exportação é uma cópia e fica registrada no histórico administrativo{cfg.includeHistory ? '; inclui o histórico de cada registro' : ''}.</span></div>
        </div>
      </Dialog>
    </>
  );
}
