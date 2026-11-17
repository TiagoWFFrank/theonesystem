import { PageHeader } from '@/ui/core';
import { WorkList } from '@/ui/work';
import { SourceNotice } from '@/ui/source';

export default function Pendencias() {
  return (
    <>
      <PageHeader crumbs={[{ label: 'Início', to: '/inicio' }, { label: 'Meu trabalho' }]} title="Meu trabalho"
        sub="Chamados, tarefas e pendências contribuídos pelos plugins e sistemas que você acessa neste ambiente. Filtre por origem e situação; cada fila abre a lista correspondente." />
      <section className="card">
        <SourceNotice id="chamados" label="O sistema de Chamados" cachedNote="Chamados e tarefas vêm do cache" />
        <WorkList />
      </section>
    </>
  );
}
