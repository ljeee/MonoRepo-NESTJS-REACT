/**
 * Muestra el DDL que `synchronize` aplicaría contra la base configurada, SIN aplicarlo.
 * Correr antes de cada despliegue contra una copia restaurada de producción:
 *
 *   PowerShell:  $env:DOTENV_CONFIG_PATH='.env.ensayo'; npm run schema:preview
 *   Git Bash:    DOTENV_CONFIG_PATH=.env.ensayo npm run schema:preview
 *
 * Revisar que NO aparezca ningún DROP inesperado (un DROP COLUMN = datos perdidos).
 * No se carga dotenv dentro de src/data-source.ts a propósito: los seeders lo importan.
 */
require("dotenv").config({path: process.env.DOTENV_CONFIG_PATH || ".env"});

process.argv.splice(2, 0, "schema:log", "-d", "src/data-source.ts");
require("typeorm/cli-ts-node-commonjs.js");
