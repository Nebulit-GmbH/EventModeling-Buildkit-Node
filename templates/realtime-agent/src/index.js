import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

function findRalphShDir(startDir) {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, 'ralph.sh'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function findConfigPath(startDir) {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, '.eventmodelers', 'config.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('No .eventmodelers/config.json found in current directory or any parent directory');
    dir = parent;
  }
}

function loadLocalConfig() {
  const configPath = findConfigPath(process.cwd());
  const raw = readFileSync(configPath, 'utf-8');
  const cfg = JSON.parse(raw);

  for (const key of ['token', 'organizationId', 'boardId', 'baseUrl']) {
    if (!cfg[key]) throw new Error(`Missing config field: ${key}`);
  }

  if (process.env.BASE_URL) cfg.baseUrl = process.env.BASE_URL;

  return cfg;
}

async function fetchPlatformConfig(local) {
  const res = await fetch(`${local.baseUrl}/api/config`, {
    headers: { 'x-token': local.token },
  });
  if (!res.ok) throw new Error(`Failed to fetch platform config: ${res.status} / ${res.statusText} / ${await res.text()}`);
  const remote = await res.json();
  return { ...local, ...remote };
}

async function getRealtimeToken(cfg) {
  const res = await fetch(`${cfg.baseUrl}/api/prompts/realtime-token`, {
    headers: { 'x-token': cfg.token },
  });
  if (!res.ok) throw new Error(`Failed to get realtime token: ${res.status} / ${res.statusText} / ${await res.text()}`);
  const { token } = await res.json();
  return token;
}

async function fetchAndPersistSlices(cfg, cwd) {
  const url = `${cfg.baseUrl}/api/org/${cfg.organizationId}/boards/${cfg.boardId}/slicedata/slices`;
  const res = await fetch(url, {
    headers: { 'x-token': cfg.token, 'x-board-id': cfg.boardId },
  });
  if (!res.ok) {
    console.error(`[agent] Failed to fetch slices: ${res.status} ${res.statusText}`);
    return;
  }

  const { slices } = await res.json();

  const slicesDir = join(cwd, 'slices');
  mkdirSync(slicesDir, { recursive: true });

  for (const slice of slices) {
    const filePath = join(slicesDir, `${slice.id}.json`);
    writeFileSync(filePath, JSON.stringify(slice, null, 2), 'utf-8');
  }

  console.log(`[agent] Persisted ${slices.length} slice(s) to ${slicesDir}`);
}

async function writeTask(payload, cwd) {
  const tasksPath = resolve(cwd, 'tasks.json');

  const existing = existsSync(tasksPath)
    ? JSON.parse(readFileSync(tasksPath, 'utf-8'))
    : [];

  const task = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    payload,
  };

  existing.push(task);
  writeFileSync(tasksPath, JSON.stringify(existing, null, 2), 'utf-8');
  console.log(`[agent] Task ${task.id} written — slice="${payload.sliceTitle}" status="${payload.sliceStatus}"`);
}

async function start() {
  const claudeCwd = process.argv[2] ?? findRalphShDir(process.cwd()) ?? resolve(process.cwd(), '.');

  const local = loadLocalConfig();
  const cfg = await fetchPlatformConfig(local);

  console.log(`[agent] Starting — org=${cfg.organizationId}, board=${cfg.boardId}, base=${cfg.baseUrl}, cwd=${claudeCwd}`);

  let realtimeToken = await getRealtimeToken(cfg);

  await fetchAndPersistSlices(cfg, claudeCwd).catch((err) =>
    console.error('[agent] Initial slice fetch error:', err),
  );

  const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    realtime: { params: { apikey: cfg.supabaseAnonKey } },
  });

  await supabase.realtime.setAuth(realtimeToken);

  const channelName = `board:${cfg.boardId}-slicechanged`;

  supabase
    .channel(channelName, { config: { private: true } })
    .on('broadcast', { event: 'slice:changed' }, async (msg) => {
      const payload = msg.payload;
      console.log(`[agent] slice:changed — slice="${payload.sliceTitle}" status="${payload.sliceStatus}"`);

      await fetchAndPersistSlices(cfg, claudeCwd).catch((err) =>
        console.error('[agent] Slice persist error:', err),
      );

      await writeTask(payload, claudeCwd).catch((err) =>
        console.error('[agent] writeTask error:', err),
      );
    })
    .subscribe((status) => {
      console.log(`[agent] Realtime channel "${channelName}" status: ${status}`);
    });

  setInterval(async () => {
    try {
      realtimeToken = await getRealtimeToken(cfg);
      supabase.realtime.setAuth(realtimeToken);
      console.log('[agent] Realtime token refreshed');
    } catch (err) {
      console.error('[agent] Token refresh failed:', err);
    }
  }, 10 * 60 * 1000);

}

start().catch((err) => {
  console.error('[agent] Fatal:', err);
  process.exit(1);
});
