let nmc = [], units = [], programme = [];
let currentView = 'nmc';
let previousView = null;
let selectedUnit = null;
let filters = { year: 'all', field: 'all', search: '' };

async function loadData() {
  try {
    [programme, nmc, units] = await Promise.all([
      fetch('data/programmeOutcomes.json').then(r => r.json()),
      fetch('data/nmcStandards.json').then(r => r.json()),
      fetch('data/units.json').then(r => r.json())
    ]);
    render();
  } catch (e) {
    document.getElementById('content').innerHTML =
      '<div class="empty"><p>Error loading data. Open this file via a local server (e.g. <code>npx serve .</code>) rather than directly in the browser.</p></div>';
  }
}

function setView(v, btn) {
  previousView = null;
  selectedUnit = null;
  currentView = v;
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  render();
}

function showUnitDetail(code) {
  previousView = currentView;
  selectedUnit = code;
  currentView = 'unit-detail';
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.remove('active'));
  render();
}

function goBack() {
  currentView = previousView || 'nmc';
  previousView = null;
  selectedUnit = null;
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => {
    if (b.dataset.view === currentView) b.classList.add('active');
  });
  render();
}

function getFilteredUnits() {
  const q = filters.search.toLowerCase();
  return units.filter(u => {
    if (filters.year !== 'all' && u.year !== +filters.year) return false;
    if (filters.field !== 'all') {
      const f = u.fields || [];
      if (!f.includes(filters.field) && !f.includes('All')) return false;
    }
    if (q) {
      const inCode  = u.code.toLowerCase().includes(q);
      const inTitle = u.title.toLowerCase().includes(q);
      const inNmc   = u.outcomes.some(o => (o.nmc || []).some(n => n.toLowerCase().includes(q)));
      const inPo    = u.outcomes.some(o => (o.po  || []).some(p => p.toLowerCase().includes(q)));
      const inText  = u.outcomes.some(o => o.text.toLowerCase().includes(q));
      if (!inCode && !inTitle && !inNmc && !inPo && !inText) return false;
    }
    return true;
  });
}

function ycls(year) { return ['', 'y1', 'y2', 'y3'][year] || ''; }

function unitChip(u) {
  const d = u.discovery ? ' discovery' : '';
  return `<span class="chip ${ycls(u.year)}${d} chip-link" title="${u.title}" onclick="showUnitDetail('${u.code}')">${u.code}</span>`;
}

function unitInfoGrid(u) {
  const fieldMap = { MH: 'Mental Health', CYP: 'Children & Young People' };
  const fieldsText = (u.fields || []).map(f => fieldMap[f] || f).join(' · ');
  const discoveryItem = u.discovery
    ? `<div class="unit-info-item"><span class="unit-info-label">Type</span><span class="unit-info-value unit-info-discovery">Discovery unit</span></div>`
    : '';
  return `<div class="unit-info-grid">
    <div class="unit-info-item"><span class="unit-info-label">Year of study</span><span class="unit-info-value">Year ${u.year}</span></div>
    <div class="unit-info-item"><span class="unit-info-label">FHEQ level</span><span class="unit-info-value">Level ${u.level}</span></div>
    <div class="unit-info-item"><span class="unit-info-label">Credits</span><span class="unit-info-value">${u.credits}</span></div>
    <div class="unit-info-item"><span class="unit-info-label">Fields</span><span class="unit-info-value">${fieldsText}</span></div>
    ${discoveryItem}
  </div>`;
}

/* ── Render dispatcher ────────────────────────────────── */
function render() {
  const c = document.getElementById('content');
  const fu = getFilteredUnits();
  if      (currentView === 'nmc')         renderNMC(c, fu);
  else if (currentView === 'programme')   renderProgramme(c, fu);
  else if (currentView === 'units')       renderUnits(c, fu);
  else if (currentView === 'gaps')        renderGaps(c, fu);
  else if (currentView === 'assessments') renderAssessments(c, fu);
  else if (currentView === 'unit-detail') renderUnitDetail(c);
}

