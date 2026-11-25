# Allocation para Mac

App de escritorio de asset allocation: diagnóstico de la cartera, riesgo y correlación con históricos de Yahoo Finance, y rebalanceo.

- `renderer/` — interfaz que la app descarga al abrir (`version.json` sube con cada cambio; `minShell` indica la versión mínima de la app instalada).
- `src/` — proceso principal de Electron (cambios acá requieren reinstalar la app).
- `build/` — piezas que generan `renderer/index.html`.

La cartera no está en este repositorio: queda guardada solo en la Mac (`~/Library/Application Support/Allocation/allocation.json`).
