import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {FacturasVentas} from './esquemas/facturas-ventas.entity';
import {CreateFacturasVentasDto} from './esquemas/facturas-ventas.dto';

@Injectable()
export class FacturasVentasService {
	constructor(
		@InjectRepository(FacturasVentas)
		private readonly repo: Repository<FacturasVentas>,
	) {}

	async findAll(page = 1, limit = 500) {
		const result = await this.repo
			.createQueryBuilder('f')
			.leftJoinAndSelect('f.ordenes', 'ordenes')
			.leftJoinAndSelect('ordenes.productos', 'op')
			.leftJoinAndSelect('f.domicilios', 'domicilios')
			.orderBy('f.fechaFactura', 'DESC')
			.take(limit)
			.skip((page - 1) * limit)
			.getMany();
		console.log('findAll result count:', result.length);
		return result;
	}

	async findByDay() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		const result = await this.repo
			.createQueryBuilder('f')
			.leftJoinAndSelect('f.ordenes', 'ordenes')
			.leftJoinAndSelect('ordenes.productos', 'op')
			.leftJoinAndSelect('f.domicilios', 'domicilios')
			.where('f.fechaFactura BETWEEN :start AND :end', {start, end})
			.getMany();
		console.log('findByDay result count:', result.length, 'start:', start, 'end:', end);
		return result;
	}

	findPendingByDay() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo
			.createQueryBuilder('f')
			.leftJoinAndSelect('f.ordenes', 'ordenes')
			.leftJoinAndSelect('f.domicilios', 'domicilios')
			.where('(f.estado = :pendiente OR f.estado IS NULL)')
			.andWhere('f.fechaFactura BETWEEN :start AND :end', {start, end, pendiente: 'pendiente'})
			.getMany();
	}

	async getDayStats() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);

		const facturas = await this.repo
			.createQueryBuilder('f')
			.where('f.fechaFactura BETWEEN :start AND :end', {start, end})
			.getMany();

		const totalDia = facturas.reduce((sum, f) => sum + (Number(f.total) || 0), 0);
		const totalPagado = facturas.filter((f) => f.estado === 'pagado').reduce((sum, f) => sum + (Number(f.total) || 0), 0);
		const totalPendiente = facturas
			.filter((f) => f.estado !== 'pagado')
			.reduce((sum, f) => sum + (Number(f.total) || 0), 0);

		return {
			totalDia,
			totalPagado,
			totalPendiente,
			count: facturas.length,
		};
	}

	findOne(id: number) {
		return this.repo.findOne({
			where: {facturaId: id},
			relations: ['ordenes', 'domicilios'],
		});
	}

	create(data: CreateFacturasVentasDto) {
		return this.repo.save(data);
	}

	update(id: number, data: Partial<CreateFacturasVentasDto>) {
		return this.repo.update(id, data);
	}

	remove(id: number) {
		return this.repo.delete(id);
	}
}
