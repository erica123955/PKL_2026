// ============================================================
// EWS BTN KC KEDIRI — main.js v3
// ============================================================

const navItems    = document.querySelectorAll('.nav-item');
const pages       = document.querySelectorAll('.page');
const pageTitleEl = document.getElementById('pageTitle');
const heroBanner  = document.getElementById('heroBanner');
const hamburger   = document.getElementById('hamburger');
const sidebar     = document.getElementById('sidebar');

const PAGE_TITLES = {
  dashboard:'Dashboard EWS', predict:'Prediksi Status EWS Debitur',
  analysis:'Analisis Information Gain & Entropy', accuracy:'Evaluasi Akurasi Model ID3',
  tree:'Visualisasi Pohon Keputusan ID3', compare:'Perbandingan Antar Bulan',
  data:'Kelola Data Debitur'
};

navItems.forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const t = item.dataset.page;
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + t).classList.add('active');
    pageTitleEl.textContent = PAGE_TITLES[t] || t;
    heroBanner.style.display = t === 'dashboard' ? 'flex' : 'none';
    if (window.innerWidth < 768) sidebar.classList.remove('open');
    if (t === 'analysis') loadAnalysis(currentAnalysisMonth);
    if (t === 'accuracy') loadAccuracy(currentAccMonth);
    if (t === 'tree')     loadTree(currentTreeMonth);
    if (t === 'compare')  { compareLoaded = false; loadCompare(); }
  });
});

hamburger.addEventListener('click', () => sidebar.classList.toggle('open'));

// ============================================================
// DASHBOARD
// ============================================================
let pieChartInstance = null;
let lineChartInstance = null;
let currentPieMonth = allMonths[0];

function initDashboardCharts() {
  buildPieChart(currentPieMonth);
  buildLineChart();
}

function buildPieChart(mk) {
  const ctx = document.getElementById('pieChart').getContext('2d');
  if (pieChartInstance) pieChartInstance.destroy();
  const s = dashStats[mk];
  if (!s) return;
  pieChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['HIJAU','KUNING','MERAH'],
      datasets: [{ data:[s.hijau,s.kuning,s.merah],
        backgroundColor:['#22c55e','#eab308','#ef4444'],
        borderWidth:3, borderColor:'#fff', hoverOffset:8 }]
    },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'60%',
      plugins: {
        legend:{ position:'bottom', labels:{ font:{size:12}, padding:12 } },
        tooltip:{ callbacks:{ label: c => {
          const pct = ((c.raw/s.total)*100).toFixed(1);
          return ` ${c.label}: ${c.raw.toLocaleString()} (${pct}%)`;
        }}}
      }
    }
  });
  document.getElementById('pieCenter').innerHTML =
    `<div style="font-size:1.4rem;font-weight:800;color:#1e293b">${s.total.toLocaleString()}</div>
     <div style="font-size:0.68rem;color:#64748b">Debitur</div>`;
}

function buildLineChart() {
  const ctx = document.getElementById('lineChart').getContext('2d');
  if (lineChartInstance) lineChartInstance.destroy();
  const months  = allMonths;
  const labels  = months.map(m => (monthShort[m] || m).replace(' 2025','').replace(' 2026',''));
  const hijaus  = months.map(m => dashStats[m] ? dashStats[m].hijau  : 0);
  const kunings = months.map(m => dashStats[m] ? dashStats[m].kuning : 0);
  const merahs  = months.map(m => dashStats[m] ? dashStats[m].merah  : 0);
  const allV    = [...hijaus,...kunings,...merahs].filter(v=>v>0);
  const yMin    = allV.length ? Math.max(0,Math.min(...allV)-20) : 0;
  const yMax    = allV.length ? Math.max(...allV)+30 : 100;
  lineChartInstance = new Chart(ctx, {
    type:'line',
    data:{ labels,
      datasets:[
        {label:'HIJAU', data:hijaus, borderColor:'#16a34a',backgroundColor:'rgba(22,163,74,0.1)',tension:0.4,fill:true,pointRadius:6,borderWidth:2.5},
        {label:'KUNING',data:kunings,borderColor:'#d97706',backgroundColor:'rgba(217,119,6,0.1)', tension:0.4,fill:true,pointRadius:6,borderWidth:2.5},
        {label:'MERAH', data:merahs, borderColor:'#dc2626',backgroundColor:'rgba(220,38,38,0.07)',tension:0.4,fill:true,pointRadius:6,borderWidth:2.5}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:10}}},
      scales:{y:{min:yMin,max:yMax,grid:{color:'#f1f5f9'},ticks:{font:{size:10}}},
              x:{grid:{color:'#f1f5f9'},ticks:{font:{size:11}}}}}
  });
}

document.querySelectorAll('.pie-month-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pie-month-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPieMonth = btn.dataset.pm;
    buildPieChart(currentPieMonth);
  });
});

