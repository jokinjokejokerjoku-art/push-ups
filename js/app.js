const dateInput = document.getElementById('dateInput');
const countInput = document.getElementById('countInput');
const formInput = document.getElementById('formInput');
const addBtn = document.getElementById('addBtn');
const filterSelect = document.getElementById('filterSelect');
const recordsTableBody = document.querySelector('#recordsTable tbody');
const totalText = document.getElementById('totalText');

let records = [];

const FORM_KEYS = ['normal','bar','decline'];
const FORM_LABEL = { normal: '通常', bar: 'プッシュアップバーあり', decline: 'デクライン' };
const FORM_COLOR = { normal: '#2563eb', bar: '#10b981', decline: '#f97316' };

function hexToRgba(hex, alpha){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16);
  const g = parseInt(h.substring(2,4),16);
  const b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function load() {
  const raw = localStorage.getItem('pushup_records');
  records = raw ? JSON.parse(raw) : [];
  // normalize existing entries to ensure form and id
  records = records.map(r => ({
    id: r.id || (Date.now() + Math.random()),
    date: r.date,
    count: Number(r.count) || 0,
    form: r.form || 'normal'
  }));
}

function save() {
  localStorage.setItem('pushup_records', JSON.stringify(records));
}

function aggregateByDate(filter){
  // returns array of {date, totals: {normal,bar,decline}}
  const map = {};
  records.forEach(r => {
    if (filter && filter !== 'all' && r.form !== filter) return;
    if (!map[r.date]) map[r.date] = { date: r.date, totals: { normal:0, bar:0, decline:0 } };
    map[r.date].totals[r.form] += Number(r.count);
  });
  return Object.values(map).sort((a,b)=>a.date.localeCompare(b.date));
}

function renderTable() {
  recordsTableBody.innerHTML = '';
  const filter = filterSelect.value || 'all';
  const rows = aggregateByDate(filter);
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.date}</td><td>${row.totals.normal}</td><td>${row.totals.bar}</td><td>${row.totals.decline}</td><td><button data-date="${row.date}" class="del-date">日付削除</button></td>`;
    recordsTableBody.appendChild(tr);
  });
}

function updateSummary() {
  const filter = filterSelect.value || 'all';
  const total = records
    .filter(r=> filter==='all' ? true : r.form===filter)
    .reduce((s,r)=>s+Number(r.count), 0);
  totalText.textContent = `合計: ${total}`;
}

let chart;
function renderChart() {
  const filter = filterSelect.value || 'all';
  const ctx = document.getElementById('pushupChart').getContext('2d');
  if (chart) chart.destroy();

  if (filter === 'all'){
    const rows = aggregateByDate('all');
    const dates = rows.map(r=>r.date);
    const datasets = FORM_KEYS.map(key => ({
      label: FORM_LABEL[key],
      data: rows.map(r=>r.totals[key]),
      borderColor: FORM_COLOR[key],
      backgroundColor: hexToRgba(FORM_COLOR[key], 0.08),
      tension: 0.2,
      fill: false,
      pointRadius: 3
    }));

    chart = new Chart(ctx, {
      type: 'line',
      data: { labels: dates, datasets },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: true } }
      }
    });

  } else {
    const sorted = [...records]
      .filter(r=> r.form===filter)
      .sort((a,b)=>a.date.localeCompare(b.date));
    const labels = sorted.map(r=>r.date);
    const data = sorted.map(r=>Number(r.count));

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: FORM_LABEL[filter] || filter,
          data,
          borderColor: FORM_COLOR[filter] || '#2563eb',
          backgroundColor: hexToRgba(FORM_COLOR[filter] || '#2563eb', 0.1),
          tension: 0.2,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: FORM_COLOR[filter] || '#2563eb'
        }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } }
      }
    });
  }
}

function refresh() {
  load();
  renderTable();
  updateSummary();
  renderChart();
}

function formatDateLocal(d){
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

// ensure no max attribute prevents past dates
if (dateInput && dateInput.removeAttribute) {
  try { dateInput.removeAttribute('max'); } catch(e){}
}

addBtn.addEventListener('click', ()=>{
  // normalize and accept past dates
  let raw = (dateInput.value || '').trim();
  let date;
  if (!raw) {
    date = formatDateLocal(new Date());
  } else {
    // try to parse common formats and produce YYYY-MM-DD
    // If input already in YYYY-MM-DD, keep it
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      date = raw;
    } else if (/^\d{4}\/\d{2}\/\d{2}$/.test(raw)) {
      date = raw.replace(/\//g,'-');
    } else {
      // fallback: try constructing Date and formatting
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) {
        date = formatDateLocal(parsed);
      } else {
        // if still invalid, use today
        date = formatDateLocal(new Date());
      }
    }
  }

  const count = Number(countInput.value) || 0;
  const form = formInput.value || 'normal';
  records.push({id: Date.now() + Math.random(), date, count, form});
  save();
  refresh();
});

recordsTableBody.addEventListener('click', (e)=>{
  if (e.target.matches('.del-date')){
    const date = e.target.dataset.date;
    if (!confirm(`${date} の記録をすべて削除しますか？`)) return;
    records = records.filter(r=>r.date !== date);
    save();
    refresh();
  }
});

filterSelect.addEventListener('change', ()=>refresh());

// init
if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0,10);
refresh();