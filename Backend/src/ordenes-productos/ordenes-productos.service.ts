import {Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {OrdenesProductos} from './esquemas/ordenes-productos.entity';
import {CreateOrdenesProductosDto} from './esquemas/ordenes-productos.dto';

@Injectable()
export class OrdenesProductosService {
	constructor(
		@InjectRepository(OrdenesProductos)
		private readonly repo: Repository<OrdenesProductos>,
	) {}

	findAll(page = 1, limit = 500) {
		return this.repo.find({
			take: limit,
			skip: (page - 1) * limit,
			relations: ['orden', 'productoObj']
		});
	}

	async findOne(id: number) {
		const result = await this.repo.findOne({
			where: {id},
			relations: ['orden', 'productoObj'],
		});
		if (!result) {
			throw new NotFoundException(`OrdenProducto con ID ${id} no encontrado`);
		}
		return result;
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