// ============================================================
// PREDICT
// ============================================================
document.getElementById('btnPredict').addEventListener('click', () => {
  const payload = {
    month:document.getElementById('predMonth').value,
    DPD_KAT:document.getElementById('fDpd').value,
    TUNGGAKAN_KAT:document.getElementById('fTunggakan').value,
    ANGSURAN_KAT:document.getElementById('fAngsuran').value,
    RATE_KAT:document.getElementById('fRate').value,
    BAYAR_BELUM:document.getElementById('fBayar').value,
    KELOLAAN_KAT:document.getElementById('fKelolaan').value
  };
  fetch('/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
  .then(r=>r.json()).then(d => {
    if (d.error) { showToast(d.error,'error'); return; }
    const card=document.getElementById('resultCard');
    const badge=document.getElementById('resultBadge');
    badge.textContent=d.icon+'  '+d.result;
    badge.style.background=d.color+'22'; badge.style.color=d.color; badge.style.border='3px solid '+d.color;
    document.getElementById('resultMonth').textContent='Bulan Data: '+d.month;
    document.getElementById('resultAction').textContent=d.action;
    document.getElementById('resultTrace').innerHTML='<strong>Input:</strong> DPD='+payload.DPD_KAT+' | Tunggakan='+payload.TUNGGAKAN_KAT+' | Bayar='+payload.BAYAR_BELUM;
    card.style.display='block';
    card.scrollIntoView({behavior:'smooth',block:'nearest'});
  }).catch(e=>alert('Error: '+e));
});

// ============================================================
// ANALYSIS
// ============================================================
let currentAnalysisMonth = allMonths[0];
let igChartInstance = null;

document.querySelectorAll('#analysisPills .pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#analysisPills .pill').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentAnalysisMonth = btn.dataset.month;
    loadAnalysis(currentAnalysisMonth);
  });
});

function loadAnalysis(month) {
  const container = document.getElementById('analysisContent');
  container.innerHTML = '<div class="loading-spinner"><i class="fa fa-spinner fa-spin"></i> Memuat analisis...</div>';
  fetch('/analysis/'+month).then(r=>r.json()).then(d => {
    const maxIG = Math.max(...Object.values(d.information_gain));
    const maxFI = Math.max(...Object.values(d.feature_importance));
    const igBars = Object.entries(d.information_gain).sort((a,b)=>b[1]-a[1]).map(([f,v])=>
      `<div class="ig-bar-row"><span class="ig-feat-name">${f}</span>
       <div class="ig-bar-outer"><div class="ig-bar-inner" style="width:${(v/maxIG*100).toFixed(1)}%"></div></div>
       <span class="ig-val">${v.toFixed(5)}</span></div>`).join('');
    const fiBars = Object.entries(d.feature_importance).sort((a,b)=>b[1]-a[1]).map(([f,v])=>
      `<div class="ig-bar-row"><span class="ig-feat-name">${f}</span>
       <div class="ig-bar-outer"><div class="ig-bar-inner" style="width:${(v/maxFI*100).toFixed(1)}%;background:linear-gradient(90deg,#16a34a,#22c55e)"></div></div>
       <span class="ig-val">${v.toFixed(2)}%</span></div>`).join('');
    const logRows = (d.build_log||[]).map(l=>
      `<div class="log-row"><span>${l.depth}</span><span>${l.feature}</span><span>${l.gain.toFixed(5)}</span><span>${l.samples}</span><span>${l.entropy.toFixed(4)}</span></div>`).join('');
    container.innerHTML =
      `<div class="analysis-grid">
        <div class="info-card"><h3>📊 Statistik — ${d.month}</h3>
          <div class="metric-row"><span class="metric-label">Total Debitur</span><span class="metric-val">${d.total.toLocaleString()}</span></div>
          <div class="metric-row"><span class="metric-label">Akurasi Model</span><span class="metric-val" style="color:#16a34a">${d.accuracy}%</span></div>
          <div class="metric-row"><span class="metric-label">Entropy Total</span><span class="metric-val">${d.total_entropy}</span></div>
          <div class="metric-row"><span class="metric-label">EWS HIJAU</span><span class="metric-val" style="color:#22c55e">${d.distribution.HIJAU.toLocaleString()} (${d.pct.HIJAU}%)</span></div>
          <div class="metric-row"><span class="metric-label">EWS KUNING</span><span class="metric-val" style="color:#ca8a04">${d.distribution.KUNING.toLocaleString()} (${d.pct.KUNING}%)</span></div>
          <div class="metric-row"><span class="metric-label">EWS MERAH</span><span class="metric-val" style="color:#dc2626">${d.distribution.MERAH.toLocaleString()} (${d.pct.MERAH}%)</span></div>
        </div>
        <div class="info-card"><h3>📐 Information Gain per Fitur</h3>${igBars}</div>
        <div class="info-card"><h3>⭐ Feature Importance</h3>${fiBars}</div>
        <div class="info-card"><h3>🪵 Build Log</h3>
          <div class="build-log"><div class="log-row header"><span>Depth</span><span>Fitur</span><span>Gain</span><span>Samples</span><span>Entropy</span></div>${logRows}</div>
        </div>
        <div class="info-card" style="grid-column:1/-1"><h3>📈 Information Gain Chart</h3><div style="height:220px;position:relative"><canvas id="igChart"></canvas></div></div>
      </div>`;
    if (igChartInstance) igChartInstance.destroy();
    const igSorted = Object.entries(d.information_gain).sort((a,b)=>b[1]-a[1]);
    igChartInstance = new Chart(document.getElementById('igChart').getContext('2d'),{
      type:'bar',data:{labels:igSorted.map(x=>x[0]),datasets:[{label:'IG',data:igSorted.map(x=>x[1]),
        backgroundColor:['#003080','#1565c0','#1976d2','#1e88e5','#42a5f5','#90caf9'],borderRadius:6}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{y:{beginAtZero:true,max:Math.max(...igSorted.map(x=>x[1]))*1.15,grid:{color:'#f1f5f9'},ticks:{font:{size:10}}},
                x:{ticks:{font:{size:10}}}}}});
  });
}

// ============================================================
// ACCURACY PAGE
// ============================================================
let currentAccMonth = allMonths[0];
let accChartInstances = {};

document.querySelectorAll('#accPills .pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#accPills .pill').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentAccMonth = btn.dataset.accMonth;
    loadAccuracy(currentAccMonth);
  });
});

