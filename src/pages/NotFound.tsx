import { Link } from 'react-router-dom';
import { Compass, Lock, Wrench } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { COMPANIES } from '@/ui/brand';

function Block({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="card" style={{ maxWidth: 640, margin: '48px auto' }}>
      <div className="state">
        <div className="state-icon">{icon}</div>
        <h3 style={{ fontSize: 20 }}>{title}</h3>
        <p>{text}</p>
        <div className="row-wrap" style={{ justifyContent: 'center', marginTop: 8 }}>{children}</div>
      </div>
    </div>
  );
}

export function NotFoundInline({ what, back }: { what: string; back: string }) {
  const { company } = useDemo();
  return (
    <Block icon={<Compass size={24} />} title={`Não encontramos este ${what}`}
      text={<>O endereço pode estar incorreto, o registro pode ter sido removido ou pertencer a outro ambiente. Ambiente ativo: <b>{COMPANIES[company].name}</b>.</>}>
      <Link to={back} className="btn btn-primary">Voltar para a lista</Link>
      <Link to="/inicio" className="btn btn-secondary">Ir para o Início</Link>
    </Block>
  );
}

export function ForbiddenInline({ module }: { module?: string }) {
  return (
    <Block icon={<Lock size={24} />} title="Você não tem acesso a esta área"
      text={<>Seu perfil não inclui {module ? <b>{module}</b> : 'esta ação'} neste ambiente. Seu líder pode solicitar o acesso; a TI (<b>Elisa Moura</b>) aplica a alteração.</>}>
      <Link to="/inicio" className="btn btn-primary">Ir para o Início</Link>
    </Block>
  );
}

export function ModuleUnavailable({ name, reason }: { name: string; reason: 'manutencao' | 'nao_instalado' }) {
  return reason === 'manutencao' ? (
    <Block icon={<Wrench size={24} />} title={`${name} está em manutenção`}
      text="Estamos atualizando este módulo. Seus registros estão preservados e as demais áreas da plataforma continuam disponíveis.">
      <Link to="/inicio" className="btn btn-primary">Ir para o Início</Link>
    </Block>
  ) : (
    <Block icon={<Compass size={24} />} title={`${name} não está disponível neste ambiente`}
      text="O módulo não está habilitado neste ambiente. Troque de ambiente no cabeçalho ou volte para uma área disponível.">
      <Link to="/inicio" className="btn btn-primary">Ir para o Início</Link>
    </Block>
  );
}

export default function NotFoundPage() {
  return (
    <Block icon={<Compass size={24} />} title="Página não encontrada" text="O endereço acessado não corresponde a nenhuma tela da plataforma.">
      <Link to="/inicio" className="btn btn-primary">Ir para o Início</Link>
    </Block>
  );
}
