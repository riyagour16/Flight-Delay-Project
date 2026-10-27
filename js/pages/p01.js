/**
 * p01.js — Executive Overview
 * Sections: KPIs · Trend · Cause Bar · Airline Bar · Airport Bar · Scatter · Stacked Area · Insights · Takeaway
 */

// ── Shared light-theme chart defaults (loaded once) ──────────
const CHART_DEFAULTS = {
  TICK:  '#6b7280',
  GRID:  'rgba(209,213,219,0.6)',
  LEGEND:'#6b7280',
  FONT:  { size: 10 },
};

const Page01 = (() => {

  const CAUSE_COLORS = {
    'Carrier':       '#3b82f6',
    'Late Aircraft': '#f97316',
    'NAS':           '#14b8a6',
    'Weather':       '#a855f7',
    'Security':      '#ef4444',
  };

  let _charts = {};

  function _destroy(key) {
    if (_charts[key]) { try { _charts[key].destroy(); } catch(e){} _charts[key] = null; }
  }

  function render() {
    const el = document.getElementById('p01');
    if (!el) return;

    const D = DataEngine;
    const net = D.getNetworkSummary();
    const f = D.fmt;

    el.innerHTML = `
      <div class="page-header">
        <h2>🏠 Executive Overview</h2>
        <p>High-level network performance — understand the full picture in 30 seconds.</p>
      </div>

      <!-- KPIs -->
      <div class="kpi-grid" id="p01-kpis"></div>

      <!-- Row 1: Trend + Cause bar -->
      <div class="grid-2">
        <div class="card">
          <div class="card-title"><span class="card-icon">📊</span>Network Performance Trend</div>
          <div class="metric-toggle" id="p01-trend-toggle">
            <button class="metric-btn active" data-metric="delay_rate">Delay Rate</button>
            <button class="metric-btn" data-metric="total_delay_min">Delay Minutes</button>
            <button class="metric-btn" data-metric="avg_delay_severity">Avg Severity</button>
            <button class="metric-btn" data-metric="cancellation_rate">Cancel Rate</button>
          </div>
          <div class="chart-wrap chart-md"><canvas id="c-trend"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title"><span class="card-icon">🔍</span>What Causes Delays?</div>
          <div class="metric-toggle" id="p01-cause-toggle">
            <button class="metric-btn active" data-mode="minutes">Delay Minutes</button>
            <button class="metric-btn" data-mode="count">Delayed Flights</button>
          </div>
          <div class="chart-wrap chart-md"><canvas id="c-cause-bar"></canvas></div>
        </div>
      </div>

      <!-- Row 2: Airline + Airport -->
      <div class="grid-2">
        <div class="card">
          <div class="card-title"><span class="card-icon">✈️</span>Airline Performance</div>
          <div class="metric-toggle" id="p01-airline-toggle">
            <button class="metric-btn active" data-metric="delay_rate">Delay Rate</button>
            <button class="metric-btn" data-metric="avg_delay_severity">Avg Severity</button>
            <button class="metric-btn" data-metric="cancellation_rate">Cancel Rate</button>
            <button class="metric-btn" data-metric="delay_min_per_100">Min/100 Flights</button>
          </div>
          <div class="chart-wrap chart-md"><canvas id="c-airline-bar"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title"><span class="card-icon">📍</span>Airport Hotspots — Top 10</div>
          <div class="metric-toggle" id="p01-airport-toggle">
            <button class="metric-btn active" data-metric="delay_min_per_100">Min/100 Flights</button>
            <button class="metric-btn" data-metric="delay_rate">Delay Rate</button>
            <button class="metric-btn" data-metric="avg_delay_severity">Avg Severity</button>
            <button class="metric-btn" data-metric="cancellation_rate">Cancel Rate</button>
          </div>
          <div class="chart-wrap chart-md"><canvas id="c-airport-bar"></canvas></div>
        </div>
      </div>

      <!-- Row 3: Scatter + Stacked area -->
      <div class="grid-2">
        <div class="card scatter-container">
          <div class="card-title"><span class="card-icon">🎯</span>Frequency vs Severity — Airports</div>
          <div class="chart-wrap chart-lg"><canvas id="c-scatter"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title"><span class="card-icon">📉</span>Delay Cause Trend Over Time</div>
          <div class="chart-wrap chart-lg"><canvas id="c-cause-trend"></canvas></div>
        </div>
      </div>

      <!-- Insights + Takeaway -->
      <div class="grid-2">
        <div class="card">
          <div class="card-title"><span class="card-icon">💡</span>Key Insights</div>
          <div id="p01-insights" class="insights-panel"></div>
        </div>
        <div class="card">
          <div class="card-title"><span class="card-icon">📋</span>Executive Takeaway</div>
          <div id="p01-takeaway" class="takeaway-box"></div>
        </div>
      </div>
    `;

    _renderKPIs(net, f);
    _renderTrend('delay_rate');
    _renderCauseBar('minutes');
    _renderAirlineBar('delay_rate');
    _renderAirportBar('delay_min_per_100');
    _renderScatter();
    _renderCauseTrend();
    _renderInsights();
    _renderTakeaway();
    _bindToggles();
  }

  function _renderKPIs(net, f) {
    const defs = [
      { label: 'Total Flights',     value: f.num(net.arr_flights),        sub: 'arr_flights',        color: '#3b82f6' },
      { label: 'Delayed Flights',   value: f.num(net.arr_del15),           sub: 'arr_del15 (≥15 min)', color: '#f97316' },
      { label: 'Delay Rate',        value: f.pct(net.delay_rate),          sub: 'delayed / total',    color: '#ef4444' },
      { label: 'Total Delay Hours', value: f.hrs(net.total_delay_hours),   sub: 'hours of delay',     color: '#a855f7' },
      { label: 'Cancellation Rate', value: f.pct(net.cancellation_rate),   sub: 'cancelled / total',  color: '#f59e0b' },
      { label: 'Diversion Rate',    value: f.pct(net.diversion_rate),      sub: 'diverted / total',   color: '#14b8a6' },
    ];
    const grid = document.getElementById('p01-kpis');
    grid.innerHTML = defs.map(d => `
      <div class="kpi-card" style="--kpi-color:${d.color}">
        <div class="kpi-label">${d.label}</div>
        <div class="kpi-value">${d.value}</div>
        <div class="kpi-sub">${d.sub}</div>
      </div>`).join('');
  }

  function _renderTrend(metric) {
    _destroy('trend');
    const ts = DataEngine.getTimeSeries();
    const labels = ts.map(t => t._label);
    const values = ts.map(t => t[metric]);
    const avg = values.reduce((a,b) => a+b, 0) / (values.length || 1);
    const isRate = metric.includes('rate');
    const ctx = document.getElementById('c-trend');
    if (!ctx) return;
    _charts.trend = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: _metricLabel(metric),
            data: values,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.08)',
            fill: true,
            tension: 0.35,
            pointRadius: labels.length > 60 ? 0 : 3,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
          {
            label: 'Network Avg',
            data: labels.map(() => avg),
            borderColor: 'rgba(239,68,68,0.5)',
            borderDash: [6,4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          }
        ]
      },
      options: _lineOpts(isRate ? '%' : metric === 'total_delay_min' ? ' min' : ' min')
    });
  }

  function _renderCauseBar(mode) {
    _destroy('causeBar');
    const causes = DataEngine.getCauseBreakdown();
    const labels = causes.map(c => c.cause);
    const values = mode === 'minutes' ? causes.map(c => c.minutes) : causes.map(c => c.count);
    const colors = labels.map(l => CAUSE_COLORS[l] || '#6e7681');
    const ctx = document.getElementById('c-cause-bar');
    if (!ctx) return;
    _charts.causeBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: mode === 'minutes' ? 'Delay Minutes' : 'Delayed Flights',
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
        }]
      },
      options: _barOpts('horizontal', mode === 'minutes' ? ' min' : '')
    });
  }

  function _renderAirlineBar(metric) {
    _destroy('airlineBar');
    const rankings = DataEngine.getAirlineRankings(metric);
    const net = DataEngine.getNetworkSummary();
    const labels = rankings.map(r => r._key);
    const values = rankings.map(r => r[metric]);
    const avg = net[metric];
    const isRate = metric.includes('rate');
    const ctx = document.getElementById('c-airline-bar');
    if (!ctx) return;
    _charts.airlineBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: _metricLabel(metric),
            data: values,
            backgroundColor: values.map(v => v > avg ? 'rgba(239,68,68,0.7)' : 'rgba(59,130,246,0.7)'),
            borderRadius: 4,
          },
          {
            label: 'Network Avg',
            data: labels.map(() => avg),
            type: 'line',
            borderColor: '#f59e0b',
            borderDash: [5,4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          }
        ]
      },
      options: _barOpts('horizontal', isRate ? '%' : '')
    });
  }

  function _renderAirportBar(metric) {
    _destroy('airportBar');
    const top = DataEngine.getAirportRankings(metric, 10);
    const labels = top.map(r => r._key);
    const values = top.map(r => r[metric]);
    const isRate = metric.includes('rate');
    const ctx = document.getElementById('c-airport-bar');
    if (!ctx) return;
    _charts.airportBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: _metricLabel(metric),
          data: values,
          backgroundColor: 'rgba(168,85,247,0.7)',
          borderRadius: 4,
        }]
      },
      options: _barOpts('horizontal', isRate ? '%' : '')
    });
  }

  function _renderScatter() {
    _destroy('scatter');
    const pts = DataEngine.getFreqSeverityScatter();
    if (!pts.length) return;
    const rates = pts.map(p => p.delay_rate);
    const sevs  = pts.map(p => p.avg_severity);
    const medRate = _median(rates);
    const medSev  = _median(sevs);
    const ctx = document.getElementById('c-scatter');
    if (!ctx) return;
    _charts.scatter = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Airport',
          data: pts.map(p => ({ x: p.delay_rate, y: p.avg_severity, r: Math.sqrt(p.arr_flights / 800), label: p.code })),
          backgroundColor: pts.map(p =>
            p.delay_rate >= medRate && p.avg_severity >= medSev ? 'rgba(239,68,68,0.75)' :
            p.delay_rate < medRate  && p.avg_severity >= medSev ? 'rgba(245,158,11,0.7)' :
            p.delay_rate >= medRate && p.avg_severity < medSev  ? 'rgba(59,130,246,0.65)' :
            'rgba(34,197,94,0.6)'
          ),
          pointRadius: pts.map(p => Math.max(4, Math.sqrt(p.arr_flights / 800))),
          pointHoverRadius: 8,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const p = pts[ctx.dataIndex];
                return `${p.code}: Rate ${p.delay_rate.toFixed(1)}% | Severity ${p.avg_severity.toFixed(0)} min`;
              }
            }
          },
          annotation: {
            annotations: {
              vLine: { type: 'line', xMin: medRate, xMax: medRate, borderColor: 'rgba(110,118,129,0.4)', borderDash: [4,4] },
              hLine: { type: 'line', yMin: medSev,  yMax: medSev,  borderColor: 'rgba(110,118,129,0.4)', borderDash: [4,4] },
              lblHH: { type: 'label', xValue: Math.max(...rates) * 0.85, yValue: Math.max(...sevs) * 0.92, content: ['HIGH RISK'], color: 'rgba(239,68,68,0.6)', font: { size: 10, weight: 'bold' } },
              lblLL: { type: 'label', xValue: Math.min(...rates) * 1.15, yValue: Math.min(...sevs) * 1.2, content: ['LOW RISK'], color: 'rgba(34,197,94,0.5)', font: { size: 10, weight: 'bold' } },
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Delay Rate (%)', color: '#6b7280', font: { size: 11 } }, ..._scaleStyle() },
          y: { title: { display: true, text: 'Avg Delay Severity (min)', color: '#6b7280', font: { size: 11 } }, ..._scaleStyle() },
        }
      }
    });
  }

  function _renderCauseTrend() {
    _destroy('causeTrend');
    const data = DataEngine.getCauseTimeSeries();
    const ctx = document.getElementById('c-cause-trend');
    if (!ctx) return;
    _charts.causeTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          _areaDs('Carrier',       data.carrier,       '#3b82f6'),
          _areaDs('Late Aircraft', data.late_aircraft, '#f97316'),
          _areaDs('NAS',           data.nas,           '#14b8a6'),
          _areaDs('Weather',       data.weather,       '#a855f7'),
          _areaDs('Security',      data.security,      '#ef4444'),
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { color: CHART_DEFAULTS.LEGEND, boxWidth: 12, font: CHART_DEFAULTS.FONT } },
          tooltip: { mode: 'index' }
        },
        scales: {
          x: { stacked: true, ticks: { color: CHART_DEFAULTS.TICK, maxTicksLimit: 12, font: CHART_DEFAULTS.FONT }, grid: { color: CHART_DEFAULTS.GRID } },
          y: { stacked: true, ticks: { color: CHART_DEFAULTS.TICK, font: CHART_DEFAULTS.FONT }, grid: { color: CHART_DEFAULTS.GRID } },
        }
      }
    });
  }

  function _areaDs(label, data, color) {
    return {
      label, data,
      borderColor: color,
      backgroundColor: color.replace(')', ', 0.35)').replace('rgb', 'rgba'),
      fill: true,
      tension: 0.3,
      pointRadius: data.length > 60 ? 0 : 2,
      borderWidth: 1.5,
    };
  }

  function _renderInsights() {
    const items = DataEngine.generateInsights();
    const el = document.getElementById('p01-insights');
    if (!el) return;
    el.innerHTML = items.map(i => `
      <div class="insight-item">
        <div class="insight-title">${i.icon} ${i.title}</div>
        <div class="insight-text">${i.text}</div>
      </div>`).join('');
  }

  function _renderTakeaway() {
    const el = document.getElementById('p01-takeaway');
    if (!el) return;
    el.innerHTML = DataEngine.generateExecutiveTakeaway();
  }

  function _bindToggles() {
    _bindToggleGroup('p01-trend-toggle',   btn => _renderTrend(btn.dataset.metric));
    _bindToggleGroup('p01-cause-toggle',   btn => _renderCauseBar(btn.dataset.mode));
    _bindToggleGroup('p01-airline-toggle', btn => _renderAirlineBar(btn.dataset.metric));
    _bindToggleGroup('p01-airport-toggle', btn => _renderAirportBar(btn.dataset.metric));
  }

  function _bindToggleGroup(containerId, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.metric-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.metric-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        callback(btn);
      });
    });
  }

  // ── Chart option helpers ──────────────────────────────────
  function _lineOpts(suffix) {
    return {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { color: CHART_DEFAULTS.LEGEND, boxWidth: 12, font: CHART_DEFAULTS.FONT } },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${typeof c.raw === 'number' ? c.raw.toFixed(2) : c.raw}${suffix}` } }
      },
      scales: {
        x: { ticks: { color: CHART_DEFAULTS.TICK, maxTicksLimit: 12, font: CHART_DEFAULTS.FONT }, grid: { color: CHART_DEFAULTS.GRID } },
        y: { ticks: { color: CHART_DEFAULTS.TICK, font: CHART_DEFAULTS.FONT }, grid: { color: CHART_DEFAULTS.GRID } },
      }
    };
  }

  function _barOpts(orientation, suffix) {
    const horiz = orientation === 'horizontal';
    return {
      indexAxis: horiz ? 'y' : 'x',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${typeof c.raw === 'number' ? c.raw.toFixed(2) : c.raw}${suffix}` } }
      },
      scales: {
        x: { ticks: { color: CHART_DEFAULTS.TICK, font: CHART_DEFAULTS.FONT }, grid: { color: CHART_DEFAULTS.GRID } },
        y: { ticks: { color: CHART_DEFAULTS.TICK, font: CHART_DEFAULTS.FONT }, grid: { color: CHART_DEFAULTS.GRID } },
      }
    };
  }

  function _scaleStyle() {
    return { ticks: { color: CHART_DEFAULTS.TICK, font: CHART_DEFAULTS.FONT }, grid: { color: CHART_DEFAULTS.GRID } };
  }

  function _metricLabel(m) {
    const MAP = {
      delay_rate: 'Delay Rate (%)',
      total_delay_min: 'Total Delay Minutes',
      avg_delay_severity: 'Avg Severity (min)',
      cancellation_rate: 'Cancellation Rate (%)',
      delay_min_per_100: 'Delay Min / 100 Flights',
      diversion_rate: 'Diversion Rate (%)',
      delay_propagation_idx: 'Propagation Index (%)',
    };
    return MAP[m] || m;
  }

  function _median(arr) {
    const s = [...arr].sort((a,b) => a-b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m-1] + s[m]) / 2 : s[m];
  }

  return { render };
})();
