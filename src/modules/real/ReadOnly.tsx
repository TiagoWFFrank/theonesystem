import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, CircleAlert, Database, FileText, LockKeyhole, LoaderCircle, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { fmtDate, fmtDateTime } from '@/platform/format';
import { listSourceRecords, ModuleSourceError, readSourceRecord, sourceDocumentUrl, type LiveModuleId, type SourceDocument } from '@/platform/moduleSources';
import { COMPANIES } from '@/ui/brand';
import { Badge, EmptyState, KV, PageHeader, Tabs, type Tone } from '@/ui/core';
import { useDemo } from '@/platform/store';

type LiveRecord = Record<string, unknown>;
type DetailTab = 'resumo' | 'eventos' | 'documentos';

const moduleInfo: Record<LiveModuleId, { name: string; base: string; search: string; empty: string; timeline: string; code: string }> = {
  inventario: {
    name: 'Inventário',
    base: '/inventario/consulta',
    search: 'Buscar pelo número de patrimônio',
    empty: 'Nenhum patrimônio autorizado foi encontrado neste ambiente.',
    timeline: 'Movimentações',
    code: 'patrimonio',
  },
  viagens: {
    name: 'Viagens',
    base: '/viagens/consulta',
    search: 'Buscar pelo código da viagem',
    empty: 'Nenhuma viagem autorizada foi encontrada neste ambiente.',
    timeline: 'Trechos',
    code: 'codigo',
  },
  reverso: {
    name: 'Reverso',
    base: '/reverso/consulta',
    search: 'Buscar pelo número da solicitação',
    empty: 'Nenhuma solicitação autorizada foi encontrada neste ambiente.',
    timeline: 'Histórico e rastreio',
    code: 'numero',
  },
};

function stringValue(record: LiveRecord, key: string): string {
  const value = record[key];
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

function displayDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—';
  return fmtDate(value);
}

function objectRows(value: unknown): LiveRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is LiveRecord => !!item && typeof item === 'object' && !Array.isArray(item));
}

function statusTone(status: string): Tone {
  const value = status.toLowerCase();
  if (/conclu|emitid|dispon|entreg|recebid|aprovad/.test(value)) return 'ok';
  if (/ajuste|cancel|negad|falh|bloque/.test(value)) return 'danger';
  if (/aguard|penden|transit|manuten|revis/.test(value)) return 'warn';
  if (/uso|andamento|abert/.test(value)) return 'info';
  return 'neutral';
}

