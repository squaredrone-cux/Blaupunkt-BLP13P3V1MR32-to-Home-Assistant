// WP-Temperatur-Karte: Stromverbrauch der Wärmepumpe pro Tag gegen das Tagesmittel außen.
// Punktwolke mit Trendlinie, darunter Kennzahlen (kWh je Grad, Heizgrenze, R²) und Hochrechnung.
// Holt die Tageswerte selbst aus der Langzeitstatistik von Home Assistant.
// Konfiguration:
//   type: custom:wp-temperatur-card
//   energie: sensor.wp_energiemeter_energie        (Zähler, kWh steigend)
//   temperatur: [sensor.wp_aussentemperatur_gefiltert, sensor.wp_aussentemperatur]
//                                                   (erster vorhandener Tagesmittelwert zählt)
//   ab: "2026-10-13"      erster Tag, der zählt (z. B. nach dem Aufheizen)
//   tage: 90              wie weit zurück
//   min_kwh: 1            Tage mit weniger Verbrauch werden ignoriert
//   title: optional
class WpTemperaturCard extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign({
      energie: "sensor.wp_energiemeter_energie",
      temperatur: ["sensor.wp_aussentemperatur_gefiltert", "sensor.wp_aussentemperatur"],
      tage: 90, min_kwh: 1, ab: null,
    }, config || {});
    if (typeof this._config.temperatur === "string") this._config.temperatur = [this._config.temperatur];
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._daten = null;
  }
  getCardSize() { return 9; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }

  set hass(hass) {
    this._hass = hass;
    const jetzt = Date.now();
    if (!this._geholt || jetzt - this._geholt > 30 * 60 * 1000) {
      this._geholt = jetzt;
      this._holen();
    }
    if (!this._daten && !this.shadowRoot.innerHTML) this._render();
  }

  _tag(ts) {
    const d = new Date(typeof ts === "number" ? ts : Date.parse(ts));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async _holen() {
    const c = this._config;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - c.tage);
    const ende = new Date();
    ende.setHours(0, 0, 0, 0); // nur abgeschlossene Tage
    try {
      const res = await this._hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: start.toISOString(), end_time: ende.toISOString(),
        statistic_ids: [c.energie, ...c.temperatur], period: "day",
        types: ["change", "mean"],
      });
      const kwh = {};
      (res[c.energie] || []).forEach(r => { if (r.change != null) kwh[this._tag(r.start)] = r.change; });
      const temp = {};
      [...c.temperatur].reverse().forEach(id => {
        (res[id] || []).forEach(r => { if (r.mean != null) temp[this._tag(r.start)] = r.mean; });
      });
      const punkte = Object.keys(kwh).sort()
        .filter(d => temp[d] != null && kwh[d] >= c.min_kwh && (!c.ab || d >= c.ab))
        .map(d => ({ d, t: temp[d], e: kwh[d] }));
      this._daten = punkte;
    } catch (err) {
      this._fehler = String(err && err.message || err);
    }
    this._render();
  }

  _fit(p) {
    const n = p.length;
    if (n < 3) return null;
    const mx = p.reduce((a, r) => a + r.t, 0) / n, my = p.reduce((a, r) => a + r.e, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    p.forEach(r => { sxy += (r.t - mx) * (r.e - my); sxx += (r.t - mx) ** 2; syy += (r.e - my) ** 2; });
    if (!sxx || !syy) return null;
    const m = sxy / sxx, b = my - m * mx;
    return { m, b, r2: (sxy * sxy) / (sxx * syy), grenze: m < 0 ? -b / m : null };
  }

  _fmt(v, dez) { return v.toLocaleString("de-DE", { minimumFractionDigits: dez, maximumFractionDigits: dez }); }

  _render() {
    const titel = this._config.title || "Wärmepumpen-Strom und Außentemperatur";
    if (this._fehler || !this._daten) {
      this.shadowRoot.innerHTML = `<ha-card style="padding:16px"><div style="font-weight:500">${titel}</div>
        <div style="color:var(--secondary-text-color);margin-top:6px">${this._fehler ? "Fehler: " + this._fehler : "Lade Statistik …"}</div></ha-card>`;
      return;
    }
    const p = this._daten;
    const fit = this._fit(p);
    // Achsen
    const W = 640, H = 300, L = 44, R = 26, T = 12, B = 34;
    const tMin = Math.floor(Math.min(...p.map(r => r.t), fit && fit.grenze != null ? 18 : 99, 5) - 1);
    const tMax = Math.ceil(Math.max(...p.map(r => r.t), fit && fit.grenze != null ? fit.grenze : -99) + 1);
    const eMax = Math.ceil(Math.max(10, ...p.map(r => r.e), fit ? fit.m * tMin + fit.b : 0) / 10) * 10;
    const x = t => L + (t - tMin) / (tMax - tMin) * (W - L - R);
    const y = e => T + (1 - e / eMax) * (H - T - B);
    let grid = "";
    for (let t = Math.ceil(tMin / 5) * 5; t <= tMax; t += 5)
      grid += `<line x1="${x(t)}" x2="${x(t)}" y1="${T}" y2="${H - B}" class="g"/><text x="${x(t)}" y="${H - B + 16}" class="ax" text-anchor="middle">${t} °C</text>`;
    const eStep = eMax > 60 ? 20 : 10;
    for (let e = 0; e <= eMax; e += eStep)
      grid += `<line x1="${L}" x2="${W - R}" y1="${y(e)}" y2="${y(e)}" class="g"/><text x="${L - 6}" y="${y(e) + 4}" class="ax" text-anchor="end">${e}</text>`;
    let linie = "";
    if (fit) {
      const t1 = tMin, t2 = fit.grenze != null ? Math.min(tMax, fit.grenze) : tMax;
      linie = `<line x1="${x(t1)}" y1="${y(Math.max(0, fit.m * t1 + fit.b))}" x2="${x(t2)}" y2="${y(Math.max(0, fit.m * t2 + fit.b))}" class="trend"/>`;
    }
    const neu = p.length ? p[p.length - 1].d : "";
    const wt = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const lbl = d => { const z = new Date(d + "T12:00:00"); return `${wt[z.getDay()]} ${z.getDate()}.${z.getMonth() + 1}.`; };
    const punkte = p.map((r, i) => {
      const alter = (p.length - 1 - i) / Math.max(1, p.length - 1);
      return `<circle cx="${x(r.t)}" cy="${y(r.e)}" r="${r.d === neu ? 6 : 4.5}" class="pt${r.d === neu ? " neu" : ""}" style="opacity:${(1 - alter * 0.55).toFixed(2)}"><title>${lbl(r.d)}: ${this._fmt(r.e, 1)} kWh bei Ø ${this._fmt(r.t, 1)} °C</title></circle>`;
    }).join("");
    const kenn = fit ? `
      <div class="kz"><div class="k"><b>${this._fmt(-fit.m, 1)} kWh</b><span>mehr pro Grad kälter</span></div>
      <div class="k"><b>${fit.grenze != null ? this._fmt(fit.grenze, 1) + " °C" : "–"}</b><span>Heizgrenze (Tagesmittel)</span></div>
      <div class="k"><b>${this._fmt(fit.r2 * 100, 0)} %</b><span>durch Außentemperatur erklärt</span></div>
      <div class="k"><b>${p.length}</b><span>Tage ausgewertet</span></div></div>
      <div class="hr">Hochrechnung pro Tag: ${[10, 5, 0, -5, -10].map(t => `<span><b>${t} °C</b> ≈ ${this._fmt(Math.max(0, fit.m * t + fit.b), 0)} kWh</span>`).join("")}</div>` :
      `<div class="hr">Noch zu wenige Tage für eine Trendlinie (mindestens 3).</div>`;
    const tabelle = p.slice(-14).reverse().map(r => {
      const soll = fit ? Math.max(0, fit.m * r.t + fit.b) : null;
      const abw = soll ? (r.e - soll) / soll * 100 : null;
      return `<tr><td>${lbl(r.d)}</td><td>${this._fmt(r.t, 1)} °C</td><td>${this._fmt(r.e, 1)}</td><td>${soll != null ? this._fmt(soll, 1) : "–"}</td>
        <td class="${abw == null ? "" : abw > 15 ? "hoch" : abw < -15 ? "tief" : ""}">${abw != null ? (abw > 0 ? "+" : "") + this._fmt(abw, 0) + " %" : ""}</td></tr>`;
    }).join("");
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 14px 16px 14px; }
        .title { font-size:16px; font-weight:500; color:var(--primary-text-color); }
        .sub { font-size:12px; color:var(--secondary-text-color); margin-top:2px; }
        svg { width:100%; height:auto; display:block; margin-top:8px; }
        .g { stroke: var(--divider-color); stroke-width:1; }
        .ax { font-size:11px; fill: var(--secondary-text-color); }
        .pt { fill:#3a86ff; stroke: var(--card-background-color, #1c1c1c); stroke-width:1.5; }
        .pt.neu { fill:#ffb703; }
        .trend { stroke:#ff9e80; stroke-width:2; stroke-dasharray:6 4; }
        .kz { display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin-top:10px; }
        .k { background: var(--secondary-background-color, rgba(127,127,127,.1)); border-radius:8px; padding:8px 10px; }
        .k b { display:block; font-size:17px; color:var(--primary-text-color); font-variant-numeric: tabular-nums; }
        .k span { font-size:11.5px; color:var(--secondary-text-color); }
        .hr { margin-top:10px; font-size:12.5px; color:var(--secondary-text-color); display:flex; flex-wrap:wrap; gap:4px 14px; }
        .hr b { color:var(--primary-text-color); font-weight:600; }
        table { width:100%; border-collapse:collapse; margin-top:12px; font-size:12.5px; font-variant-numeric: tabular-nums; }
        th { text-align:right; font-weight:500; font-size:11px; color:var(--secondary-text-color); padding:3px 6px; border-bottom:1px solid var(--divider-color); }
        td { text-align:right; padding:3px 6px; color:var(--primary-text-color); }
        th:first-child, td:first-child { text-align:left; }
        td.hoch { color:#e5383b; } td.tief { color:#43a047; }
        .note { margin-top:8px; font-size:11px; color:var(--secondary-text-color); }
      </style>
      <ha-card>
        <div class="title">${titel}</div>
        <div class="sub">Jeder Punkt ist ein Tag: Strom der Wärmepumpe (kWh/Tag) über dem Tagesmittel außen. Gestrichelt = Trend, gelb = letzter Tag.</div>
        <svg viewBox="0 0 ${W} ${H}">${grid}${linie}${punkte}</svg>
        ${kenn}
        <table><tr><th>Tag</th><th>Ø außen</th><th>kWh</th><th>Trend</th><th>Abw.</th></tr>${tabelle}</table>
        <div class="note">Abweichung rot = deutlich mehr als bei dieser Temperatur üblich (z. B. Heizstab, viel Abtauung, Heizkurve hoch), grün = deutlich weniger (z. B. viel Sonne). Nur abgeschlossene Tage${this._config.ab ? " ab " + lbl(this._config.ab) : "."}</div>
      </ha-card>`;
  }
}
customElements.define("wp-temperatur-card", WpTemperaturCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "wp-temperatur-card", name: "WP-Strom vs. Außentemperatur", description: "Tagesverbrauch der Wärmepumpe über der Außentemperatur mit Trendlinie" });
