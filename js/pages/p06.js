/**
 * p06.js — Risk & Opportunity
 */
const Page06 = (() => {

  let _charts = {};
  function _destroy(k) { if (_charts[k]) { try { _charts[k].destroy(); } catch(e){} _charts[k] = null; } }

  function render() {
    const el = document.getElementById('p06');
    if (!el) return;

    el.innerHTML = `
      <div class="page-header">
        <h2>🚨 Risk &amp; Opportunity</h2>
        <p>Where should we focus? Identify the highest-risk areas and the greatest improvement opportunities.</p>
      </div>

      <!-- Risk matrix scatter (airports) -->
      <div class="grid-2">
        <div class="card">
          <div class="card-title"><span class="card-icon">🎯</span>Risk Matrix — Airport Frequency vs Severity</div>
          <p class="text-muted" style="font-size:12px;margin-bottom:12px">Bubble size = total flights. 
            <span style="color:#ef4444">■ High Risk</span> &nbsp;
            <span style="color:#f59e0b">■ High Severity</span> &nbsp;
            <span style="color:#3b82f6">■ High Frequency</span> &nbsp;
            <span style="color:#22c55e">■ Low Risk</span>
          </p>
          <div class="chart-wrap chart-xl"><canvas id="c-risk-scatter"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title"><span class="card-icon">🚨</span>High-Risk Airport List</div>
          <div id="p06-risk-list"></div>
          <hr class="divider" />
          <div class="card-title" style="margin-top:8px"><span class="card-icon">✅</span>Opportunity List — Below Benchmark</div>
          <div id="p06-opp-list"></div>
        </div>
      </div>

      <!-- Airline risk matrix -->
      <div class="card">
        <div class="card-title"><span class="card-icon">✈️</span>Airline Risk — Delay Rate vs Propagation Index</div>
        <div class="chart-wrap chart-lg"><canvas id="c-airline-risk"></canvas></div>
      </div>

      <!-- High-risk cause concentration -->
      <div class="grid-2">
        <div class="card">
          <div class="card-title"><span class="card-icon">🔴</span>Controllable vs Uncontrollable Delays</div>
          <div class="chart-wrap chart-md"><canvas id="c-control"></canvas></div>
          <p class="text-muted mt-8" style="font-size:12px">Controllable = Carrier + Late Aircraft &nbsp;|&nbsp; Uncontrollable = Weather + NAS + Security</p>
        </div>
        <div class="card">
          <div class="card-title"><span class="card-icon">📊</span>Risk Concentration — Airlines Above Benchmark</div>
          <div class="chart-wrap chart-md"><canvas id="c-airline-above"></canvas></div>
        </div>
      </div>

      <!-- What/Why/So What -->
      <div class="card">
        <div class="card-title"><span class="card-icon">💬</span>Analysis Framework</div>
        <div class="wws-grid">
          <div class="wws-card wws-what"><span class="wws-label">What Happened?</span><p id="p06-what">Loading…</p></div>
          <div class="wws-card wws-why"><span class="wws-label">Why?</span><p id="p06-why">Loading…</p></div>
          <div class="wws-card wws-sowhat"><span class="wws-label">So What?</span><p id="p06-sowhat">Loading…</p></div>
        </div>
      </div>
    `;

    _renderRiskScatter();
    _renderRiskLists();
    _renderAirlineRisk();
    _renderControllable();
    _renderAirlineAbove();
    _renderWWS();
  }

  function _renderRiskScatter() {
    _destroy('riskScatter');
    const pts = DataEngine.getRiskMatrix();
    if (!pts.length) return;
    const rates = pts.map(p => p.delay_rate);
    const sevs  = pts.map(p => p.avg_severity);
    const medRate = _median(rates);
    const medSev  = _median(sevs);
    const ctx = document.getElementById('c-risk-scatter');
    if (!ctx) return;
    _charts.riskScatter = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Airport',
          data: pts.map(p => ({ x: p.delay_rate, y: p.avg_severity })),
          backgroundColor: pts.map(p =>
            p.delay_rate >= medRate && p.avg_severity >= medSev ? 'rgba(239,68,68,0.8)' :
            p.delay_rate < medRate  && p.avg_severity >= medSev ? 'rgba(245,158,11,0.75)' :
            p.delay_rate >= medRate && p.avg_severity < medSev  ? 'rgba(59,130,246,0.7)' :
            'rgba(34,197,94,0.65)'
          ),
          pointRadius: pts.map(p => Math.max(4, Math.sqrt(p.arr_flights / 600))),
          pointHoverRadius: 9,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: c => {
                const p = pts[c.dataIndex];
                return [`${p.code}`, `Rate: ${p.delay_rate.toFixed(1)}%  |  Severity: ${p.avg_severity.toFixed(0)} min`];
              }
            }
          },
          annotation: {
            annotations: {
              vLine: { type:'line', xMin:medRate, xMax:medRate, borderColor:'rgba(110,118,129,0.35)', borderDash:[4,4] },
              hLine: { type:'line', yMin:medSev,  yMax:medSev,  borderColor:'rgba(110,118,129,0.35)', borderDash:[4,4] },
              lblHH: { type:'label', xValue:Math.max(...rates)*0.82, yValue:Math.max(...sevs)*0.92, content:['⚠️ HIGH RISK'], color:'rgba(239,68,68,0.7)', font:{size:11,weight:'bold'} },
              lblLL: { type:'label', xValue:Math.min(...rates)*1.1,  yValue:Math.min(...sevs)*1.15, content:['✅ LOW RISK'],   color:'rgba(34,197,94,0.6)',  font:{size:11,weight:'bold'} },
            }
          }
        },
        scales: {
          x: { title:{display:true,text:'Delay Rate (%)',color:'#8b949e',font:{size:11}}, ticks:{color:'#6e7681',font:{size:10}}, grid:{color:'rgba(48,54,61,0.5)'} },
          y: { title:{display:true,text:'Avg Severity (min)',color:'#8b949e',font:{size:11}}, ticks:{color:'#6e7681',font:{size:10}}, grid:{color:'rgba(48,54,61,0.5)'} },
        }
      }
    });
  }

  function _renderRiskLists() {
    const D = DataEngine;
    const net = D.getNetworkSummary();
    const airports = D.getAirportRankings('delay_rate', null);
    const avgRate = net.delay_rate;
    const avgSev  = net.avg_delay_severity;

    // High risk: above avg on BOTH
    const highRisk = airports
      .filter(a => a.delay_rate > avgRate && a.avg_delay_severity > avgSev)
      .sort((a,b) => (b.delay_rate + b.avg_delay_severity/10) - (a.delay_rate + a.avg_delay_severity/10))
      .slice(0, 8);

    // Opportunity: below avg on both
    const opp = airports
      .filter(a => a.delay_rate < avgRate * 0.85)
      .sort((a,b) => a.delay_rate - b.delay_rate)
      .slice(0, 5);

    const riskEl = document.getElementById('p06-risk-list');
    if (riskEl) {
      riskEl.innerHTML = highRisk.length ? highRisk.map(a => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
          <div>
            <strong>${a._key}</strong>
            <span class="text-dim" style="font-size:11px;margin-left:6px">${(a._name||'').split(':')[0].trim()}</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="badge badge-red">${a.delay_rate.toFixed(1)}%</span>
            <span class="text-dim" style="font-size:11px">${a.avg_delay_severity.toFixed(0)} min avg</span>
          </div>
        </div>`).join('') : '<p class="text-dim" style="font-size:12px">No high-risk airports in current filter.</p>';
    }

    const oppEl = document.getElementById('p06-opp-list');
    if (oppEl) {
      oppEl.innerHTML = opp.length ? opp.map(a => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
          <div>
            <strong>${a._key}</strong>
            <span class="text-dim" style="font-size:11px;margin-left:6px">${(a._name||'').split(':')[0].trim()}</span>
          </div>
          <span class="badge badge-green">${a.delay_rate.toFixed(1)}%</span>
        </div>`).join('') : '<p class="text-dim" style="font-size:12px">No benchmark leaders in current filter.</p>';
    }
  }

  function _renderAirlineRisk() {
    _destroy('airlineRisk');
    const D = DataEngine;
    const airlines = D.getAirlineRankings('delay_rate');
    const net = D.getNetworkSummary();
    const ctx = document.getElementById('c-airline-risk');
    if (!ctx) return;
    const medRate = net.delay_rate;
    const medProp = net.delay_propagation_idx;
    _charts.airlineRisk = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Airline',
          data: airlines.map(a => ({ x: a.delay_rate, y: a.delay_propagation_idx })),
          backgroundColor: airlines.map(a =>
            a.delay_rate >= medRate && a.delay_propagation_idx >= medProp ? 'rgba(239,68,68,0.8)' :
            a.delay_rate >= medRate ? 'rgba(245,158,11,0.75)' :
            a.delay_propagation_idx >= medProp ? 'rgba(59,130,246,0.7)' :
            'rgba(34,197,94,0.65)'
          ),
          pointRadius: airlines.map(a => Math.max(6, Math.sqrt(a.arr_flights / 3000))),
          pointHoverRadius: 10,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: c => {
                const a = airlines[c.dataIndex];
                return [`${a._key} — ${a._name||''}`, `Rate: ${a.delay_rate.toFixed(1)}%  |  Propagation: ${a.delay_propagation_idx.toFixed(1)}%`];
              }
            }
          },
          annotation: {
            annotations: {
              vLine: { type:'line', xMin:medRate, xMax:medRate, borderColor:'rgba(110,118,129,0.35)', borderDash:[4,4] },
              hLine: { type:'line', yMin:medProp, yMax:medProp, borderColor:'rgba(110,118,129,0.35)', borderDash:[4,4] },
            }
          }
        },
        scales: {
          x: { title:{display:true,text:'Delay Rate (%)',color:'#8b949e',font:{size:11}}, ticks:{color:'#6e7681',font:{size:10}}, grid:{color:'rgba(48,54,61,0.5)'} },
          y: { title:{display:true,text:'Propagation Index (%)',color:'#8b949e',font:{size:11}}, ticks:{color:'#6e7681',font:{size:10}}, grid:{color:'rgba(48,54,61,0.5)'} },
        }
      }
    });
  }

  function _renderControllable() {
    _destroy('control');
    const D = DataEngine;
    const net = D.getNetworkSummary();
    const controllable   = net.carrier_delay + net.late_aircraft_delay;
    const uncontrollable = net.weather_delay + net.nas_delay + net.security_delay;
    const ctx = document.getElementById('c-control');
    if (!ctx) return;
    _charts.control = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Controllable (Carrier + Late Aircraft)', 'Uncontrollable (Weather + NAS + Security)'],
        datasets: [{
          data: [controllable, uncontrollable],
          backgroundColor: ['rgba(239,68,68,0.75)', 'rgba(59,130,246,0.65)'],
          borderColor: '#161b22', borderWidth: 3, hoverOffset: 6,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#6b7280', font: { size: 10 }, padding: 14 } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${(c.raw/60).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')}h (${(c.raw/(controllable+uncontrollable)*100).toFixed(1)}%)` } }
        }
      }
    });
  }

  function _renderAirlineAbove() {
    _destroy('airlineAbove');
    const D = DataEngine;
    const net = D.getNetworkSummary();
    const airlines = D.getAirlineRankings('delay_rate');
    const above = airlines.filter(a => a.delay_rate > net.delay_rate).sort((a,b) => b.delay_rate - a.delay_rate);
    const ctx = document.getElementById('c-airline-above');
    if (!ctx) return;
    _charts.airlineAbove = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: above.map(a => a._key),
        datasets: [
          {
            label: 'Delay Rate (%)',
            data: above.map(a => a.delay_rate),
            backgroundColor: 'rgba(239,68,68,0.7)',
            borderRadius: 3,
          },
          {
            label: 'Network Avg',
            data: above.map(() => net.delay_rate),
            type: 'line',
            borderColor: '#22c55e',
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
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${Number(c.raw).toFixed(2)}%` } }
        },
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.6)' } },
          y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(209,213,219,0.5)' } },
        }
      }
    });
  }

  function _renderWWS() {
    const D = DataEngine;
    const net = D.getNetworkSummary();
    const highRiskAirports = D.getAirportRankings('delay_rate', null)
      .filter(a => a.delay_rate > net.delay_rate && a.avg_delay_severity > net.avg_delay_severity).length;
    const controllablePct = net.total_delay_min > 0
      ? ((net.carrier_delay + net.late_aircraft_delay) / net.total_delay_min * 100).toFixed(1)
      : '—';

    document.getElementById('p06-what').innerHTML =
      `<strong>${highRiskAirports} airports</strong> operate above the network average on both delay rate and severity — the high-risk quadrant. 
       <strong>${controllablePct}%</strong> of total delay minutes are categorised as controllable (carrier + late aircraft).`;

    document.getElementById('p06-why').innerHTML =
      `High-risk airports typically serve as major connection hubs where <strong>schedule compression and aircraft utilisation</strong> leave minimal recovery time. 
       Airlines in the high-rate / high-propagation quadrant face systemic operational challenges beyond weather or NAS limitations.`;

    document.getElementById('p06-sowhat').innerHTML =
      `Management should <strong>prioritise the ${highRiskAirports} high-risk airports</strong> for operational review and scheduling reform. 
       The ${controllablePct}% controllable share means <strong>substantial delay reduction is achievable without weather improvements</strong> — 
       making this a viable target for operational investment.`;
  }

  function _median(arr) {
    const s = [...arr].sort((a,b) => a-b);
    const m = Math.floor(s.length/2);
    return s.length % 2 === 0 ? (s[m-1]+s[m])/2 : s[m];
  }

  return { render };
})();
