import {Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {Domiciliarios} from './esquemas/domiciliarios.entity';
import {CreateDomiciliariosDto} from './esquemas/domiciliarios.dto';

@Injectable()
export class DomiciliariosService {
	constructor(
		@InjectRepository(Domiciliarios)
		private readonly repo: Repository<Domiciliarios>,
	) {}

	findAll(page = 1, limit = 500) {
		return this.repo.find({
			take: limit,
			skip: (page - 1) * limit,
			relations: ['domicilios', 'user'],
		});
	}

	async findOne(telefono: string) {
		const domiciliario = await this.repo.findOne({
			where: {telefono},
			relations: ['domicilios', 'user'],
		});
		if (!domiciliario) {
			throw new NotFoundException(`Domiciliario con teléfono ${telefono} no encontrado`);
		}
		return domiciliario;
	}

	create(data: CreateDomiciliariosDto) {
		return this.repo.save(data);
	}

	update(telefono: string, data: Partial<CreateDomiciliariosDto>) {
		return this.repo.update(telefono, data);
	}

	async actualizarUbicacion(telefono: string, latitud: number, longitud: number) {
		await this.repo.update(
			{telefono},
			{ultimaLatitud: latitud, ultimaLongitud: longitud, ultimaUbicacionFecha: new Date()},
		);
		return {ok: true};
	}

	remove(telefono: string) {
		return this.repo.delete(telefono);
	}
}
