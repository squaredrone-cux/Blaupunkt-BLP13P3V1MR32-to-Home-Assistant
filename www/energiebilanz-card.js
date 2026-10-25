// Energiebilanz-Karte: pro Tag / Monat ein waagerechter Balken (Gesamtverbrauch),
// unterteilt in Solar (selbst genutzt), Wärmepumpe und übriges Haus, mit Werten im Balken.
// Rechts: Gesamtverbrauch und Netzbezug. Unten: Summenzeile.
// Konfiguration:
//   type: custom:energiebilanz-card
//   mode: tage | monate        (Standard: tage)
//   title: optional
//   hinweis: optional, Text unter der Tabelle (z. B. Datenlücken)
class EnergiebilanzCard extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign({ mode: "tage" }, config || {});
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }
  getCardSize() { return this._config.mode === "monate" ? 6 : 14; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }

  set hass(hass) {
    this._hass = hass;
    const key = JSON.stringify(this._rows());
    if (key === this._last) return;
    this._last = key;
    this._render();
  }

  _num(id) {
    const s = this._hass && this._hass.states[id];
    const v = s ? parseFloat(s.state) : NaN;
    return isNaN(v) ? 0 : v;
  }

  _rows() {
    if (!this._hass) return [];
    const monate = this._config.mode === "monate";
    const src = this._hass.states[monate ? "sensor.energiebilanz_monate" : "sensor.energiebilanz_tage"];
    const liste = (src && src.attributes[monate ? "monate" : "tage"]) || [];
    const sfx = monate ? "monat" : "tag";
    const jetzt = new Date();
    const live = {
      k: monate ? `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, "0")}` : "heute",
      live: true,
      h: this._num(`sensor.haus_verbrauch_${sfx}`),
      p: this._num(`sensor.pv_ertrag_${sfx}`),
      n: this._num(`sensor.netzbezug_${sfx}`),
      e: this._num(`sensor.einspeisung_${sfx}`),
      w: this._num(monate ? "sensor.wp_energie_monat" : "sensor.wp_energie_tag"),
    };
    let alle = liste.map(r => ({
      k: monate ? r.m : r.d, h: r.h || 0, p: r.p || 0, n: r.n || 0, e: r.e || 0, w: r.w,
    }));
    if (!monate) alle = this._luecken(alle);
    const alt = alle.slice(monate ? -11 : -29).reverse();
    return [live, ...alt].map(r => this._verbrauch(r));
  }

  // Verbrauch aus Netz + PV − Einspeisung. Der Sungrow-Zähler „Gesamtverbrauch“ zählt das
  // Laden des Akkus mit, dadurch würde Solarstrom über den Akku doppelt gezählt.
  // Ohne PV-Wert (alte Einträge) bleibt der gemeldete Verbrauch stehen.
  _verbrauch(r) {
    if (!(r.p > 0) && !(r.n > 0)) return r;
    const h = Math.max(0, r.n + r.p - r.e);
    return Object.assign({}, r, { h: Math.round(h * 10) / 10 });
  }

  // Datenlücken: Fehlen Tage zwischen zwei Einträgen, enthält der Tag nach der Lücke
  // den Zuwachs aller fehlenden Tage. Er wird gleichmäßig auf die Lücke verteilt
  // und als geschätzt markiert (≈ am Datum).
  _luecken(liste) {
    const tag = 86400000;
    const ms = k => Date.parse(k + "T12:00:00Z");
    const iso = t => new Date(t).toISOString().slice(0, 10);
    const aus = [];
    liste.forEach((r, i) => {
      const vor = i > 0 ? liste[i - 1] : null;
      const n = vor ? Math.round((ms(r.k) - ms(vor.k)) / tag) : 1;
      if (n <= 1 || n > 31) { aus.push(r); return; }
      const teil = v => Math.round((v / n) * 10) / 10;
      for (let j = n - 1; j >= 0; j--) {
        aus.push({
          k: iso(ms(r.k) - j * tag), geschaetzt: true,
          h: teil(r.h), p: teil(r.p), n: teil(r.n), e: teil(r.e),
          w: r.w == null ? r.w : teil(r.w),
        });
      }
    });
    return aus;
  }

  _label(r) {
    const monate = this._config.mode === "monate";
    if (monate) {
      const mn = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
      const [y, m] = r.k.split("-");
      return `${mn[parseInt(m, 10) - 1]} ${y}${r.live ? " ●" : ""}`;
    }
    if (r.live) return "heute";
    const d = new Date(r.k + "T12:00:00");
    const wt = ["So","Mo","Di","Mi","Do","Fr","Sa"][d.getDay()];
    return `${wt} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${r.geschaetzt ? " ≈" : ""}`;
  }

  _split(r) {
    if (this._config.variante === "verbraucher") {
      const wp = r.w == null ? 0 : Math.max(0, Math.min(r.w, r.h));
      return { solar: 0, wp, rest: Math.max(0, r.h - wp) };
    }
    // Solar selbst genutzt = Verbrauch - Netzbezug (nie negativ, nie mehr als Verbrauch)
    const solar = Math.max(0, Math.min(r.h, r.h - r.n));
    const wp = r.w == null ? 0 : Math.max(0, Math.min(r.w, r.h - solar));
    const rest = Math.max(0, r.h - solar - wp);
    return { solar, wp, rest };
  }

  _fmt(v, dez) { return v.toLocaleString("de-DE", { minimumFractionDigits: dez, maximumFractionDigits: dez }); }

  _render() {
    const monate = this._config.mode === "monate";
    const dez = monate ? 0 : 1;
    const rows = this._rows();
    const vb = this._config.variante === "verbraucher";
    const max = Math.max(1, ...rows.map(r => Math.max(r.h, vb ? r.p : 0)));
    const sum = rows.reduce((a, r) => ({ h: a.h + r.h, n: a.n + r.n, p: a.p + r.p, w: a.w + (r.w || 0) }), { h: 0, n: 0, p: 0, w: 0 });
    const seg = (v, cls, total) => {
      if (v <= 0) return "";
      const pct = (v / total) * 100;
      return `<div class="seg ${cls}" style="width:${pct}%" title="${this._fmt(v, dez)} kWh">${pct >= 7 ? this._fmt(v, dez) : ""}</div>`;
    };
    const zeile = (r, total, extraCls) => {
      const s = this._split(r);
      const w = total ? (r.h / total) * 100 : 0;
      return `<div class="row ${extraCls || ""}">
        <div class="lbl">${extraCls === "sum" ? "Summe" : this._label(r)}</div>
        <div class="track"><div class="bar" style="width:${Math.max(w, 0.5)}%">${seg(s.solar, "solar", r.h)}${seg(s.wp, "wp", r.h)}${seg(s.rest, "rest", r.h)}</div>${this._config.variante === "verbraucher" ? `<div class="pv" style="width:${Math.min(100, Math.max(total ? (r.p / total) * 100 : 0, 0.3))}%">${r.p > 0 ? this._fmt(r.p, dez) : ""}</div>` : ""}</div>
        <div class="tot">${this._fmt(r.h, dez)}</div><div class="tot netz">${this._fmt(r.n, dez)}</div>
      </div>`;
    };
    const title = this._config.title || (monate ? "Pro Monat" : "Pro Tag (30 Tage)");
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 12px 14px 14px; }
        .head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; gap:8px; flex-wrap:wrap; }
        .title { font-size: 16px; font-weight: 500; color: var(--primary-text-color); }
        .legend { display:flex; gap:10px; flex-wrap:wrap; font-size:12px; color: var(--secondary-text-color); }
        .legend i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:4px; vertical-align:-1px; }
        .cols { display:grid; grid-template-columns: 74px 1fr 58px 58px; gap:6px; font-size:11px; color: var(--secondary-text-color); margin-bottom:2px; }
        .cols .r { text-align:right; }
        .row { display:grid; grid-template-columns: 74px 1fr 58px 58px; align-items:center; gap:6px; margin:3px 0; }
        .lbl { font-size:12.5px; color: var(--primary-text-color); white-space:nowrap; font-variant-numeric: tabular-nums; }
        .track { height:20px; }
        .vb .track { height:auto; }
        .vb .bar { height:20px; }
        .pv { height:11px; margin-top:2px; background:#f9c74f; border-radius:3px; font-size:9.5px; font-weight:600; color:#3a2d00; display:flex; align-items:center; padding-left:4px; white-space:nowrap; overflow:visible; font-variant-numeric: tabular-nums; }
        .bar { height:100%; display:flex; border-radius:4px; overflow:hidden; background: var(--divider-color); }
        .seg { height:100%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600;
               white-space:nowrap; overflow:hidden; font-variant-numeric: tabular-nums; }
        .solar { background:#f9c74f; color:#3a2d00; }
        .wp    { background:#3a86ff; color:#fff; }
        .rest  { background:#8d99ae; color:#fff; }
        .tot { text-align:right; font-size:12.5px; font-variant-numeric: tabular-nums; color: var(--primary-text-color); line-height:1.15; }
        .tot.netz { color:#e5383b; }
        .row.sum .tot { font-weight:700; }
        .row.live .lbl { font-weight:600; }
        .row.geschaetzt .lbl { font-style:italic; color: var(--secondary-text-color); }
        .row.geschaetzt .bar { opacity:.7; }
        .row.sum { margin-top:8px; padding-top:8px; border-top:1px solid var(--divider-color); }
        .row.sum .lbl { font-weight:700; }
        .note { margin-top:8px; font-size:11px; color: var(--secondary-text-color); }
      </style>
      <ha-card class="${this._config.variante === "verbraucher" ? "vb" : ""}">
        <div class="head"><div class="title">${title}</div>
          <div class="legend"><span><i style="background:#f9c74f"></i>${this._config.variante === "verbraucher" ? "Solar-Ertrag (dünner Balken)" : "Solar"}</span><span><i style="background:#3a86ff"></i>Wärmepumpe</span><span><i style="background:#8d99ae"></i>übriges Haus</span></div>
        </div>
        <div class="cols"><div>${monate ? "Monat" : "Tag"}</div><div>Verbrauch gesamt (kWh)</div><div class="r">Gesamt</div><div class="r" style="color:#e5383b">Netz</div></div>
        ${rows.map((r, i) => zeile(r, max, i === 0 ? "live" : (r.geschaetzt ? "geschaetzt" : ""))).join("")}
        ${zeile({ h: sum.h, n: sum.n, p: sum.p, w: sum.w }, Math.max(sum.h, vb ? sum.p : 0), "sum")}
        <div class="note">${this._config.variante === "verbraucher" ? "Oberer Balken = Verbrauch (Wärmepumpe + übriges Haus), unterer gelber Balken = Solar-Ertrag gesamt." : "Verbrauch = Netzbezug + PV-Ertrag − Einspeisung (Akku nur Zwischenspeicher). Solar = selbst genutzter Solarstrom."} ${rows.some(r => r.geschaetzt) ? "≈ = Datenlücke, Zuwachs gleichmäßig auf die fehlenden Tage verteilt (geschätzt)." : ""} ${this._config.hinweis ? this._config.hinweis : ""}</div>
      </ha-card>`;
  }
}
customElements.define("energiebilanz-card", EnergiebilanzCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "energiebilanz-card", name: "Energiebilanz", description: "Verbrauch pro Tag/Monat als geteilter Balken" });
