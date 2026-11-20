const entries = (value) => String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);

export function requireTrustedRepository(repository, env = process.env) {
  const allowed = entries(env.HORIZON_GIT_ALLOWED_REPOSITORIES);
  if (env.NODE_ENV === 'production' && !allowed.length) throw new Error('Configure HORIZON_GIT_ALLOWED_REPOSITORIES no servidor.');
  if (allowed.length && !allowed.includes(repository)) throw new Error('O repositório Git não está na lista permitida.');
}

export function requireTrustedRevision(repository, commit, env = process.env) {
  const allowed = entries(env.HORIZON_GIT_TRUSTED_REVISIONS);
  if (env.NODE_ENV === 'production' && !allowed.length) throw new Error('Configure HORIZON_GIT_TRUSTED_REVISIONS no servidor.');
  if (allowed.length && !allowed.includes(`${repository}#${commit}`)) throw new Error('A revisão Git não está na lista aprovada.');
}
