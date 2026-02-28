import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PizzaSabor } from './esquemas/pizza-sabores.entity';
import { UpdatePizzaSaborDto } from './esquemas/pizza-sabores.dto';

// Sabores precisos del menú actual con sus recargos por tamaño
const SABORES_INICIALES: Omit<PizzaSabor, 'saborId'>[] = [
	// ── Tradicionales (sin recargo) ──────────────────────────────────────
	{ nombre: 'De Casa',           tipo: 'tradicional', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true },
	{ nombre: 'Napolitana',        tipo: 'tradicional', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true },
	{ nombre: 'Ranchera',          tipo: 'tradicional', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true },
	{ nombre: 'Hawaiana',          tipo: 'tradicional', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true },
	{ nombre: 'Vegetales',         tipo: 'tradicional', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true },
	{ nombre: 'Mexicana',          tipo: 'tradicional', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true },
	{ nombre: 'Carnes',            tipo: 'tradicional', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true },
	{ nombre: 'Pollo Tocineta',    tipo: 'tradicional', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true },
	{ nombre: 'Pollo Champiñones', tipo: 'tradicional', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true },
	{ nombre: 'Pollo Maicitos',    tipo: 'tradicional', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true },
	{ nombre: 'Jamón y Queso',     tipo: 'tradicional', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true },
	// ── Especiales (recargo por tamaño) ─────────────────────────────────
	// Quesuda es más cara que los demás especiales
	{ nombre: 'Quesuda',    tipo: 'especial', recargoPequena: 2000, recargoMediana: 3000, recargoGrande: 3000, activo: true },
	{ nombre: 'Boloñesa',   tipo: 'especial', recargoPequena: 1000, recargoMediana: 2000, recargoGrande: 2000, activo: true },
	{ nombre: 'Pollo BBQ',  tipo: 'especial', recargoPequena: 1000, recargoMediana: 2000, recargoGrande: 2000, activo: true },
	{ nombre: 'Aborrajada', tipo: 'especial', recargoPequena: 1000, recargoMediana: 2000, recargoGrande: 2000, activo: true },
	{ nombre: 'Firu',       tipo: 'especial', recargoPequena: 1000, recargoMediana: 2000, recargoGrande: 2000, activo: true },
	{ nombre: 'Paisa',      tipo: 'especial', recargoPequena: 1000, recargoMediana: 2000, recargoGrande: 2000, activo: true },
	// ── Configuración (Dfiru POS) ───────────────────────────────────────
	{ nombre: 'RECARGO_3_SABORES', tipo: 'configuracion', recargoPequena: 0, recargoMediana: 0, recargoGrande: 3000, activo: true },
];

@Injectable()
export class PizzaSaboresService implements OnModuleInit {
	constructor(
		@InjectRepository(PizzaSabor)
		private readonly repo: Repository<PizzaSabor>,
	) {}

	/** Inserta los sabores por defecto si la tabla está vacía */
	async onModuleInit() {
		const count = await this.repo.count();
		if (count === 0) {
			await this.repo.save(SABORES_INICIALES.map(s => this.repo.create(s)));
			console.log('🍕 pizza_sabores seeded with', SABORES_INICIALES.length, 'sabores.');
		}
	}

	findAll() {
		return this.repo.find({ order: { tipo: 'ASC', nombre: 'ASC' } });
	}

	async update(saborId: number, dto: UpdatePizzaSaborDto) {
		await this.repo.update(saborId, {
			...(dto.nombre !== undefined && { nombre: dto.nombre }),
			...(dto.tipo !== undefined && { tipo: dto.tipo }),
			...(dto.recargoPequena !== undefined && { recargoPequena: dto.recargoPequena }),
			...(dto.recargoMediana !== undefined && { recargoMediana: dto.recargoMediana }),
			...(dto.recargoGrande !== undefined && { recargoGrande: dto.recargoGrande }),
			...(dto.activo !== undefined && { activo: dto.activo }),
		});
		return this.repo.findOne({ where: { saborId } });
	}
}
