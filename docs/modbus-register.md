# Modbus-Register PW58322

Alle Register sind **Holding-Register**: lesen mit Funktion 03H, schreiben mit 06H. In Home Assistant werden die Adressen dezimal angegeben (0x8002 = 32770). Zwischen zwei Anfragen müssen mehr als 200 ms liegen (`message_wait_milliseconds: 250`).

## Messwerte (nur lesen)

Temperaturen sind vorzeichenbehaftet (`int16`). Die Skalierung ist **nicht einheitlich**: Rücklauf 0,1 °C pro Bit, alle anderen 0,5 °C.

| Adresse | dez. | Wert | Skalierung |
| --- | --- | --- | --- |
| 0x800E | 32782 | Rücklauf (WP-Fühler) | 0,1 |
| 0x800F | 32783 | Warmwasser- bzw. Pufferfühler der WP | 0,5 |
| 0x8011 | 32785 | Außentemperatur | 0,5 |
| 0x8012 | 32786 | Vorlauf (WP-Fühler) | 0,5 |
| 0x8015 | 32789 | Sauggas | 0,5 |
| 0x8016 | 32790 | Verdampfer | 0,5 |
| 0x801A | 32794 | Kühlspule | 0,5 |
| 0x801B | 32795 | Heißgas | 0,5 |
| 0x801C / 0x801D | 32796 / 32797 | Öffnung Haupt- / Hilfsexpansionsventil | Schritte |
| 0x801E | 32798 | Verdichterfrequenz | Hz |
| 0x801F / 0x8020 | 32799 / 32800 | Inverter-Fehler Low / High | Bitfeld |
| 0x8021 | 32801 | DC-Bus-Spannung | V |
| 0x8024 | 32804 | Verdichter-Zielfrequenz | Hz |
| 0x8025 | 32805 | Verdichterstrom | A |
| 0x8026 | 32806 | Lüfterdrehzahl | U/min |
| 0x8028 | 32808 | Niederdruck als Umrechnungstemperatur | °C |
| 0x802A | 32810 | Drehzahl der DC-Umwälzpumpe | % |

## Status- und Fehlerbits

| Adresse | Register | Bits |
| --- | --- | --- |
| 0x8003 | Modus-Freigaben | Bit 7 (128) = Abtauung aktiv |
| 0x8004 | Ausgänge 1 | Bit 0 (1) = Verdichter, Bit 5 (32) = Lüfter, Bit 6 (64) = 4-Wege-Ventil |
| 0x8005 | Ausgänge 2 | Bit 5 (32) = Heizstab Puffer, Bit 7 (128) = Heizstab Warmwasser |
| 0x8006 | Ausgänge 3 | Bit 0 (1) = Umwälzpumpe |
| 0x8007–0x800D | Fehler 1–7 | jedes gesetzte Bit = ein Fehlercode laut Protokoll |

## Steuerregister (lesen und schreiben)

Die Steuerflags sind Bitfelder. Das Paket liest das Register, setzt oder löscht ein Bit und schreibt das ganze Wort zurück.

| Adresse | dez. | Funktion | Werte |
| --- | --- | --- | --- |
| 0x0000 | 0 | Steuerflags 1 | Bit 0 = Ein/Aus |
| 0x0001 | 1 | Steuerflags 2 | Bit 4 (16) = Powerful, Bit 5 (32) = Silent/ECO, Bit 6 (64) = P22 Heizkurve automatisch |
| 0x0002 | 2 | Steuerflags 3 | Bit 1 (2) = Urlaubsmodus |
| 0x0004 | 4 | Betriebsmodus | 0 Warmwasser, 1 Heizen, 2 Kühlen, 3 WW + Heizen, 4 WW + Kühlen |
| 0x008F | 143 | Soll Warmwasser | °C |
| 0x0090 | 144 | Soll Kühlen | °C |
| 0x0091 | 145 | Soll Heizen | °C |
| 0x0092 | 146 | P08 Wassertemperatur-Kompensation | −5 bis 15, `int16` |
| 0x00F2 | 242 | Urlaub-Solltemperatur | °C |

Silent und Powerful schließen sich aus: Wer eines setzt, löscht das andere.

## Parameter P01–P27

