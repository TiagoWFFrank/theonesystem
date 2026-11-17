// Identidade das marcas. Arquivos oficiais em src/brands/<marca>/logo.svg e symbol.svg substituem
// automaticamente as assinaturas tipográficas PROVISÓRIAS abaixo.
import type { BrandId } from '@/platform/types';

export const COMPANIES: Record<BrandId, { name: string; legal: string; tagline: string; swatches: string[] }> = {
  azime: { name: 'AZIME', legal: 'AZIME Participações (exemplo)', tagline: 'Grupo e serviços corporativos', swatches: ['#0b0b0c', '#ffffff', '#3a3c42'] },
  alinare: { name: 'Alinare', legal: 'Alinare Joias (exemplo)', tagline: 'Joalheria', swatches: ['#242741', '#f0ebe4', '#9aa3d6'] },
  novitah: { name: 'Novitah', legal: 'Novitah Acessórios (exemplo)', tagline: 'Acessórios', swatches: ['#d6c0b8', '#a46f69', '#d7b79b'] },
};

const files = import.meta.glob('/src/brands/*/{logo,symbol}.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const official = (brand: BrandId, kind: 'logo' | 'symbol') => files[`/src/brands/${brand}/${kind}.svg`];

export function Monogram({ brand, size = 36 }: { brand: BrandId; size?: number }) {
  const svg = official(brand, 'symbol');
  if (svg) return <span className="monogram" style={{ width: size, height: size, background: 'none', boxShadow: 'none' }} aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />;
  const label = brand === 'azime' ? 'AZ' : brand === 'alinare' ? 'A' : 'N';
  const style =
    brand === 'azime'
      ? { background: '#0b0b0c', color: '#ffffff', fontSize: size * 0.38 }
      : brand === 'alinare'
        ? { background: '#242741', color: '#f0ebe4', fontFamily: 'var(--font-display)', fontSize: size * 0.58, fontWeight: 400 }
        : { background: 'linear-gradient(140deg, #c48e86, #94605a)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: size * 0.58, fontWeight: 400 };
  return <span className={`monogram monogram-${brand}`} style={{ width: size, height: size, borderRadius: size * 0.3, ...style }} aria-hidden>{label}</span>;
}

export function Wordmark({ brand }: { brand: BrandId }) {
  const svg = official(brand, 'logo');
  if (svg) return <span className="brand-word" style={{ display: 'inline-flex', height: 22 }} dangerouslySetInnerHTML={{ __html: svg }} />;
  if (brand === 'azime') return <span className="wordmark brand-word">AZIME</span>;
  return <span className="wordmark serif brand-word">{COMPANIES[brand].name.toUpperCase()}</span>;
}

export function Logo({ brand }: { brand: BrandId }) {
  return (
    <span className="row" style={{ gap: 12 }} aria-label={COMPANIES[brand].name}>
      <Monogram brand={brand} />
      <Wordmark brand={brand} />
    </span>
  );
}

/** Camada 1: fundo de luz e cor derivado da marca ativa. */
export function Ambient() {
  return <div className="ambient" aria-hidden><i className="a1" /><i className="a2" /><i className="a3" /><i className="a4" /></div>;
}