/* ── NMC Standards view ───────────────────────────────── */
function renderNMC(c, fu) {
  const cov = {};
  fu.forEach(u => u.outcomes.forEach(o => (o.nmc || []).forEach(ref => {
    if (!cov[ref]) cov[ref] = [];
    if (!cov[ref].find(x => x.code === u.code)) cov[ref].push(u);
  })));

  const assessedCov = {};
  fu.forEach(u => {
    const idx = new Set();
    (u.assessments || []).forEach(a => (a.assesses_outcomes || []).forEach(i => idx.add(i)));
    u.outcomes.forEach((o, i) => {
      if (!idx.has(i)) return;
      (o.nmc || []).forEach(ref => {
        if (!assessedCov[ref]) assessedCov[ref] = [];
        if (!assessedCov[ref].find(x => x.code === u.code)) assessedCov[ref].push(u);
      });
    });
  });

  const mainStds = nmc.filter(s => typeof s.platform === 'number');
  const annexStds = nmc.filter(s => s.platform === 'Annexe');
  const covered = mainStds.filter(s => cov[s.id]?.length).length +
                  annexStds.filter(s => cov[s.id]?.length).length;
  const total = nmc.length;
  const assessedCount = [...mainStds, ...annexStds].filter(s => assessedCov[s.id]?.length).length;

  let html = `<div class="stats-bar">
    <div class="stat"><div class="stat-num">${total}</div><div class="stat-label">NMC Proficiencies</div></div>
    <div class="stat covered"><div class="stat-num">${covered}</div><div class="stat-label">Covered</div></div>
    <div class="stat assessed"><div class="stat-num">${assessedCount}</div><div class="stat-label">Summatively Assessed</div></div>
    <div class="stat gap"><div class="stat-num">${total - covered}</div><div class="stat-label">Gaps</div></div>
    <div class="stat"><div class="stat-num">${fu.length}</div><div class="stat-label">Units shown</div></div>
  </div>`;

  const platforms = [...new Set(mainStds.map(s => s.platform))].sort((a, b) => a - b);
  platforms.forEach(p => {
    const stds = mainStds.filter(s => s.platform === p);
    const pTitle = stds[0]?.platformTitle || '';
    html += `<div class="section-hd">Platform ${p}: ${pTitle}</div>`;
    stds.forEach(s => {
      const taughtUnits = cov[s.id] || [];
      const aUnits = assessedCov[s.id] || [];
      const ok = taughtUnits.length > 0;
      html += `<div class="std-item ${ok ? 'covered' : 'gap'}">
        <div class="std-row">
          <span class="std-id">${s.id}</span>
          <span class="std-text">${s.text}</span>
          <span class="badge ${ok ? 'badge-ok' : 'badge-gap'}">${ok ? 'covered' : 'gap'}</span>
        </div>
        ${ok ? `<div class="chip-row">${taughtUnits.map(unitChip).join('')}</div>` : ''}
        ${aUnits.length ? `<div class="chip-row assessed-chip-row"><span class="assessed-row-label">Assessed by</span>${aUnits.map(unitChip).join('')}</div>` : ''}
      </div>`;
    });
  });

  if (annexStds.length) {
    html += `<div class="section-hd">Annexes</div>`;
    annexStds.forEach(s => {
      const taughtUnits = cov[s.id] || [];
      const aUnits = assessedCov[s.id] || [];
      const ok = taughtUnits.length > 0;
      html += `<div class="std-item ${ok ? 'covered' : 'gap'}">
        <div class="std-row">
          <span class="std-id">${s.id}</span>
          <span class="std-text">${s.text}</span>
          <span class="badge ${ok ? 'badge-ok' : 'badge-gap'}">${ok ? 'covered' : 'gap'}</span>
        </div>
        ${ok ? `<div class="chip-row">${taughtUnits.map(unitChip).join('')}</div>` : ''}
        ${aUnits.length ? `<div class="chip-row assessed-chip-row"><span class="assessed-row-label">Assessed by</span>${aUnits.map(unitChip).join('')}</div>` : ''}
      </div>`;
    });
  }

  c.innerHTML = html;
}