| Parameter | Adresse | dez. | Bereich | Werkswert |
| --- | --- | --- | --- | --- |
| P01 Neustart-Differenz Heizen/Kühlen | 0x008D | 141 | 2–18 K | 2 K |
| P02 Neustart-Differenz Warmwasser | 0x008E | 142 | 2–18 K | 5 K |
| P09 Abtaufrequenz | 0x0005 | 5 | 30–120 Hz | 60 Hz |
| P10 Abtauzyklus (Mindestabstand) | 0x0006 | 6 | 20–90 min | 45 min |
| P11 Abtau-Start Spulentemperatur | 0x0093 | 147 | −15 bis −1 °C | −3 °C |
| P12 Abtauzeit | 0x0007 | 7 | 5–20 min | 10 min |
| P13 Abtau-Ende Spulentemperatur | 0x0094 | 148 | 1–40 °C | 20 °C |
| P14 / P15 Abtau-Differenz 1 / 2 | 0x0095 / 0x0096 | 149 / 150 | 0–15 K | 5 / 5 K |
| P16 Abtau-Umgebungstemperatur | 0x0097 | 151 | 0–20 °C | 17 °C |
| P17 Desinfektion Zyklus | 0x00E6 | 230 | 0–30 Tage (0 = aus) | 7 |
| P18 Desinfektion Startzeit | 0x00E7 | 231 | 0–23 h | 23 |
| P19 Desinfektion Haltezeit | 0x00E8 | 232 | 0–90 min | 30 min |
| P20 / P21 Desinfektion Soll / WP-Soll | 0x00E9 / 0x00EA | 233 / 234 | 0–90 / 40–60 °C | 70 / 53 °C |
| P23 Heizkurve Außentemperatur | 0x00EB | 235 | 0–40 °C | 20 |
| P24 Heizkurve Faktor | 0x00EC | 236 | 1–30 (1 = 0,1) | 1 |
| P26 Heizstab ab Außentemperatur | 0x00ED | 237 | −20 bis 20 °C, `int16` | 0 °C |
| P27 Heizstab-Verzögerung | 0x00FE | 254 | 0–60 min | 30 min |

Werkswerte laut deutscher Bedienungsanleitung (Liste der Systemparameter). Die Anleitung rät davon ab, sie zu ändern. Für P08 nennt sie keinen Wert; ab Werk stand er beim Autor auf 7 (siehe README). Beim Autor waren P09 (90 Hz) und P10 (84 min) verstellt; zurück auf Werkswert sind sie für feuchtes Küstenklima die sicherere Wahl.

Mit P22 an rechnet die WP selbst: **Soll-Vorlauf = 20 + P24/10 × (P23 − Außen)**. Beispiel: P23 = 25 und P24 = 10 ergeben 45 °C bei 0 °C außen und 55 °C bei −10 °C.

## Umwälzpumpe F2–F10

Im PDF steht die Adresse jeweils **in der Zeile unter** dem Parameternamen. Wer die Zeilen verrutscht, landet bei F4–F10 schnell ein Register daneben.

| Parameter | Adresse | dez. | Bedeutung |
| --- | --- | --- | --- |
| F2 Pumpe Betriebsart | 0x0101 | 257 | Dauerlauf / Takten |
| F3 Pumpe Taktzeit | 0x0102 | 258 | min |
| F4 DC-Pumpe Modus | 0x0105 | 261 | 0 aus, 1 Automatik, 2 manuell |
| F5 Regelzyklus | 0x0106 | 262 | s |
| F6 Handdrehzahl | 0x0107 | 263 | % (nur bei F4 = 2) |
| F7 Drehzahl max. | 0x0108 | 264 | % |
| F8 Drehzahl min. | 0x0109 | 265 | % |
| F9 Regelschritt | 0x010A | 266 | % |
| F10 Soll-Spreizung | 0x010B | 267 | K |

## Weitere Register (im Paket nicht genutzt)

| Adresse | Inhalt |
| --- | --- |
| 0x0100 | F1 |
| 0x00C4 / 0x00C5 | R12 / R13 |
| 0x00EE / 0x00EF | R29 / R30 (Silent-Höchstfrequenz, max. 70 Hz) |
| 0x00F3 | D08 |
| 0x00D0–0x00E4 | Zeitprogramme der WP |
| 0x00F5–0x00FD | Silent-Zeitprogramm |
| 0x8002 | Gesamtstatus |

## Pufferfühler über Wellpro WP3082ADAM (optional)

Vier DS18B20 an einem Wellpro-Modul, eigenes Gateway, Hub `puffer`, Slave 1. Gelesen werden die Register 0–3 als `uint16`.

- Umrechnung: Rohwert ÷ 10 = °C.
- Rohwerte über 10.000 sind negativ: −(Roh − 10.000) ÷ 10.
- 65535 bedeutet, dass kein Fühler angeschlossen ist.

| Register | Fühler |
| --- | --- |
| 0 | Puffer WP-Vorlauf (Eingang von der WP) |
| 1 | Puffer WP-Rücklauf (Ausgang zur WP) |
| 2 | Heizkreis-Rücklauf |
| 3 | Heizkreis-Vorlauf |
