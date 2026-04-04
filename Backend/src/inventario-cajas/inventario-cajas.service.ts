import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { InventarioCajas, InventarioCajasMovimiento } from './esquemas/inventario-cajas.entity';
import { AjustarCajasDto, ConfigurarAlertaDto } from './esquemas/inventario-cajas.dto';

@Injectable()
export class InventarioCajasService {
	constructor(
		@InjectRepository(InventarioCajas)
		private readonly inventarioRepo: Repository<InventarioCajas>,
		@InjectRepository(InventarioCajasMovimiento)
		private readonly movimientosRepo: Repository<InventarioCajasMovimiento>,
	) {}

	/** Obtiene o crea el registro único de inventario */
	private async getOrCreate(): Promise<InventarioCajas> {
		let inv = await this.inventarioRepo.findOne({ where: {} });
		if (!inv) {
			inv = this.inventarioRepo.create({ cantidad: 0, alertaMinimo: 10 });
			await this.inventarioRepo.save(inv);
		}
		return inv;
	}

	/** Retorna el estado actual del inventario */
	async getEstado(): Promise<{ cantidad: number; alertaMinimo: number | null; enAlerta: boolean }> {
		const inv = await this.getOrCreate();
		return {
			cantidad: inv.cantidad,
			alertaMinimo: inv.alertaMinimo,
			enAlerta: inv.alertaMinimo !== null && inv.cantidad <= inv.alertaMinimo,
		};
	}

	/** Ajusta la cantidad de cajas (positivo = agregar, negativo = restar) */
	async ajustar(dto: AjustarCajasDto): Promise<{ cantidad: number; alertaMinimo: number | null; enAlerta: boolean }> {
		const inv = await this.getOrCreate();
		const nuevaCantidad = Math.max(0, inv.cantidad + dto.delta);

		// Guardar movimiento
		await this.movimientosRepo.save(
			this.movimientosRepo.create({
				delta: dto.delta,
				cantidadResultante: nuevaCantidad,
				tipo: dto.tipo || (dto.delta > 0 ? 'entrada' : 'salida'),
				nota: dto.nota || null,
			}),
		);

		inv.cantidad = nuevaCantidad;
		await this.inventarioRepo.save(inv);

		return {
			cantidad: inv.cantidad,
			alertaMinimo: inv.alertaMinimo,
			enAlerta: inv.alertaMinimo !== null && inv.cantidad <= inv.alertaMinimo,
		};
	}

	/** Configura la cantidad mínima de alerta */
	async configurarAlerta(dto: ConfigurarAlertaDto): Promise<{ alertaMinimo: number }> {
		const inv = await this.getOrCreate();
		inv.alertaMinimo = dto.alertaMinimo;
		await this.inventarioRepo.save(inv);
		return { alertaMinimo: inv.alertaMinimo! };
	}

	/** Obtiene los movimientos del día actual */
	async getMovimientosHoy(): Promise<InventarioCajasMovimiento[]> {
		const hoy = new Date();
		hoy.setHours(0, 0, 0, 0);
		return this.movimientosRepo.find({
			where: { creadoEn: MoreThanOrEqual(hoy) },
			order: { creadoEn: 'DESC' },
		});
	}

	/** Obtiene los últimos N movimientos */
	async getMovimientos(limit = 20): Promise<InventarioCajasMovimiento[]> {
		return this.movimientosRepo.find({
			order: { creadoEn: 'DESC' },
			take: limit,
		});
	}
}
