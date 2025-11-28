import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Clientes} from "./esquemas/clientes.entity";
import {CreateClientesDto} from "./esquemas/clientes.dto";

@Injectable()
export class ClientesService {
	constructor(
		@InjectRepository(Clientes)
		private readonly repo: Repository<Clientes>,
	) {}

	findAll() {
		return this.repo.find();
	}

	findOne(telefono: string) {
		return this.repo.findOneBy({telefono});
	}

	create(data: CreateClientesDto) {
		return this.repo.save(data);
	}

	update(telefono: string, data: Partial<CreateClientesDto>) {
		return this.repo.update(telefono, data);
	}

	remove(telefono: string) {
		return this.repo.delete(telefono);
	}
}
