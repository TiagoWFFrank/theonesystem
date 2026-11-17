// Serviço de exportação do núcleo. O PLUGIN fornece campos e linhas (ExportProvider);
// o núcleo aplica a regra da Gerência, registra o conteúdo exato, revalida no download e gera o arquivo.
import type { BrandId, ContribCtx, DemoData, ExportConfig, ExportContent, ExportFormat, ExportProvider, ExportRequest, ModuleId, User } from './types';

/** Impressão digital estável do conteúdo (ambiente, módulo, registros, campos, formato, histórico). */
export function hashContent(c: Pick<ExportContent, 'companyId' | 'module' | 'recordIds' | 'fields' | 'formato' | 'includeHistory'>): string {
  const canon = JSON.stringify([c.companyId, c.module, [...c.recordIds].sort(), c.fields.map((f) => f.key), c.formato, c.includeHistory]);
  let h = 0x811c9dc5; // FNV-1a 32 bits
  for (let i = 0; i < canon.length; i++) { h ^= canon.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const configVersion = (cfg?: ExportConfig) => cfg?.versao ?? 1;

/** Direito de exportar segundo a regra ATUAL. Gerência sempre exporta direto. */
export function exportRight(d: DemoData, me: User | undefined, module: ModuleId, isManager: boolean): 'direto' | 'solicitar' | null {
  const cfg = d.exportConfig[module];
  if (!me || !cfg?.enabled) return null;
  if (isManager) return 'direto';
  if (!me.roles.some((r) => cfg.roles.includes(r))) return null;
  return cfg.mode === 'permanente' ? 'direto' : 'solicitar';
}

/** Diferenças entre um conteúdo e o que a regra atual permite (vazio = permitido). */
export function ruleGaps(cfg: ExportConfig | undefined, content: ExportContent, requester: User | undefined, requesterIsManager: boolean, fieldLabel: (k: string) => string): string[] {
  if (!cfg?.enabled) return ['a exportação deste módulo foi desativada'];
  const out: string[] = [];
  if (!requesterIsManager && !requester?.roles.some((r) => cfg.roles.includes(r))) out.push('o cargo do solicitante não está mais autorizado');
  if (!cfg.formats.includes(content.formato)) out.push(`o formato ${content.formato} não é mais permitido`);
  const gone = content.fields.filter((f) => !cfg.fields.includes(f.key));
  if (gone.length) out.push(`${gone.length === 1 ? 'o campo' : 'os campos'} ${gone.map((f) => fieldLabel(f.key) || f.label).join(', ')} ${gone.length === 1 ? 'foi retirado' : 'foram retirados'} da regra`);
  if (content.includeHistory && !cfg.includeHistory) out.push('o histórico dos registros não é mais incluído');
  return out;
}

export interface BuiltFile { ok: true; csv: string; rows: number; cols: number; bytes: number; hash: string }
/**
 * Monta o arquivo a partir das linhas que a pessoa pode ver AGORA e confere a correspondência com o conteúdo
 * autorizado: mesmos registros, mesmos campos na mesma ordem. Qualquer divergência impede a geração.
 */
export function buildFile(c: ContribCtx, p: ExportProvider, content: ExportContent): BuiltFile | { ok: false; detail: string } {
  const rows = p.rows(c, content.recordIds);
  const got = new Set(rows.map((r) => r.id));
  const missing = content.recordIds.filter((id) => !got.has(id));
  if (missing.length) return { ok: false, detail: `${missing.length} de ${content.recordIds.length} registros não estão mais acessíveis para você neste ambiente` };
  const order = new Map(content.recordIds.map((id, i) => [id, i]));
  rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const unknown = content.fields.filter((f) => !p.fields.some((x) => x.key === f.key));
  if (unknown.length) return { ok: false, detail: `campos sem correspondência no plugin: ${unknown.map((f) => f.label).join(', ')}` };
  const header = [...content.fields.map((f) => f.label), ...(content.includeHistory ? ['Histórico'] : [])];
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [...content.fields.map((f) => q(r.values[f.key] ?? '')), ...(content.includeHistory ? [q(p.history?.(c, r.id) ?? '')] : [])].join(';'));
  const csv = [header.map(q).join(';'), ...lines].join('\n');
  const check = hashContent({ ...content, recordIds: rows.map((r) => r.id) });
  if (rows.length !== content.recordIds.length || check !== hashContent(content)) return { ok: false, detail: 'o conteúdo montado não corresponde ao autorizado' };
  return { ok: true, csv, rows: rows.length, cols: header.length, bytes: new Blob(['﻿' + csv]).size, hash: check };
}

/** Formatos com gerador nesta versão. XLSX e PDF são conferidos, mas o arquivo não é produzido (simulação). */
export const REAL_FORMATS: ExportFormat[] = ['CSV'];

/** Entrega o CSV ao navegador. Devolve false se o navegador não permitir. */
export function deliverCsv(csv: string, fileName: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    Object.assign(document.createElement('a'), { href: url, download: `${fileName}.csv` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

export const requestFileName = (x: ExportRequest) => `${x.numero.toLowerCase()}-${x.module}-${x.companyId as BrandId}`;
