// Prognose-Karte: erwarteter Stromverbrauch der Heiz-Wärmepumpe für die nächsten 14 Tage
// als Balken, darunter Wochentag, Datum und Tagesmittel außen.
// Rechnet wie custom_templates/wp_prognose.jinja:
//   kWh/Tag = steigung × (f / basis) × (heizgrenze − Tagesmittel), nie unter 0
//   f = aktuelle kWh je Heizgradtag (14-Tage-Mittel), begrenzt auf 1…5
// Konfiguration:
//   type: custom:prognose-card
//   wetter: sensor.wetterprognose_14_tage                     (Attribut daily von Open-Meteo)
//   effizienz: sensor.wp_kwh_pro_heizgradtag_mittel_14_tage
//   steigung: 2.6      heizgrenze: 18.7      basis: 2.3       (wie in wp_prognose.jinja)
//   title: optional
class PrognoseCard extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign({
      wetter: "sensor.wetterprognose_14_tage",
      effizienz: "sensor.wp_kwh_pro_heizgradtag_mittel_14_tage",
      steigung: 2.6, heizgrenze: 18.7, basis: 2.3,
    }, config || {});
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }
  getCardSize() { return 6; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }

  set hass(hass) {
    this._hass = hass;
    const w = hass.states[this._config.wetter];
    const e = hass.states[this._config.effizienz];
    const key = JSON.stringify([w && w.attributes.daily, e && e.state]);
    if (key === this._last) return;
    this._last = key;
    this._render();
  }

  _daten() {
    const c = this._config;
    const w = this._hass.states[c.wetter];
    const d = w && w.attributes.daily;
    if (!d || !d.time || !d.temperature_2m_mean) return null;
    const e = this._hass.states[c.effizienz];
    let f = e ? parseFloat(e.state) : NaN;
    if (isNaN(f)) f = c.basis;
    f = Math.min(5, Math.max(1, f));
    const faktor = c.steigung * f / c.basis;
    const tage = d.time.map((t, i) => {
      const tm = d.temperature_2m_mean[i];
      const kwh = Math.max(0, Math.round(faktor * (c.heizgrenze - tm) * 10) / 10);
      return { t, tm, tmin: d.temperature_2m_min ? d.temperature_2m_min[i] : null, kwh };
    });
    return { tage, f };
  }

  _fmt(v, dez) { return v.toLocaleString("de-DE", { minimumFractionDigits: dez, maximumFractionDigits: dez }); }

  _render() {
    const daten = this._daten();
    if (!daten) {
      this.shadowRoot.innerHTML = `<ha-card style="padding:16px">Keine Wetterprognose (${this._config.wetter}) verfügbar.</ha-card>`;
      return;
    }
    const { tage, f } = daten;
    const s7 = tage.slice(0, 7).reduce((a, r) => a + r.kwh, 0);
    const s14 = tage.reduce((a, r) => a + r.kwh, 0);
    const max = Math.max(10, ...tage.map(r => r.kwh));
    const wt = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const spalten = tage.map((r, i) => {
      const d = new Date(r.t + "T12:00:00");
      const h = (r.kwh / max) * 100;
      return `<div class="col${i >= 7 ? " spaet" : ""}" title="${wt[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.: ${this._fmt(r.kwh, 1)} kWh bei Ø ${this._fmt(r.tm, 1)} °C${r.tmin != null ? ` (min ${this._fmt(r.tmin, 1)} °C)` : ""}">
        <div class="area"><div class="val" style="bottom:calc(${h}% + 4px)">${this._fmt(r.kwh, 0)}</div><div class="bar" style="height:${Math.max(h, 0.5)}%"></div></div>
        <div class="wt">${wt[d.getDay()]}</div>
        <div class="dt">${d.getDate()}.${d.getMonth() + 1}.</div>
        <div class="tm">${this._fmt(r.tm, 1)}°</div>
      </div>`;
    }).join("");
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 14px 16px 12px; }
        .title { font-size: 16px; font-weight: 600; color: var(--primary-text-color); }
        .sub { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }
        .chart { display: grid; grid-template-columns: repeat(${tage.length}, 1fr); gap: 6px; margin-top: 14px; }
        .col { display: flex; flex-direction: column; align-items: center; min-width: 0; }
        .area { position: relative; width: 100%; height: 150px; border-bottom: 1px solid var(--divider-color); }
        .bar { position: absolute; bottom: 0; left: 8%; right: 8%; background: #3a86ff; border-radius: 4px 4px 0 0; }
        .spaet .bar { background: rgba(58, 134, 255, .45); }
        .val { position: absolute; left: 0; right: 0; text-align: center; font-size: 12px; font-weight: 600;
               color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
        .wt { font-size: 12px; color: var(--primary-text-color); margin-top: 6px; }
        .dt { font-size: 11px; color: var(--secondary-text-color); }
        .tm { font-size: 11.5px; color: #ff9e80; margin-top: 2px; font-variant-numeric: tabular-nums; }
        .note { font-size: 11px; color: var(--secondary-text-color); margin-top: 10px; }
      </style>
      <ha-card>
        <div class="title">${this._config.title || `Prognose: ${this._fmt(s7, 0)} kWh in 7 Tagen, ${this._fmt(s14, 0)} kWh in 14 Tagen`}</div>
        <div class="sub">Open-Meteo-Tagesmittel × eigene Effizienz (${this._fmt(f, 2)} kWh je Heizgradtag, 14-Tage-Mittel)</div>
        <div class="chart">${spalten}</div>
        <div class="note">kWh Strom pro Tag · Tagesmittel außen in Orange · hellere Balken = Tage 8–14, Wetter dort unsicherer</div>
      </ha-card>`;
  }
}
customElements.define("prognose-card", PrognoseCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "prognose-card", name: "WP-Prognose", description: "Stromprognose der Wärmepumpe für 14 Tage aus der Wettervorhersage" });
