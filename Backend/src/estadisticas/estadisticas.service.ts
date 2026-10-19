import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, Between, In} from 'typeorm';
import {Ordenes} from '../ordenes/esquemas/ordenes.entity';
import {OrdenesProductos} from '../ordenes-productos/esquemas/ordenes-productos.entity';
import {FacturasVentas} from '../facturas-ventas/esquemas/facturas-ventas.entity';
import {FacturasPagos} from '../facturas-pagos/esquemas/facturas-pagos.entity';
import {getBogotaDateString} from '../common/utils/date.utils';

@Injectable()
export class EstadisticasService {
	constructor(
		@InjectRepository(Ordenes)
		private readonly ordenesRepo: Repository<Ordenes>,
		@InjectRepository(OrdenesProductos)
		private readonly opRepo: Repository<OrdenesProductos>,
		@InjectRepository(FacturasVentas)
		private readonly facturasRepo: Repository<FacturasVentas>,
		@InjectRepository(FacturasPagos)
		private readonly pagosRepo: Repository<FacturasPagos>,
	) {}

	private buildDayBounds(from: string, to: string) {
		const start = from.includes('T') ? new Date(from) : new Date(`${from}T00:00:00-05:00`);
		const end = to.includes('T') ? new Date(to) : new Date(`${to}T23:59:59.999-05:00`);
		return {start, end};
	}

	// ─── Detalle de Facturas ──────────────────────────────────────────────────────
	async facturasDetalle(from: string, to: string) {
		const {start, end} = this.buildDayBounds(from, to);
		return this.facturasRepo.find({
			where: {
				fechaFactura: Between(start, end),
				estado: In(['pagado', 'pagada']),
			},
			order: {fechaFactura: 'ASC'},
		});
	}
}