/* ── Programme Outcomes view ──────────────────────────── */
function renderProgramme(c, fu) {
  const cov = {};
  fu.forEach(u => u.outcomes.forEach(o => (o.po || []).forEach(ref => {
    if (!cov[ref]) cov[ref] = [];
    if (!cov[ref].find(x => x.code === u.code)) cov[ref].push(u);
  })));

  const assessedCov = {};
  fu.forEach(u => {
    const idx = new Set();
    (u.assessments || []).forEach(a => (a.assesses_outcomes || []).forEach(i => idx.add(i)));
    u.outcomes.forEach((o, i) => {
      if (!idx.has(i)) return;
      (o.po || []).forEach(ref => {
        if (!assessedCov[ref]) assessedCov[ref] = [];
        if (!assessedCov[ref].find(x => x.code === u.code)) assessedCov[ref].push(u);
      });
    });
  });

  const covered = programme.filter(p => cov[p.id]?.length).length;
  const assessedCount = programme.filter(p => assessedCov[p.id]?.length).length;

  let html = `<div class="stats-bar">
    <div class="stat"><div class="stat-num">${programme.length}</div><div class="stat-label">Programme Outcomes</div></div>
    <div class="stat covered"><div class="stat-num">${covered}</div><div class="stat-label">Covered</div></div>
    <div class="stat assessed"><div class="stat-num">${assessedCount}</div><div class="stat-label">Summatively Assessed</div></div>
    <div class="stat gap"><div class="stat-num">${programme.length - covered}</div><div class="stat-label">Gaps</div></div>
    <div class="stat"><div class="stat-num">${fu.length}</div><div class="stat-label">Units shown</div></div>
  </div>`;

  const cats = [...new Set(programme.map(p => p.category))];
  cats.forEach(cat => {
    const pos = programme.filter(p => p.category === cat);
    const catTitle = pos[0]?.categoryTitle || '';
    html += `<div class="section-hd">Category ${cat}: ${catTitle}</div>`;
    pos.forEach(p => {
      const taughtUnits = cov[p.id] || [];
      const aUnits = assessedCov[p.id] || [];
      const ok = taughtUnits.length > 0;
      html += `<div class="std-item ${ok ? 'covered' : 'gap'}">
        <div class="std-row">
          <span class="std-id">${p.id}</span>
          <span class="std-text">${p.text}</span>
          <span class="badge ${ok ? 'badge-ok' : 'badge-gap'}">${ok ? 'covered' : 'gap'}</span>
        </div>
        ${ok ? `<div class="chip-row">${taughtUnits.map(unitChip).join('')}</div>` : ''}
        ${aUnits.length ? `<div class="chip-row assessed-chip-row"><span class="assessed-row-label">Assessed by</span>${aUnits.map(unitChip).join('')}</div>` : ''}
      </div>`;
    });
  });

  c.innerHTML = html;
}

