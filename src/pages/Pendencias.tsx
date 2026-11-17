import { PageHeader } from '@/ui/core';
import { WorkList, WorkSourceNotices } from '@/ui/work';

export default function Pendencias() {
  return (
    <>
      <PageHeader crumbs={[{ label: 'Início', to: '/inicio' }, { label: 'Meu trabalho' }]} title="Meu trabalho"
        sub="Chamados, tarefas e pendências contribuídos pelos plugins e sistemas que você acessa neste ambiente. Filtre por origem e situação; cada fila abre a lista correspondente." />
      <section className="card">
        <WorkSourceNotices />
        <WorkList />
      </section>
    </>
  );
}
