import {Injectable, NotFoundException} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {FacturasPagos} from "./esquemas/facturas-pagos.entity";
import {CreateFacturasPagosDto, FindFacturasPagosDto} from "./esquemas/facturas-pagos.dto";
import {getBogotaDateString} from "../common/utils/date.utils";
import {CajaMovimientosService} from "../caja-movimientos/caja-movimientos.service";

@Injectable()
export class FacturasPagosService {
	constructor(
		@InjectRepository(FacturasPagos)
		private readonly repo: Repository<FacturasPagos>,
		private readonly cajaMovimientosService: CajaMovimientosService,
	) {}

	async findAll(query: FindFacturasPagosDto = {}) {
		const { from, to, page = 1, limit = 100 } = query;
		const qb = this.repo.createQueryBuilder('p')
			.orderBy('p.fechaFactura', 'DESC')
			.take(limit)
			.skip((page - 1) * limit);

		if (from && to) {
			qb.where('p.fechaFactura BETWEEN :from AND :to', { from, to });
		} else if (from) {
			qb.where('p.fechaFactura >= :from', { from });
		} else if (to) {
			qb.where('p.fechaFactura <= :to', { to });
		}

		const [data, total] = await qb.getManyAndCount();
		return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
	}

	findByDay() {
		// fechaFactura is a date column (equality check is timezone-independent)
		const today = getBogotaDateString();
		return this.repo.createQueryBuilder('p')
			.where('p.fechaFactura = :today', { today })
			.getMany();
	}

	findPendingByDay() {
		const today = getBogotaDateString();
		return this.repo.createQueryBuilder('p')
			.where('(p.estado = :pendiente OR p.estado IS NULL)')
			.andWhere('p.fechaFactura = :today', { today, pendiente: 'pendiente' })
			.getMany();
	}

	async findOne(id: number) {
		const pago = await this.repo.findOneBy({pagosId: id});
		if (!pago) {
			throw new NotFoundException(`Factura de pago con ID ${id} no encontrada`);
		}
		return pago;
	}

	async create(data: CreateFacturasPagosDto) {
		if (!data.fechaFactura) {
			data.fechaFactura = getBogotaDateString();
		}
		const gasto = await this.repo.save(data);

		// Registrar salida de caja si el gasto es en efectivo y trae denominaciones
		if (data.metodo === 'efectivo' && data.denominaciones && Object.keys(data.denominaciones).length > 0) {
			await this.cajaMovimientosService.registrarSalida({
				denominaciones: data.denominaciones,
				facturaPagoId: gasto.pagosId,
				descripcion: data.nombreGasto ?? 'Gasto en efectivo',
				fecha: data.fechaFactura,
				cajaOrigen: 'gastos',
			});
		}

		return gasto;
	}

	update(id: number, data: Partial<CreateFacturasPagosDto>) {
		return this.repo.update(id, data);
	}

	remove(id: number) {
		return this.repo.delete(id);
	}
}
