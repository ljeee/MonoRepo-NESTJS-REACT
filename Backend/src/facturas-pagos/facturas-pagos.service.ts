import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {FacturasPagos} from "./esquemas/facturas-pagos.entity";
import {CreateFacturasPagosDto} from "./esquemas/facturas-pagos.dto";

@Injectable()
export class FacturasPagosService {
	constructor(
		@InjectRepository(FacturasPagos)
		private readonly repo: Repository<FacturasPagos>,
	) {}

	findAll() {
		return this.repo.find();
	}

	findByDay() {
		// fechaFactura is a date column
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo.createQueryBuilder('p')
			.where('p.fechaFactura BETWEEN :start AND :end', { start, end })
			.getMany();
	}

	findPendingByDay() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo.createQueryBuilder('p')
			.where('(p.estado = :pendiente OR p.estado IS NULL)')
			.andWhere('p.fechaFactura BETWEEN :start AND :end', { start, end, pendiente: 'pendiente' })
			.getMany();
	}

	findOne(id: number) {
		return this.repo.findOneBy({pagosId: id});
	}

	create(data: CreateFacturasPagosDto) {
		return this.repo.save(data);
	}

	update(id: number, data: Partial<CreateFacturasPagosDto>) {
		return this.repo.update(id, data);
	}

	remove(id: number) {
		return this.repo.delete(id);
	}
}
