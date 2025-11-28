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

	findAll() {
		return this.repo.find();
	}

	findOne(telefono: string) {
		return this.repo.findOneBy({telefono});
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
