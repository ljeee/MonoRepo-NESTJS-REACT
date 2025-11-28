import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Productos} from "./esquemas/productos.entity";
import {CreateProductosDto} from "./esquemas/productos.dto";

@Injectable()
export class ProductosService {
	constructor(
		// eslint-disable-next-line prettier/prettier
		@InjectRepository(Productos)
		private readonly repo: Repository<Productos>,
	) {}

	findAll() {
		return this.repo.find();
	}

	findOne(productoNombre: string) {
		return this.repo.findOneBy({productoNombre});
	}

	create(data: CreateProductosDto) {
		return this.repo.save(data);
	}

	update(productoNombre: string, data: Partial<CreateProductosDto>) {
		return this.repo.update(productoNombre, data);
	}

	remove(productoNombre: string) {
		return this.repo.delete(productoNombre);
	}
}
