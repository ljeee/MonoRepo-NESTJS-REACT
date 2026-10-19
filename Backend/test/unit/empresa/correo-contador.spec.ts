import {getMetadataArgsStorage} from 'typeorm';
import {EmpresaConfig} from '../../../src/empresa/esquemas/empresa.entity';
import {PATRON_CORREOS} from '../../../src/empresa/esquemas/empresa.dto';
import {normalizarCorreos} from '../../../src/empresa/empresa.service';

/**
 * El correo del contador recibe el libro diario de cada cierre. GET /empresa es PÚBLICO (ClientWeb lo usa en
 * «Nosotros»): la columna debe quedar fuera de las consultas normales (`select: false`) para no exponerla.
 */
describe('Correo del contador', () => {
	it('la columna correo_contador no se carga por defecto (no sale en GET /empresa)', () => {
		const columna = getMetadataArgsStorage().columns.find(
			(c) => c.target === EmpresaConfig && c.propertyName === 'correoContador',
		);
		expect(columna?.options).toMatchObject({name: 'correo_contador', type: 'text', nullable: true, select: false});
	});

	it('acepta vacío o correos separados por coma, y rechaza lo demás', () => {
		for (const ok of ['', '  ', 'conta@x.com', 'conta@x.com, otro@y.co', 'a@b.co,c@d.com'])
			expect(PATRON_CORREOS.test(ok)).toBe(true);
		for (const malo of ['conta', 'conta@x', 'a@b.com,', 'a@b.com otro@c.com', 'a b@c.com'])
			expect(PATRON_CORREOS.test(malo)).toBe(false);
	});

	it('normaliza la lista y deja null cuando está vacía', () => {
		expect(normalizarCorreos(' a@x.com ,b@y.com ')).toBe('a@x.com, b@y.com');
		expect(normalizarCorreos('  ')).toBeNull();
		expect(normalizarCorreos(null)).toBeNull();
	});
});