function loadAccuracy(month) {
  const container = document.getElementById('accContent');
  container.innerHTML='<div class="loading-spinner"><i class="fa fa-spinner fa-spin"></i> Menghitung akurasi...</div>';
  fetch('/accuracy/'+month).then(r=>r.json()).then(d => {
    const labels = ['HIJAU','KUNING','MERAH'];
    const clsColor = {HIJAU:'#16a34a',KUNING:'#ca8a04',MERAH:'#dc2626'};
    const clsBg    = {HIJAU:'#f0fdf4',KUNING:'#fefce8',MERAH:'#fef2f2'};

    // Confusion matrix HTML
    const cmRows = labels.map(actual =>
      `<tr>
        <td class="cm-label" style="color:${clsColor[actual]};font-weight:700">${actual}</td>
        ${labels.map(pred => {
          const v = d.confusion[actual] ? (d.confusion[actual][pred]||0) : 0;
          const isDiag = actual===pred;
          return `<td class="cm-cell ${isDiag?'cm-diag':''}" ${isDiag?`style="background:${clsBg[actual]};color:${clsColor[actual]};font-weight:800"`:''}>
            ${v.toLocaleString()}</td>`;
        }).join('')}
      </tr>`).join('');

    // Per-class metrics
    const pcCards = labels.map(cls => {
      const pc = d.per_class[cls] || {};
      const pct = pc.support && d.total ? ((pc.support/d.total)*100).toFixed(1) : 0;
      return `<div class="pc-card" style="border-top:3px solid ${clsColor[cls]}">
        <div class="pc-head" style="color:${clsColor[cls]}">${cls}</div>
        <div class="pc-support">${(pc.support||0).toLocaleString()} sampel (${pct}%)</div>
        <div class="pc-metrics">
          <div class="pc-metric"><span>Precision</span><strong>${pc.precision||0}%</strong></div>
          <div class="pc-metric"><span>Recall</span><strong>${pc.recall||0}%</strong></div>
          <div class="pc-metric"><span>F1-Score</span><strong>${pc.f1||0}%</strong></div>
        </div>
        <div class="pc-tp">TP:${pc.tp||0} FP:${pc.fp||0} FN:${pc.fn||0}</div>
      </div>`;
    }).join('');

    // Build steps
    const stepRows = (d.build_steps||[]).map((s,i)=>
      `<div class="build-step-row">
        <div class="bsr-depth">Depth ${s.depth}</div>
        <div class="bsr-feat"><i class="fa fa-code-branch" style="color:#1e88e5;margin-right:4px"></i>${s.feature}</div>
        <div class="bsr-gain">IG = <strong>${s.gain.toFixed(6)}</strong></div>
        <div class="bsr-samples"><i class="fa fa-users" style="color:#64748b;margin-right:4px"></i>${s.samples.toLocaleString()} sampel</div>
        <div class="bsr-ent">H = ${s.entropy.toFixed(4)}</div>
      </div>`).join('');

    // FI bars
    const fiRows = (d.feature_importance||[]).map(([f,v])=>
      `<div class="ig-bar-row"><span class="ig-feat-name">${f}</span>
       <div class="ig-bar-outer"><div class="ig-bar-inner" style="width:${v}%;background:linear-gradient(90deg,#003080,#1e88e5)"></div></div>
       <span class="ig-val">${v}%</span></div>`).join('');

    // Accuracy grade
    const acc = d.accuracy;
    let grade = 'Sangat Baik', gradeColor = '#16a34a';
    if (acc < 70) { grade='Kurang'; gradeColor='#dc2626'; }
    else if (acc < 80) { grade='Cukup'; gradeColor='#ca8a04'; }
    else if (acc < 90) { grade='Baik'; gradeColor='#2563eb'; }

    container.innerHTML = `
      <!-- RINGKASAN AKURASI -->
      <div class="acc-summary-row">
        <div class="acc-big-card">
          <div class="acc-big-label">Akurasi Keseluruhan</div>
          <div class="acc-big-val" style="color:${gradeColor}">${acc}%</div>
          <div class="acc-big-grade" style="background:${gradeColor}22;color:${gradeColor}">${grade}</div>
          <div class="acc-big-detail">
            <span><i class="fa fa-check-circle" style="color:#16a34a"></i> Benar: ${d.correct.toLocaleString()}</span>
            <span><i class="fa fa-times-circle" style="color:#dc2626"></i> Salah: ${d.wrong.toLocaleString()}</span>
            <span><i class="fa fa-database" style="color:#1e88e5"></i> Total: ${d.total.toLocaleString()}</span>
          </div>
        </div>
        <div class="acc-tree-stats">
          <h3>🌳 Statistik Pohon</h3>
          <div class="metric-row"><span class="metric-label">Entropy Dataset</span><span class="metric-val">${d.total_entropy}</span></div>
          <div class="metric-row"><span class="metric-label">Jumlah Node</span><span class="metric-val">${d.n_nodes}</span></div>
          <div class="metric-row"><span class="metric-label">Jumlah Leaf</span><span class="metric-val">${d.n_leaves}</span></div>
          <div class="metric-row"><span class="metric-label">Kedalaman Pohon</span><span class="metric-val">${d.n_depth}</span></div>
          <div class="metric-row"><span class="metric-label">Fitur Digunakan</span><span class="metric-val">${(d.feature_importance||[]).length}</span></div>
          <div class="metric-row"><span class="metric-label">Max Depth Config</span><span class="metric-val">6</span></div>
        </div>
        <div class="acc-chart-mini">
          <h3>📊 Prediksi vs Aktual</h3>
          <div style="height:180px;position:relative"><canvas id="accBarChart"></canvas></div>
        </div>
      </div>

      <!-- CONFUSION MATRIX -->
      <div class="section-title" style="margin-top:1.5rem"><i class="fa fa-table"></i> Confusion Matrix</div>
      <div class="cm-wrap">
        <div class="cm-desc">
          <p>Setiap baris = kelas <strong>aktual</strong>, setiap kolom = kelas <strong>prediksi</strong>. Diagonal (warna) = prediksi benar.</p>
        </div>
        <div class="cm-table-wrap">
          <table class="cm-table">
            <thead>
              <tr>
                <th class="cm-corner">Aktual ╲ Prediksi</th>
                ${labels.map(l=>`<th style="color:${clsColor[l]}">${l}</th>`).join('')}
              </tr>
            </thead>
            <tbody>${cmRows}</tbody>
          </table>
        </div>
      </div>

      <!-- PER CLASS -->
      <div class="section-title" style="margin-top:1.5rem"><i class="fa fa-chart-pie"></i> Metrik per Kelas EWS</div>
      <div class="pc-grid">${pcCards}</div>

      <!-- LANGKAH PENGERJAAN -->
      <div class="section-title" style="margin-top:1.5rem"><i class="fa fa-list-ol"></i> Langkah Pengerjaan Pohon (Build Log)</div>
      <div class="build-steps-card">
        <p class="build-steps-desc">Berikut adalah setiap keputusan split yang diambil algoritma ID3 saat membangun pohon, diurutkan dari root (Depth 0) ke bawah:</p>
        <div class="build-steps-list">${stepRows}</div>
      </div>

      <!-- FEATURE IMPORTANCE -->
      <div class="section-title" style="margin-top:1.5rem"><i class="fa fa-star"></i> Kontribusi Fitur terhadap Akurasi</div>
      <div class="info-card" style="padding:18px">${fiRows}</div>

      <!-- INTERPRETASI HASIL -->
      <div class="section-title" style="margin-top:1.5rem"><i class="fa fa-lightbulb"></i> Interpretasi Hasil</div>
      <div class="acc-interp-card">
        <div class="interp-item">
          <div class="interp-icon" style="background:#e8f0fe">📌</div>
          <div><strong>Akurasi ${acc}%</strong> berarti dari ${d.total.toLocaleString()} debitur, sebanyak ${d.correct.toLocaleString()} diklasifikasikan dengan benar oleh model ID3.</div>
        </div>
        <div class="interp-item">
          <div class="interp-icon" style="background:#f0fdf4">🌳</div>
          <div>Pohon memiliki kedalaman <strong>${d.n_depth} level</strong> dengan <strong>${d.n_leaves} simpul daun</strong>, menghasilkan ${d.n_leaves} kombinasi rule keputusan unik.</div>
        </div>
        <div class="interp-item">
          <div class="interp-icon" style="background:#fefce8">⚡</div>
          <div>Fitur paling berpengaruh adalah <strong>${(d.feature_importance||[])[0]?.[0]||'-'}</strong> dengan kontribusi ${(d.feature_importance||[])[0]?.[1]||0}% terhadap proses pemilihan split.</div>
        </div>
        <div class="interp-item">
          <div class="interp-icon" style="background:#fef2f2">📋</div>
          <div>Entropy dataset awal sebesar <strong>${d.total_entropy}</strong> — semakin mendekati 0, semakin murni kelas dalam dataset tersebut.</div>
        </div>
      </div>
    `;

    // Mini bar chart: predicted vs actual count
    const predCounts  = {HIJAU:0, KUNING:0, MERAH:0};
    const actualCounts = {HIJAU:0, KUNING:0, MERAH:0};
    labels.forEach(l => {
      if (d.per_class[l]) {
        actualCounts[l] = d.per_class[l].support || 0;
        labels.forEach(p => { predCounts[p] = (predCounts[p]||0) + (d.confusion[l]?.[p]||0); });
      }
    });
    if (accChartInstances['bar']) accChartInstances['bar'].destroy();
    accChartInstances['bar'] = new Chart(document.getElementById('accBarChart').getContext('2d'),{
      type:'bar',
      data:{labels,datasets:[
        {label:'Aktual', data:labels.map(l=>actualCounts[l]), backgroundColor:'rgba(30,136,229,0.7)',borderRadius:5},
        {label:'Prediksi',data:labels.map(l=>predCounts[l]),  backgroundColor:'rgba(22,163,74,0.7)', borderRadius:5}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10},padding:8}}},
        scales:{y:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{font:{size:9}}},x:{ticks:{font:{size:10}}}}}
    });
  });
}

