import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {OrdenesProductos} from "./esquemas/ordenes-productos.entity";
import {CreateOrdenesProductosDto} from "./esquemas/ordenes-productos.dto";

@Injectable()
export class OrdenesProductosService {
	constructor(
		@InjectRepository(OrdenesProductos)
		private readonly repo: Repository<OrdenesProductos>,
	) {}

	findAll() {
		return this.repo.find();
	}

	findOne(id: number) {
		return this.repo.findOneBy({id});
	}

	create(data: CreateOrdenesProductosDto) {
		return this.repo.save(data);
	}

	update(id: number, data: Partial<CreateOrdenesProductosDto>) {
		return this.repo.update(id, data);
	}

	remove(id: number) {
		return this.repo.delete(id);
	}
}
