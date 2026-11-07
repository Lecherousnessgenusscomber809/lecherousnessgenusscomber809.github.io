const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};

let DATA = { counts: {}, agents: [], skills: [], knowledge: [], repos: [], models: [], usage: {} };

// ---------- tabs
document.querySelectorAll('#nav .item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#nav .item').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + btn.dataset.tab));
    const label = btn.textContent.trim().replace(/^\S+\s*/, '');
    $('#page-title').textContent = label;
    document.title = label + ' · EnjoytheLegenD';
    if (btn.dataset.tab === 'opencode') ocCheck();
  });
});

// ---------- render
function card(title, desc, tags) {
  const c = el('article', 'card');
  c.appendChild(el('h4', '', title));
  if (desc) c.appendChild(el('p', 'muted small', desc));
  if (tags && tags.length) {
    const m = el('div', 'meta');
    tags.filter(Boolean).forEach(t => m.appendChild(el('span', 'tag', t)));
    c.appendChild(m);
  }
  return c;
}

function list(target, items, render, filter) {
  const box = $(target);
  box.innerHTML = '';
  const q = (filter || '').toLowerCase();
  const shown = items.filter(i => !q || JSON.stringify(i).toLowerCase().includes(q));
  if (!shown.length) { box.appendChild(card('Nada encontrado', 'Ajuste o filtro.')); return; }
  shown.forEach(i => box.appendChild(render(i)));
}