// ============================================================
// TREE
// ============================================================
let currentTreeMonth = allMonths[0];

document.querySelectorAll('#treePills .pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#treePills .pill').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentTreeMonth = btn.dataset.monthTree;
    loadTree(currentTreeMonth);
  });
});

function loadTree(month) {
  const c = document.getElementById('treeContainer');
  c.innerHTML='<div class="loading-spinner"><i class="fa fa-spinner fa-spin"></i> Memuat pohon...</div>';
  document.getElementById('treeInfoBar').innerHTML='';
  Promise.all([fetch('/tree/'+month).then(r=>r.json()),fetch('/analysis/'+month).then(r=>r.json())])
  .then(([tree,stats]) => {
    document.getElementById('treeInfoBar').innerHTML=
      `<span><strong>Bulan:</strong> ${stats.month}</span>
       <span><strong>Total:</strong> ${stats.total.toLocaleString()}</span>
       <span><strong>Akurasi:</strong> ${stats.accuracy}%</span>
       <span><strong>Entropy:</strong> ${stats.total_entropy}</span>
       <span style="color:#64748b;font-size:0.75rem"><i class="fa fa-search-plus"></i> Scroll/pinch/drag</span>`;
    renderD3Tree(tree, c);
  });
}

function renderD3Tree(treeData, container) {
  container.innerHTML='';
  const colorLeaf = {HIJAU:'#22c55e',KUNING:'#eab308',MERAH:'#ef4444'};
  const shortMap  = {DPD_KAT:'DPD',TUNGGAKAN_KAT:'TUNGGAKAN',ANGSURAN_KAT:'ANGSURAN',RATE_KAT:'RATE',BAYAR_BELUM:'BAYAR',KELOLAAN_KAT:'KELOLAAN'};
  const root = d3.hierarchy(treeData, d => {
    if (d.is_leaf||!d.children) return null;
    return Object.entries(d.children).map(([k,v])=>Object.assign({},v,{_edgeLabel:k}));
  });
  const nc = root.descendants().length;
  const NW = nc>60?90:nc>30?110:130;
  const NH = nc>60?55:nc>30?65:75;
  const leaves = root.leaves().length;
  const depth  = root.height;
  const W = Math.max(leaves*NW+100,900);
  const H = Math.max((depth+1)*NH+120,480);
  const svgEl = d3.select(container).append('svg').attr('width',W).attr('height',H).style('background','#fafbff').style('display','block');
  const g = svgEl.append('g').attr('transform','translate(0,50)');
  svgEl.call(d3.zoom().scaleExtent([0.15,3]).on('zoom',e=>g.attr('transform',e.transform)));
  d3.tree().size([W-60,H-120]).separation((a,b)=>a.parent===b.parent?1:1.5)(root);
  g.selectAll('.link').data(root.links()).join('path').attr('class','link')
    .attr('d',d3.linkVertical().x(d=>d.x).y(d=>d.y))
    .style('fill','none').style('stroke','#cbd5e1').style('stroke-width','1.8px');
  g.selectAll('.edge-label').data(root.links()).join('text').attr('class','edge-label')
    .attr('x',d=>(d.source.x+d.target.x)/2).attr('y',d=>(d.source.y+d.target.y)/2-2)
    .attr('text-anchor','middle').style('font-size','8px').style('fill','#94a3b8')
    .text(d=>{const l=d.target.data._edgeLabel||'';return l.length>14?l.substring(0,12)+'…':l;});
  const nodeR = nc>60?14:17;
  const node  = g.selectAll('.node').data(root.descendants()).join('g').attr('transform',d=>`translate(${d.x},${d.y})`);
  node.filter(d=>!d.data.is_leaf).append('rect')
    .attr('x',-nodeR*1.6).attr('y',-nodeR).attr('width',nodeR*3.2).attr('height',nodeR*2).attr('rx',5)
    .style('fill','#fff').style('stroke','#003080').style('stroke-width','2px')
    .style('filter','drop-shadow(0 1px 3px rgba(0,0,64,0.12))');
  node.filter(d=>!d.data.is_leaf).append('text').attr('text-anchor','middle').attr('dy','-3px')
    .style('font-size',nc>60?'7px':'8px').style('font-weight','700').style('fill','#003080')
    .text(d=>shortMap[d.data.feature]||d.data.feature||'');
  node.filter(d=>!d.data.is_leaf).append('text').attr('text-anchor','middle').attr('dy','9px')
    .style('font-size','7px').style('fill','#94a3b8').text(d=>'n='+d.data.samples);
  node.filter(d=>d.data.is_leaf).append('circle').attr('r',nodeR)
    .style('fill',d=>colorLeaf[d.data.label]||'#94a3b8').style('stroke-width','2.5px')
    .style('filter','drop-shadow(0 1px 4px rgba(0,0,0,0.15))');
  node.filter(d=>d.data.is_leaf).append('text').attr('text-anchor','middle').attr('dy','4px')
    .style('font-size','7.5px').style('font-weight','800').style('fill','#fff')
    .text(d=>(d.data.label||'?').substring(0,5));
  node.filter(d=>d.data.is_leaf).append('text').attr('text-anchor','middle').attr('dy',nodeR+11+'px')
    .style('font-size','7px').style('fill','#64748b').text(d=>'n='+d.data.samples);
}

