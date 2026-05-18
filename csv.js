function exportCSV() {
  const fu = getFilteredUnits();
  const rows = [
    ["Unit Code","Unit Title","Year","Level","Credits","Fields","Discovery","Outcome Text","Category","NMC Standards","Programme Outcomes","Assessment"]
  ];
  fu.forEach(u => {
    const fields = (u.fields || []).join('; ');
    const assess = (u.assessments || []).map(a => `${a.type}${a.length ? ' (' + a.length + ')' : ''}`).join('; ');
    u.outcomes.forEach(o => {
      rows.push([
        u.code,
        u.title,
        u.year,
        u.level,
        u.credits,
        fields,
        u.discovery ? 'Yes' : 'No',
        o.text,
        o.category,
        (o.nmc || []).join('; '),
        (o.po  || []).join('; '),
        assess
      ]);
    });
  });

  const csv = rows.map(r =>
    r.map(v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(',')
  ).join('\r\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bnurs_curriculum_mapping.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
