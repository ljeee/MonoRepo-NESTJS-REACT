import {Injectable, NotFoundException} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Domicilios} from "./esquemas/domicilios.entity";
import {CreateDomiciliosDto} from "./esquemas/domicilios.dto";

@Injectable()
export class DomiciliosService {
	constructor(
		@InjectRepository(Domicilios)
		private readonly repo: Repository<Domicilios>,
	) {}

	findAll(page = 1, limit = 500) {
		return this.repo.createQueryBuilder('d')
			.leftJoinAndSelect('d.factura', 'factura')
			.leftJoinAndSelect('d.orden', 'orden')
			.leftJoinAndSelect('orden.productos', 'productos')
			.leftJoinAndSelect('d.cliente', 'cliente')
			.leftJoinAndSelect('d.domiciliario', 'domiciliario')
			.orderBy('d.fechaCreado', 'DESC')
			.take(limit)
			.skip((page - 1) * limit)
			.getMany();
	}

	findByDay() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo.createQueryBuilder('d')
			.leftJoinAndSelect('d.factura', 'factura')
			.leftJoinAndSelect('d.orden', 'orden')
			.leftJoinAndSelect('orden.productos', 'productos')
			.leftJoinAndSelect('d.cliente', 'cliente')
			.leftJoinAndSelect('d.domiciliario', 'domiciliario')
			.where('d.fechaCreado BETWEEN :start AND :end', { start, end })
			.orderBy('d.fechaCreado', 'DESC')
			.getMany();
	}

	findPendingByDay() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo.createQueryBuilder('d')
			.leftJoinAndSelect('d.factura', 'factura')
			.leftJoinAndSelect('d.orden', 'orden')
			.leftJoinAndSelect('orden.productos', 'productos')
			.leftJoinAndSelect('d.cliente', 'cliente')
			.leftJoinAndSelect('d.domiciliario', 'domiciliario')
			.where('(d.estadoDomicilio = :pendiente OR d.estadoDomicilio IS NULL)')
			.andWhere('d.fechaCreado BETWEEN :start AND :end', { start, end, pendiente: 'pendiente' })
			.orderBy('d.fechaCreado', 'DESC')
			.getMany();
	}

	async findOne(id: number) {
		const domicilio = await this.repo.findOne({
			where: { domicilioId: id },
			relations: ['factura', 'orden', 'cliente', 'domiciliario']
		});
		if (!domicilio) {
			throw new NotFoundException(`Domicilio con ID ${id} no encontrado`);
		}
		return domicilio;
	}

	create(data: CreateDomiciliosDto) {
		return this.repo.save(data);
	}

	update(id: number, data: Partial<CreateDomiciliosDto>) {
		return this.repo.update(id, data);
	}

	findByUser(telefono: string, all = false) {
		const query = this.repo.createQueryBuilder('d')
			.leftJoinAndSelect('d.factura', 'factura')
			.leftJoinAndSelect('d.orden', 'orden')
			.leftJoinAndSelect('orden.productos', 'productos')
			.leftJoinAndSelect('d.cliente', 'cliente')
			.leftJoinAndSelect('d.domiciliario', 'domiciliario')
			.where('d.telefonoDomiciliarioAsignado = :telefono', { telefono });

		if (!all) {
			const start = new Date();
			start.setHours(0, 0, 0, 0);
			const end = new Date();
			end.setHours(23, 59, 59, 999);
			query.andWhere('d.fechaCreado BETWEEN :start AND :end', { start, end });
		}

		return query.orderBy('d.fechaCreado', 'DESC').getMany();
	}

	remove(id: number) {
		return this.repo.delete(id);
	}
}
