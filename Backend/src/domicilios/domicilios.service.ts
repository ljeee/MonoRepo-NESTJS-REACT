import {Injectable} from "@nestjs/common";
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

	findAll() {
		return this.repo.find();
	}

	findByDay() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo.createQueryBuilder('d')
			.where('d.fechaCreado BETWEEN :start AND :end', { start, end })
			.getMany();
	}

	findPendingByDay() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo.createQueryBuilder('d')
			.where('(d.estadoDomicilio = :pendiente OR d.estadoDomicilio IS NULL)')
			.andWhere('d.fechaCreado BETWEEN :start AND :end', { start, end, pendiente: 'pendiente' })
			.getMany();
	}

	findOne(id: number) {
		return this.repo.findOneBy({domicilioId: id});
	}

	create(data: CreateDomiciliosDto) {
		return this.repo.save(data);
	}

	update(id: number, data: Partial<CreateDomiciliosDto>) {
		return this.repo.update(id, data);
	}

	remove(id: number) {
		return this.repo.delete(id);
	}
}
