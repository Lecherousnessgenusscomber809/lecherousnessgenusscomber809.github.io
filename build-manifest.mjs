// Gera data/manifest.json a partir do cérebro local, sem dependências.
// Uso: node build-manifest.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const BRAIN = path.join(HOME, 'opencode-brain');
const CONFIG = path.join(HOME, '.config', 'opencode');
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)), 'data', 'manifest.json');
const USAGE = path.join(HOME, 'ai-command-center', 'app', 'data', 'usage.jsonl');

const fm = (text) => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return {};
  const o = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_./-]+):\s*(.*)$/.exec(line);
    if (kv) o[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return o;
};

const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };

function agents() {
  const dir = path.join(CONFIG, 'agents');
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const d = fm(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { id: f.replace(/\.md$/, ''), description: (d.description || '').slice(0, 180), mode: d.mode || '', model: d.model || '' };
  });
}

function skills() {
  const dir = path.join(BRAIN, 'skills');
  if (!exists(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const skill = path.join(dir, name, 'SKILL.md');
    if (!exists(skill)) continue;
    const d = fm(fs.readFileSync(skill, 'utf8'));
    const files = fs.readdirSync(path.join(dir, name), { recursive: true })
      .filter(x => fs.statSync(path.join(dir, name, x)).isFile()).length;
    out.push({ id: name, description: (d.description || '').slice(0, 180), status: d.status || 'active', files });
  }
  return out;
}

function knowledge() {
  const dir = path.join(BRAIN, 'knowledge');
  if (!exists(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.endsWith('.md')) continue;
      const text = fs.readFileSync(full, 'utf8');
      const meta = fm(text);
      const h = text.split(/\r?\n/).find(l => l.startsWith('# '));
      out.push({
        title: h ? h.replace(/^#\s*/, '') : e.name,
        path: path.relative(BRAIN, full).replace(/\\/g, '/'),
        status: meta.status || '', domain: meta.domain || ''
      });
    }
  };
  walk(dir);
  return out;
}

function models() {
  const cache = path.join(HOME, 'opencode-brain', 'knowledge', 'benchmarks', 'modelos.txt');
  const fixed = [
    'opencode-go/glm-5.3-flash', 'opencode-go/glm-5.3', 'opencode-go/deepseek-v4.1-flash',
    'opencode-go/deepseek-v4-pro', 'opencode-go/claude-haiku-5-5', 'opencode-go/gemini-4-argon',
    'opencode-go/qwen3.8-max', 'opencode-go/kimi-k2.7-code', 'opencode-go/gpt-6-luna'
  ];
  return exists(cache) ? fs.readFileSync(cache, 'utf8').split(/\r?\n/).filter(Boolean) : fixed;
}

function repos() {
  const file = path.join(BRAIN, 'knowledge', 'repos.json');
  if (!exists(file)) {
    return [
      { name: 'opencode-brain', description: 'Conhecimento, skills e agentes', url: 'https://github.com/EnjoytheLegenD/opencode-brain', private: true, language: 'Markdown' },
      { name: 'ai-command-center', description: 'Central de IA e especificação', url: 'https://github.com/EnjoytheLegenD/ai-command-center', private: true, language: 'JavaScript' }
    ];
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function tasks() {
  const file = path.join(HOME, 'ai-command-center', 'app', 'data', 'tasks.json');
  if (!exists(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).slice(0, 20).map(t => ({
      title: String(t.title || '').slice(0, 120),
      state: String(t.state || 'received'),
      notes: String(t.notes || '').slice(0, 200),
      createdAt: t.createdAt || ''
    }));
  } catch { return []; }
}

function usage() {  if (!exists(USAGE)) return { calls: 0, tokensIn: 0, tokensOut: 0, seconds: 0, byDay: {} };
  const lines = fs.readFileSync(USAGE, 'utf8').split('\n').filter(Boolean);
  const u = { calls: 0, tokensIn: 0, tokensOut: 0, seconds: 0, byDay: {} };
  for (const l of lines) {
    let r; try { r = JSON.parse(l); } catch { continue; }
    u.calls++; u.tokensIn += r.tokensIn || 0; u.tokensOut += r.tokensOut || 0;
    u.seconds += r.seconds || 0;
    const d = (r.at || '').slice(0, 10);
    if (d) u.byDay[d] = (u.byDay[d] || 0) + 1;
  }
  u.seconds = Math.round(u.seconds);
  return u;
}

const a = agents(), s = skills(), k = knowledge(), r = repos();
const manifest = {
  generated: new Date().toISOString(),
  counts: { agents: a.length, skills: s.length, knowledge: k.length, repos: r.length, models: models().length },
  agents: a, skills: s,
  knowledge: k.slice(0, 60),
  repos: r,
  models: models(),
  usage: usage(),
  tasks: tasks()
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`manifest: ${a.length} agentes, ${s.length} skills, ${k.length} conhecimentos, ${r.length} repos`);
