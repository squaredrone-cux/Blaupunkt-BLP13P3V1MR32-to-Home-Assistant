# Andere Modbus-Protokolle

Viele Luft/Wasser-Wärmepumpen mit derselben Steuerung tragen andere Markennamen, aber eines der folgenden Modbus-Protokolle. Welches deine WP spricht, steht im Protokoll-PDF vom Händler oder auf dem Aufkleber der Steuerplatine.

Für jedes Protokoll gibt es im Ordner `protokolle/` ein eigenes Modbus-Paket. Es **ersetzt** `packages/waermepumpe_modbus.yaml`. Verwende immer nur eine der beiden Dateien, sonst gibt es den Hub `waermepumpe` doppelt.

| Protokoll | Datei | Bus | Status |
| --- | --- | --- | --- |
| **PW58322** (Kaskade) | `packages/waermepumpe_modbus.yaml` | 9600 8N1, Adresse per DIP 1–16 | an einer Anlage getestet |
| **PW58321** (Easylife, ohne Kaskade) | `protokolle/pw58321.yaml` | 9600 8N1, feste Adresse 1 | Registerliste laut PDF identisch mit PW58322 |
| **PW58332-2** (CC1010B, 2023) | `protokolle/pw58332_2.yaml` | 9600 8N1, Adresse per DIP 1–16 | wie PW58322 plus SG-Ready/EVU, Heizstab-Freigabe, manuelles Abtauen; Zusätze ungetestet |
| **PW58329** (CC1010B) | `protokolle/pw58329_cc1010b.yaml` | 9600 8N1, Adresse per DIP 1–8 | eigene Registerkarte, ungetestet |
| **CG248075** (V1.2) | `protokolle/cg248075.yaml` | **19200 8N2**, Adresse per DIP 1–8 | eigene Registerkarte, ungetestet |

„Ungetestet“ heißt: aus dem PDF erzeugt und von Home Assistant als gültige Konfiguration akzeptiert, aber noch an keiner echten Wärmepumpe ausprobiert. Wer eine dieser Anlagen hat, bitte als Issue melden, ob die Werte stimmen.

## So gehst du vor

1. Datei aus `protokolle/` in deinen Ordner `packages/` kopieren und `waermepumpe_modbus.yaml` dort **weglassen**.
2. Gateway passend einstellen. Für CG248075 heißt das 19200 Baud und **2 Stoppbits**.
3. Neu starten und zuerst **nur lesen**: Stimmen Vorlauf, Rücklauf, Außentemperatur und Frequenz mit dem Display überein?
4. Erst dann einen harmlosen Wert schreiben, zum Beispiel die Urlaubs-Solltemperatur, und am Display prüfen.

Die Entitäten heißen in allen Paketen gleich (`sensor.wp_vorlauf_temperatur`, `switch.wp_power`, `select.wp_dc_pumpe_modus` …). Auswertung, Prognose und Dashboard funktionieren deshalb weiter. Was ein Protokoll nicht kann, bleibt im Dashboard „nicht verfügbar“.

## Die wichtigsten Unterschiede

| | PW58322 / PW58321 / PW58332-2 | PW58329 | CG248075 |
| --- | --- | --- | --- |
| Messwerte | ab 0x8000 | ab 0x0000 | ab 0x0000 |
| Ein/Aus | 0x0000 Bit 0 | 0x003F Bit 0 | 0x0032 Bit 0 |
| Silent / Powerful | 0x0001 Bit 5 / 4 | 0x0040 Bit 5 / 4 | – (Verdichtermodus Normal/ECO/Nacht in 0x0190) |
| Betriebsmodus | 0x0004 | 0x0043 | 0x0036 |
| Soll Heizen | 0x0091 | 0x00C0 | 0x00CC (°C × 2, unteres Byte) |
| P08 Wassertemp.-Kompensation | 0x0092 | 0x00E9 | – |
| Heizkurve | P22 + P23/P24 (0x00EB/0x00EC) | P22 + P23/P24 (0x00CE/0x0148) | 4-Punkte-Kurve E01–E04 / E13–E16 |
| DC-Pumpe Modus | F4 0x0105: 1 Auto, 2 manuell | 0x015F (Werte im PDF nicht angegeben) | F13 0x0186: 0 manuell, 1 Auto |
| Rücklauf / Vorlauf | 0,1 / 0,5 °C | 0,1 / 0,5 °C | 0,1 / 0,1 °C |

Bei **CG248075** passen die Automationen „WP Heizkurve Stufe übernehmen“ und „WP Modus automatisch (ECO/Smart)“ nicht, weil es P23 und Silent/Powerful dort nicht gibt. Diese beiden Automationen ausgeschaltet lassen.

## Nicht unterstützt

`MODBUS_RTU V1.04` (三相储能通信规约) ist kein Wärmepumpen-Protokoll. Es beschreibt einen dreiphasigen Hybrid-Wechselrichter mit Speicher (Deye-Familie). Dafür gibt es eigene Home-Assistant-Integrationen, zum Beispiel „Solarman“ oder „Deye Modbus“.