// ============================================================
// COMPARE
// ============================================================
let compareLoaded = false;

function loadCompare() {
  if (compareLoaded) return;
  const c = document.getElementById('compareContent');
  c.innerHTML='<div class="loading-spinner"><i class="fa fa-spinner fa-spin"></i> Memuat...</div>';
  fetch('/compare').then(r=>r.json()).then(data => {
    compareLoaded = true;
    const months = Object.keys(data);
    const cards = months.map(m => {
      const d=data[m],dist=d.distribution,total=d.total;
      const top=Object.entries(d.information_gain).sort((a,b)=>b[1]-a[1])[0];
      return `<div class="compare-card">
        <div class="compare-month">${d.label}</div>
        <span class="compare-acc">Akurasi: ${d.accuracy}%</span>
        <div class="metric-row"><span class="metric-label">Total</span><span class="metric-val">${total.toLocaleString()}</span></div>
        <div class="metric-row"><span class="metric-label">HIJAU</span><span class="metric-val" style="color:#16a34a">${(dist.HIJAU||0).toLocaleString()} (${((dist.HIJAU||0)/total*100).toFixed(1)}%)</span></div>
        <div class="metric-row"><span class="metric-label">KUNING</span><span class="metric-val" style="color:#ca8a04">${(dist.KUNING||0).toLocaleString()} (${((dist.KUNING||0)/total*100).toFixed(1)}%)</span></div>
        <div class="metric-row"><span class="metric-label">MERAH</span><span class="metric-val" style="color:#dc2626">${(dist.MERAH||0).toLocaleString()} (${((dist.MERAH||0)/total*100).toFixed(1)}%)</span></div>
        <div class="metric-row"><span class="metric-label">Fitur Terpenting</span><span class="metric-val">${top?top[0]:'-'}</span></div>
      </div>`;
    }).join('');
    const allDist = months.flatMap(m=>[data[m].distribution.HIJAU||0,data[m].distribution.KUNING||0,data[m].distribution.MERAH||0]);
    const dMin=Math.max(0,Math.min(...allDist)-10), dMax=Math.max(...allDist)+20;
    c.innerHTML=`<div class="compare-grid">${cards}</div>
      <div class="compare-chart-row">
        <div class="chart-card"><div class="chart-title">📊 Distribusi EWS Antar Bulan</div><div style="height:240px;position:relative"><canvas id="cmpDist"></canvas></div></div>
        <div class="chart-card"><div class="chart-title">🕸 Information Gain Radar</div><div style="height:240px;position:relative"><canvas id="cmpIG"></canvas></div></div>
      </div>`;
    new Chart(document.getElementById('cmpDist').getContext('2d'),{type:'bar',
      data:{labels:months.map(m=>data[m].label.replace(' 2025','').replace(' 2026','')),datasets:[
        {label:'HIJAU', data:months.map(m=>data[m].distribution.HIJAU||0), backgroundColor:'#22c55e',borderRadius:5},
        {label:'KUNING',data:months.map(m=>data[m].distribution.KUNING||0),backgroundColor:'#eab308',borderRadius:5},
        {label:'MERAH', data:months.map(m=>data[m].distribution.MERAH||0), backgroundColor:'#ef4444',borderRadius:5}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:8}}},
        scales:{y:{min:dMin,max:dMax,grid:{color:'#f1f5f9'},ticks:{font:{size:10}}},x:{ticks:{font:{size:11}}}}}});
    const feats=['DPD_KAT','TUNGGAKAN_KAT','ANGSURAN_KAT','RATE_KAT','BAYAR_BELUM','KELOLAAN_KAT'];
    const shortF=['DPD','TUNGGAKAN','ANGSURAN','RATE','BAYAR','KELOLAAN'];
    new Chart(document.getElementById('cmpIG').getContext('2d'),{type:'radar',
      data:{labels:shortF,datasets:months.map((m,i)=>({
        label:data[m].label.replace(' 2025','').replace(' 2026',''),
        data:feats.map(f=>data[m].information_gain[f]||0),
        borderColor:['#1e88e5','#fb8c00','#e53935','#8e24aa','#00897b'][i],
        backgroundColor:['rgba(30,136,229,0.08)','rgba(251,140,0,0.08)','rgba(229,57,53,0.08)','rgba(142,36,170,0.08)','rgba(0,137,123,0.08)'][i],
        pointRadius:4,borderWidth:2}))},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:8}}},
        scales:{r:{beginAtZero:true,ticks:{font:{size:8},stepSize:0.1},pointLabels:{font:{size:10}}}}}});
  });
}

