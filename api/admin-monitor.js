'use strict';

const staging = 'https://qnuluspqfazdppciermw.supabase.co';
const repository = 'https://api.github.com/repos/neopep/App-NeoPep';
const ref = 'staging/permanente';
const cache = new Map();

async function read(url, headers, options={}) {
  const response = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(4500), redirect: 'error' });
  if (!response.ok) throw Error('source_unavailable');
  return response.json();
}

async function github() {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const token = process.env.NEO_MONITOR_GITHUB_TOKEN;
  if (token) headers.Authorization = 'Bearer ' + token;
  const query = encodeURIComponent(ref);
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const search = q => 'https://api.github.com/search/issues?q=' + encodeURIComponent('repo:neopep/App-NeoPep ' + q) + '&per_page=1';
  const sources = await Promise.allSettled([
    read(repository + '/commits?sha=' + query + '&per_page=1', headers),
    read(repository + '/compare/main...' + query + '?per_page=1', headers),
    read(repository + '/actions/runs?branch=' + query + '&per_page=30&created=%3E%3D' + encodeURIComponent(since), headers),
    read(search('is:pr is:open base:' + ref), headers),
    read(search('is:issue is:open'), headers),
    read(search('is:issue is:closed'), headers)
  ]);
  const [commits, comparison, actions, prs, open, closed] = sources.map(result => result.value);
  if (sources.every(result=>result.status==='rejected'))return { connected: false };
  const latest = commits?.[0];
  const runs = actions?.workflow_runs;
  return { connected: true, partial: sources.some(result=>result.status==='rejected'), branch: ref,
    commit: latest?.sha ?? null, date: latest?.commit?.committer?.date ?? null,
    author: latest?.author?.login ?? null, ahead: comparison?.ahead_by ?? null, behind: comparison?.behind_by ?? null,
    actions_30d: actions?.total_count ?? null, actions_sample: runs?.length ?? null,
    sampled_success: runs?.filter(run=>run.conclusion==='success').length ?? null,
    sampled_failures: runs?.filter(run=>run.conclusion==='failure').length ?? null,
    open_prs: prs?.total_count ?? null, open_issues: open?.total_count ?? null, closed_issues: closed?.total_count ?? null };
}

async function vercel() {
  const token = process.env.NEO_MONITOR_VERCEL_TOKEN;
  const projectId = process.env.NEO_MONITOR_VERCEL_PROJECT_ID;
  const teamId = process.env.NEO_MONITOR_VERCEL_TEAM_ID;
  if (!token || !projectId) return { connected: false };
  const headers = { Authorization: 'Bearer ' + token };
  const team = teamId ? 'teamId=' + encodeURIComponent(teamId) : '';
  const project = await read('https://api.vercel.com/v9/projects/' + encodeURIComponent(projectId) + (team ? '?' + team : ''), headers);
  if (project.name !== 'app-neopep-staging' || project.id !== projectId) return { connected: false };
  const data = await read('https://api.vercel.com/v6/deployments?limit=15&projectId=' + encodeURIComponent(projectId) + (team ? '&' + team : ''), headers);
  return { connected: true, deployments: (data.deployments || []).map(row => {
    const build = row.buildingAt && row.ready && row.ready >= row.buildingAt ? row.ready - row.buildingAt : null;
    return { state: row.readyState || row.state, created: row.created, branch: row.meta?.githubCommitRef ?? null,
      commit: row.meta?.githubCommitSha ?? null, build_ms: build };
  }) };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });
  const provider = req.query?.provider;
  if (provider !== 'github' && provider !== 'vercel') return res.status(400).json({ error: 'provider' });
  if (process.env.VERCEL_GIT_COMMIT_REF !== ref) return res.status(404).json({ error: 'environment' });
  const key = process.env.NEO_STAGING_SUPABASE_PUBLISHABLE_KEY;
  const authorization = req.headers.authorization;
  if (!key || typeof authorization !== 'string' || authorization.length > 8192 || !/^Bearer [A-Za-z0-9_.-]+$/.test(authorization)) {
    return res.status(401).json({ error: 'authentication' });
  }
  try {
    const check = await read(staging + '/rest/v1/rpc/neo_admin_system', { apikey: key, Authorization: authorization, 'Content-Type': 'application/json' },
      { method: 'POST', body: JSON.stringify({ p_action: 'access' }) });
    if (check.authorized !== true) return res.status(403).json({ error: 'authorization' });
  } catch { return res.status(403).json({ error: 'authorization' }); }
  try {
    let entry = cache.get(provider);
    if (!entry || entry.expires <= Date.now()) {
      const fetcher = provider === 'github' ? github : vercel;
      entry = { expires: Date.now()+600000, data: fetcher().then(data => ({...data, observed_at: new Date().toISOString()})) };
      cache.set(provider,entry);
    }
    return res.status(200).json(await entry.data);
  } catch { return res.status(503).json({ error: 'source_unavailable' }); }
};