/* ── Units Overview ───────────────────────────────────── */
function renderUnits(c, fu) {
  if (!fu.length) {
    c.innerHTML = '<div class="empty"><p>No units match the current filters.</p></div>';
    return;
  }

  let html = '';
  [1, 2, 3].forEach(yr => {
    const yUnits = fu.filter(u => u.year === yr);
    if (!yUnits.length) return;
    html += `<div class="section-hd">Year ${yr} – Level ${yr + 3}</div>`;
    yUnits.forEach(u => {
      const assessText = (u.assessments || []).map(a =>
        `${a.type}${a.length ? ' — ' + a.length : ''}`).join(' &amp; ');

      html += `<div class="unit-card">
        <div class="unit-card-hd">
          <div class="unit-code">${u.code}</div>
          <div class="unit-title">${u.title}</div>
          ${unitInfoGrid(u)}
        </div>
        <div class="unit-card-body">
          ${u.note ? `<p style="font-size:0.8rem;color:#7a5200;background:#fff3cd;border-radius:4px;padding:0.4rem 0.6rem;margin-bottom:0.6rem">${u.note}</p>` : ''}
          ${u.outcomes.map(o => {
            const nmcRefs = (o.nmc || []).map(n => `<span class="nmc-ref ref-link" onclick="showRefPopup('${n}','nmc')">${n}</span>`).join('');
            const poRefs  = (o.po  || []).map(p => `<span class="po-ref ref-link" onclick="showRefPopup('${p}','po')">${p}</span>`).join('');
            return `<div class="outcome-item">
              <div class="outcome-cat">${o.category}</div>
              <div class="outcome-text">${o.text}</div>
              ${nmcRefs ? `<div class="nmc-ref-row"><span class="ref-label">NMC</span>${nmcRefs}</div>` : ''}
              ${poRefs  ? `<div class="nmc-ref-row" style="margin-top:0.2rem"><span class="ref-label">PO</span>${poRefs}</div>`  : ''}
            </div>`;
          }).join('')}
          <div class="assessment-block"><strong>Assessment:</strong> ${assessText || 'See unit specification'}</div>
        </div>
      </div>`;
    });
  });

  c.innerHTML = html;
}

/* ── Coverage Gaps view ───────────────────────────────── */
function renderGaps(c, fu) {
  const nmcCov = new Set();
  const poCov  = new Set();
  fu.forEach(u => u.outcomes.forEach(o => {
    (o.nmc || []).forEach(n => nmcCov.add(n));
    (o.po  || []).forEach(p => poCov.add(p));
  }));

  const nmcGaps = nmc.filter(s => !nmcCov.has(s.id));
  const poGaps  = programme.filter(p => !poCov.has(p.id));

  let html = `<div class="stats-bar">
    <div class="stat gap"><div class="stat-num">${nmcGaps.length}</div><div class="stat-label">NMC Gaps</div></div>
    <div class="stat gap"><div class="stat-num">${poGaps.length}</div><div class="stat-label">Programme Outcome Gaps</div></div>
    <div class="stat covered"><div class="stat-num">${nmc.length - nmcGaps.length}</div><div class="stat-label">NMC Covered</div></div>
    <div class="stat"><div class="stat-num">${fu.length}</div><div class="stat-label">Units in view</div></div>
  </div>`;

  if (nmcGaps.length === 0 && poGaps.length === 0) {
    html += '<div class="empty"><p>No coverage gaps for the current filter selection. All standards are addressed.</p></div>';
  } else {
    if (nmcGaps.length) {
      html += `<div class="section-hd">Uncovered NMC Standards (${nmcGaps.length})</div>`;
      const platforms = [...new Set(nmcGaps.map(s => s.platform))];
      platforms.forEach(p => {
        const gaps = nmcGaps.filter(s => s.platform === p);
        const pTitle = typeof p === 'number' ? `Platform ${p}: ${gaps[0]?.platformTitle}` : `${gaps[0]?.platformTitle}`;
        html += `<div class="subsection-hd">${pTitle}</div>`;
        gaps.forEach(s => {
          html += `<div class="std-item gap">
            <div class="std-row">
              <span class="std-id">${s.id}</span>
              <span class="std-text">${s.text}</span>
              <span class="badge badge-gap">gap</span>
            </div>
          </div>`;
        });
      });
    }

    if (poGaps.length) {
      html += `<div class="section-hd" style="margin-top:2rem">Uncovered Programme Outcomes (${poGaps.length})</div>`;
      const cats = [...new Set(poGaps.map(p => p.category))];
      cats.forEach(cat => {
        const gaps = poGaps.filter(p => p.category === cat);
        html += `<div class="subsection-hd">Category ${cat}: ${gaps[0]?.categoryTitle}</div>`;
        gaps.forEach(p => {
          html += `<div class="std-item gap">
            <div class="std-row">
              <span class="std-id">${p.id}</span>
              <span class="std-text">${p.text}</span>
              <span class="badge badge-gap">gap</span>
            </div>
          </div>`;
        });
      });
    }
  }

  c.innerHTML = html;
}

