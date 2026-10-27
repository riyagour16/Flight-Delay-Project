/**
 * p02.js — Delay Cause Intelligence
 */
const Page02 = (() => {

  const COLORS = {
    'Carrier':       '#3b82f6',
    'Late Aircraft': '#f97316',
    'NAS':           '#14b8a6',
    'Weather':       '#a855f7',
    'Security':      '#ef4444',
  };

  let _charts = {};
  function _destroy(k) { if (_charts[k]) { try { _charts[k].destroy(); } catch(e){} _charts[k] = null; } }

  function render() {
    const el = document.getElementById('p02');
    if (!el) return;

    el.innerHTML = `
      <div class="page-header">
        <h2>🔍 Delay Cause Intelligence</h2>
        <p>Why are flights delayed? Understand the relative contribution of each delay category.</p>
      </div>

      <!-- KPIs by cause -->
      <div class="kpi-grid" id="p02-cause-kpis"></div>

      <div class="grid-2">
        <!-- Cause donut -->
        <div class="card">
          <div class="card-title"><span class="card-icon">🥧</span>Cause Contribution — Delay Minutes</div>
          <div class="chart-wrap" style="height:300px"><canvas id="c-cause-donut"></canvas></div>
        </div>
        <!-- Cause horizontal bar -->
        <div class="card">
          <div class="card-title"><span class="card-icon">📊</span>Cause Breakdown</div>
          <div class="metric-toggle" id="p02-cause-toggle">
            <button class="metric-btn active" data-mode="minutes">Delay Minutes</button>
            <button class="metric-btn" data-mode="count">Delayed Flights</button>
            <button class="metric-btn" data-mode="contrib">% Contribution</button>
          </div>
          <div class="chart-wrap chart-md"><canvas id="c-cause-breakdown"></canvas></div>
        </div>
      </div>

      <!-- Cause trend stacked area -->
      <div class="card">
        <div class="card-title"><span class="card-icon">📈</span>Delay Cause Trend Over Time</div>
        <div class="metric-toggle" id="p02-trend-toggle">
          <button class="metric-btn active" data-mode="absolute">Absolute (Minutes)</button>
          <button class="metric-btn" data-mode="proportion">Proportional (%)</button>
        </div>
        <div class="chart-wrap chart-lg"><canvas id="c-cause-trend-p02"></canvas></div>
      </div>

      <!-- Cause by month (heatmap-style grouped bar) -->
      <div class="card">
        <div class="card-title"><span class="card-icon">📅</span>Delay Cause by Month — Seasonal Pattern</div>
        <div class="chart-wrap chart-lg"><canvas id="c-cause-monthly"></canvas></div>
      </div>

      <!-- What / Why / So What -->
      <div class="card">
        <div class="card-title"><span class="card-icon">💬</span>Analysis Framework</div>
        <div class="wws-grid">
          <div class="wws-card wws-what">
            <span class="wws-label">What Happened?</span>
            <p id="p02-what">Loading…</p>
          </div>
          <div class="wws-card wws-why">
            <span class="wws-label">Why?</span>
            <p id="p02-why">Loading…</p>
          </div>
          <div class="wws-card wws-sowhat">
            <span class="wws-label">So What?</span>
            <p id="p02-sowhat">Loading…</p>
          </div>
        </div>
      </div>
    `;

    _renderCauseKPIs();
    _renderDonut();
    _renderBreakdown('minutes');
    _renderCauseTrend('absolute');
    _renderCauseMonthly();
    _renderWWS();
    _bindToggles();
  }

  function _renderCauseKPIs() {
    const D = DataEngine;
    const causes = D.getCauseBreakdown();
    const grid = document.getElementById('p02-cause-kpis');
    if (!grid) return;
    grid.innerHTML = causes.map(c => `
      <div class="kpi-card" style="--kpi-color:${COLORS[c.cause] || '#6e7681'}">
        <div class="kpi-label">${c.cause}</div>
        <div class="kpi-value">${D.fmt.num(Math.round(c.minutes / 60))}h</div>
        <div class="kpi-sub">${c.contrib.toFixed(1)}% of total delay | ${D.fmt.num(c.count)} incidents</div>
      </div>`).join('');
  }

  function _renderDonut() {
    _destroy('donut');
    const causes = DataEngine.getCauseBreakdown();
    const ctx = document.getElementById('c-cause-donut');
    if (!ctx) return;
    _charts.donut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: causes.map(c => c.cause),
        datasets: [{
          data: causes.map(c => c.minutes),
          backgroundColor: causes.map(c => COLORS[c.cause] || '#6e7681'),
          borderColor: '#161b22',
          borderWidth: 3,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'right', labels: { color: '#6b7280', font: { size: 11 }, padding: 14 } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${(c.raw/60).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')}h (${(c.parsed / causes.reduce((s,x)=>s+x.minutes,0)*100).toFixed(1)}%)` } }
        }
      }
    });
  }

  function _renderBreakdown(mode) {
    _destroy('breakdown');
    const causes = DataEngine.getCauseBreakdown();
    const sorted = [...causes].sort((a,b) => {
      if (mode === 'minutes') return b.minutes - a.minutes;
      if (mode === 'count')   return b.count - a.count;
      return b.contrib - a.contrib;
    });
    const vals = sorted.map(c => mode === 'minutes' ? c.minutes : mode === 'count' ? c.count : c.contrib);
    const ctx = document.getElementById('c-cause-breakdown');
    if (!ctx) return;
    _charts.breakdown = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(c => c.cause),
        datasets: [{
          data: vals,
          backgroundColor: sorted.map(c => COLORS[c.cause] || '#6e7681'),
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${c.raw.toFixed(mode === 'contrib' ? 1 : 0)}${mode === 'contrib' ? '%' : ''}` } }
        },
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
          y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.5)' } },
        }
      }
    });
  }

  function _renderCauseTrend(mode) {
    _destroy('causeTrend');
    const raw = DataEngine.getCauseTimeSeries();
    const labels = raw.labels;
    let datasets;
    if (mode === 'proportion') {
      const totals = labels.map((_,i) =>
        (raw.carrier[i]||0)+(raw.late_aircraft[i]||0)+(raw.nas[i]||0)+(raw.weather[i]||0)+(raw.security[i]||0)
      );
      const pct = arr => arr.map((v,i) => totals[i] > 0 ? (v/totals[i])*100 : 0);
      datasets = [
        _areaDs('Carrier',       pct(raw.carrier),       '#3b82f6'),
        _areaDs('Late Aircraft', pct(raw.late_aircraft), '#f97316'),
        _areaDs('NAS',           pct(raw.nas),           '#14b8a6'),
        _areaDs('Weather',       pct(raw.weather),       '#a855f7'),
        _areaDs('Security',      pct(raw.security),      '#ef4444'),
      ];
    } else {
      datasets = [
        _areaDs('Carrier',       raw.carrier,       '#3b82f6'),
        _areaDs('Late Aircraft', raw.late_aircraft, '#f97316'),
        _areaDs('NAS',           raw.nas,           '#14b8a6'),
        _areaDs('Weather',       raw.weather,       '#a855f7'),
        _areaDs('Security',      raw.security,      '#ef4444'),
      ];
    }
    const ctx = document.getElementById('c-cause-trend-p02');
    if (!ctx) return;
    _charts.causeTrend = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { color: '#6b7280', boxWidth: 12, font: { size: 10 } } },
        },
        scales: {
          x: { stacked: true, ticks: { color: '#6b7280', maxTicksLimit: 14, font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
          y: { stacked: true, ticks: { color: '#6b7280', font: { size: 10 }, callback: v => mode === 'proportion' ? v.toFixed(0)+'%' : v }, grid: { color: 'rgba(209,213,219,0.6)' } },
        }
      }
    });
  }

  function _renderCauseMonthly() {
    _destroy('causeMonthly');
    const D = DataEngine;
    const rows = D.getFiltered();
    const months = [1,2,3,4,5,6,7,8,9,10,11,12];
    const MNAMES = D.MONTH_NAMES;
    const causeKeys = ['carrier_delay','late_aircraft_delay','nas_delay','weather_delay','security_delay'];
    const causeLabels = ['Carrier','Late Aircraft','NAS','Weather','Security'];
    const causeColors = ['#3b82f6','#f97316','#14b8a6','#a855f7','#ef4444'];
    const byMonth = months.map(m => {
      const sub = rows.filter(r => r.month === m);
      const agg = D.aggregateRows(sub);
      return agg;
    });
    const ctx = document.getElementById('c-cause-monthly');
    if (!ctx) return;
    _charts.causeMonthly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: MNAMES,
        datasets: causeKeys.map((k, i) => ({
          label: causeLabels[i],
          data: byMonth.map(a => a[k]),
          backgroundColor: causeColors[i],
          borderRadius: 2,
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#6b7280', boxWidth: 12, font: { size: 10 } } },
          tooltip: { mode: 'index' }
        },
        scales: {
          x: { stacked: true, ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
          y: { stacked: true, ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
        }
      }
    });
  }

  function _renderWWS() {
    const causes = DataEngine.getCauseBreakdown();
    const top = causes[0] || {};
    const top2 = causes[1] || {};
    const net = DataEngine.getNetworkSummary();
    const propIdx = net.delay_propagation_idx.toFixed(1);

    document.getElementById('p02-what').innerHTML =
      `<strong>${top.cause || '—'}</strong> is the largest delay driver, contributing <strong>${(top.contrib||0).toFixed(1)}%</strong> of all delay minutes. 
       Together, <strong>${top.cause}</strong> and <strong>${top2.cause||'—'}</strong> account for over <strong>${((top.contrib||0)+(top2.contrib||0)).toFixed(1)}%</strong> of total delay impact.`;

    document.getElementById('p02-why').innerHTML =
      `<strong>Carrier delays</strong> reflect internal airline operations — scheduling, maintenance, crew issues. 
       <strong>Late-aircraft cascades</strong> (${propIdx}% of delay minutes) amplify operational disruption throughout the day 
       as one delayed inbound aircraft makes the next outbound flight late.`;

    document.getElementById('p02-sowhat').innerHTML =
      `Airlines should target <strong>${top.cause} delay reduction</strong> as it offers the highest ROI on operational improvement. 
       Reducing late-aircraft propagation requires tighter <strong>turn-around buffers</strong> and proactive recovery scheduling, 
       particularly at hub airports with high connection density.`;
  }

  function _areaDs(label, data, color) {
    return {
      label, data,
      borderColor: color,
      backgroundColor: color + '55',
      fill: true, tension: 0.3,
      pointRadius: data.length > 60 ? 0 : 2,
      borderWidth: 1.5,
    };
  }

  function _bindToggles() {
    _bindGroup('p02-cause-toggle',  btn => _renderBreakdown(btn.dataset.mode));
    _bindGroup('p02-trend-toggle',  btn => _renderCauseTrend(btn.dataset.mode));
  }

  function _bindGroup(id, cb) {
    const c = document.getElementById(id);
    if (!c) return;
    c.querySelectorAll('.metric-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        c.querySelectorAll('.metric-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        cb(btn);
      });
    });
  }

  return { render };
})();