function humanize(value: string): string {
  if (!value) return 'Não informado';
  return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').replace(/^./, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

function SourceFailure({ error, retry }: { error: ModuleSourceError; retry: () => void }) {
  const access = error.kind === 'denied' || error.kind === 'no_session';
  const Icon = access ? LockKeyhole : CircleAlert;
  const title = error.kind === 'not_configured' ? 'Integração indisponível' : error.kind === 'no_session' ? 'Acesso não validado' : error.kind === 'denied' ? 'Acesso negado' : 'Fonte indisponível';
  return (
    <div className="card" role="status">
      <div className="state">
        <div className="state-icon"><Icon size={23} /></div>
        <h2 style={{ fontSize: 20 }}>{title}</h2>
        <p>{error.message}</p>
        <p className="xs muted">Nenhum dado demonstrativo foi usado nesta consulta.</p>
        <button className="btn btn-secondary" onClick={retry}><RefreshCw size={15} />Tentar novamente</button>
      </div>
    </div>
  );
}

function LoadingState({ module }: { module: string }) {
  return (
    <div className="card" role="status">
      <div className="state"><div className="state-icon"><LoaderCircle size={23} className="spin" /></div><h2 style={{ fontSize: 20 }}>Consultando {module}</h2><p>Aguardando resposta da fonte autorizada.</p></div>
    </div>
  );
}

function SourceEyebrow({ module, company }: { module: string; company: string }) {
  return (
    <div className="row-wrap" style={{ gap: 8, marginBottom: 8 }}>
      <Badge tone="ok"><Database size={13} />Consulta real · somente leitura</Badge>
      <span className="xs muted">Fonte: {module} · ambiente {company}</span>
    </div>
  );
}

function listColumns(module: LiveModuleId): { label: string; field: string; mono?: boolean }[] {
  if (module === 'inventario') return [
    { label: 'Patrimônio', field: 'patrimonio', mono: true },
    { label: 'Equipamento', field: 'descricao' },
    { label: 'Responsável', field: 'responsavel_nome' },
    { label: 'Localização', field: 'localizacao' },
    { label: 'Situação', field: 'situacao' },
    { label: 'Última movimentação', field: 'ultima_movimentacao' },
  ];
  if (module === 'viagens') return [
    { label: 'Código', field: 'codigo', mono: true },
    { label: 'Destino', field: 'destino' },
    { label: 'Viajante', field: 'viajante_nome' },
    { label: 'Situação', field: 'situacao' },
    { label: 'Embarque', field: 'inicio' },
    { label: 'Retorno', field: 'fim' },
  ];
  return [
    { label: 'Número', field: 'numero', mono: true },
    { label: 'Cliente', field: 'cliente_nome' },
    { label: 'Solicitante', field: 'solicitante_nome' },
    { label: 'Motivo', field: 'motivo' },
    { label: 'Situação', field: 'situacao' },
    { label: 'Abertura', field: 'aberto_em' },
  ];
}

function cellValue(record: LiveRecord, field: string): string {
  const value = stringValue(record, field);
  if (/^(inicio|fim|ultima_movimentacao|aberto_em)$/.test(field)) return displayDate(value);
  return humanize(value);
}

export function LiveModuleList({ module }: { module: LiveModuleId }) {
  const { company } = useDemo();
  const info = moduleInfo[module];
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const [draft, setDraft] = useState(search);
  const [records, setRecords] = useState<LiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ModuleSourceError | null>(null);
  const request = useRef(0);
  useEffect(() => setDraft(search), [search]);

  const refresh = useCallback(async () => {
    const sequence = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await listSourceRecords<LiveRecord>(module, company, search);
      if (request.current === sequence) setRecords(rows);
    } catch (reason) {
      if (request.current === sequence) {
        setRecords([]);
        setError(reason instanceof ModuleSourceError ? reason : new ModuleSourceError('unavailable', 'A consulta à fonte não foi concluída.'));
      }
    } finally {
      if (request.current === sequence) setLoading(false);
    }
  }, [company, module, search]);

  useEffect(() => {
    void refresh();
    return () => { request.current += 1; };
  }, [refresh]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    setParams(value ? { q: value } : {});
  };

  const open = (record: LiveRecord) => info.base + '/' + encodeURIComponent(stringValue(record, 'id'));
  const columns = listColumns(module);

  return (
    <>
      <PageHeader
        crumbs={[{ label: info.name }, { label: 'Consulta' }]}
        title={info.name}
        eyebrow={<SourceEyebrow module={info.name} company={COMPANIES[company].name} />}
        sub="Consulta somente leitura da fonte do domínio. O ambiente ativo limita os registros retornados."
        actions={<button className="btn btn-secondary" onClick={() => void refresh()}><RefreshCw size={15} />Atualizar</button>}
      />
      <div className="card">
        <form className="list-tools" onSubmit={submitSearch}>
          <div className="tools-row">
            <div className="input-icon">
              <Search size={17} />
              <input className="input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={info.search} aria-label={info.search} />
            </div>
            <button className="btn btn-primary" type="submit">Buscar</button>
            {search && <button className="btn btn-ghost" type="button" onClick={() => { setDraft(''); setParams({}); }}>Limpar</button>}
          </div>
        </form>
      </div>
      <div style={{ marginTop: 16 }}>
        {loading ? <LoadingState module={info.name} /> : error ? <SourceFailure error={error} retry={() => void refresh()} /> : records.length === 0 ? (
          <div className="card"><EmptyState icon={<ShieldAlert size={22} />} title={info.empty} text="A lista contém somente os resultados que a fonte autorizou para a conta e o ambiente ativos." /></div>
        ) : (
          <div className="card">
            <div className="table-wrap responsive">
              <table className="tbl">
                <thead><tr>{columns.map((column) => <th key={column.field}>{column.label}</th>)}<th><span className="sr-only">Abrir registro</span></th></tr></thead>
                <tbody>
                  {records.map((record) => {
                    const status = stringValue(record, 'situacao');
                    return (
                      <tr key={stringValue(record, 'id')}>
                        {columns.map((column) => (
                          <td key={column.field} className={column.mono ? 'id-cell mono' : undefined}>
                            {column.field === 'situacao' ? <Badge tone={statusTone(status)}>{humanize(status)}</Badge> : cellValue(record, column.field)}
                          </td>
                        ))}
                        <td className="row-action"><Link className="btn btn-ghost btn-xs" to={open(record)} aria-label={'Abrir ' + stringValue(record, info.code)}>Consultar</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="card-foot xs muted">{records.length} registro(s) retornado(s) pela fonte, limitado(s) a 200 por consulta.</div>
          </div>
        )}
      </div>
    </>
  );
}

function summaryItems(module: LiveModuleId, record: LiveRecord): [string, string][] {
  const fields: Record<LiveModuleId, [string, string][]> = {
    inventario: [
      ['Patrimônio', 'patrimonio'], ['Equipamento', 'descricao'], ['Tipo', 'tipo'], ['Modelo', 'modelo'], ['Número de série', 'serie'],
      ['Situação', 'situacao'], ['Responsável', 'responsavel_nome'], ['E-mail do responsável', 'responsavel_email'], ['Localização', 'localizacao'],
      ['Aquisição', 'aquisicao'], ['Última movimentação', 'ultima_movimentacao'],
    ],
    viagens: [
      ['Código', 'codigo'], ['Situação', 'situacao'], ['Viajante', 'viajante_nome'], ['E-mail do viajante', 'viajante_email'],
      ['Destino', 'destino'], ['Motivo', 'motivo'], ['Início', 'inicio'], ['Retorno', 'fim'],
    ],
    reverso: [
      ['Número', 'numero'], ['Situação', 'situacao'], ['Solicitante', 'solicitante_nome'], ['E-mail do solicitante', 'solicitante_email'],
      ['Cliente', 'cliente_nome'], ['Código do cliente', 'cliente_codigo'], ['Motivo', 'motivo'], ['Abertura', 'aberto_em'], ['Rastreio', 'rastreio'],
    ],
  };
  return fields[module].map(([label, field]) => [label, /^(aquisicao|inicio|fim|ultima_movimentacao|aberto_em)$/.test(field) ? displayDate(record[field]) : humanize(stringValue(record, field))]);
}

function eventRows(module: LiveModuleId, record: LiveRecord): LiveRecord[] {
  const key = module === 'inventario' ? 'movimentacoes' : module === 'viagens' ? 'trechos' : 'historico';
  return objectRows(record[key]);
}

function eventText(module: LiveModuleId, item: LiveRecord): string {
  if (module === 'viagens') {
    const from = stringValue(item, 'origem');
    const to = stringValue(item, 'destino');
    const route = from || to ? (from || '—') + ' → ' + (to || '—') : '';
    return [stringValue(item, 'tipo'), stringValue(item, 'cia') || stringValue(item, 'transportadora'), stringValue(item, 'voo') || stringValue(item, 'numero_voo'), route].filter(Boolean).map(humanize).join(' · ');
  }
  return stringValue(item, 'acao') || stringValue(item, 'action') || stringValue(item, 'descricao') || stringValue(item, 'status') || 'Movimentação registrada pela origem';
}

function eventDate(item: LiveRecord): string {
  const date = stringValue(item, 'em') || stringValue(item, 'data') || stringValue(item, 'at') || stringValue(item, 'created_at');
  return date ? fmtDateTime(date) : 'Data não informada pela origem';
}

function eventMeta(item: LiveRecord): string {
  return [stringValue(item, 'responsavel'), stringValue(item, 'por'), stringValue(item, 'actor'), stringValue(item, 'local'), stringValue(item, 'detalhe')].filter(Boolean).map(humanize).join(' · ');
}

export function LiveModuleDetail({ module }: { module: LiveModuleId }) {
  const { company } = useDemo();
  const { id = '' } = useParams();
  const info = moduleInfo[module];
  const [record, setRecord] = useState<LiveRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ModuleSourceError | null>(null);
  const [tab, setTab] = useState<DetailTab>('resumo');
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [documentErrors, setDocumentErrors] = useState<Record<string, string>>({});
  const [busyDocument, setBusyDocument] = useState<string | null>(null);
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++request.current;
    setLoading(true);
    setError(null);
    setRecord(null);
    try {
      const row = await readSourceRecord<LiveRecord>(module, company, id);
      if (request.current === sequence) setRecord(row);
    } catch (reason) {
      if (request.current === sequence) setError(reason instanceof ModuleSourceError ? reason : new ModuleSourceError('unavailable', 'A consulta à fonte não foi concluída.'));
    } finally {
      if (request.current === sequence) setLoading(false);
    }
  }, [company, id, module]);

  useEffect(() => {
    void refresh();
    return () => { request.current += 1; };
  }, [refresh]);

  const documents = objectRows(record?.documentos) as SourceDocument[];
  const openDocument = async (document: SourceDocument, key: string) => {
    setBusyDocument(key);
    setDocumentErrors((current) => ({ ...current, [key]: '' }));
    try {
      const url = await sourceDocumentUrl(module, document);
      if (!url) throw new Error('A origem não forneceu um endereço seguro para este documento.');
      setDocumentUrls((current) => ({ ...current, [key]: url }));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Não foi possível abrir o documento autorizado.';
      setDocumentErrors((current) => ({ ...current, [key]: message }));
    } finally {
      setBusyDocument(null);
    }
  };

  const title = record ? stringValue(record, info.code) : id;
  const status = record ? stringValue(record, 'situacao') : '';
  const events = record ? eventRows(module, record) : [];
  const tabLabel = info.timeline;

  return (
    <>
      <PageHeader
        crumbs={[{ label: info.name, to: info.base }, { label: 'Consulta', to: info.base }, { label: title || 'Registro' }]}
        title={title || 'Registro'}
        eyebrow={<SourceEyebrow module={info.name} company={COMPANIES[company].name} />}
        sub="Ficha real somente leitura. A consulta é limitada pela identidade, pelas políticas da fonte e pelo ambiente ativo."
        actions={<><Link className="btn btn-secondary" to={info.base}><ArrowLeft size={16} />Voltar à lista</Link><button className="btn btn-ghost" onClick={() => void refresh()} aria-label="Atualizar ficha"><RefreshCw size={15} /></button></>}
      />
      {loading ? <LoadingState module={info.name} /> : error ? <SourceFailure error={error} retry={() => void refresh()} /> : !record ? (
        <div className="card"><EmptyState icon={<ShieldAlert size={22} />} title="Registro não encontrado" text="A fonte não retornou este registro para a conta e o ambiente ativos." /></div>
      ) : (
        <>
          <section className="card" style={{ marginBottom: 18 }}>
            <div className="hero">
              <span className="hero-ic"><Database size={25} /></span>
              <div style={{ minWidth: 0 }}>
                <div className="hero-id">{title}</div>
                <h2 className="hero-title">{stringValue(record, module === 'inventario' ? 'descricao' : module === 'viagens' ? 'destino' : 'cliente_nome') || info.name}</h2>
                <div className="row-wrap" style={{ gap: 9 }}><Badge tone={statusTone(status)}>{humanize(status)}</Badge><span className="xs muted">Registro da fonte · somente leitura</span></div>
              </div>
            </div>
          </section>
          <div className="card">
            <Tabs<DetailTab> value={tab} onChange={setTab} tabs={[
              { id: 'resumo', label: 'Resumo' },
              { id: 'eventos', label: tabLabel, count: events.length },
              { id: 'documentos', label: 'Documentos', count: documents.length },
            ]} />
            <div className="card-body">
              {tab === 'resumo' && <KV items={summaryItems(module, record)} />}
              {tab === 'eventos' && (events.length ? (
                <div className="stack">
                  {events.map((item, index) => (
                    <article className="card card-pad" key={stringValue(item, 'id') || String(index)}>
                      <div className="row-wrap" style={{ gap: 8 }}><span className="strong">{eventText(module, item)}</span><span className="spacer" /><span className="xs muted">{eventDate(item)}</span></div>
                      {eventMeta(item) && <p className="xs muted" style={{ marginTop: 6 }}>{eventMeta(item)}</p>}
                      {module === 'viagens' && (stringValue(item, 'localizador') || stringValue(item, 'localizador_reserva')) && <p className="xs muted" style={{ marginTop: 6 }}>Localizador: <span className="mono">{stringValue(item, 'localizador') || stringValue(item, 'localizador_reserva')}</span></p>}
                    </article>
                  ))}
                </div>
              ) : <p className="muted">A origem não retornou {tabLabel.toLocaleLowerCase('pt-BR')} para este registro.</p>)}
              {tab === 'documentos' && (documents.length ? (
                <div className="stack">
                  {documents.map((document, index) => {
                    const key = document.id || document.path || String(index);
                    const label = document.nome || document.label || 'Documento disponível na origem';
                    const url = documentUrls[key];
                    return (
                      <div className="row-wrap card card-pad" key={key} style={{ gap: 12 }}>
                        <FileText size={18} />
                        <div style={{ minWidth: 0, flex: 1 }}><div className="strong">{label}</div><div className="xs muted">Documento informado pela fonte do domínio.</div>{documentErrors[key] && <div className="xs" role="alert" style={{ color: 'var(--danger)' }}>{documentErrors[key]}</div>}</div>
                        {url ? <a className="btn btn-secondary btn-xs" href={url} target="_blank" rel="noreferrer"><ArrowUpRight size={14} />Abrir</a> : <button className="btn btn-secondary btn-xs" disabled={busyDocument === key} onClick={() => void openDocument(document, key)}>{busyDocument === key ? <LoaderCircle size={14} className="spin" /> : <ArrowUpRight size={14} />}Preparar acesso</button>}
                      </div>
                    );
                  })}
                </div>
              ) : <p className="muted">A origem não informou documentos disponíveis para este registro.</p>)}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export function InventoryLiveList() { return <LiveModuleList module="inventario" />; }
export function InventoryLiveDetail() { return <LiveModuleDetail module="inventario" />; }
export function TravelLiveList() { return <LiveModuleList module="viagens" />; }
export function TravelLiveDetail() { return <LiveModuleDetail module="viagens" />; }
export function ReverseLiveList() { return <LiveModuleList module="reverso" />; }
export function ReverseLiveDetail() { return <LiveModuleDetail module="reverso" />; }
