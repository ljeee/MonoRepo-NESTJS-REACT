import {Injectable, NotFoundException} from "@nestjs/common";
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

	findAll(page = 1, limit = 500) {
		return this.repo.find({
			take: limit,
			skip: (page - 1) * limit,
			relations: ['domicilios']
		});
	}

	async findOne(telefono: string) {
		const cliente = await this.repo.findOne({
			where: { telefono },
			relations: ['domicilios']
		});
		if (!cliente) {
			throw new NotFoundException(`Cliente con teléfono ${telefono} no encontrado`);
		}
		return cliente;
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
