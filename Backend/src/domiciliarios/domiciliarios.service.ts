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

	/**
	 * Guarda la última posición. `capturadaEn` es la hora en que el GPS tomó la posición (puede llegar tarde si el
	 * teléfono estuvo sin red): se usa si es razonable (no futura, no de hace más de un día); si no, la del servidor.
	 * Si el teléfono no es de un domiciliario registrado responde 404: antes devolvía {ok: true} sin guardar nada y
	 * el POS nunca lo veía mientras la app creía estar reportando.
	 */
	async actualizarUbicacion(telefono: string, latitud: number, longitud: number, capturadaEn?: number) {
		const ahora = Date.now();
		const fecha =
			typeof capturadaEn === 'number' && capturadaEn <= ahora + 60_000 && capturadaEn >= ahora - 24 * 3600_000
				? new Date(Math.min(capturadaEn, ahora))
				: new Date(ahora);
		const res = await this.repo.update(
			{telefono},
			{ultimaLatitud: latitud, ultimaLongitud: longitud, ultimaUbicacionFecha: fecha},
		);
		if (!res.affected) {
			throw new NotFoundException(
				`No hay un domiciliario registrado con el teléfono ${telefono}: el usuario debe tener username = teléfono del domiciliario`,
			);
		}
		return {ok: true};
	}

	remove(telefono: string) {
		return this.repo.delete(telefono);
	}
}
