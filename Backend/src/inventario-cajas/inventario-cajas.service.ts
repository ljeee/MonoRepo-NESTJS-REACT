import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { InventarioCajas, InventarioCajasMovimiento } from './esquemas/inventario-cajas.entity';
import { AjustarCajasDto, ConfigurarAlertaDto, CrearCajaDto } from './esquemas/inventario-cajas.dto';

@Injectable()
export class InventarioCajasService {
	constructor(
		@InjectRepository(InventarioCajas)
		private readonly inventarioRepo: Repository<InventarioCajas>,
		@InjectRepository(InventarioCajasMovimiento)
		private readonly movimientosRepo: Repository<InventarioCajasMovimiento>,
	) {}

	/** Crear nuevo tipo de caja */
	async crear(dto: CrearCajaDto): Promise<InventarioCajas> {
		const inv = this.inventarioRepo.create({
			nombre: dto.nombre,
			cantidad: dto.cantidad || 0,
			alertaMinimo: dto.alertaMinimo ?? null,
		});
		return await this.inventarioRepo.save(inv);
	}

	/** Eliminar tipo de caja */
	async eliminar(id: number): Promise<void> {
		const inv = await this.inventarioRepo.findOne({ where: { id } });
		if (!inv) throw new NotFoundException('Caja no encontrada');
		await this.inventarioRepo.remove(inv);
	}

	/** Retorna todas las cajas */
	async getEstado(): Promise<Array<{ id: number; nombre: string; cantidad: number; alertaMinimo: number | null; enAlerta: boolean }>> {
		const cajas = await this.inventarioRepo.find({ order: { id: 'ASC' } });
		return cajas.map(inv => ({
			id: inv.id,
			nombre: inv.nombre,
			cantidad: inv.cantidad,
			alertaMinimo: inv.alertaMinimo,
			enAlerta: inv.alertaMinimo !== null && inv.cantidad <= inv.alertaMinimo,
		}));
	}

	/** Ajusta la cantidad de una caja específica (positivo = agregar, negativo = restar) */
	async ajustar(cajaId: number, dto: AjustarCajasDto) {
		const inv = await this.inventarioRepo.findOne({ where: { id: cajaId } });
		if (!inv) throw new NotFoundException('Caja no encontrada');

		const nuevaCantidad = Math.max(0, inv.cantidad + dto.delta);

		// Guardar movimiento
		await this.movimientosRepo.save(
			this.movimientosRepo.create({
				cajaId: inv.id,
				delta: dto.delta,
				cantidadResultante: nuevaCantidad,
				tipo: dto.tipo || (dto.delta > 0 ? 'entrada' : 'salida'),
				nota: dto.nota || null,
			}),
		);

		inv.cantidad = nuevaCantidad;
		await this.inventarioRepo.save(inv);

		return {
			id: inv.id,
			nombre: inv.nombre,
			cantidad: inv.cantidad,
			alertaMinimo: inv.alertaMinimo,
			enAlerta: inv.alertaMinimo !== null && inv.cantidad <= inv.alertaMinimo,
		};
	}

	/** Configura la cantidad mínima de alerta de una caja */
	async configurarAlerta(cajaId: number, dto: ConfigurarAlertaDto): Promise<{ alertaMinimo: number }> {
		const inv = await this.inventarioRepo.findOne({ where: { id: cajaId } });
		if (!inv) throw new NotFoundException('Caja no encontrada');
		
		inv.alertaMinimo = dto.alertaMinimo;
		await this.inventarioRepo.save(inv);
		return { alertaMinimo: inv.alertaMinimo! };
	}

	/** Obtiene los movimientos cargando la info de la caja a la que pertenecen */
	async getMovimientos(limit = 20): Promise<any[]> {
		const movimientos = await this.movimientosRepo.find({
			relations: ['caja'],
			order: { creadoEn: 'DESC' },
			take: limit,
		});

		return movimientos.map(m => ({
			id: m.id,
			cajaId: m.cajaId,
			cajaNombre: m.caja?.nombre || 'Caja eliminada',
			delta: m.delta,
			cantidadResultante: m.cantidadResultante,
			tipo: m.tipo,
			nota: m.nota,
			creadoEn: m.creadoEn,
		}));
	}
}
