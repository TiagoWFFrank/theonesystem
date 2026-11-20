type Row = { id: string; title: string; status: string };
type StateSetter<T> = (value: T | ((current: T) => T)) => void;
type ReactApi = {
  createElement: (type: string, props: Record<string, unknown> | null, ...children: unknown[]) => unknown;
  useState: <T>(initial: T) => [T, StateSetter<T>];
  useEffect: (effect: () => () => void, dependencies: unknown[]) => void;
};
type Context = { brandId: string; userId: string; operation(id: string, inputs?: Record<string, string>): Promise<unknown> };

// Compiled as a standalone module; React and the authorized API come from the host.
export default function DemoPage({ react, context }: { react: ReactApi; context: Context }) {
  const { createElement: h, useEffect, useState } = react;
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    context.operation('listar-registros').then((value) => {
      if (live) setRows(Array.isArray(value) ? value as Row[] : []);
    }).catch((reason: Error) => { if (live) setError(reason.message); });
    return () => { live = false; };
  }, [context.brandId, context.userId]);
  const changeStatus = async (row: Row) => {
    setSaving(true); setError('');
    try {
      const updated = await context.operation('alterar-status', { id: row.id, status: row.status === 'Concluído' ? 'Em análise' : 'Concluído' }) as Row;
      setRows((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao alterar o status.'); }
    finally { setSaving(false); }
  };
  return h('section', { className: 'stack', 'data-plugin-react': 'demo' },
    h('header', null, h('h1', null, 'Página React do Plugin Demo'),
      h('p', { className: 'muted' }, `Conteúdo fornecido pelo plugin para o ambiente ${context.brandId}.`)),
    h('div', { className: 'banner banner-info' }, 'Dados fictícios consultados pela operação autorizada do plugin.'),
    error ? h('div', { className: 'banner banner-danger', role: 'alert' }, error) : null,
    h('div', { className: 'card card-pad' }, h('h2', null, 'Registros'),
      h('ul', null, rows.map((row) => h('li', { key: row.id }, `${row.id} · ${row.title} · ${row.status} `,
        h('button', { type: 'button', className: 'btn btn-secondary btn-xs', disabled: saving, onClick: () => changeStatus(row), 'aria-label': `Alterar status ${row.id}` }, 'Alterar status'))))));
}
