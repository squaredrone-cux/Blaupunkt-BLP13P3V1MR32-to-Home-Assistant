# Erfahrungen aus dem ersten Betrieb

Eine 13-kW-Anlage in einem Einfamilienhaus mit Heizkörpern (Auslegung 55/45 °C), 200-l-Trennpuffer und separater Heizkreispumpe. Die Zahlen sollen eine Größenordnung geben; jedes Haus ist anders.

## Was am meisten gebracht hat

| Maßnahme | Wirkung |
| --- | --- |
| **P08 von 7 auf 0** | Die WP-Fühler zeigten 5–6 K mehr als Anlegefühler am Rohr, die WP schaltete zu früh ab. Danach passten die Werte bis auf etwa 2 K im Rücklauf. |
| **Hydraulischer Abgleich** (voreinstellbare Ventile) | gleichmäßig warme Räume bei niedrigerem Vorlauf |
| **Heizkreispumpe eine Stufe höher** (Konstantdruck CP2 → CP3, ca. 6 → 14 W) | Die Spreizung im Heizkreis sank von 17 K auf 5–6 K, die Heizkörper wurden gleichmäßig warm. |
| **Heizstab erst unter −10 °C** (P26, vorher 17 °C) | kein Direktheizen bei mildem Wetter |
| **DC-Pumpe in Automatik** (F10 = 5 K, F8 = 40 %) | Die Pumpe läuft fast immer auf 40 %. Manuell mit 70–80 % brachte nichts außer Stromverbrauch. |
| **Nachtabsenkung über die Heizkurve** statt Abschalten | kein Aufheizen mit voller Leistung am Morgen |
| **Thermostate auf Raumsensor kalibrieren** | Thermostate am Heizkörper messen zu warm und schließen zu früh |

## Kennzahlen zur Orientierung

| Kennwert | Wert |
| --- | --- |
| kWh je Heizgradtag (Oktober, nach den Optimierungen) | 2,1–2,5, im Wochenmittel etwa 2,3 |
| Spreizung WP bei 40 % Pumpendrehzahl | etwa 4,7 K |
| geschätzter COP bei 10–15 °C außen | etwa 4,2 (Carnot × 0,5) |

Ohne Wärmemengenzähler ist der COP nur geschätzt. Wer es genau wissen will, baut einen Wärmemengenzähler in den WP-Kreis ein.

## Stolperfallen

- **Modbus-Typ**: Steht das Gateway auf „Modbus TCP to RTU“, braucht HA `type: tcp`. Im transparenten Modus ist es `rtuovertcp`. Falsch gewählt, kommen keine oder unsinnige Werte.
- **Vorzeichen**: Negative Werte (Außentemperatur, P08, P11, P26) als `int16` lesen und beim Schreiben mit `% 65536` umrechnen.
- **Neustart**: Nach jeder Änderung an der Modbus-Konfiguration muss HA neu gestartet werden.
- **Außenfühler**: springt beim Abtauen. Für Automationen immer die gefilterte Außentemperatur nehmen.
- **Rücklauf-Versatz**: Ein Anlegefühler am Puffer zeigte dauerhaft etwa 2 K mehr als der WP-Fühler. Ob das ein Messfehler oder echter Verlust ist, lässt sich ohne Referenz nicht sagen; dafür gibt es den Korrektur-Helfer.
- **Zigbee**: ZHA und Zigbee2MQTT nicht gleichzeitig mit denselben Geräten betreiben. Die Geräte melden dann falsche Werte und müssen neu angelernt werden.
- **Raumsensoren unter der Decke** messen deutlich falsch (bis 3 K zu kalt). Montage auf Sitzhöhe an einer Innenwand.
