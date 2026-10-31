# Raíz · Tu cartera, con perspectiva

Aplicación web instalable para registrar una cartera de fondos indexados. Guarda los registros y realiza todos los cálculos en el dispositivo. No usa ChatGPT, modelos de IA, cuentas, claves API ni un servidor de datos de cartera.

## Usar en iPhone

Abre la web en Safari, pulsa Compartir → Añadir a pantalla de inicio y activa Abrir como app web si aparece. Abre el icono instalado e importa una copia JSON de Raíz o añade tus primeras aportaciones y la valoración total de la cartera.

Cada dispositivo empieza vacío. La cartera de ejemplo es ficticia y no modifica los registros guardados. Compartir la dirección de la aplicación no comparte la cartera. Exportar una copia sí genera un archivo con sus registros: guárdalo de forma privada. El almacenamiento del navegador puede borrarse; exporta copias periódicas. No hay sincronización entre dispositivos.

## Funciones y cálculos

- Aportaciones fechadas con notas e historial editable.
- Una única valoración manual del valor total de la cartera al cierre del día; cada actualización sustituye a la anterior.
- Ganancia: valoración menos aportaciones hasta esa fecha, inclusive.
- Rentabilidad total: ganancia / aportaciones. No considera el tiempo invertido de cada importe.
- Anualizada: TIR.NO.PER/XIRR, ponderada por dinero y fechas, días reales / 365. Sin datos suficientes o solución válida se muestra «—».
- Simulación: tasa anual efectiva, días reales / 365,2425 y aportaciones mensuales en fechas de calendario. Permite elegir primera aportación y fecha objetivo, guardar escenario, pérdidas y tasa cero.
- Copias JSON para exportar e importar todos los registros y el escenario guardado.
- Uso sin conexión tras la primera descarga completa de los recursos.

Las aportaciones posteriores a la última valoración quedan pendientes del siguiente cierre. El gráfico muestra aportaciones acumuladas y la última valoración, sin histórico de valoraciones ni precios pasados inventados. Al abrir una cartera antigua se conserva solo la valoración más reciente y se mantienen todas las aportaciones. Esta versión admite entradas de dinero, sin retiradas. El simulador no ajusta inflación ni impuestos; utiliza una tasa neta de gastos para reflejarlos.

Los campos numéricos aceptan coma o punto decimal, sin separadores de miles. Los importes de dinero admiten hasta dos decimales; las tasas del simulador, hasta ocho. Los campos de fecha y sus contenedores se ajustan a pantallas pequeñas, incluidos los controles nativos de Safari.

## Publicación y desarrollo

Todos los archivos estáticos están en la raíz. En GitHub: Settings → Pages → Deploy from a branch → main → / (root). El archivo `.nojekyll` evita procesamiento adicional de Jekyll. También se puede alojar en cualquier servidor estático con HTTPS, incluso en una subcarpeta.

Para desarrollo local: `python -m http.server 8897` y abre `http://localhost:8897/`. No requiere instalación de paquetes ni compilación. `finance.mjs` concentra los cálculos, separado de `app.mjs`, que contiene la interfaz y persistencia. Al actualizar recursos, cambia la versión de caché de `sw.js`.

Este repositorio contiene exclusivamente la aplicación y datos ficticios. No contiene archivos de carteras personales.
