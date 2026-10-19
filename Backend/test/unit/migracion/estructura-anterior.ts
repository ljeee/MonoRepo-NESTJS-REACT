import * as fs from 'fs';
import * as path from 'path';

const BACKEND = path.join(__dirname, '../../..');

/**
 * `Backend/init.sql` (volcado de la ESTRUCTURA ANTERIOR, el 01-init.sql de un volumen nuevo) listo para PGlite:
 * sin los metacomandos de psql ni la extensión uuid-ossp (PGlite trae gen_random_uuid()).
 */
export function estructuraAnterior(): string {
	return fs
		.readFileSync(path.join(BACKEND, 'init.sql'), 'utf8')
		.split(/\r?\n/)
		.filter((l) => !l.startsWith('\\') && !/EXTENSION/i.test(l))
		.join('\n')
		.replace(/public\.uuid_generate_v4\(\)/g, 'gen_random_uuid()');
}

/** `Backend/seed-menu.sql` tal cual: el 02-seed-menu.sql que el contenedor db corre después de init.sql. */
export function seedMenu(): string {
	return fs.readFileSync(path.join(BACKEND, 'seed-menu.sql'), 'utf8');
}
