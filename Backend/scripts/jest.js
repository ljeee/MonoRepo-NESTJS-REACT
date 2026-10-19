/**
 * Lanzador de Jest con `--experimental-vm-modules` (lo pasa el script de npm a node):
 * PGlite (Postgres embebido de test/unit/estadisticas/analitica.sql.spec.ts) usa
 * import() dinámico, que Jest en CommonJS solo permite con ese flag. Usar siempre
 * `npm test -- --testPathPatterns=X` en vez de `npx jest` directo.
 */
require(require.resolve('jest/bin/jest'));
