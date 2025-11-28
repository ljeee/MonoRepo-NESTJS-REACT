import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {FacturasVentas} from "./esquemas/facturas-ventas.entity";
import {CreateFacturasVentasDto} from "./esquemas/facturas-ventas.dto";

@Injectable()
export class FacturasVentasService {
	constructor(
		@InjectRepository(FacturasVentas)
		private readonly repo: Repository<FacturasVentas>,
	) {}

	findAll() {
		return this.repo.find();
	}

	findByDay() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo.createQueryBuilder('f')
			.where('f.fechaFactura BETWEEN :start AND :end', { start, end })
			.getMany();
	}

	findPendingByDay() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo.createQueryBuilder('f')
			.where('(f.estado = :pendiente OR f.estado IS NULL)')
			.andWhere('f.fechaFactura BETWEEN :start AND :end', { start, end, pendiente: 'pendiente' })
			.getMany();
	}

	findOne(id: number) {
		return this.repo.findOneBy({facturaId: id});
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
