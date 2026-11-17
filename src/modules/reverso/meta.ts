import type { BrandId, ReversoStatus } from '@/platform/types';
import type { Tone } from '@/ui/core';

export const RV_STATUS: Record<ReversoStatus, { label: string; tone: Tone }> = {
  aguardando_aprovacao: { label: 'Aguardando aprovação', tone: 'warn' },
  ajuste: { label: 'Devolvida para ajuste', tone: 'danger' },
  aguardando_expedicao: { label: 'Aguardando expedição', tone: 'accent' },
  em_transito: { label: 'Em trânsito', tone: 'info' },
  concluido: { label: 'Concluída', tone: 'ok' },
};

export const MOTIVOS = ['Mercadoria errada', 'Defeito', 'Troca de tamanho', 'Arrependimento', 'Outro'] as const;
/** Motivos que exigem justificativa */
export const MOTIVO_EXIGE_JUST = new Set(['Mercadoria errada', 'Defeito', 'Outro']);
export const SETORES = ['Comercial', 'Atendimento', 'Expedição', 'Financeiro', 'Marketing'];

/** Base local que representa a consulta ao cadastro de clientes (dados fictícios). */
export const CLIENTES: { codigo: string; companyId: BrandId; nome: string; endereco: string }[] = [
  { codigo: 'C-20871', companyId: 'alinare', nome: 'Joalheria Bela Vista Ltda.', endereco: 'Rua das Acácias, 210 · Centro · Campinas/SP · 13010-120' },
  { codigo: 'C-19034', companyId: 'alinare', nome: 'Ouro Fino Presentes ME', endereco: 'Av. Brasil, 1450 · Jardim América · Ribeirão Preto/SP · 14020-260' },
  { codigo: 'C-21455', companyId: 'alinare', nome: 'Atelier Dourado Joias', endereco: 'Rua Oscar Freire, 512 · Jardins · São Paulo/SP · 01426-000' },
  { codigo: 'C-22010', companyId: 'alinare', nome: 'Reluz Joias e Relógios', endereco: 'Rua Marechal Deodoro, 455 · Centro · Florianópolis/SC · 88010-020' },
  { codigo: 'N-08812', companyId: 'novitah', nome: 'Bijoux Terra Boutique', endereco: 'Rua Padre Chagas, 77 · Moinhos de Vento · Porto Alegre/RS · 90570-080' },
  { codigo: 'N-07740', companyId: 'novitah', nome: 'Nude Store Multimarcas', endereco: 'Av. Sete de Setembro, 1200 · Vitória · Salvador/BA · 40080-001' },
  { codigo: 'N-09215', companyId: 'novitah', nome: 'Mimo Acessórios', endereco: 'Rua da Aurora, 320 · Boa Vista · Recife/PE · 50050-000' },
];
