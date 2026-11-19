import './styles/tokens.css';
import './styles/app.css';
import { cacheGitInstalledPackages } from '@/platform/externalPackages';

async function start() {
  try {
    const response = await fetch('/api/plugins', { cache: 'no-store' });
    if (response.ok) {
      const result = await response.json() as { plugins?: unknown };
      cacheGitInstalledPackages(result.plugins);
    }
  } catch {
    // Existing browser cache keeps the last server-provided Git catalog available offline.
  }
  const { mountApp } = await import('./app');
  mountApp();
}

void start();
