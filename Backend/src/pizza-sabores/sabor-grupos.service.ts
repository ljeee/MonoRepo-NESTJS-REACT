import {ConflictException, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {QueryFailedError, Repository} from 'typeorm';
import {SaborGrupo} from './esquemas/sabor-grupo.entity';
import {CreateSaborGrupoDto, UpdateSaborGrupoDto} from './esquemas/sabor-grupo.dto';

const esNombreRepetido = (error: unknown) =>
	error instanceof QueryFailedError && (error as {code?: string}).code === '23505';

/** Grupos de sabores: el conjunto de sabores de un producto y las reglas de cómo se piden y cobran. */
@Injectable()
export class SaborGruposService {
	constructor(
		@InjectRepository(SaborGrupo)
		private readonly repo: Repository<SaborGrupo>,
	) {}

	findAll() {
		return this.repo.find({order: {orden: 'ASC', id: 'ASC'}});
	}

	async findOne(id: number) {
		const grupo = await this.repo.findOne({where: {id}});
		if (!grupo) throw new NotFoundException(`Grupo de sabores ${id} no encontrado`);
		return grupo;
	}

	async create(dto: CreateSaborGrupoDto) {
		try {
			return await this.repo.save(this.repo.create({...dto, nombre: dto.nombre.trim()}));
		} catch (error) {
			if (esNombreRepetido(error)) throw new ConflictException('Ya existe un grupo de sabores con ese nombre.');
			throw error;
		}
	}

	async update(id: number, dto: UpdateSaborGrupoDto) {
		await this.findOne(id);
		const cambios: Partial<SaborGrupo> = {...dto};
		if (dto.nombre !== undefined) cambios.nombre = dto.nombre.trim();
		try {
			await this.repo.update(id, cambios);
		} catch (error) {
			if (esNombreRepetido(error)) throw new ConflictException('Ya existe un grupo de sabores con ese nombre.');
			throw error;
		}
		return this.findOne(id);
	}

	/** No se borra un grupo en uso: sus sabores y productos quedarían huérfanos. Se puede desactivar. */
	async remove(id: number) {
		await this.findOne(id);
		const [{sabores, productos}]: {sabores: number; productos: number}[] = await this.repo.manager.query(
			`SELECT (SELECT COUNT(*)::int FROM pizza_sabores WHERE grupo_id = $1) AS sabores,
			        (SELECT COUNT(*)::int FROM productos WHERE sabor_grupo_id = $1) AS productos`,
			[id],
		);
		if (sabores > 0 || productos > 0) {
			throw new ConflictException(
				`El grupo tiene ${sabores} sabores y ${productos} productos: muévelos a otro grupo o desactívalo.`,
			);
		}
		await this.repo.delete(id);
		return {deleted: true};
	}
}