// ============================================================
// DATA MANAGEMENT — dynamic month support
// ============================================================
function toggleCustomLabel(prefix) {
  const sel   = document.getElementById(prefix+'Month');
  const panel = document.getElementById(prefix+'NewLabel');
  panel.style.display = sel.value === '__new__' ? 'block' : 'none';
}

function resolveMonth(prefix) {
  const sel = document.getElementById(prefix+'Month');
  if (sel.value !== '__new__') return { key: sel.value, label: monthLabels[sel.value]||sel.value, valid: true };
  const code  = (document.getElementById(prefix+'MonthCode').value||'').trim().toUpperCase();
  const label = (document.getElementById(prefix+'MonthLabel').value||'').trim();
  if (!code) { showToast('Kode bulan tidak boleh kosong','error'); return { valid:false }; }
  if (!label){ showToast('Nama bulan tidak boleh kosong','error'); return { valid:false }; }
  return { key: code, label, valid: true };
}

function afterMonthAdded(mk, label, d) {
  // Update month lists everywhere
  if (!allMonths.includes(mk)) {
    allMonths.push(mk);
    monthLabels[mk] = label;
    // Add pills to analysis, accuracy, tree pages
    ['analysisPills','accPills','treePills'].forEach(id => {
      const pills = document.getElementById(id);
      if (pills && !pills.querySelector(`[data-month="${mk}"]`) && !pills.querySelector(`[data-month-tree="${mk}"]`) && !pills.querySelector(`[data-acc-month="${mk}"]`)) {
        const btn = document.createElement('button');
        btn.className = 'pill';
        const attr = id==='treePills'?'data-month-tree': id==='accPills'?'data-acc-month':'data-month';
        btn.setAttribute(attr, mk);
        btn.textContent = label;
        pills.appendChild(btn);
        btn.addEventListener('click', () => {
          pills.querySelectorAll('.pill').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
          if (id==='analysisPills'){ currentAnalysisMonth=mk; loadAnalysis(mk); }
          if (id==='accPills'){ currentAccMonth=mk; loadAccuracy(mk); }
          if (id==='treePills'){ currentTreeMonth=mk; loadTree(mk); }
        });
      }
    });
    // Add to predict select
    ['predMonth','uploadMonth','manualMonth'].forEach(selId => {
      const sel = document.getElementById(selId);
      if (sel && !sel.querySelector(`option[value="${mk}"]`)) {
        const opt = document.createElement('option');
        opt.value = mk; opt.textContent = label;
        sel.insertBefore(opt, sel.querySelector('option[value="__new__"]'));
      }
    });
    // Add pie pill
    const piePills = document.getElementById('piePills');
    if (piePills && !piePills.querySelector(`[data-pm="${mk}"]`)) {
      const btn = document.createElement('button');
      btn.className='pie-month-btn'; btn.dataset.pm=mk; btn.textContent=mk;
      piePills.appendChild(btn);
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.pie-month-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active'); currentPieMonth=mk; buildPieChart(mk);
      });
    }
    dashStats[mk] = {label,total:0,hijau:0,kuning:0,merah:0,pct_hijau:0,pct_kuning:0,pct_merah:0,accuracy:0};
    monthShort[mk] = label.split(' ')[0];
  }
  // Update dashStats
  if (d.distribution) {
    const tot = d.total||0;
    dashStats[mk] = {
      label, total:tot,
      hijau: d.distribution.HIJAU||0, kuning:d.distribution.KUNING||0, merah:d.distribution.MERAH||0,
      pct_hijau: tot?((d.distribution.HIJAU||0)/tot*100).toFixed(1):0,
      pct_kuning:tot?((d.distribution.KUNING||0)/tot*100).toFixed(1):0,
      pct_merah: tot?((d.distribution.MERAH||0)/tot*100).toFixed(1):0,
      accuracy: d.accuracy||0
    };
  }
  // Add/update data status card
  const grid = document.getElementById('dataStatusGrid');
  let card = document.getElementById('dsCard_'+mk);
  if (!card && grid) {
    card = document.createElement('div');
    card.className='data-status-card'; card.id='dsCard_'+mk;
    card.innerHTML=`<div class="ds-head">${label}</div><div class="ds-body" id="dataSummary_${mk}"></div>
      <button class="btn-reset-extra" data-reset-month="${mk}"><i class="fa fa-trash"></i> Reset Data</button>`;
    grid.appendChild(card);
    card.querySelector('.btn-reset-extra').addEventListener('click', function(){
      const m=this.dataset.resetMonth;
      if(!confirm('Reset data untuk bulan ini?')) return;
      fetch('/reset_extra',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({month:m})})
      .then(r=>r.json()).then(d=>{ showToast(d.message||d.error, d.error?'error':'success'); compareLoaded=false; });
    });
  }
  updateDataSummary(mk, d);
  compareLoaded = false;
}

