import {Injectable, OnModuleInit, NotFoundException, ConflictException, BadRequestException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {EmpresaConfig} from './esquemas/empresa.entity';
import {CuentaTransferencia} from './esquemas/cuenta-transferencia.entity';
import {UpdateEmpresaDto} from './esquemas/empresa.dto';

/** " a@x.com ,b@y.com " → "a@x.com, b@y.com"; vacío → null. */
export function normalizarCorreos(valor?: string | null): string | null {
	const lista = (valor ?? '')
		.split(',')
		.map((c) => c.trim())
		.filter(Boolean);
	return lista.length ? lista.join(', ') : null;
}

@Injectable()
export class EmpresaService implements OnModuleInit {
	constructor(
		@InjectRepository(EmpresaConfig)
		private readonly repo: Repository<EmpresaConfig>,
		@InjectRepository(CuentaTransferencia)
		private readonly cuentasRepo: Repository<CuentaTransferencia>,
	) {}

	async onModuleInit() {
		const count = await this.repo.count();
		if (count === 0) {
			await this.repo.save(
				this.repo.create({
					nit: '1026147348',
					razonSocial: 'Dfiruexpo Pizzería S.A.S',
					nombreComercial: 'Dfiru Pizzería',
				}),
			);
			console.log('🏢 EmpresaConfig initialized with default values.');
		}

		const countCuentas = await this.cuentasRepo.count();
		if (countCuentas === 0) {
			await this.cuentasRepo.save([
				this.cuentasRepo.create({nombre: 'Jeferson', activa: true}),
				this.cuentasRepo.create({nombre: 'Diana', activa: true}),
				this.cuentasRepo.create({nombre: 'Firu', activa: true}),
			]);
			console.log('💳 CuentasTransferencia initialized default accounts (Jeferson, Diana, Firu).');
		}
	}

	async getConfig() {
		return this.repo.findOne({where: {}}) || {};
	}

	async updateConfig(dto: UpdateEmpresaDto) {
		let config = await this.repo.findOne({where: {}});
		if (!config) {
			config = this.repo.create(dto);
		} else {
			// Apagado → encendido: marca el momento. Obliga a contar la caja de nuevo (el conteo debe ser posterior).
			const reactivando = dto.arqueoCaja === true && config.arqueoCaja === false;
			Object.assign(config, dto);
			if (reactivando) config.arqueoDesde = new Date();
		}
		if (dto.correoContador !== undefined) config.correoContador = normalizarCorreos(dto.correoContador);
		const guardada = await this.repo.save(config);
		// La respuesta del PATCH tampoco lo repite: se consulta con getCorreoContador().
		delete (guardada as Partial<EmpresaConfig>).correoContador;
		return guardada;
	}

	/** Correo(s) del contador (columna con select: false, fuera de la respuesta pública). null = sin configurar. */
	async getCorreoContador(): Promise<string | null> {
		const fila = await this.repo
			.createQueryBuilder('e')
			.select('e.id')
			.addSelect('e.correoContador')
			.orderBy('e.id', 'ASC')
			.getOne();
		return normalizarCorreos(fila?.correoContador);
	}

	// ─── Cuentas Transferencia ──────────────────────────────────────────────────
	async getCuentasTransferencia(incluirInactivas = false) {
		if (incluirInactivas) {
			return this.cuentasRepo.find({order: {id: 'ASC'}});
		}
		return this.cuentasRepo.find({where: {activa: true}, order: {id: 'ASC'}});
	}

	/** Nombre limpio y sin repetir (las filas viejas de facturas se enlazan a la cuenta por nombre). */
	private async nombreValido(nombre: string | undefined, excluirId?: number): Promise<string> {
		const limpio = (nombre ?? '').trim();
		if (!limpio) throw new BadRequestException('El nombre de la cuenta es obligatorio');
		const existentes = await this.cuentasRepo.find();
		if (existentes.some((c) => c.id !== excluirId && c.nombre.trim().toLowerCase() === limpio.toLowerCase())) {
			throw new ConflictException(`Ya existe una cuenta llamada "${limpio}"`);
		}
		return limpio;
	}

	async crearCuentaTransferencia(nombre: string) {
		const nueva = this.cuentasRepo.create({nombre: await this.nombreValido(nombre), activa: true});
		return this.cuentasRepo.save(nueva);
	}

	async actualizarCuentaTransferencia(id: number, updates: {nombre?: string; activa?: boolean}) {
		const cuenta = await this.cuentasRepo.findOne({where: {id}});
		if (!cuenta) throw new NotFoundException(`Cuenta #${id} no encontrada`);
		const nombreAnterior = cuenta.nombre;
		if (updates.nombre !== undefined) cuenta.nombre = await this.nombreValido(updates.nombre, id);
		if (updates.activa !== undefined) cuenta.activa = updates.activa;

		return this.cuentasRepo.manager.transaction(async (manager) => {
			const guardada = await manager.getRepository(CuentaTransferencia).save(cuenta);
			// Las facturas guardan una copia del nombre: sin esto las listas y los PDF mostraban el nombre
			// viejo mientras el resumen mostraba el nuevo.
			if (guardada.nombre !== nombreAnterior) {
				await manager.query('UPDATE facturas_ventas SET cuenta_transferencia_nombre = $1 WHERE cuenta_transferencia_id = $2', [
					guardada.nombre,
					id,
				]);
			}
			return guardada;
		});
	}

	/** Facturas que cobraron (o abonaron) por transferencia a esta cuenta, más egresos pagados desde ella. */
	async facturasDeCuenta(id: number): Promise<number> {
		const [fila] = await this.cuentasRepo.manager.query(
			`SELECT (SELECT COUNT(*) FROM facturas_ventas
			          WHERE cuenta_transferencia_id = $1 OR desglose_transferencia @> $2::jsonb)::int
			      + (SELECT COUNT(*) FROM facturas_pagos WHERE cuenta_origen_id = $1)::int AS n`,
			[id, JSON.stringify([{cuentaId: id}])],
		);
		return Number(fila?.n) || 0;
	}

	/**
	 * Eliminar una cuenta con facturas dejaba esos cobros "huérfanos" (sin cuenta en la tabla): para
	 * dejar de usarla hay que desactivarla, que conserva el historial.
	 */
	async eliminarCuentaTransferencia(id: number) {
		const usos = await this.facturasDeCuenta(id);
		if (usos > 0) {
			throw new ConflictException(
				`La cuenta tiene ${usos} movimiento${usos === 1 ? '' : 's'} registrado${usos === 1 ? '' : 's'} (facturas o egresos): desactívala en vez de eliminarla para conservar el historial`,
			);
		}
		return this.cuentasRepo.delete(id);
	}
}
