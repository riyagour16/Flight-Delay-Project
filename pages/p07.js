/**
 * p07.js — Insights & Recommendations
 */
const Page07 = (() => {

  function render() {
    const el = document.getElementById('p07');
    if (!el) return;

    const D = DataEngine;
    const net = D.getNetworkSummary();
    const f = D.fmt;
    const causes = D.getCauseBreakdown();
    const airlines = D.getAirlineRankings('delay_rate');
    const airports = D.getAirportRankings('delay_min_per_100', 5);
    const insights = D.generateInsights();
    const takeaway = D.generateExecutiveTakeaway();

    const topCause   = causes[0] || {};
    const topAirline = airlines[0] || {};
    const worstAirport = airports[0] || {};
    const bestAirline  = airlines[airlines.length - 1] || {};

    const controllable = net.total_delay_min > 0
      ? ((net.carrier_delay + net.late_aircraft_delay) / net.total_delay_min * 100).toFixed(1)
      : '—';

    const yoy = D.getYearOverYear('delay_rate');
    const lastYoy = yoy.length > 1 ? yoy[yoy.length-1].yoy_change : null;
    const trendSentence = lastYoy !== null
      ? `The most recent year-over-year change was <strong>${lastYoy > 0 ? '+' : ''}${lastYoy.toFixed(2)} pp</strong>, indicating a ${lastYoy > 0 ? 'deteriorating' : 'positive'} trend.`
      : '';

    const recs = [
      {
        priority: 'Critical',
        color: 'var(--danger)',
        icon: '🔴',
        title: `Reduce ${topCause.cause || 'Carrier'} Delays`,
        detail: `${topCause.cause || 'Carrier'} delays account for <strong>${(topCause.contrib||0).toFixed(1)}%</strong> of all delay minutes. 
          This is the highest-ROI target. Root-cause analysis should focus on 
          ${topCause.cause === 'Carrier' ? '<strong>maintenance reliability, crew scheduling, and aircraft rotation efficiency</strong>' :
            topCause.cause === 'Late Aircraft' ? '<strong>scheduling buffers, hub turnaround times, and proactive recovery planning</strong>' :
            topCause.cause === 'NAS' ? '<strong>slot coordination with ATC, preferred routing, and demand management</strong>' :
            '<strong>the specific drivers of this delay category</strong>'}.`,
        action: `Establish a cross-functional task force targeting ${topCause.cause} delay root causes within 60 days.`,
      },
      {
        priority: 'High',
        color: 'var(--kpi-orange)',
        icon: '🟠',
        title: `Prioritise High-Risk Airports`,
        detail: `<strong>${worstAirport._key}</strong> and similar hub airports generate disproportionate delay impact. 
          With <strong>${(worstAirport.delay_min_per_100||0).toFixed(0)} delay minutes per 100 flights</strong>, 
          these airports drive systemic network disruption through late-aircraft propagation.`,
        action: `Commission airport-level operational audits at the top 5 high-risk airports, focusing on turnaround efficiency and slot utilisation.`,
      },
      {
        priority: 'High',
        color: 'var(--kpi-orange)',
        icon: '🟠',
        title: `Address Airline Performance Gaps`,
        detail: `<strong>${topAirline._name || topAirline._key}</strong> operates at a delay rate of 
          <strong>${(topAirline.delay_rate||0).toFixed(1)}%</strong> versus the network average of <strong>${net.delay_rate.toFixed(1)}%</strong>. 
          Performance benchmarking against top performers like <strong>${bestAirline._name || bestAirline._key}</strong> (${(bestAirline.delay_rate||0).toFixed(1)}%) 
          can identify specific scheduling or operational practices worth adopting.`,
        action: `Implement airline-level KPI dashboards and quarterly performance reviews against network benchmarks.`,
      },
      {
        priority: 'Medium',
        color: 'var(--kpi-amber)',
        icon: '🟡',
        title: `Reduce Delay Propagation`,
        detail: `Late-aircraft propagation contributes <strong>${net.delay_propagation_idx.toFixed(1)}%</strong> of total delay minutes. 
          This cascading effect means that delays compound throughout the operating day, disproportionately affecting afternoon and evening flights.`,
        action: `Review scheduling models to add recovery buffers at key hub airports, especially in the first wave of morning departures.`,
      },
      {
        priority: 'Medium',
        color: 'var(--kpi-amber)',
        icon: '🟡',
        title: `Leverage Seasonal Capacity Planning`,
        detail: `Delay rates follow a predictable seasonal pattern. Peak months require proactive resource allocation — 
          additional ground staff, maintenance crews, and gate flexibility — rather than reactive adjustments after disruptions occur.`,
        action: `Build seasonal delay rate forecasts into annual capacity planning cycles and pre-negotiate resource flexibility with ground handlers.`,
      },
      {
        priority: 'Low',
        color: 'var(--success)',
        icon: '🟢',
        title: `Capitalise on Controllable Delay Share`,
        detail: `<strong>${controllable}%</strong> of total delay minutes are classified as controllable (carrier + late aircraft). 
          This represents the maximum achievable delay reduction without external intervention on weather or NAS. 
          ${trendSentence}`,
        action: `Set a three-year delay reduction target focused on controllable delay categories, with quarterly progress reviews.`,
      },
    ];

    el.innerHTML = `
      <div class="page-header">
        <h2>💡 Insights &amp; Recommendations</h2>
        <p>What should management do? Data-driven findings converted into actionable business decisions.</p>
      </div>

      <!-- Executive summary -->
      <div class="card">
        <div class="card-title"><span class="card-icon">📋</span>Executive Summary</div>
        <div class="takeaway-box">${takeaway}</div>
      </div>

      <!-- Network KPI snapshot -->
      <div class="card">
        <div class="card-title"><span class="card-icon">📊</span>Current Network Snapshot</div>
        <div class="kpi-grid">
          <div class="kpi-card" style="--kpi-color:#3b82f6"><div class="kpi-label">Total Flights</div><div class="kpi-value">${f.num(net.arr_flights)}</div><div class="kpi-sub">total arrivals</div></div>
          <div class="kpi-card" style="--kpi-color:#ef4444"><div class="kpi-label">Delay Rate</div><div class="kpi-value">${f.pct(net.delay_rate)}</div><div class="kpi-sub">of all flights delayed</div></div>
          <div class="kpi-card" style="--kpi-color:#f97316"><div class="kpi-label">Delay Hours</div><div class="kpi-value">${f.hrs(net.total_delay_hours)}</div><div class="kpi-sub">total delay hours</div></div>
          <div class="kpi-card" style="--kpi-color:#a855f7"><div class="kpi-label">Controllable</div><div class="kpi-value">${controllable}%</div><div class="kpi-sub">of delay is controllable</div></div>
          <div class="kpi-card" style="--kpi-color:#f59e0b"><div class="kpi-label">Cancel Rate</div><div class="kpi-value">${f.pct(net.cancellation_rate)}</div><div class="kpi-sub">flights cancelled</div></div>
          <div class="kpi-card" style="--kpi-color:#14b8a6"><div class="kpi-label">Propagation</div><div class="kpi-value">${net.delay_propagation_idx.toFixed(1)}%</div><div class="kpi-sub">late-aircraft share</div></div>
        </div>
      </div>

      <!-- Key findings -->
      <div class="card">
        <div class="card-title"><span class="card-icon">🔍</span>Key Findings</div>
        <div class="insights-panel">${insights.map(i => `
          <div class="insight-item">
            <div class="insight-title">${i.icon} ${i.title}</div>
            <div class="insight-text">${i.text}</div>
          </div>`).join('')}
        </div>
      </div>

      <!-- Recommendations -->
      <div class="card">
        <div class="card-title"><span class="card-icon">🎯</span>Strategic Recommendations</div>
        ${recs.map((r, i) => `
          <div style="border:1px solid var(--border);border-left:4px solid ${r.color};border-radius:var(--radius-sm);padding:16px 20px;margin-bottom:14px;background:var(--surface2)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <span style="font-size:13px">${r.icon}</span>
              <strong style="font-size:14px">${r.title}</strong>
              <span style="margin-left:auto;font-size:11px;font-weight:600;color:${r.color};background:${r.color}22;padding:2px 10px;border-radius:20px">${r.priority}</span>
            </div>
            <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:10px">${r.detail}</p>
            <div style="background:var(--bg);border-radius:4px;padding:8px 12px;font-size:12px;color:var(--text-muted)">
              <strong style="color:var(--accent)">→ Action:</strong> ${r.action}
            </div>
          </div>`).join('')}
      </div>

      <!-- Benchmarking table -->
      <div class="card">
        <div class="card-title"><span class="card-icon">🏆</span>Airline Benchmarking — Best vs Worst</div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead>
              <tr><th>Airline</th><th>Delay Rate</th><th>Avg Severity</th><th>Cancel Rate</th><th>Min/100 Flights</th><th>Propagation</th><th>Assessment</th></tr>
            </thead>
            <tbody>
              ${airlines.map(a => {
                const diff = a.delay_rate - net.delay_rate;
                const badge = diff > 3 ? `<span class="badge badge-red">High Risk</span>` :
                              diff > 1 ? `<span class="badge badge-amber">Above Avg</span>` :
                              diff < -1 ? `<span class="badge badge-green">Top Performer</span>` :
                              `<span class="badge badge-amber">On Benchmark</span>`;
                return `<tr>
                  <td><strong>${a._name || a._key}</strong> <span class="text-dim" style="font-size:11px">${a._key}</span></td>
                  <td>${f.pct(a.delay_rate)}</td>
                  <td>${a.avg_delay_severity.toFixed(0)} min</td>
                  <td>${f.pct(a.cancellation_rate)}</td>
                  <td>${a.delay_min_per_100.toFixed(0)}</td>
                  <td>${a.delay_propagation_idx.toFixed(1)}%</td>
                  <td>${badge}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return { render };
})();
