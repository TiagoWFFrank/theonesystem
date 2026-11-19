import type { SupabaseClient } from '@supabase/supabase-js';
import type { BrandId } from './types';

export type LiveModuleId = 'inventario' | 'viagens' | 'reverso';
export type SourceFailureKind = 'not_configured' | 'no_session' | 'denied' | 'unavailable';

export class ModuleSourceError extends Error {
  constructor(readonly kind: SourceFailureKind, message: string) {
    super(message);
    this.name = 'ModuleSourceError';
  }
}

export interface SourceDocument {
  id?: string;
  nome?: string;
  label?: string;
  url?: string;
  bucket?: string;
  path?: string;
}

declare global {
  interface Window {
    horizonAuth?: {
      getAccessToken?: () => Promise<string | null>;
      getPluginAccessToken?: () => Promise<string | null>;
    };
  }
}

interface SourceSpec {
  url: string;
  publishableKey: string;
  view: string;
  columns: string;
  searchColumn: string;
}

const sourceSpecs: Record<LiveModuleId, SourceSpec> = {
  inventario: {
    url: import.meta.env.VITE_SUPABASE_INVENTARIO_URL ?? '',
    publishableKey: import.meta.env.VITE_SUPABASE_INVENTARIO_PUBLISHABLE_KEY ?? '',
    view: import.meta.env.VITE_INVENTARIO_READ_VIEW || 'horizon_inventory_read',
    columns: 'id,company_id,patrimonio,descricao,tipo,modelo,serie,situacao,responsavel_nome,responsavel_email,localizacao,aquisicao,ultima_movimentacao,movimentacoes,documentos,updated_at',
    searchColumn: 'patrimonio',
  },
  viagens: {
    url: import.meta.env.VITE_SUPABASE_VIAGENS_URL ?? '',
    publishableKey: import.meta.env.VITE_SUPABASE_VIAGENS_PUBLISHABLE_KEY ?? '',
    view: import.meta.env.VITE_VIAGENS_READ_VIEW || 'horizon_travel_read',
    columns: 'id,company_id,codigo,situacao,viajante_nome,viajante_email,destino,motivo,inicio,fim,trechos,documentos,updated_at',
    searchColumn: 'codigo',
  },
  reverso: {
    url: import.meta.env.VITE_SUPABASE_REVERSO_URL ?? '',
    publishableKey: import.meta.env.VITE_SUPABASE_REVERSO_PUBLISHABLE_KEY ?? '',
    view: import.meta.env.VITE_REVERSO_READ_VIEW || 'horizon_reverse_read',
    columns: 'id,company_id,numero,situacao,solicitante_nome,solicitante_email,cliente_codigo,cliente_nome,motivo,aberto_em,historico,rastreio,documentos,updated_at',
    searchColumn: 'numero',
  },
};

const clients: Partial<Record<LiveModuleId, SupabaseClient>> = {};

async function currentAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.horizonAuth?.getAccessToken) return null;
  try {
    return await window.horizonAuth.getAccessToken();
  } catch {
    return null;
  }
}

async function clientFor(module: LiveModuleId): Promise<{ client: SupabaseClient; spec: SourceSpec }> {
  const spec = sourceSpecs[module];
  if (!spec.url || !spec.publishableKey) {
    throw new ModuleSourceError('not_configured', 'A conexão Supabase deste módulo ainda não foi configurada.');
  }
  if (!await currentAccessToken()) {
    throw new ModuleSourceError('no_session', 'A sessão atual é demonstrativa e não fornece um token autorizado para a fonte.');
  }
  let client = clients[module];
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(spec.url, spec.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      accessToken: currentAccessToken,
    });
    clients[module] = client;
  }
  return { client, spec };
}

function sourceError(error: unknown): ModuleSourceError {
  const detail = error as { code?: string; message?: string; status?: number };
  const code = (detail?.code ?? '').toLowerCase();
  const message = (detail?.message ?? '').toLowerCase();
  if (detail?.status === 401 || detail?.status === 403 || code === '42501' || /permission denied|not authorized|unauthorized|row-level security/.test(message)) {
    return new ModuleSourceError('denied', 'A fonte negou a consulta para esta conta ou ambiente.');
  }
  return new ModuleSourceError('unavailable', 'A consulta não foi concluída. A fonte, a view de leitura ou a conexão está indisponível.');
}

export async function listSourceRecords<T extends Record<string, unknown>>(
  module: LiveModuleId,
  company: BrandId,
  search = '',
): Promise<T[]> {
  const { client, spec } = await clientFor(module);
  const normalized = search.trim().replace(/[%_*(),]/g, '').slice(0, 80);
  const base = () => client.from(spec.view).select(spec.columns).eq('company_id', company);
  try {
    const result = normalized
      ? await base().ilike(spec.searchColumn, '%' + normalized + '%').order('updated_at', { ascending: false }).limit(200)
      : await base().order('updated_at', { ascending: false }).limit(200);
    if (result.error) throw result.error;
    return (result.data ?? []) as unknown as T[];
  } catch (error) {
    throw sourceError(error);
  }
}

export async function readSourceRecord<T extends Record<string, unknown>>(
  module: LiveModuleId,
  company: BrandId,
  id: string,
): Promise<T | null> {
  const { client, spec } = await clientFor(module);
  try {
    const result = await client.from(spec.view).select(spec.columns).eq('company_id', company).eq('id', id).limit(1);
    if (result.error) throw result.error;
    const row = (result.data ?? [])[0];
    return row ? row as unknown as T : null;
  } catch (error) {
    throw sourceError(error);
  }
}

export async function sourceDocumentUrl(module: LiveModuleId, document: SourceDocument): Promise<string | null> {
  if (document.url) {
    try {
      return new URL(document.url).protocol === 'https:' ? document.url : null;
    } catch {
      return null;
    }
  }
  if (!document.bucket || !document.path) return null;
  const { client } = await clientFor(module);
  try {
    const result = await client.storage.from(document.bucket).createSignedUrl(document.path, 60);
    if (result.error) throw result.error;
    return result.data?.signedUrl ?? null;
  } catch (error) {
    throw sourceError(error);
  }
}
