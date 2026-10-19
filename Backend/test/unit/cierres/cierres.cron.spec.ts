import {antesDeHoraCierre, CierresCronService, HORA_CIERRE} from '../../../src/cierres/cierres.cron';

/**
 * El cierre automático corre a las 4:00 (Bogotá) y cierra AYER: el local a veces atiende hasta las 2 a. m. Al
 * arrancar el backend antes de esa hora no se cierra nada (lo hará el cron); después, se recupera el cierre que falte.
 */
describe('Cierre automático a las 4 a. m.', () => {
	const cierres = {generalCierre: jest.fn().mockResolvedValue({})};
	const cron = new CierresCronService(cierres as any);

	afterEach(() => {
		jest.useRealTimers();
		cierres.generalCierre.mockClear();
	});

	it('la hora de corte es las 4:00 de Bogotá (UTC−5)', () => {
		expect(HORA_CIERRE).toBe(4);
		expect(antesDeHoraCierre(new Date('2026-10-19T06:30:00Z'))).toBe(true); // 1:30 a. m.
		expect(antesDeHoraCierre(new Date('2026-10-19T08:59:00Z'))).toBe(true); // 3:59 a. m.
		expect(antesDeHoraCierre(new Date('2026-10-19T09:00:00Z'))).toBe(false); // 4:00 a. m.
		expect(antesDeHoraCierre(new Date('2026-10-19T04:30:00Z'))).toBe(false); // 11:30 p. m. del 18: ya pasaron las 4 de ese día
		expect(antesDeHoraCierre(new Date('2026-10-19T05:30:00Z'))).toBe(true); // 12:30 a. m. del 19
	});

	it('si el backend arranca a la 1 a. m. no cierra (el local puede seguir abierto)', async () => {
		jest.useFakeTimers({now: new Date('2026-10-19T06:00:00Z')});
		await cron.onApplicationBootstrap();
		expect(cierres.generalCierre).not.toHaveBeenCalled();
	});

	it('a las 4:05 cierra el día de ayer y envía el correo', async () => {
		jest.useFakeTimers({now: new Date('2026-10-19T09:05:00Z')});
		await cron.handleDailyClose();
		expect(cierres.generalCierre).toHaveBeenCalledWith(
			'2026-10-18',
			expect.any(String),
			expect.any(String),
			false,
			true,
		);
	});

	it('si arranca después de las 4:00 recupera el cierre de ayer', async () => {
		jest.useFakeTimers({now: new Date('2026-10-19T15:00:00Z')});
		await cron.onApplicationBootstrap();
		expect(cierres.generalCierre).toHaveBeenCalledWith(
			'2026-10-18',
			expect.any(String),
			expect.any(String),
			false,
			true,
		);
	});
});
