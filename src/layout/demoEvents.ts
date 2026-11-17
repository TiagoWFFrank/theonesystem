// Eventos SIMULADOS de outras pessoas, disparados pelo painel do apresentador para demonstrar
// a revalidação (permissão retirada, situação alterada, regra de exportação alterada após aprovação).
// Arquivo exclusivo da demonstração: pode conhecer detalhes dos plugins.
import { chStore } from '@/modules/chamados/model';
import { uid } from '@/platform/format';
import type { DemoData, Grant, HistoryEvent } from '@/platform/types';

const ev = (d: DemoData, e: Omit<HistoryEvent, 'id' | 'ts'>) => d.events.push({ id: uid('ev'), ts: new Date().toISOString(), ...e });

let savedDiego: Grant | undefined;

export interface DemoEvent { id: string; label: string; on: (d: DemoData) => boolean; apply: (d: DemoData, on: boolean) => void; hint: string }

export const DEMO_EVENTS: DemoEvent[] = [
  {
    id: 'ana-atender', label: 'Ana pode “Atender” em Chamados (AZIME)', hint: 'TI concede/retira a ação; aplicada imediatamente',
    on: (d) => !!d.users.find((u) => u.id === 'u1')?.grants?.azime?.chamados?.actions.includes('atender'),
    apply: (d, on) => {
      const g = d.users.find((u) => u.id === 'u1')!.grants!.azime!.chamados!;
      g.actions = on ? Array.from(new Set([...g.actions, 'atender'])) : g.actions.filter((a) => a !== 'atender');
      ev(d, { companyId: 'azime', module: 'admin', recordId: 'u1', recordLabel: 'Ana Ribeiro', actorId: 'u5', kind: 'acesso', action: `${on ? 'Concedida' : 'Retirada'} a ação Atender em Chamados (AZIME)` });
    },
  },
  {
    id: 'tf311-afazer', label: 'TF-311 em andamento (desmarque: Bruno devolve para A fazer)', hint: 'Mudança de situação feita por outra pessoa no sistema de origem',
    on: (d) => chStore(d).tarefas.find((t) => t.id === 't1')?.status === 'em_andamento',
    apply: (d, on) => {
      const t = chStore(d).tarefas.find((x) => x.id === 't1')!;
      t.status = on ? 'em_andamento' : 'a_fazer'; t.atualizadoEm = new Date().toISOString();
      ev(d, { companyId: 'azime', module: 'chamados', recordId: 't1', recordLabel: 'TF-311', actorId: 'u2', kind: 'tarefa', action: on ? 'Tarefa retomada' : 'Tarefa voltou para A fazer (alterada por Bruno no sistema de Chamados)' });
    },
  },
  {
    id: 'rev-cliente', label: 'Regra de Reverso inclui o campo Cliente', hint: 'Gerência altera a regra depois de uma aprovação',
    on: (d) => !!d.exportConfig.reverso?.fields.includes('cliente'),
    apply: (d, on) => {
      const c = d.exportConfig.reverso!;
      c.fields = on ? [...c.fields.filter((f) => f !== 'cliente'), 'cliente'].sort((a, b) => ['numero', 'motivo', 'cliente', 'situacao', 'abertura'].indexOf(a) - ['numero', 'motivo', 'cliente', 'situacao', 'abertura'].indexOf(b)) : c.fields.filter((f) => f !== 'cliente');
      c.versao = (c.versao ?? 1) + 1; c.atualizadoEm = new Date().toISOString(); c.atualizadoPor = 'u6';
      ev(d, { companyId: 'alinare', module: 'admin', recordId: 'export-cfg-reverso', recordLabel: 'Exportação Reverso', actorId: 'u6', kind: 'exportacao', action: `Regra de exportação de Reverso v${c.versao}: campo Cliente ${on ? 'incluído' : 'retirado'}` });
    },
  },
  {
    id: 'diego-reverso', label: 'Diego tem acesso ao Reverso (Alinare)', hint: 'TI retira/devolve o acesso ao módulo',
    on: (d) => !!d.users.find((u) => u.id === 'u4')?.grants?.alinare?.reverso?.actions.length,
    apply: (d, on) => {
      const u = d.users.find((x) => x.id === 'u4')!;
      u.grants ??= {}; u.grants.alinare ??= {};
      if (on) u.grants.alinare.reverso = savedDiego ?? { actions: ['ver', 'expedir'], scope: 'empresa' };
      else { savedDiego = u.grants.alinare.reverso; delete u.grants.alinare.reverso; }
      ev(d, { companyId: 'alinare', module: 'admin', recordId: 'u4', recordLabel: 'Diego Santos', actorId: 'u5', kind: 'acesso', action: `${on ? 'Concedido' : 'Retirado'} o acesso de Diego ao Reverso (Alinare)` });
    },
  },
];
