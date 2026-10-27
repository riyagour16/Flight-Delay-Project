/**
 * data.js — Data layer
 * Handles XLSX parsing, column mapping, metric calculation, and filter state.
 */

const DataEngine = (() => {

  // ── Raw data ────────────────────────────────────────────────────────────────
  let _raw = [];          // array of row objects after parsing
  let _filtered = [];     // after applying global filters

  // ── Filter state ────────────────────────────────────────────────────────────
  const filters = {
    years:    [],   // [] = All
    months:   [],
    carriers: [],
    airports: [],
  };

  // ── Column map ──────────────────────────────────────────────────────────────
  // Maps expected field names to actual column names found in the file.
  const COL = {
    year:               'Year',
    month:              'Month',
    carrier:            'Carrier',
    carrier_name:       'Carrier_name',
    airport:            'Airport',
    airport_name:       'Airport_name',
    arr_flights:        'arr_flight',   // note: dataset uses arr_flight (no s)
    arr_del15:          'arr_del15',
    carrier_ct:         'carrier_ct',
    weather_ct:         'weather_ct',
    nas_ct:             'nas_ct',
    security_ct:        'security_ct',
    late_aircraft_ct:   'late_aircraft_ct',
    arr_cancelled:      'arr_cancelled',
    arr_diverted:       'arr_diverted',
    arr_delay:          'arr_delay',
    carrier_delay:      'carrier_delay',
    weather_delay:      'weather_delay',
    nas_delay:          'nas_delay',
    security_delay:     'security_delay',
    late_aircraft_delay:'late_aircraft_delay',
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const n = (v) => (v === undefined || v === null || v === '' || isNaN(Number(v))) ? 0 : Number(v);
  const pct = (num, den) => den > 0 ? (num / den) * 100 : 0;
  const safe = (v, fallback = 'N/A') => (v === undefined || v === null || v === '') ? fallback : v;

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ── Parse uploaded file ──────────────────────────────────────────────────────
  function parseFile(file, onSuccess, onError) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rows || rows.length === 0) { onError('No data found in file.'); return; }

        // Auto-detect column name variants
        const firstRow = rows[0];
        const keys = Object.keys(firstRow);
        // Try to fix arr_flight vs arr_flights
        const flightCol = keys.find(k => k.toLowerCase() === 'arr_flights' || k.toLowerCase() === 'arr_flight');
        if (flightCol && flightCol !== COL.arr_flights) COL.arr_flights = flightCol;

        _raw = rows.map(r => _normalizeRow(r));
        _applyFilters();
        onSuccess(_raw);
      } catch(err) {
        onError('Failed to parse file: ' + err.message);
      }
    };
    reader.onerror = () => onError('File read error.');
    reader.readAsArrayBuffer(file);
  }

  function _normalizeRow(r) {
    return {
      year:               n(r[COL.year]),
      month:              n(r[COL.month]),
      carrier:            safe(r[COL.carrier]),
      carrier_name:       safe(r[COL.carrier_name]),
      airport:            safe(r[COL.airport]),
      airport_name:       safe(r[COL.airport_name]),
      arr_flights:        n(r[COL.arr_flights]),
      arr_del15:          n(r[COL.arr_del15]),
      carrier_ct:         n(r[COL.carrier_ct]),
      weather_ct:         n(r[COL.weather_ct]),
      nas_ct:             n(r[COL.nas_ct]),
      security_ct:        n(r[COL.security_ct]),
      late_aircraft_ct:   n(r[COL.late_aircraft_ct]),
      arr_cancelled:      n(r[COL.arr_cancelled]),
      arr_diverted:       n(r[COL.arr_diverted]),
      arr_delay:          n(r[COL.arr_delay]),
      carrier_delay:      n(r[COL.carrier_delay]),
      weather_delay:      n(r[COL.weather_delay]),
      nas_delay:          n(r[COL.nas_delay]),
      security_delay:     n(r[COL.security_delay]),
      late_aircraft_delay:n(r[COL.late_aircraft_delay]),
    };
  }

  // ── Filter logic ─────────────────────────────────────────────────────────────
  function _applyFilters() {
    _filtered = _raw.filter(r => {
      if (filters.years.length    && !filters.years.includes(r.year))       return false;
      if (filters.months.length   && !filters.months.includes(r.month))     return false;
      if (filters.carriers.length && !filters.carriers.includes(r.carrier)) return false;
      if (filters.airports.length && !filters.airports.includes(r.airport)) return false;
      return true;
    });
  }

  function setFilter(key, values) {
    filters[key] = values;
    _applyFilters();
  }

  function resetFilters() {
    filters.years = []; filters.months = []; filters.carriers = []; filters.airports = [];
    _applyFilters();
  }

  function getFiltered() { return _filtered; }
  function getRaw()      { return _raw; }

  // ── Dimension values for filter dropdowns ────────────────────────────────────
  function getYears()    { return [...new Set(_raw.map(r => r.year))].filter(Boolean).sort(); }
  function getMonths()   { return [...new Set(_raw.map(r => r.month))].filter(Boolean).sort((a,b)=>a-b); }
  function getCarriers() { return [...new Set(_raw.map(r => r.carrier))].filter(Boolean).sort(); }
  function getAirports() { return [...new Set(_raw.map(r => r.airport))].filter(Boolean).sort(); }
  function getCarrierName(code) {
    const row = _raw.find(r => r.carrier === code);
    return row ? row.carrier_name : code;
  }
  function getAirportName(code) {
    const row = _raw.find(r => r.airport === code);
    return row ? row.airport_name : code;
  }

  // ── Core metric calculation ───────────────────────────────────────────────────
  /**
   * Aggregate an array of rows into summary metrics.
   */
  function aggregateRows(rows) {
    let arr_flights = 0, arr_del15 = 0, arr_cancelled = 0, arr_diverted = 0;
    let carrier_delay = 0, weather_delay = 0, nas_delay = 0, security_delay = 0, late_aircraft_delay = 0;
    let carrier_ct = 0, weather_ct = 0, nas_ct = 0, security_ct = 0, late_aircraft_ct = 0;
    let arr_delay = 0;

    for (const r of rows) {
      arr_flights        += r.arr_flights;
      arr_del15          += r.arr_del15;
      arr_cancelled      += r.arr_cancelled;
      arr_diverted       += r.arr_diverted;
      carrier_delay      += r.carrier_delay;
      weather_delay      += r.weather_delay;
      nas_delay          += r.nas_delay;
      security_delay     += r.security_delay;
      late_aircraft_delay+= r.late_aircraft_delay;
      carrier_ct         += r.carrier_ct;
      weather_ct         += r.weather_ct;
      nas_ct             += r.nas_ct;
      security_ct        += r.security_ct;
      late_aircraft_ct   += r.late_aircraft_ct;
      arr_delay          += r.arr_delay;
    }

    const total_delay_min = carrier_delay + weather_delay + nas_delay + security_delay + late_aircraft_delay;

    return {
      arr_flights,
      arr_del15,
      arr_cancelled,
      arr_diverted,
      carrier_delay,
      weather_delay,
      nas_delay,
      security_delay,
      late_aircraft_delay,
      carrier_ct,
      weather_ct,
      nas_ct,
      security_ct,
      late_aircraft_ct,
      arr_delay,
      total_delay_min,
      // Derived
      delay_rate:           pct(arr_del15, arr_flights),
      cancellation_rate:    pct(arr_cancelled, arr_flights),
      diversion_rate:       pct(arr_diverted, arr_flights),
      total_delay_hours:    total_delay_min / 60,
      avg_delay_severity:   arr_del15 > 0 ? total_delay_min / arr_del15 : 0,
      delay_min_per_100:    arr_flights > 0 ? (total_delay_min / arr_flights) * 100 : 0,
      delay_propagation_idx: total_delay_min > 0 ? pct(late_aircraft_delay, total_delay_min) : 0,
      carrier_contrib:      total_delay_min > 0 ? pct(carrier_delay, total_delay_min) : 0,
      weather_contrib:      total_delay_min > 0 ? pct(weather_delay, total_delay_min) : 0,
      nas_contrib:          total_delay_min > 0 ? pct(nas_delay, total_delay_min) : 0,
      security_contrib:     total_delay_min > 0 ? pct(security_delay, total_delay_min) : 0,
      late_aircraft_contrib:total_delay_min > 0 ? pct(late_aircraft_delay, total_delay_min) : 0,
    };
  }

  // ── Network-level summary (from filtered data) ───────────────────────────────
  function getNetworkSummary() {
    return aggregateRows(_filtered);
  }

  // ── Group by a dimension ──────────────────────────────────────────────────────
  function groupBy(dimension, rows = _filtered) {
    const map = new Map();
    for (const r of rows) {
      const key = r[dimension];
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    const result = [];
    for (const [key, group] of map) {
      const agg = aggregateRows(group);
      agg._key = key;
      // Attach name label
      if (dimension === 'carrier') agg._name = group[0].carrier_name || key;
      if (dimension === 'airport') agg._name = group[0].airport_name || key;
      if (dimension === 'year')    agg._name = String(key);
      if (dimension === 'month')   agg._name = MONTH_NAMES[(key - 1)] || String(key);
      result.push(agg);
    }
    return result;
  }

  // ── Time series: group by year-month ─────────────────────────────────────────
  function getTimeSeries(rows = _filtered) {
    const map = new Map();
    for (const r of rows) {
      const key = `${r.year}-${String(r.month).padStart(2,'0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    const result = [];
    for (const [key, group] of [...map.entries()].sort((a,b) => a[0].localeCompare(b[0]))) {
      const agg = aggregateRows(group);
      agg._key = key;
      agg._label = key;
      result.push(agg);
    }
    return result;
  }

  // ── Airline rankings ──────────────────────────────────────────────────────────
  function getAirlineRankings(metric = 'delay_rate', topN = null) {
    const groups = groupBy('carrier');
    // Only include carriers with meaningful flight volume (>= 100 flights)
    const qualified = groups.filter(g => g.arr_flights >= 100);
    qualified.sort((a, b) => b[metric] - a[metric]);
    return topN ? qualified.slice(0, topN) : qualified;
  }

  // ── Airport rankings ──────────────────────────────────────────────────────────
  function getAirportRankings(metric = 'delay_min_per_100', topN = 10) {
    const groups = groupBy('airport');
    const qualified = groups.filter(g => g.arr_flights >= 100);
    qualified.sort((a, b) => b[metric] - a[metric]);
    return topN ? qualified.slice(0, topN) : qualified;
  }

  // ── Cause breakdown ──────────────────────────────────────────────────────────
  function getCauseBreakdown(rows = _filtered) {
    const agg = aggregateRows(rows);
    return [
      { cause: 'Carrier',       minutes: agg.carrier_delay,       count: agg.carrier_ct,       contrib: agg.carrier_contrib },
      { cause: 'Late Aircraft', minutes: agg.late_aircraft_delay,  count: agg.late_aircraft_ct, contrib: agg.late_aircraft_contrib },
      { cause: 'NAS',           minutes: agg.nas_delay,            count: agg.nas_ct,           contrib: agg.nas_contrib },
      { cause: 'Weather',       minutes: agg.weather_delay,        count: agg.weather_ct,       contrib: agg.weather_contrib },
      { cause: 'Security',      minutes: agg.security_delay,       count: agg.security_ct,      contrib: agg.security_contrib },
    ].sort((a, b) => b.minutes - a.minutes);
  }

  // ── Cause time series (stacked area data) ────────────────────────────────────
  function getCauseTimeSeries(rows = _filtered) {
    const ts = getTimeSeries(rows);
    return {
      labels: ts.map(t => t._label),
      carrier:       ts.map(t => t.carrier_delay),
      late_aircraft: ts.map(t => t.late_aircraft_delay),
      nas:           ts.map(t => t.nas_delay),
      weather:       ts.map(t => t.weather_delay),
      security:      ts.map(t => t.security_delay),
    };
  }

  // ── Monthly heatmap data ──────────────────────────────────────────────────────
  function getMonthlyHeatmap(metric = 'delay_rate', rows = _filtered) {
    const years  = [...new Set(rows.map(r => r.year))].sort();
    const months = [1,2,3,4,5,6,7,8,9,10,11,12];
    const data = {};
    for (const yr of years) {
      data[yr] = {};
      for (const mo of months) {
        const subset = rows.filter(r => r.year === yr && r.month === mo);
        data[yr][mo] = subset.length ? aggregateRows(subset)[metric] : null;
      }
    }
    return { years, months, data, monthNames: MONTH_NAMES };
  }

  // ── YoY comparison ────────────────────────────────────────────────────────────
  function getYearOverYear(metric = 'delay_rate', rows = _filtered) {
    const byYear = groupBy('year', rows).sort((a, b) => a._key - b._key);
    return byYear.map((y, i) => ({
      year: y._key,
      value: y[metric],
      yoy_change: i > 0 ? y[metric] - byYear[i-1][metric] : null,
    }));
  }

  // ── Scatter data for Freq vs Severity (airports) ─────────────────────────────
  function getFreqSeverityScatter(rows = _filtered) {
    const groups = groupBy('airport', rows);
    return groups
      .filter(g => g.arr_flights >= 200)
      .map(g => ({
        code:         g._key,
        name:         g._name,
        delay_rate:   g.delay_rate,
        avg_severity: g.avg_delay_severity,
        arr_flights:  g.arr_flights,
        total_delay_min: g.total_delay_min,
      }));
  }

  // ── Risk matrix data ──────────────────────────────────────────────────────────
  function getRiskMatrix(rows = _filtered) {
    // By airport: delay_rate (x), avg_severity (y), bubble = flights
    return getFreqSeverityScatter(rows);
  }

  // ── Dynamic insights generator ────────────────────────────────────────────────
  function generateInsights(rows = _filtered) {
    const net = aggregateRows(rows);
    const causes = getCauseBreakdown(rows);
    const airlines = getAirlineRankings('delay_rate');
    const airports = getAirportRankings('delay_min_per_100', 5);
    const timeSeries = getTimeSeries(rows);
    const insights = [];

    // 1. Dominant delay cause
    if (causes.length > 0) {
      const top = causes[0];
      insights.push({
        icon: '🔍',
        title: 'Dominant Delay Cause',
        text: `<strong>${top.cause}</strong> delays account for <strong>${top.contrib.toFixed(1)}%</strong> of all delay minutes (${(top.minutes/60).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')} hours), making it the single largest driver of delay impact.`
      });
    }

    // 2. Highest-risk airline
    if (airlines.length > 0) {
      const worst = airlines[0];
      const net_rate = net.delay_rate;
      const diff = worst.delay_rate - net_rate;
      insights.push({
        icon: '✈️',
        title: 'High-Risk Airline',
        text: `<strong>${worst._name || worst._key}</strong> carries a delay rate of <strong>${worst.delay_rate.toFixed(1)}%</strong>, which is <strong>${diff > 0 ? '+' : ''}${diff.toFixed(1)} pp</strong> vs. the network average of ${net_rate.toFixed(1)}%.`
      });
    }

    // 3. Highest-impact airport
    if (airports.length > 0) {
      const top = airports[0];
      insights.push({
        icon: '📍',
        title: 'Highest-Impact Airport',
        text: `<strong>${top._name || top._key}</strong> generates <strong>${top.delay_min_per_100.toFixed(0)} delay minutes per 100 flights</strong> — the highest in the network, with a delay rate of ${top.delay_rate.toFixed(1)}%.`
      });
    }

    // 4. Trend direction
    if (timeSeries.length >= 2) {
      const first = timeSeries[0].delay_rate;
      const last  = timeSeries[timeSeries.length - 1].delay_rate;
      const change = last - first;
      const dir = change > 0 ? 'increased' : 'decreased';
      insights.push({
        icon: '📈',
        title: 'Trend Signal',
        text: `Delay rates have <strong>${dir} by ${Math.abs(change).toFixed(1)} pp</strong> from ${timeSeries[0]._label} to ${timeSeries[timeSeries.length-1]._label}, indicating a${change > 0 ? ' deteriorating' : 'n improving'} operational trend.`
      });
    }

    // 5. Late-aircraft propagation
    const propIdx = net.delay_propagation_idx;
    if (propIdx > 20) {
      insights.push({
        icon: '🔄',
        title: 'High Delay Propagation',
        text: `Late-aircraft delays represent <strong>${propIdx.toFixed(1)}%</strong> of total delay minutes, signaling systemic delay propagation — issues earlier in the day cascade into subsequent flights.`
      });
    }

    return insights;
  }

  // ── Executive takeaway ────────────────────────────────────────────────────────
  function generateExecutiveTakeaway(rows = _filtered) {
    const net = aggregateRows(rows);
    const causes = getCauseBreakdown(rows);
    const airlines = getAirlineRankings('delay_rate');
    const airports = getAirportRankings('delay_min_per_100', 3);

    const topCause   = causes[0]?.cause || 'carrier';
    const topAirline = airlines[0]?._name || airlines[0]?._key || '—';
    const topAirport = airports[0]?._name || airports[0]?._key || '—';

    return `The network is operating at a <strong>${net.delay_rate.toFixed(1)}% delay rate</strong> with a cancellation rate of <strong>${net.cancellation_rate.toFixed(1)}%</strong>, 
    representing <strong>${(net.total_delay_hours).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')} total delay hours</strong> across ${net.arr_flights.toLocaleString()} flights. 
    <strong>${topCause} delays</strong> are the primary driver of delay minutes, accounting for ${causes[0]?.contrib.toFixed(1) || '—'}% of total impact. 
    <strong>${topAirline}</strong> shows the highest delay rate among carriers, while <strong>${topAirport}</strong> emerges as the most delay-intensive airport by normalized impact. 
    Delay propagation — cascading effects from late aircraft — amplifies operational disruption throughout the day and warrants targeted scheduling and turnaround investigation.`;
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  return {
    parseFile,
    setFilter,
    resetFilters,
    getFilters: () => ({ ...filters }),
    getFiltered,
    getRaw,
    getYears,
    getMonths,
    getCarriers,
    getAirports,
    getCarrierName,
    getAirportName,
    getNetworkSummary,
    aggregateRows,
    groupBy,
    getTimeSeries,
    getAirlineRankings,
    getAirportRankings,
    getCauseBreakdown,
    getCauseTimeSeries,
    getMonthlyHeatmap,
    getYearOverYear,
    getFreqSeverityScatter,
    getRiskMatrix,
    generateInsights,
    generateExecutiveTakeaway,
    MONTH_NAMES,
    fmt: {
      num:  v => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }),
      pct:  v => Number(v).toFixed(1) + '%',
      hrs:  v => Number(v).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      min:  v => Number(v).toFixed(1),
    }
  };
})();
