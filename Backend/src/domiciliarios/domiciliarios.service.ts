import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Domiciliarios} from "./esquemas/domiciliarios.entity";
import {CreateDomiciliariosDto} from "./esquemas/domiciliarios.dto";

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
			relations: ['domicilios']
		});
	}

	findOne(telefono: string) {
		return this.repo.findOne({
			where: { telefono },
			relations: ['domicilios']
		});
	}

	create(data: CreateDomiciliariosDto) {
		return this.repo.save(data);
	}

	update(telefono: string, data: Partial<CreateDomiciliariosDto>) {
		return this.repo.update(telefono, data);
	}

	remove(telefono: string) {
		return this.repo.delete(telefono);
	}
}
