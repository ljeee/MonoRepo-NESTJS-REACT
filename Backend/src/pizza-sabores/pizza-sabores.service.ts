import {BadRequestException, ConflictException, Injectable, OnModuleInit} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {QueryFailedError, Repository} from 'typeorm';
import {PizzaSabor} from './esquemas/pizza-sabores.entity';
import {SaborGrupo} from './esquemas/sabor-grupo.entity';
import {CreatePizzaSaborDto, UpdatePizzaSaborDto} from './esquemas/pizza-sabores.dto';
import {GRUPOS_BASE, GRUPO_PIZZA} from './grupos-base';

type Recargos = [number, number, number];

/** Sabores de pizza del menú con el que arranca una instalación nueva; el recargo por tamaño es del propio sabor (0 = no cobra). */
const SABORES_PIZZA_INICIALES: {nombre: string; recargos: Recargos}[] = [
	...[
		'De Casa',
		'Napolitana',
		'Ranchera',
		'Hawaiana',
		'Vegetales',
		'Mexicana',
		'Carnes',
		'Pollo Tocineta',
		'Pollo Champiñones',
		'Pollo Maicitos',
		'Jamón y Queso',
	].map((nombre) => ({nombre, recargos: [0, 0, 0] as Recargos})),
	// Quesuda es más cara que los demás con recargo
	{nombre: 'Quesuda', recargos: [2000, 3000, 3000]},
	{nombre: 'Boloñesa', recargos: [1000, 2000, 2000]},
	{nombre: 'Pollo BBQ', recargos: [1000, 2000, 2000]},
	{nombre: 'Aborrajada', recargos: [1000, 2000, 2000]},
	{nombre: 'Firu', recargos: [1000, 2000, 2000]},
	{nombre: 'Paisa', recargos: [1000, 2000, 2000]},
];

const codigoError = (error: unknown) =>
	error instanceof QueryFailedError ? (error as {code?: string}).code : undefined;

@Injectable()
export class PizzaSaboresService implements OnModuleInit {
	constructor(
		@InjectRepository(PizzaSabor)
		private readonly repo: Repository<PizzaSabor>,
		@InjectRepository(SaborGrupo)
		private readonly gruposRepo: Repository<SaborGrupo>,
	) {}

	/** Instalación nueva: crea los grupos base (Pizza, Calzone) y los sabores de pizza del menú. */
	async onModuleInit() {
		const count = await this.repo.count();
		if (count > 0) return;

		for (const base of GRUPOS_BASE) {
			const existe = await this.gruposRepo.findOne({where: {nombre: base.nombre}});
			if (!existe) await this.gruposRepo.save(this.gruposRepo.create(base));
		}
		const pizza = await this.gruposRepo.findOne({where: {nombre: GRUPO_PIZZA.nombre}});
		await this.repo.save(
			SABORES_PIZZA_INICIALES.map((s) =>
				this.repo.create({
					nombre: s.nombre,
					grupoId: pizza?.id ?? null,
					recargoPequena: s.recargos[0],
					recargoMediana: s.recargos[1],
					recargoGrande: s.recargos[2],
					activo: true,
				}),
			),
		);
		console.log('🍕 sabores seeded:', SABORES_PIZZA_INICIALES.length, 'sabores de pizza.');
	}

	/**
	 * Sabores de un grupo (o todos). Excluye la fila de configuración heredada (`RECARGO_3_SABORES`):
	 * ese recargo ahora es una regla del grupo.
	 */
	findAll(grupoId?: number) {
		const qb = this.repo
			.createQueryBuilder('s')
			.where("s.tipo IS DISTINCT FROM 'configuracion'")
			.orderBy('s.grupoId', 'ASC', 'NULLS LAST')
			.addOrderBy('s.nombre', 'ASC');
		if (grupoId != null) qb.andWhere('s.grupoId = :grupoId', {grupoId});
		return qb.getMany();
	}

	async update(saborId: number, dto: UpdatePizzaSaborDto) {
		try {
			await this.repo.update(saborId, {
				...(dto.nombre !== undefined && {nombre: dto.nombre.trim()}),
				...(dto.grupoId !== undefined && {grupoId: dto.grupoId}),
				...(dto.recargoPequena !== undefined && {recargoPequena: dto.recargoPequena}),
				...(dto.recargoMediana !== undefined && {recargoMediana: dto.recargoMediana}),
				...(dto.recargoGrande !== undefined && {recargoGrande: dto.recargoGrande}),
				...(dto.activo !== undefined && {activo: dto.activo}),
			});
		} catch (error) {
			if (codigoError(error) === '23505')
				throw new ConflictException('Ya existe un sabor con ese nombre en este grupo.');
			if (codigoError(error) === '23503') throw new BadRequestException('El grupo de sabores no existe.');
			throw error;
		}
		return this.repo.findOne({where: {saborId}});
	}

	async create(dto: CreatePizzaSaborDto) {
		const nuevo = this.repo.create({
			nombre: dto.nombre.trim(),
			grupoId: dto.grupoId,
			recargoPequena: dto.recargoPequena ?? 0,
			recargoMediana: dto.recargoMediana ?? 0,
			recargoGrande: dto.recargoGrande ?? 0,
			activo: dto.activo ?? true,
		});
		try {
			return await this.repo.save(nuevo);
		} catch (error) {
			if (codigoError(error) === '23505')
				throw new ConflictException('Ya existe un sabor con ese nombre en este grupo.');
			if (codigoError(error) === '23503') throw new BadRequestException('El grupo de sabores no existe.');
			throw error;
		}
	}

	async delete(saborId: number) {
		const result = await this.repo.delete(saborId);
		return {deleted: !!result.affected && result.affected > 0};
	}
}