/* ── Assessment Map view ──────────────────────────────── */
function renderAssessments(c, fu) {
  const unitsWithData = fu.filter(u =>
    (u.assessments || []).some(a => (a.assesses_outcomes || []).length > 0)
  );

  let totalAssessed = 0, totalTaught = 0;
  unitsWithData.forEach(u => {
    const idx = new Set();
    (u.assessments || []).forEach(a => (a.assesses_outcomes || []).forEach(i => idx.add(i)));
    totalAssessed += idx.size;
    totalTaught += u.outcomes.length - idx.size;
  });

  let html = `<div class="stats-bar">
    <div class="stat"><div class="stat-num">${unitsWithData.length}</div><div class="stat-label">Units mapped</div></div>
    <div class="stat assessed"><div class="stat-num">${totalAssessed}</div><div class="stat-label">Outcomes assessed</div></div>
    <div class="stat"><div class="stat-num">${totalTaught}</div><div class="stat-label">Outcomes taught only</div></div>
    <div class="stat"><div class="stat-num">${fu.length - unitsWithData.length}</div><div class="stat-label">Units pending data</div></div>
  </div>
  <div class="assess-note">Constructive alignment view: which learning outcomes are summatively assessed versus taught or formatively assessed only. Units without assessment mapping data are excluded from this view.</div>`;

  if (!unitsWithData.length) {
    html += '<div class="empty"><p>No assessment mapping data available for the current filter selection.</p></div>';
    c.innerHTML = html;
    return;
  }

  [1, 2, 3].forEach(yr => {
    const yUnits = unitsWithData.filter(u => u.year === yr);
    if (!yUnits.length) return;
    html += `<div class="section-hd">Year ${yr}</div>`;
    yUnits.forEach(u => {
      const assessedIdx = new Set();
      (u.assessments || []).forEach(a => (a.assesses_outcomes || []).forEach(i => assessedIdx.add(i)));

      html += `<div class="unit-card">
        <div class="unit-card-hd">
          <div class="unit-code">${u.code}</div>
          <div class="unit-title">${u.title}</div>
          ${unitInfoGrid(u)}
        </div>
        <div class="unit-card-body">`;

      (u.assessments || []).forEach(a => {
        const loCount = (a.assesses_outcomes || []).length;
        html += `<div class="assess-method-row">
          <span class="assess-method-label">Assessment</span>
          <span class="assess-method-text">${a.type}${a.length ? ' — ' + a.length : ''}</span>
          ${a.weight ? `<span class="assess-weight-badge">${a.weight}%</span>` : ''}
          ${loCount ? `<span class="lo-count-chip">Assesses ${loCount} LO${loCount !== 1 ? 's' : ''}</span>` : ''}
        </div>`;
      });

      u.outcomes.forEach((o, i) => {
        const isAssessed = assessedIdx.has(i);
        const nmcRefs = (o.nmc || []).map(n => `<span class="nmc-ref ref-link" onclick="showRefPopup('${n}','nmc')">${n}</span>`).join('');
        const poRefs  = (o.po  || []).map(p => `<span class="po-ref ref-link" onclick="showRefPopup('${p}','po')">${p}</span>`).join('');
        html += `<div class="outcome-item ${isAssessed ? 'assessed-outcome' : 'taught-outcome'}">
          <div class="outcome-cat">${o.category}</div>
          <div class="outcome-text">${o.text}
            <span class="outcome-status-tag ${isAssessed ? 'assessed-tag' : 'taught-tag'}">${isAssessed ? 'Summatively assessed' : 'Taught / formative'}</span>
          </div>
          ${nmcRefs ? `<div class="nmc-ref-row"><span class="ref-label">NMC</span>${nmcRefs}</div>` : ''}
          ${poRefs  ? `<div class="nmc-ref-row" style="margin-top:0.2rem"><span class="ref-label">PO</span>${poRefs}</div>` : ''}
        </div>`;
      });

      html += `</div></div>`;
    });
  });

  c.innerHTML = html;
}

