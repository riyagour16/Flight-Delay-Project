/**
 * p04.js — Airport Intelligence
 */
const Page04 = (() => {

  const CAUSE_COLORS = ['#3b82f6','#f97316','#14b8a6','#a855f7','#ef4444'];

  let _charts = {};
  function _destroy(k) { if (_charts[k]) { try { _charts[k].destroy(); } catch(e){} _charts[k] = null; } }

  function render() {
    const el = document.getElementById('p04');
    if (!el) return;

    el.innerHTML = `
      <div class="page-header">
        <h2>📍 Airport Intelligence</h2>
        <p>Where are the operational hotspots? Identify airports by delay intensity, not just raw volume.</p>
      </div>

      <!-- Top 10 bar + metric toggle -->
      <div class="card">
        <div class="card-title"><span class="card-icon">🏆</span>Top 10 Airport Hotspots</div>
        <div class="metric-toggle" id="p04-rank-toggle">
          <button class="metric-btn active" data-metric="delay_min_per_100">Min/100 Flights</button>
          <button class="metric-btn" data-metric="delay_rate">Delay Rate</button>
          <button class="metric-btn" data-metric="avg_delay_severity">Avg Severity</button>
          <button class="metric-btn" data-metric="cancellation_rate">Cancel Rate</button>
          <button class="metric-btn" data-metric="total_delay_min">Total Delay Min</button>
        </div>
        <div class="chart-wrap chart-lg"><canvas id="c-airport-top10"></canvas></div>
      </div>

      <div class="grid-2">
        <!-- Airport cause mix -->
        <div class="card">
          <div class="card-title"><span class="card-icon">🥧</span>Delay Cause Mix by Airport</div>
          <div style="margin-bottom:10px">
            <label style="font-size:11px;color:var(--text-muted);margin-right:8px">Select Airport:</label>
            <select id="p04-airport-select" class="filter-select" style="max-width:240px"></select>
          </div>
          <div class="chart-wrap chart-md"><canvas id="c-airport-cause-mix"></canvas></div>
        </div>

        <!-- Airport KPIs -->
        <div class="card">
          <div class="card-title"><span class="card-icon">📊</span>Airport Performance Metrics</div>
          <div id="p04-airport-kpis" class="kpi-grid" style="grid-template-columns:repeat(2,1fr)"></div>
          <hr class="divider" />
          <div class="card-title" style="margin-bottom:10px"><span class="card-icon">📋</span>Cause Breakdown</div>
          <div id="p04-cause-table"></div>
        </div>
      </div>

      <!-- Full ranked table -->
      <div class="card">
        <div class="card-title"><span class="card-icon">📋</span>Full Airport Comparison — Top 30</div>
        <div style="overflow-x:auto">
          <table class="data-table" id="p04-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Airport</th>
                <th data-sort="arr_flights">Flights ↕</th>
                <th data-sort="delay_rate">Delay Rate ↕</th>
                <th data-sort="avg_delay_severity">Avg Severity ↕</th>
                <th data-sort="cancellation_rate">Cancel Rate ↕</th>
                <th data-sort="delay_min_per_100">Min/100 ↕</th>
                <th data-sort="delay_propagation_idx">Propagation ↕</th>
              </tr>
            </thead>
            <tbody id="p04-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- What/Why/So What -->
      <div class="card">
        <div class="card-title"><span class="card-icon">💬</span>Analysis Framework</div>
        <div class="wws-grid">
          <div class="wws-card wws-what"><span class="wws-label">What Happened?</span><p id="p04-what">Loading…</p></div>
          <div class="wws-card wws-why"><span class="wws-label">Why?</span><p id="p04-why">Loading…</p></div>
          <div class="wws-card wws-sowhat"><span class="wws-label">So What?</span><p id="p04-sowhat">Loading…</p></div>
        </div>
      </div>
    `;

    _populateAirportSelect();
    _renderTop10('delay_min_per_100');
    _renderTable('delay_min_per_100', false);
    _renderAirportDrilldown();
    _renderWWS();
    _bindToggles();
  }

  function _populateAirportSelect() {
    const sel = document.getElementById('p04-airport-select');
    if (!sel) return;
    const top = DataEngine.getAirportRankings('delay_min_per_100', 30);
    sel.innerHTML = top.map(a =>
      `<option value="${a._key}">${a._key} — ${(a._name||'').split(':')[0].trim()}</option>`
    ).join('');
    sel.addEventListener('change', () => _renderAirportDrilldown(sel.value));
  }

  function _renderTop10(metric) {
    _destroy('top10');
    const D = DataEngine;
    const top = D.getAirportRankings(metric, 10);
    const net = D.getNetworkSummary();
    const avg = net[metric];
    const ctx = document.getElementById('c-airport-top10');
    if (!ctx) return;
    _charts.top10 = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top.map(r => r._key),
        datasets: [
          {
            label: _mLabel(metric),
            data: top.map(r => r[metric]),
            backgroundColor: top.map(r => r[metric] > avg * 1.2 ? 'rgba(239,68,68,0.75)' : 'rgba(245,158,11,0.7)'),
            borderRadius: 4,
          },
          {
            label: 'Network Avg',
            data: top.map(() => avg),
            type: 'line',
            borderColor: '#3b82f6',
            borderDash: [5,4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#6b7280', font: { size: 10 }, boxWidth: 12 } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${Number(c.raw).toFixed(1)}` } }
        },
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
          y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
        }
      }
    });
  }

  function _renderAirportDrilldown(code) {
    const D = DataEngine;
    const airportCode = code || document.getElementById('p04-airport-select')?.value;
    if (!airportCode) return;
    const rows = D.getFiltered().filter(r => r.airport === airportCode);
    if (!rows.length) return;
    const agg = D.aggregateRows(rows);

    // Donut
    _destroy('airportCauseMix');
    const ctx = document.getElementById('c-airport-cause-mix');
    if (ctx) {
      _charts.airportCauseMix = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Carrier','Late Aircraft','NAS','Weather','Security'],
          datasets: [{
            data: [agg.carrier_delay, agg.late_aircraft_delay, agg.nas_delay, agg.weather_delay, agg.security_delay],
            backgroundColor: CAUSE_COLORS,
            borderColor: '#161b22',
            borderWidth: 3,
            hoverOffset: 6,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: { position: 'right', labels: { color: '#6b7280', font: { size: 10 }, padding: 10 } },
            tooltip: { callbacks: { label: c => ` ${c.label}: ${(c.raw/60).toFixed(0)}h (${(c.raw/Math.max(agg.total_delay_min,1)*100).toFixed(1)}%)` } }
          }
        }
      });
    }

    // KPIs
    const f = D.fmt;
    const kpiEl = document.getElementById('p04-airport-kpis');
    if (kpiEl) {
      kpiEl.innerHTML = [
        { label: 'Total Flights',   value: f.num(agg.arr_flights),              color: '#3b82f6' },
        { label: 'Delay Rate',      value: f.pct(agg.delay_rate),               color: '#ef4444' },
        { label: 'Avg Severity',    value: agg.avg_delay_severity.toFixed(0)+' min', color: '#f97316' },
        { label: 'Cancel Rate',     value: f.pct(agg.cancellation_rate),        color: '#a855f7' },
        { label: 'Min/100 Flights', value: agg.delay_min_per_100.toFixed(0),    color: '#f59e0b' },
        { label: 'Propagation',     value: agg.delay_propagation_idx.toFixed(1)+'%', color: '#14b8a6' },
      ].map(d => `
        <div class="kpi-card" style="--kpi-color:${d.color}">
          <div class="kpi-label">${d.label}</div>
          <div class="kpi-value" style="font-size:18px">${d.value}</div>
        </div>`).join('');
    }

    // Cause table
    const ct = document.getElementById('p04-cause-table');
    if (ct) {
      const totalMin = agg.total_delay_min || 1;
      const causes = [
        { name:'Carrier',       min: agg.carrier_delay,        ct: agg.carrier_ct },
        { name:'Late Aircraft', min: agg.late_aircraft_delay,  ct: agg.late_aircraft_ct },
        { name:'NAS',           min: agg.nas_delay,            ct: agg.nas_ct },
        { name:'Weather',       min: agg.weather_delay,        ct: agg.weather_ct },
        { name:'Security',      min: agg.security_delay,       ct: agg.security_ct },
      ].sort((a,b) => b.min-a.min);
      ct.innerHTML = `<table class="data-table"><thead><tr><th>Cause</th><th>Minutes</th><th>Flights</th><th>Share</th></tr></thead><tbody>
        ${causes.map(c => `<tr>
          <td>${c.name}</td>
          <td>${f.num(Math.round(c.min))}</td>
          <td>${f.num(c.ct)}</td>
          <td>${(c.min/totalMin*100).toFixed(1)}%</td>
        </tr>`).join('')}
      </tbody></table>`;
    }
  }

  function _renderTable(sortMetric, asc) {
    const D = DataEngine;
    const data = D.getAirportRankings(sortMetric, 30);
    const sorted = [...data].sort((a,b) => asc ? a[sortMetric]-b[sortMetric] : b[sortMetric]-a[sortMetric]);
    const f = D.fmt;
    const tbody = document.getElementById('p04-tbody');
    if (!tbody) return;
    tbody.innerHTML = sorted.map((r,i) => `<tr>
      <td class="rank-num">${i+1}</td>
      <td><strong>${r._key}</strong><br><span class="text-dim" style="font-size:10px">${(r._name||'').split(':')[0].trim()}</span></td>
      <td>${f.num(r.arr_flights)}</td>
      <td>${f.pct(r.delay_rate)}</td>
      <td>${r.avg_delay_severity.toFixed(0)} min</td>
      <td>${f.pct(r.cancellation_rate)}</td>
      <td>${r.delay_min_per_100.toFixed(0)}</td>
      <td>${r.delay_propagation_idx.toFixed(1)}%</td>
    </tr>`).join('');
    document.querySelectorAll('#p04-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => _renderTable(th.dataset.sort, !asc));
    });
  }

  function _renderWWS() {
    const D = DataEngine;
    const top = D.getAirportRankings('delay_min_per_100', 3);
    const worst = top[0] || {};
    const rows = D.getFiltered().filter(r => r.airport === worst._key);
    const agg = rows.length ? D.aggregateRows(rows) : {};
    const causes = [
      { name:'Carrier',       val: agg.carrier_delay||0 },
      { name:'Late Aircraft', val: agg.late_aircraft_delay||0 },
      { name:'NAS',           val: agg.nas_delay||0 },
    ].sort((a,b)=>b.val-a.val);

    document.getElementById('p04-what').innerHTML =
      `<strong>${worst._key}</strong> (${(worst._name||'').split(':')[0].trim()}) is the highest-impact airport with <strong>${(worst.delay_min_per_100||0).toFixed(0)} delay minutes per 100 flights</strong> and a delay rate of <strong>${(worst.delay_rate||0).toFixed(1)}%</strong>.`;

    document.getElementById('p04-why').innerHTML =
      `At ${worst._key}, <strong>${causes[0]?.name}</strong> and <strong>${causes[1]?.name}</strong> delays are the primary contributors. 
       This reflects a combination of <strong>high traffic volume, hub complexity, and aircraft utilisation pressure</strong> that make recovery from disruption slow.`;

    document.getElementById('p04-sowhat').innerHTML =
      `${worst._key} should be investigated for <strong>aircraft rotation/turnaround efficiency and scheduling bottlenecks</strong>. 
       Airports with high NAS contribution may benefit from coordination with Air Traffic Control and slot management review.`;
  }

  function _mLabel(m) {
    const MAP = { delay_min_per_100:'Min/100 Flights', delay_rate:'Delay Rate (%)', avg_delay_severity:'Avg Severity (min)', cancellation_rate:'Cancel Rate (%)', total_delay_min:'Total Delay Minutes' };
    return MAP[m] || m;
  }

  function _bindToggles() {
    const c = document.getElementById('p04-rank-toggle');
    if (!c) return;
    c.querySelectorAll('.metric-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        c.querySelectorAll('.metric-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _renderTop10(btn.dataset.metric);
      });
    });
  }

  return { render };
})();