document.getElementById('btnUploadExcel').addEventListener('click', () => {
  const file = document.getElementById('uploadFile').files[0];
  if (!file) { showToast('Pilih file Excel terlebih dahulu','error'); return; }
  const m = resolveMonth('upload');
  if (!m.valid) return;
  const fd = new FormData();
  fd.append('file',file); fd.append('month',m.key); fd.append('month_label',m.label);
  fetch('/upload_excel',{method:'POST',body:fd}).then(r=>r.json()).then(d=>{
    if (d.error){ showToast(d.error,'error'); return; }
    showToast(d.message,'success');
    afterMonthAdded(m.key, d.label||m.label, d);
  }).catch(e=>showToast('Error: '+e,'error'));
});

document.getElementById('btnAddManual').addEventListener('click', () => {
  const m = resolveMonth('manual');
  if (!m.valid) return;
  const payload = {
    month:m.key, month_label:m.label,
    DPD_KAT:document.getElementById('mDpd').value,
    TUNGGAKAN_KAT:document.getElementById('mTunggakan').value,
    ANGSURAN_KAT:document.getElementById('mAngsuran').value,
    RATE_KAT:document.getElementById('mRate').value,
    BAYAR_BELUM:document.getElementById('mBayar').value,
    KELOLAAN_KAT:document.getElementById('mKelolaan').value,
    EWS:document.getElementById('mEws').value
  };
  fetch('/add_manual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
  .then(r=>r.json()).then(d=>{
    if (d.error){ showToast(d.error,'error'); return; }
    showToast(d.message,'success');
    afterMonthAdded(m.key, d.label||m.label, d);
  }).catch(e=>showToast('Error: '+e,'error'));
});

document.querySelectorAll('.btn-reset-extra').forEach(btn => {
  btn.addEventListener('click', function(){
    const mk = this.dataset.resetMonth;
    if(!confirm('Reset semua data tambahan untuk bulan ini?')) return;
    fetch('/reset_extra',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({month:mk})})
    .then(r=>r.json()).then(d=>{ showToast(d.message||d.error, d.error?'error':'success'); compareLoaded=false; });
  });
});

function updateDataSummary(mk, d) {
  const el = document.getElementById('dataSummary_'+mk);
  if (!el) return;
  const dist = d.distribution||{};
  el.innerHTML=`<strong>Total:</strong> ${(d.total||0).toLocaleString()}
    | <span style="color:#16a34a">H:${dist.HIJAU||0}</span>
    <span style="color:#ca8a04"> K:${dist.KUNING||0}</span>
    <span style="color:#dc2626"> M:${dist.MERAH||0}</span>
    | Akurasi: ${d.accuracy||0}%`;
}

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className='toast show '+type;
  setTimeout(()=>t.className='toast',3500);
}

// INIT
window.addEventListener('DOMContentLoaded', () => { initDashboardCharts(); });
