/**
 * p05.js — Trends & Seasonality
 */
const Page05 = (() => {

  let _charts = {};
  function _destroy(k) { if (_charts[k]) { try { _charts[k].destroy(); } catch(e){} _charts[k] = null; } }

  function render() {
    const el = document.getElementById('p05');
    if (!el) return;

    el.innerHTML = `
      <div class="page-header">
        <h2>📈 Trends &amp; Seasonality</h2>
        <p>How does performance change over time? Identify seasonal patterns and year-over-year improvement or deterioration.</p>
      </div>

      <!-- YoY trend line -->
      <div class="card">
        <div class="card-title"><span class="card-icon">📊</span>Year-over-Year Performance</div>
        <div class="metric-toggle" id="p05-yoy-toggle">
          <button class="metric-btn active" data-metric="delay_rate">Delay Rate</button>
          <button class="metric-btn" data-metric="cancellation_rate">Cancel Rate</button>
          <button class="metric-btn" data-metric="avg_delay_severity">Avg Severity</button>
          <button class="metric-btn" data-metric="total_delay_min">Total Delay Min</button>
        </div>
        <div class="chart-wrap chart-lg"><canvas id="c-yoy"></canvas></div>
      </div>

      <!-- Monthly seasonality pattern -->
      <div class="grid-2">
        <div class="card">
          <div class="card-title"><span class="card-icon">📅</span>Monthly Seasonality — Delay Rate</div>
          <div class="chart-wrap chart-md"><canvas id="c-monthly-bar"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title"><span class="card-icon">🌡️</span>Monthly Average — Avg Severity</div>
          <div class="chart-wrap chart-md"><canvas id="c-monthly-severity"></canvas></div>
        </div>
      </div>

      <!-- Monthly heatmap -->
      <div class="card">
        <div class="card-title">
          <span class="card-icon">🔥</span>Performance Heatmap — Month × Year
          <div class="metric-toggle" id="p05-heat-toggle" style="margin-left:auto;margin-bottom:0">
            <button class="metric-btn active" data-metric="delay_rate">Delay Rate</button>
            <button class="metric-btn" data-metric="cancellation_rate">Cancel Rate</button>
            <button class="metric-btn" data-metric="avg_delay_severity">Avg Severity</button>
          </div>
        </div>
        <div class="heatmap-wrap" id="p05-heatmap"></div>
      </div>

      <!-- Long-run trend (time series) -->
      <div class="card">
        <div class="card-title"><span class="card-icon">📉</span>Full Timeline — Monthly Detail</div>
        <div class="metric-toggle" id="p05-ts-toggle">
          <button class="metric-btn active" data-metric="delay_rate">Delay Rate</button>
          <button class="metric-btn" data-metric="cancellation_rate">Cancel Rate</button>
          <button class="metric-btn" data-metric="total_delay_min">Total Delay Min</button>
          <button class="metric-btn" data-metric="avg_delay_severity">Avg Severity</button>
        </div>
        <div class="chart-wrap chart-xl"><canvas id="c-ts-full"></canvas></div>
      </div>

      <!-- What/Why/So What -->
      <div class="card">
        <div class="card-title"><span class="card-icon">💬</span>Analysis Framework</div>
        <div class="wws-grid">
          <div class="wws-card wws-what"><span class="wws-label">What Happened?</span><p id="p05-what">Loading…</p></div>
          <div class="wws-card wws-why"><span class="wws-label">Why?</span><p id="p05-why">Loading…</p></div>
          <div class="wws-card wws-sowhat"><span class="wws-label">So What?</span><p id="p05-sowhat">Loading…</p></div>
        </div>
      </div>
    `;

    _renderYoY('delay_rate');
    _renderMonthlyBar();
    _renderMonthlySeverity();
    _renderHeatmap('delay_rate');
    _renderTimeSeries('delay_rate');
    _renderWWS();
    _bindToggles();
  }

  function _renderYoY(metric) {
    _destroy('yoy');
    const data = DataEngine.getYearOverYear(metric);
    const ctx = document.getElementById('c-yoy');
    if (!ctx) return;
    const isRate = metric.includes('rate');
    const colors = data.map((d, i) =>
      i > 0 && d.yoy_change !== null && d.yoy_change > 0 ? 'rgba(239,68,68,0.8)' : 'rgba(34,197,94,0.8)'
    );
    _charts.yoy = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => String(d.year)),
        datasets: [
          {
            label: _mLabel(metric),
            data: data.map(d => d.value),
            backgroundColor: colors,
            borderRadius: 4,
            yAxisID: 'y',
          },
          {
            label: 'YoY Change',
            data: data.map(d => d.yoy_change),
            type: 'line',
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0.1)',
            pointBackgroundColor: data.map(d => d.yoy_change > 0 ? '#ef4444' : '#22c55e'),
            pointRadius: 6,
            fill: false,
            tension: 0.2,
            yAxisID: 'y2',
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { color: '#6b7280', font: { size: 10 }, boxWidth: 12 } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${Number(c.raw).toFixed(2)}${isRate ? '%' : ''}` } }
        },
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
          y:  { position: 'left',  ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' }, title: { display: true, text: _mLabel(metric), color: '#6b7280', font: { size: 10 } } },
          y2: { position: 'right', ticks: { color: '#f59e0b', font: { size: 10 } }, grid: { display: false }, title: { display: true, text: 'YoY Change', color: '#f59e0b', font: { size: 10 } } },
        }
      }
    });
  }

  function _renderMonthlyBar() {
    _destroy('monthlyBar');
    const D = DataEngine;
    const rows = D.getFiltered();
    const months = [1,2,3,4,5,6,7,8,9,10,11,12];
    const byMonth = months.map(m => {
      const sub = rows.filter(r => r.month === m);
      return sub.length ? D.aggregateRows(sub).delay_rate : null;
    });
    const avgRate = byMonth.filter(v=>v!==null).reduce((a,b)=>a+b,0) / byMonth.filter(v=>v!==null).length;
    const ctx = document.getElementById('c-monthly-bar');
    if (!ctx) return;
    _charts.monthlyBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: D.MONTH_NAMES,
        datasets: [
          {
            label: 'Delay Rate (%)',
            data: byMonth,
            backgroundColor: byMonth.map(v => v !== null && v > avgRate ? 'rgba(239,68,68,0.75)' : 'rgba(59,130,246,0.65)'),
            borderRadius: 4,
          },
          {
            label: 'Annual Avg',
            data: byMonth.map(() => avgRate),
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
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#6b7280', font: { size: 10 }, boxWidth: 12 } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${Number(c.raw).toFixed(2)}%` } }
        },
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
          y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
        }
      }
    });
  }

  function _renderMonthlySeverity() {
    _destroy('monthlySeverity');
    const D = DataEngine;
    const rows = D.getFiltered();
    const months = [1,2,3,4,5,6,7,8,9,10,11,12];
    const byMonth = months.map(m => {
      const sub = rows.filter(r => r.month === m);
      return sub.length ? D.aggregateRows(sub).avg_delay_severity : null;
    });
    const ctx = document.getElementById('c-monthly-severity');
    if (!ctx) return;
    _charts.monthlySeverity = new Chart(ctx, {
      type: 'line',
      data: {
        labels: D.MONTH_NAMES,
        datasets: [{
          label: 'Avg Severity (min)',
          data: byMonth,
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168,85,247,0.1)',
          fill: true, tension: 0.4,
          pointBackgroundColor: '#a855f7',
          pointRadius: 5, pointHoverRadius: 7,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` Severity: ${Number(c.raw).toFixed(1)} min` } } },
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
          y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
        }
      }
    });
  }

  function _renderHeatmap(metric) {
    const D = DataEngine;
    const { years, months, data, monthNames } = D.getMonthlyHeatmap(metric);
    const allVals = years.flatMap(y => months.map(m => data[y][m]).filter(v => v !== null));
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const el = document.getElementById('p05-heatmap');
    if (!el) return;

    function heatColor(v) {
      if (v === null) return 'var(--surface2)';
      const t = maxV > minV ? (v - minV) / (maxV - minV) : 0;
      const r = Math.round(34  + (239-34)  * t);
      const g = Math.round(197 + (68-197)  * t);
      const b = Math.round(94  + (68-94)   * t);
      return `rgb(${r},${g},${b})`;
    }
    function textColor(v) {
      if (v === null) return 'var(--text-dim)';
      const t = maxV > minV ? (v - minV) / (maxV - minV) : 0;
      return t > 0.55 ? '#fff' : '#0d1117';
    }

    el.innerHTML = `
      <table class="heatmap-table">
        <thead>
          <tr>
            <th>Year</th>
            ${monthNames.map(m => `<th>${m}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${years.map(yr => `
            <tr>
              <td class="heatmap-year-label">${yr}</td>
              ${months.map(m => {
                const v = data[yr][m];
                const disp = v !== null ? (metric.includes('rate') ? v.toFixed(1)+'%' : v.toFixed(0)) : '—';
                return `<td style="background:${heatColor(v)};color:${textColor(v)}" title="${yr}-${monthNames[m-1]}: ${disp}">${disp}</td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  function _renderTimeSeries(metric) {
    _destroy('tsFull');
    const ts = DataEngine.getTimeSeries();
    const ctx = document.getElementById('c-ts-full');
    if (!ctx) return;
    const isRate = metric.includes('rate');
    _charts.tsFull = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ts.map(t => t._label),
        datasets: [{
          label: _mLabel(metric),
          data: ts.map(t => t[metric]),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.07)',
          fill: true, tension: 0.3,
          pointRadius: ts.length > 60 ? 0 : 3,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${_mLabel(metric)}: ${Number(c.raw).toFixed(2)}${isRate ? '%' : ''}` } }
        },
        scales: {
          x: { ticks: { color: '#6b7280', maxTicksLimit: 16, font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
          y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
        }
      }
    });
  }

  function _renderWWS() {
    const D = DataEngine;
    const rows = D.getFiltered();
    const months = [1,2,3,4,5,6,7,8,9,10,11,12];
    const byMonth = months.map(m => {
      const sub = rows.filter(r => r.month === m);
      return { month: D.MONTH_NAMES[m-1], rate: sub.length ? D.aggregateRows(sub).delay_rate : 0 };
    });
    const peakMonth = byMonth.reduce((a,b) => b.rate > a.rate ? b : a, byMonth[0] || {});
    const yoy = D.getYearOverYear('delay_rate');
    const lastChange = yoy.length > 1 ? yoy[yoy.length-1].yoy_change : 0;
    const improving = lastChange !== null && lastChange < 0;

    document.getElementById('p05-what').innerHTML =
      `<strong>${peakMonth.month}</strong> shows the highest delay rate at <strong>${(peakMonth.rate||0).toFixed(1)}%</strong>. 
       Year-over-year the delay rate has ${improving ? 'improved' : 'worsened'} by <strong>${Math.abs(lastChange||0).toFixed(1)} pp</strong> in the most recent year.`;

    document.getElementById('p05-why').innerHTML =
      `Summer months (Jun–Aug) typically see higher delay rates due to <strong>increased passenger traffic, thunderstorm activity, and constrained NAS capacity</strong>. 
       Winter months (Dec–Jan) spike due to <strong>weather-related disruptions</strong> and holiday travel surges.`;

    document.getElementById('p05-sowhat').innerHTML =
      `Seasonal capacity planning should <strong>increase scheduling buffers in peak months</strong> and pre-position maintenance resources. 
       YoY trends reveal whether operational improvements are structural or one-off — sustained improvement over 3+ years indicates systemic progress.`;
  }

  function _mLabel(m) {
    const MAP = { delay_rate:'Delay Rate (%)', cancellation_rate:'Cancel Rate (%)', avg_delay_severity:'Avg Severity (min)', total_delay_min:'Total Delay Minutes' };
    return MAP[m] || m;
  }

  function _bindToggles() {
    _bindGroup('p05-yoy-toggle',  btn => _renderYoY(btn.dataset.metric));
    _bindGroup('p05-heat-toggle', btn => _renderHeatmap(btn.dataset.metric));
    _bindGroup('p05-ts-toggle',   btn => _renderTimeSeries(btn.dataset.metric));
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
