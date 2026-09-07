import { stateRepo, pull } from './manifest.mjs';
import { installTargets } from './install.mjs';

export default async function update(ctx) {
  const repo = stateRepo(ctx);
  pull(repo, ctx);
  await installTargets(repo, ctx, { yes: true });
}