/* ── Unit Detail view ─────────────────────────────────── */
function renderUnitDetail(c) {
  const u = units.find(x => x.code === selectedUnit);
  if (!u) { c.innerHTML = '<div class="empty"><p>Unit not found.</p></div>'; return; }

  const backLabels = {
    nmc: 'NMC Standards', programme: 'Programme Outcomes',
    units: 'Units Overview', gaps: 'Coverage Gaps',
    assessments: 'Assessment Map'
  };
  const backLabel = backLabels[previousView] || 'Back';

  const assessText = (u.assessments || []).map(a =>
    `${a.type}${a.length ? ' — ' + a.length : ''}`).join(' &amp; ');

  let html = `<div class="unit-detail-nav">
    <button class="back-btn" onclick="goBack()">&#8592; ${backLabel}</button>
  </div>
  <div class="unit-card">
    <div class="unit-card-hd">
      <div class="unit-code">${u.code}</div>
      <div class="unit-title">${u.title}</div>
      ${unitInfoGrid(u)}
    </div>
    <div class="unit-card-body">
      ${u.note ? `<p style="font-size:0.8rem;color:#7a5200;background:#fff3cd;border-radius:4px;padding:0.4rem 0.6rem;margin-bottom:0.6rem">${u.note}</p>` : ''}
      ${u.outcomes.map(o => {
        const nmcRefs = (o.nmc || []).map(n => `<span class="nmc-ref ref-link" onclick="showRefPopup('${n}','nmc')">${n}</span>`).join('');
        const poRefs  = (o.po  || []).map(p => `<span class="po-ref ref-link" onclick="showRefPopup('${p}','po')">${p}</span>`).join('');
        return `<div class="outcome-item">
          <div class="outcome-cat">${o.category}</div>
          <div class="outcome-text">${o.text}</div>
          ${nmcRefs ? `<div class="nmc-ref-row"><span class="ref-label">NMC</span>${nmcRefs}</div>` : ''}
          ${poRefs  ? `<div class="nmc-ref-row" style="margin-top:0.2rem"><span class="ref-label">PO</span>${poRefs}</div>` : ''}
        </div>`;
      }).join('')}
      <div class="assessment-block"><strong>Assessment:</strong> ${assessText || 'See unit specification'}</div>
    </div>
  </div>`;

  c.innerHTML = html;
}

/* ── Reference popup ──────────────────────────────────── */
function showRefPopup(id, type) {
  const body = document.getElementById('ref-modal-body');
  let item, subtitle, labelClass;

  if (type === 'nmc') {
    item = nmc.find(s => s.id === id);
    if (!item) return;
    const pNum = typeof item.platform === 'number';
    subtitle = pNum
      ? `Platform ${item.platform}: ${item.platformTitle}`
      : item.platformTitle;
    labelClass = 'popup-label-nmc';
  } else {
    item = programme.find(p => p.id === id);
    if (!item) return;
    subtitle = `Category ${item.category}: ${item.categoryTitle}`;
    labelClass = 'popup-label-po';
  }

  body.innerHTML = `
    <div class="popup-label ${labelClass}">${type === 'nmc' ? 'NMC Standard' : 'Programme Outcome'}</div>
    <div class="popup-id">${item.id}</div>
    <div class="popup-subtitle">${subtitle}</div>
    <div class="popup-text">${item.text}</div>`;

  document.getElementById('ref-modal').classList.add('active');
}

function closeRefPopup(e) {
  if (e && e.target !== document.getElementById('ref-modal')) return;
  document.getElementById('ref-modal').classList.remove('active');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('ref-modal').classList.remove('active');
});

/* ── Filter event wiring ──────────────────────────────── */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const ft = this.dataset.filter;
    document.querySelectorAll(`.filter-btn[data-filter="${ft}"]`).forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    filters[ft] = this.dataset.value;
    render();
  });
});

document.getElementById('search').addEventListener('input', function () {
  filters.search = this.value.trim();
  render();
});

loadData();
