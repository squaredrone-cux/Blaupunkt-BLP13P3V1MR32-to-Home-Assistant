// Puffer-Speicher-Karte: animierte Darstellung von Wärmepumpe, Pufferspeicher und Heizkreis
class PufferSpeicherCard extends HTMLElement {
  setConfig(config) {
    const e = config.entities || {};
    if (!e.oben || !e.unten) throw new Error("entities.oben und entities.unten sind erforderlich");
    this._config = config;
    this._key = null;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    if (this._hass) this.hass = this._hass;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config || !hass) return;
    const e = this._config.entities;
    const ids = Object.values(e);
    const key = ids.map((id) => (hass.states[id] ? hass.states[id].state : "")).join("|");
    if (key === this._key) return;
    this._key = key;
    try {
      this._render();
    } catch (err) {
      this._inhalt = null;
      this.shadowRoot.innerHTML = `<ha-card style="padding:16px">Puffer-Karte Fehler: ${err && err.message}</ha-card>`;
    }
  }

  _num(id) {
    const s = id && this._hass.states[id];
    if (!s) return null;
    const v = parseFloat(s.state);
    return isNaN(v) ? null : v;
  }

  _on(id) {
    const s = id && this._hass.states[id];
    return !!s && s.state === "on";
  }

  // Farbe der Puffermitte: je nachdem, ob sie eher oben (rot) oder unten (blau) liegt
  _mix(t, lo, hi) {
    if (t === null || lo === null || hi === null || hi - lo < 0.5) return "rgb(130,97,141)";
    const f = Math.min(1, Math.max(0, (t - lo) / (hi - lo)));
    const kalt = [30, 136, 229], warm = [229, 57, 53];
    return `rgb(${kalt.map((v, k) => Math.round(v + (warm[k] - v) * f)).join(",")})`;
  }

  _fmt(t) {
    return t === null ? "–" : `${t.toFixed(1).replace(".", ",")} °C`;
  }

  // Pumpensymbol: schwarzer Außenring, Füllung wie die Vorlaufleitung, Turbinenrad wie die Flussanimation (dreht, wenn die Pumpe läuft)
  _pumpe(x, y, an) {
    const schaufeln = [0, 60, 120, 180, 240, 300]
      .map((w) => `<path class="schaufel" transform="rotate(${w})" d="M0,-2.4 C3.2,-3.6 4.6,-6.4 3,-8.8 C1.6,-6.8 0.6,-5 -1.2,-2.1 Z"/>`)
      .join("");
    return `
      <g class="pumpe ${an ? "an" : ""}">
        <circle cx="${x}" cy="${y}" r="8.5" class="pumpe-koerper"/>
        <g transform="translate(${x} ${y}) scale(0.75)">
          <g class="laufrad ${an ? "dreht" : ""}">
            ${schaufeln}
            <circle r="2.6" class="nabe"/>
          </g>
        </g>
      </g>`;
  }

  _render() {
    const e = this._config.entities;
    const oben = this._num(e.oben);
    const mitte = this._num(e.mitte);
    const unten = this._num(e.unten);
    const wpVl = this._num(e.wp_vorlauf);
    const wpRl = this._num(e.wp_ruecklauf);
    const hkVl = this._num(e.hk_vorlauf);
    const hkRl = this._num(e.hk_ruecklauf);
    const wpPumpe = this._on(e.wp_pumpe);
    const hkPumpe = this._on(e.hk_pumpe);
    const verdichter = this._on(e.verdichter);
    const spreizWp = wpVl !== null && wpRl !== null ? (wpVl - wpRl).toFixed(1).replace(".", ",") : "–";
    const spreizHk = hkVl !== null && hkRl !== null ? (hkVl - hkRl).toFixed(1).replace(".", ",") : "–";
    const titel = this._config.title || "Pufferspeicher";

    if (!this._inhalt) {
      this.shadowRoot.innerHTML = `
      <style>
        /* Hintergrund, Rahmen und Schatten kommen vom aktiven Theme (z. B. Liquid Glass); --puffer-karte-hintergrund überschreibt bei Bedarf */
        ha-card { padding: 12px 12px 8px; background: var(--puffer-karte-hintergrund, var(--ha-card-background, var(--card-background-color))); }
        .kopf { display:flex; justify-content:space-between; align-items:center; padding: 0 4px 4px; }
        .titel { font-size: 16px; font-weight: 500; color: var(--primary-text-color); }
        .status { font-size: 12px; color: var(--secondary-text-color); display:flex; gap:12px; }
        .status span.an { color: var(--primary-text-color); }
        .punkt { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:4px; background:#6b6b75; }
        .an .punkt { background:#43a047; box-shadow:0 0 6px #43a047; }
        svg { width:100%; height:auto; display:block; }
        text { font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif); fill: var(--primary-text-color); }
        .klein { font-size: 10px; fill: var(--secondary-text-color); }
        .wert { font-size: 12px; font-weight: 600; }
        .tankwert { font-size: 13px; font-weight: 700; fill: #fff; paint-order: stroke; stroke: rgba(0,0,0,0.45); stroke-width: 3px; }
        .rohr { fill:none; stroke-width:7; stroke-linecap:round; stroke-linejoin:round; opacity:0.35; }
        .fluss { fill:none; stroke-width:3; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray: 6 10; }
        .laeuft { animation: fliessen 1.1s linear infinite; }
        @keyframes fliessen { to { stroke-dashoffset: -32; } }
        .luefter { transform-origin: 45px 118px; }
        .dreht { animation: drehen 1.4s linear infinite; }
        @keyframes drehen { to { transform: rotate(360deg); } }
        .welle { animation: welle 4s ease-in-out infinite; }
        @keyframes welle { 0%,100% { opacity: 0.10; } 50% { opacity: 0.22; } }
        .pumpe-koerper { fill: rgb(119,59,62); stroke: #000; stroke-width: 2; }
        .laufrad { transform-box: fill-box; transform-origin: center; }
        .laufrad.dreht { animation-duration: 1s; }
        .schaufel { fill: rgb(229,57,53); }
        .nabe { fill: #000; }
      </style>
      <ha-card><div id="inhalt"></div></ha-card>`;
      this._inhalt = this.shadowRoot.getElementById("inhalt");
    }
    this._inhalt.innerHTML = `
        <div class="kopf">
          <div class="titel">${titel}</div>
          <div class="status">
            <span class="${verdichter ? "an" : ""}"><i class="punkt"></i>Verdichter</span>
            <span class="${wpPumpe ? "an" : ""}"><i class="punkt"></i>WP-Pumpe</span>
            <span class="${hkPumpe ? "an" : ""}"><i class="punkt"></i>Heizkreispumpe</span>
          </div>
        </div>
        <svg viewBox="0 0 400 250" role="img" aria-label="Pufferspeicher">
          <defs>
            <linearGradient id="tank" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stop-color="rgb(229,57,53)"/>
              <stop offset="50%" stop-color="${this._mix(mitte, unten, oben)}"/>
              <stop offset="95%" stop-color="rgb(30,136,229)"/>
            </linearGradient>
            <linearGradient id="hk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="10%" stop-color="rgb(229,57,53)"/>
              <stop offset="90%" stop-color="rgb(30,136,229)"/>
            </linearGradient>
            <linearGradient id="glanz" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
              <stop offset="30%" stop-color="#fff" stop-opacity="0.25"/>
              <stop offset="60%" stop-color="#fff" stop-opacity="0"/>
            </linearGradient>
          </defs>

          <!-- Wärmepumpe -->
          <rect x="8" y="72" width="76" height="96" rx="10" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.25)"/>
          <circle cx="45" cy="118" r="24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
          <g class="luefter ${verdichter ? "dreht" : ""}">
            <path d="M45 118 L45 98 A8 8 0 0 1 53 108 Z" fill="rgba(255,255,255,0.55)"/>
            <path d="M45 118 L62 128 A8 8 0 0 1 50 132 Z" fill="rgba(255,255,255,0.55)"/>
            <path d="M45 118 L28 128 A8 8 0 0 1 32 114 Z" fill="rgba(255,255,255,0.55)"/>
          </g>
          <circle cx="45" cy="118" r="3" fill="rgba(255,255,255,0.8)"/>
          <text x="46" y="186" text-anchor="middle" class="klein">Wärmepumpe</text>
          <text x="46" y="200" text-anchor="middle" class="klein">Δ ${spreizWp} K</text>

          <!-- Leitungen Wärmepumpe ↔ Puffer -->
          <path class="rohr" stroke="rgb(229,57,53)" d="M84 90 H118 V62 H152"/>
          <path class="fluss ${wpPumpe ? "laeuft" : ""}" stroke="rgb(229,57,53)" d="M84 90 H118 V62 H152" style="opacity:${wpPumpe ? 1 : 0.25}"/>
          <text x="118" y="54" text-anchor="middle" class="wert">${this._fmt(wpVl)}</text>
          <path class="rohr" stroke="rgb(30,136,229)" d="M152 196 H118 V150 H84"/>
          <path class="fluss ${wpPumpe ? "laeuft" : ""}" stroke="rgb(30,136,229)" d="M152 196 H118 V150 H84" style="opacity:${wpPumpe ? 1 : 0.25}"/>
          <text x="118" y="214" text-anchor="middle" class="wert">${this._fmt(wpRl)}</text>
          ${this._pumpe(118, 76, wpPumpe)}

          <!-- Pufferspeicher -->
          <rect x="152" y="22" width="96" height="208" rx="44" fill="url(#tank)" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
          <rect class="welle" x="152" y="22" width="96" height="208" rx="44" fill="url(#glanz)"/>
          <text x="200" y="66" text-anchor="middle" class="tankwert">${this._fmt(oben)}</text>
          <text x="200" y="131" text-anchor="middle" class="tankwert">${this._fmt(mitte)}</text>
          <text x="200" y="196" text-anchor="middle" class="tankwert">${this._fmt(unten)}</text>
          <text x="200" y="246" text-anchor="middle" class="klein">Puffer</text>

          <!-- Leitungen Puffer ↔ Heizkörper -->
          <path class="rohr" stroke="rgb(229,57,53)" d="M248 62 H282 V90 H316"/>
          <path class="fluss ${hkPumpe ? "laeuft" : ""}" stroke="rgb(229,57,53)" d="M248 62 H282 V90 H316" style="opacity:${hkPumpe ? 1 : 0.25}"/>
          <text x="282" y="54" text-anchor="middle" class="wert">${this._fmt(hkVl)}</text>
          <path class="rohr" stroke="rgb(30,136,229)" d="M316 150 H282 V196 H248"/>
          <path class="fluss ${hkPumpe ? "laeuft" : ""}" stroke="rgb(30,136,229)" d="M316 150 H282 V196 H248" style="opacity:${hkPumpe ? 1 : 0.25}"/>
          <text x="282" y="214" text-anchor="middle" class="wert">${this._fmt(hkRl)}</text>
          ${this._pumpe(282, 76, hkPumpe)}

          <!-- Heizkörper -->
          <g>
            ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${318 + i * 12}" y="78" width="9" height="84" rx="4" fill="url(#hk)" opacity="${hkPumpe ? 0.85 : 0.45}"/>`).join("")}
            <rect x="316" y="84" width="76" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>
            <rect x="316" y="152" width="76" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>
          </g>
          <text x="354" y="186" text-anchor="middle" class="klein">Heizkörper</text>
          <text x="354" y="200" text-anchor="middle" class="klein">Δ ${spreizHk} K</text>
        </svg>
`;
  }

  static getStubConfig() {
    return { entities: { oben: "", unten: "" } };
  }

  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, rows: 6, min_columns: 6, min_rows: 4 };
  }
}

if (!customElements.get("puffer-speicher-card")) customElements.define("puffer-speicher-card", PufferSpeicherCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "puffer-speicher-card",
  name: "Puffer-Speicher",
  description: "Animierte Darstellung von Wärmepumpe, Pufferspeicher und Heizkreis",
});