function renderAll() {
  const c = DATA.counts || {};
  $('#k-agents').textContent = c.agents ?? '—';
  $('#k-skills').textContent = c.skills ?? '—';
  $('#k-knowledge').textContent = c.knowledge ?? '—';
  $('#k-repos').textContent = c.repos ?? '—';
  $('#chip-agents').textContent = (c.agents || 0) + ' agentes';
  $('#chip-skills').textContent = (c.skills || 0) + ' skills';
  const u = DATA.usage || {};
  $('#chip-tokens').textContent = ((u.tokensIn || 0) + (u.tokensOut || 0)) + ' tokens';

  // donut
  const total = (c.agents || 0) + (c.skills || 0) + (c.knowledge || 0);
  const pct = (v) => total ? Math.round(100 * v / total) : 0;
  const a = pct(c.agents || 0), s = pct(c.skills || 0), k = 100 - a - s;
  $('.donut').style.background =
    `conic-gradient(var(--cyan) 0 ${a}%, var(--magenta) ${a}% ${a + s}%, var(--violet) ${a + s}% 100%)`;
  $('#legend').innerHTML = `
    <li><span class="sw" style="background:var(--cyan)"></span> Agentes ${a}%</li>
    <li><span class="sw" style="background:var(--magenta)"></span> Skills ${s}%</li>
    <li><span class="sw" style="background:var(--violet)"></span> Conhecimento ${k}%</li>`;

  // bars
  const byDay = (u.byDay && Object.entries(u.byDay)) || [];
  const bars = $('#bars');
  bars.innerHTML = '';
  const days = byDay.length ? byDay.slice(-7) : [['—', 0]];
  const max = Math.max(1, ...days.map(d => d[1]));
  days.forEach(([d, v]) => {
    const wrap = el('div', 'bar-wrap');
    const b = el('div', 'bar');
    b.style.height = Math.max(6, Math.round(96 * v / max)) + 'px';
    b.title = `${d}: ${v}`;
    wrap.append(b, el('div', 'bar-label', String(d).slice(5) || d));
    bars.appendChild(wrap);
  });

  // usage
  $('#usage').innerHTML = `
    <div><span>chamadas</span><strong>${u.calls || 0}</strong></div>
    <div><span>tokens entrada</span><strong>${u.tokensIn || 0}</strong></div>
    <div><span>tokens saída</span><strong>${u.tokensOut || 0}</strong></div>
    <div><span>tempo total</span><strong>${u.seconds || 0}s</strong></div>`;

  list('#list-agents', DATA.agents || [],
    a => card(a.id, a.description || '', [a.mode, a.model]));

  const specialists = (DATA.agents || []).filter(a => a.mode === 'subagent');
  list('#list-specialists', specialists, a => {
    const sk = (a.skills || []);
    const tags = [a.model || 'modelo padrão'];
    if (sk.length) tags.push(...sk.map(s => 'skill: ' + s));
    else tags.push('sem skill dedicada');
    return card(a.id, a.description || '', tags);
  });

  const routing = $('#list-routing');
  if (routing) {
    routing.innerHTML = '';
    (DATA.routing || []).forEach(r => {
      const s = document.createElement('span');
      s.textContent = `${r.kind} → ${r.model.split('/').pop()} (${r.count})`;
      routing.appendChild(s);
    });
    if (!(DATA.routing || []).length) routing.innerHTML = '<span>sem dados de roteamento</span>';
  }

  list('#list-skills', DATA.skills || [],
    s => card(s.id, s.description || '', [s.status, (s.files || 0) + ' arq.']));

  list('#list-knowledge', DATA.knowledge || [],
    k => card(k.title, k.path, [k.status, k.domain]));

  const repos = $('#list-repos');
  repos.innerHTML = '';
  (DATA.repos || []).forEach(r => {
    const c = card(r.name, r.description || '', [r.language, r.private ? 'privado' : 'público']);
    const link = el('a', '', 'abrir ↗');
    link.href = r.url; link.target = '_blank'; link.rel = 'noopener';
    link.style.fontSize = '12px';
    c.appendChild(link);
    repos.appendChild(c);
  });

  $('#list-models').innerHTML = (DATA.models || []).map(m => `<span>${m}</span>`).join('');

  const tasks = $('#list-tasks');
  if (tasks) {
    tasks.innerHTML = '';
    const list = DATA.tasks || [];
    if (!list.length) {
      tasks.appendChild(card('Sem tarefas exportadas', 'A lista vem da central local; rode /painel após criar tarefas.'));
    } else {
      list.forEach(t => {
        const c = card(t.title, t.notes || '', [t.state, (t.createdAt || '').slice(0, 10)]);
        tasks.appendChild(c);
      });
    }
  }

  const quick = $('#list-quick');  quick.innerHTML = '';
  [
    { name: 'Dashboard GitHub', url: 'https://github.com/dashboard' },
    { name: 'Meus repositórios', url: 'https://github.com/EnjoytheLegenD?tab=repositories' },
    { name: 'OpenCode (local)', url: 'http://127.0.0.1:28894' },
    { name: 'OpenCode Go', url: 'https://opencode.ai/go' }
  ].forEach(q => {
    const c = card(q.name, q.url.replace(/^https?:\/\//, ''), []);
    const a = el('a', '', 'abrir ↗');
    a.href = q.url; a.target = '_blank'; a.rel = 'noopener'; a.style.fontSize = '12px';
    c.appendChild(a);
    quick.appendChild(c);
  });

  $('#generated').textContent = DATA.generated ? new Date(DATA.generated).toLocaleString('pt-BR') : '—';
}

// ---------- filtros
[['#f-agents', '#list-agents', () => DATA.agents, a => card(a.id, a.description || '', [a.mode, a.model])],
 ['#f-skills', '#list-skills', () => DATA.skills, s => card(s.id, s.description || '', [s.status, (s.files || 0) + ' arq.'])],
 ['#f-knowledge', '#list-knowledge', () => DATA.knowledge, k => card(k.title, k.path, [k.status, k.domain])]
].forEach(([input, target, get, render]) => {
  const node = $(input);
  if (node) node.addEventListener('input', e => list(target, get() || [], render, e.target.value));
});

// ---------- browser
$('#browser-form').addEventListener('submit', e => {
  e.preventDefault();
  let u = $('#browser-url').value.trim();
  if (!u) return;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  window.open(u, '_blank', 'noopener');
});

// ---------- OpenCode
const OC_KEY = 'oc-url';
const ocUrl = () => (localStorage.getItem(OC_KEY) || 'http://127.0.0.1:28894').replace(/\/+$/, '');

async function ocCheck() {
  const url = ocUrl();
  const diag = [];
  diag.push('URL: ' + url);
  diag.push('origem da página: ' + location.origin);
  diag.push('página é HTTPS: ' + (location.protocol === 'https:'));
  diag.push('destino é HTTP: ' + url.startsWith('http://'));

  let reachable = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    await fetch(url + '/api/info', { mode: 'no-cors', signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    reachable = true;
  } catch (e) {
    diag.push('falha: ' + (e.name || e.message));
  }

  const status = document.getElementById('oc-status');
  if (status) {
    status.textContent = reachable
      ? 'motor detectado neste computador — clique em Abrir'
      : 'motor não detectado (ou bloqueado pelo navegador)';
    status.className = 'muted small ' + (reachable ? 'ok' : 'err');
  }

  if (reachable) diag.push('fetch no-cors: respondeu');
  else diag.push('fetch no-cors: bloqueado ou offline');
  diag.push(reachable
    ? 'Abrir em nova aba deve funcionar neste PC.'
    : 'Se o motor está rodando, o bloqueio é mixed content (HTTPS → HTTP). Use túnel HTTPS.');

  const box = document.getElementById('oc-diag');
  if (box) box.innerHTML = diag.map(d => '<li>' + d + '</li>').join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('oc-url');
  if (!input) return;
  input.value = ocUrl();
  document.getElementById('oc-save').addEventListener('click', () => {
    const v = input.value.trim();
    if (v) { localStorage.setItem(OC_KEY, v); ocCheck(); }
  });
  document.getElementById('oc-open').addEventListener('click', () => {
    window.open(ocUrl(), '_blank', 'noopener');
  });
  document.getElementById('oc-embed').addEventListener('click', () => {
    const wrap = document.getElementById('oc-frame-wrap');
    const frame = document.getElementById('oc-frame');
    wrap.style.display = 'block';
    frame.src = ocUrl();
  });
  const connect = document.getElementById('oc-connect');
  if (connect) connect.addEventListener('click', () => {
    const link = document.getElementById('oc-pair').value.trim();
    if (!link) return;
    // link de pareamento não é persistido: vale só para esta abertura
    window.open(link, '_blank', 'noopener');
  });
});

// ---------- load (com retentativa: o Pages pode servir 404 durante o deploy)
async function loadData(attempt = 0) {
  try {
    const res = await fetch('data/manifest.json?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    DATA = await res.json();
    renderAll();
  } catch (e) {
    if (attempt < 3) { setTimeout(() => loadData(attempt + 1), 900); return; }
    $('#generated').textContent = 'manifest indisponível';
    console.warn('manifest:', e.message);
  }
}
loadData();
