/**
 * p03.js — Airline Performance
 */
const Page03 = (() => {

  const CAUSE_COLORS = ['#3b82f6','#f97316','#14b8a6','#a855f7','#ef4444'];

  let _charts = {};
  function _destroy(k) { if (_charts[k]) { try { _charts[k].destroy(); } catch(e){} _charts[k] = null; } }

  function render() {
    const el = document.getElementById('p03');
    if (!el) return;

    el.innerHTML = `
      <div class="page-header">
        <h2>✈️ Airline Performance</h2>
        <p>Who performs better or worse — and why? Ranked by normalised metrics against the network benchmark.</p>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title"><span class="card-icon">📊</span>Airline Ranking</div>
          <div class="metric-toggle" id="p03-rank-toggle">
            <button class="metric-btn active" data-metric="delay_rate">Delay Rate</button>
            <button class="metric-btn" data-metric="avg_delay_severity">Avg Severity</button>
            <button class="metric-btn" data-metric="cancellation_rate">Cancel Rate</button>
            <button class="metric-btn" data-metric="delay_min_per_100">Min/100 Flights</button>
            <button class="metric-btn" data-metric="delay_propagation_idx">Propagation</button>
          </div>
          <div class="chart-wrap chart-xl"><canvas id="c-airline-rank"></canvas></div>
        </div>

        <div class="card">
          <div class="card-title"><span class="card-icon">🥧</span>Cause Mix by Airline</div>
          <div style="margin-bottom:10px">
            <label style="font-size:11px;color:var(--text-muted);margin-right:8px">Select Airline:</label>
            <select id="p03-airline-select" class="filter-select" style="max-width:220px"></select>
          </div>
          <div class="chart-wrap chart-md"><canvas id="c-airline-cause-mix"></canvas></div>
          <div id="p03-carrier-kpis" class="kpi-grid" style="margin-top:16px;grid-template-columns:repeat(3,1fr)"></div>
        </div>
      </div>

      <!-- Comparison table -->
      <div class="card">
        <div class="card-title"><span class="card-icon">📋</span>Full Airline Comparison Table</div>
        <div style="overflow-x:auto">
          <table class="data-table" id="p03-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Airline</th>
                <th data-sort="arr_flights">Flights ↕</th>
                <th data-sort="delay_rate">Delay Rate ↕</th>
                <th data-sort="avg_delay_severity">Avg Severity ↕</th>
                <th data-sort="cancellation_rate">Cancel Rate ↕</th>
                <th data-sort="delay_min_per_100">Min/100 ↕</th>
                <th data-sort="delay_propagation_idx">Propagation ↕</th>
                <th>vs Benchmark</th>
              </tr>
            </thead>
            <tbody id="p03-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- What/Why/So What -->
      <div class="card">
        <div class="card-title"><span class="card-icon">💬</span>Analysis Framework</div>
        <div class="wws-grid">
          <div class="wws-card wws-what"><span class="wws-label">What Happened?</span><p id="p03-what">Loading…</p></div>
          <div class="wws-card wws-why"><span class="wws-label">Why?</span><p id="p03-why">Loading…</p></div>
          <div class="wws-card wws-sowhat"><span class="wws-label">So What?</span><p id="p03-sowhat">Loading…</p></div>
        </div>
      </div>
    `;

    _populateAirlineSelect();
    _renderRanking('delay_rate');
    _renderTable('delay_rate', false);
    _renderCauseMix();
    _renderWWS();
    _bindToggles();
  }

  function _populateAirlineSelect() {
    const sel = document.getElementById('p03-airline-select');
    if (!sel) return;
    const airlines = DataEngine.getAirlineRankings('delay_rate');
    sel.innerHTML = airlines.map(a =>
      `<option value="${a._key}">${a._name || a._key} (${a._key})</option>`
    ).join('');
    sel.addEventListener('change', () => _renderCauseMix(sel.value));
  }

  function _renderRanking(metric) {
    _destroy('airlineRank');
    const D = DataEngine;
    const rankings = D.getAirlineRankings(metric);
    const net = D.getNetworkSummary();
    const avg = net[metric];
    const ctx = document.getElementById('c-airline-rank');
    if (!ctx) return;
    _charts.airlineRank = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: rankings.map(r => r._key),
        datasets: [
          {
            label: _mLabel(metric),
            data: rankings.map(r => r[metric]),
            backgroundColor: rankings.map(r => r[metric] > avg ? 'rgba(239,68,68,0.75)' : 'rgba(34,197,94,0.65)'),
            borderRadius: 3,
          },
          {
            label: 'Network Avg',
            data: rankings.map(() => avg),
            type: 'line',
            borderColor: '#f59e0b',
            borderDash: [5,4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#6b7280', font: { size: 10 }, boxWidth: 12 } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${Number(c.raw).toFixed(2)}` } }
        },
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
          y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.5)' } },
        }
      }
    });
  }

  function _renderCauseMix(carrierCode) {
    _destroy('causeMix');
    const D = DataEngine;
    const rows = D.getFiltered();
    const code = carrierCode || document.getElementById('p03-airline-select')?.value;
    if (!code) return;
    const subset = rows.filter(r => r.carrier === code);
    const agg = D.aggregateRows(subset);
    const labels = ['Carrier','Late Aircraft','NAS','Weather','Security'];
    const vals   = [agg.carrier_delay, agg.late_aircraft_delay, agg.nas_delay, agg.weather_delay, agg.security_delay];
    const ctx = document.getElementById('c-airline-cause-mix');
    if (!ctx) return;
    _charts.causeMix = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: vals,
          backgroundColor: CAUSE_COLORS,
          borderColor: '#161b22',
          borderWidth: 3,
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: { position: 'right', labels: { color: '#6b7280', font: { size: 10 }, padding: 10 } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${(c.raw/60).toFixed(0)}h` } }
        }
      }
    });
    // Carrier KPIs
    const f = D.fmt;
    const kpiEl = document.getElementById('p03-carrier-kpis');
    if (kpiEl) {
      kpiEl.innerHTML = [
        { label: 'Delay Rate',    value: f.pct(agg.delay_rate),          color: '#ef4444' },
        { label: 'Avg Severity',  value: agg.avg_delay_severity.toFixed(1)+' min', color: '#f97316' },
        { label: 'Cancel Rate',   value: f.pct(agg.cancellation_rate),   color: '#a855f7' },
      ].map(d => `
        <div class="kpi-card" style="--kpi-color:${d.color}">
          <div class="kpi-label">${d.label}</div>
          <div class="kpi-value" style="font-size:20px">${d.value}</div>
        </div>`).join('');
    }
  }

  function _renderTable(sortMetric, asc) {
    const D = DataEngine;
    const net = D.getNetworkSummary();
    const rankings = D.getAirlineRankings('delay_rate');
    const sorted = [...rankings].sort((a,b) => asc ? a[sortMetric]-b[sortMetric] : b[sortMetric]-a[sortMetric]);
    const f = D.fmt;
    const netRate = net.delay_rate;
    const tbody = document.getElementById('p03-tbody');
    if (!tbody) return;
    tbody.innerHTML = sorted.map((r, i) => {
      const diff = r.delay_rate - netRate;
      const badge = diff > 2 ? `<span class="badge badge-red">▲ ${diff.toFixed(1)}pp</span>` :
                    diff < -2 ? `<span class="badge badge-green">▼ ${Math.abs(diff).toFixed(1)}pp</span>` :
                    `<span class="badge badge-amber">~ On par</span>`;
      return `<tr>
        <td class="rank-num">${i+1}</td>
        <td><strong>${r._name || r._key}</strong><br><span class="text-dim" style="font-size:11px">${r._key}</span></td>
        <td>${f.num(r.arr_flights)}</td>
        <td>${f.pct(r.delay_rate)}</td>
        <td>${r.avg_delay_severity.toFixed(1)} min</td>
        <td>${f.pct(r.cancellation_rate)}</td>
        <td>${r.delay_min_per_100.toFixed(0)}</td>
        <td>${r.delay_propagation_idx.toFixed(1)}%</td>
        <td>${badge}</td>
      </tr>`;
    }).join('');

    // Sortable headers
    document.querySelectorAll('#p03-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => _renderTable(th.dataset.sort, !asc));
    });
  }

  function _renderWWS() {
    const D = DataEngine;
    const rankings = D.getAirlineRankings('delay_rate');
    const net = D.getNetworkSummary();
    const worst = rankings[0] || {};
    const best  = rankings[rankings.length-1] || {};

    document.getElementById('p03-what').innerHTML =
      `<strong>${worst._name || worst._key}</strong> has the highest delay rate at <strong>${(worst.delay_rate||0).toFixed(1)}%</strong>, 
       while <strong>${best._name || best._key}</strong> leads with just <strong>${(best.delay_rate||0).toFixed(1)}%</strong>. 
       The network average stands at <strong>${net.delay_rate.toFixed(1)}%</strong>.`;

    document.getElementById('p03-why').innerHTML =
      `Differences in delay rates reflect <strong>fleet age, scheduling efficiency, hub complexity, and maintenance practices</strong>. 
       Airlines with high <strong>late-aircraft propagation indexes</strong> are particularly vulnerable to schedule disruption — 
       a single delay early in the day ripples across multiple subsequent flights.`;

    document.getElementById('p03-sowhat').innerHTML =
      `Airlines above the network benchmark should review <strong>scheduling buffers, hub turn-around times, and maintenance reliability</strong>. 
       Identifying whether delays are carrier-driven or externally driven (NAS/weather) helps separate controllable from uncontrollable performance.`;
  }

  function _mLabel(m) {
    const MAP = { delay_rate:'Delay Rate (%)', avg_delay_severity:'Avg Severity (min)', cancellation_rate:'Cancel Rate (%)', delay_min_per_100:'Min/100 Flights', delay_propagation_idx:'Propagation (%)' };
    return MAP[m] || m;
  }

  function _bindToggles() {
    const c = document.getElementById('p03-rank-toggle');
    if (!c) return;
    c.querySelectorAll('.metric-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        c.querySelectorAll('.metric-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _renderRanking(btn.dataset.metric);
      });
    });
  }

  return { render };
})();
