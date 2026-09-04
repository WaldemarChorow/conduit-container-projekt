# Multi-Stage Builds (Docker) — Nachschlagenotiz

## Warum überhaupt?

Manche Pakete brauchen beim **Installieren** Werkzeuge, die zur **Laufzeit**
gar nicht mehr gebraucht werden. Beispiel: `psycopg2` (Postgres-Treiber für
Python) braucht beim `pip install` oft einen C-Compiler (`gcc`) und
Postgres-Header-Dateien. Läuft die App später, braucht sie diese Build-Tools
nicht mehr.

Ohne Multi-Stage landen diese Build-Tools trotzdem im finalen Image →
unnötig groß + unnötig viel Angriffsfläche (Security-Prinzip: je weniger
Software im laufenden Container installiert ist, desto weniger potenzielle
Schwachstellen).

**Die Idee:** Ein Dockerfile mit **mehreren `FROM`-Anweisungen**. Jede
`FROM`-Zeile startet ein komplett frisches, unabhängiges Image ("Stage").
Man baut in einer frühen Stage alles zusammen, was zum *Bauen* nötig ist,
und kopiert am Ende nur die *fertigen Ergebnisse* in eine schlanke,
finale Stage.

## Grundgerüst

```dockerfile
# Stage 1: "builder" — hat alles zum Bauen (Compiler, alle Dependencies, ...)
FROM python:3.6-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

# Stage 2: finales Image — schlank, nur das Nötigste zum Ausführen
FROM python:3.6-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.6/site-packages /usr/local/lib/python3.6/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY . .
EXPOSE 8000
ENTRYPOINT ["gunicorn", "conduit.wsgi:application", "--bind", "0.0.0.0:8000"]
```

## Kernbegriffe

- **`AS builder`** — vergibt der ersten Stage einen Namen, damit man später
  darauf verweisen kann. Der Name ist frei wählbar (`AS builder` ist nur
  Konvention).
- **`COPY --from=builder <Quellpfad> <Zielpfad>`** — das Bindeglied zwischen
  den Stages. Kopiert *gezielt* einzelne Dateien/Ordner aus einer früheren
  Stage in die aktuelle — nicht das ganze Image.
- Jede Stage ist bei `FROM` komplett "bei null" — nichts wird automatisch
  übernommen. Auch Befehle wie `WORKDIR` müssen in jeder Stage, die sie
  braucht, erneut gesetzt werden.
- Nur die **letzte** Stage im Dockerfile landet am Ende im fertigen Image
  (die `builder`-Stage existiert nur temporär während des Build-Vorgangs).

## Warum genau dieser Pfad kopiert wird

`pip install` legt Pakete in offiziellen Python-Docker-Images typischerweise
unter `/usr/local/lib/python<VERSION>/site-packages/` ab (nicht
`~/.local/...` — das wäre nur bei `pip install --user` außerhalb eines
Containers der Fall). Selbst nachprüfen statt zu vermuten:

```bash
docker run --rm -it -v "$PWD":/app -w /app python:3.6-slim bash
pip install -r requirements.txt
find / -iname "django" -maxdepth 6 -type d 2>/dev/null
```

`/usr/local/bin` wird zusätzlich kopiert, weil manche Pakete (z.B.
`gunicorn`) dort ein ausführbares CLI-Kommando ablegen.

## Verwandtes Konzept: Layer-Caching (warum COPY-Reihenfolge wichtig ist)

Jede Zeile im Dockerfile erzeugt einen eigenen "Layer" (Dateisystem-
Schnappschuss). Beim erneuten Bauen prüft Docker Zeile für Zeile: hat sich
diese Zeile (bzw. ihr Input) seit dem letzten Build geändert? Falls nein →
Layer wird aus dem Cache wiederverwendet (schnell). Falls ja → ab dieser
Zeile wird **alles neu ausgeführt**, auch alle folgenden Zeilen.

**Falsch (Cache wird unnötig oft invalidiert):**
```dockerfile
COPY . .
RUN pip install -r requirements.txt
```
Jede Änderung an *irgendeiner* Datei im Projekt (auch nur `.py`-Code) macht
den `COPY . .`-Layer neu → `pip install` läuft danach zwangsläufig auch neu,
selbst wenn sich an den Dependencies gar nichts geändert hat.

**Richtig (Dependencies und Code getrennt kopieren):**
```dockerfile
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
```
`pip install` hängt jetzt nur vom `requirements.txt`-Layer ab. Ändert sich
nur der Anwendungscode, bleibt der teure `pip install`-Schritt im Cache
und der Build ist deutlich schneller.

**Merksatz:** Was sich selten ändert (Dependencies), zuerst kopieren. Was
sich oft ändert (eigener Code), zuletzt kopieren.

## Bezug zum Conduit-Projekt

- Stage 1 (`builder`): `python:3.6-slim`, installiert `requirements.txt`
  (inkl. `psycopg2`/`psycopg2-binary` für Postgres).
- Stage 2 (final): frisches `python:3.6-slim`, übernimmt nur die
  installierten Pakete + Anwendungscode, setzt ENV/EXPOSE, startet über ein
  eigenes Entrypoint-Skript `migrate` gefolgt von `gunicorn`
  (kein `runserver`, siehe DA-Checkliste: "ENTRYPOINT startet WSGI-App,
  keinen dev-server").

Python-Version `3.6-slim` ist bewusst gewählt, weil Django 1.10 (2016) mit
modernem Python (getestet: 3.14) an `django.utils.six.moves` scheitert
(`ModuleNotFoundError`) — im Container mit `python:3.6-slim` lief
`python manage.py check` dagegen fehlerfrei.
