import {Injectable, NotFoundException} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Clientes} from "./esquemas/clientes.entity";
import {ClienteDirecciones} from "./esquemas/cliente-direcciones.entity";
import {CreateClientesDto} from "./esquemas/clientes.dto";

@Injectable()
export class ClientesService {
	constructor(
		@InjectRepository(Clientes)
		private readonly repo: Repository<Clientes>,
		@InjectRepository(ClienteDirecciones)
		private readonly direccionesRepo: Repository<ClienteDirecciones>,
	) {}

	findAll(page = 1, limit = 500) {
		return this.repo.find({
			take: limit,
			skip: (page - 1) * limit,
			relations: ['direcciones', 'domicilios'],
			order: {telefono: 'ASC'},
		});
	}

	async findOne(telefono: string) {
		const cliente = await this.repo.findOne({
			where: { telefono },
			relations: ['direcciones', 'domicilios'],
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

	// ─── Direcciones ──────────────────────────────────────────────

	async getDirecciones(telefono: string): Promise<ClienteDirecciones[]> {
		return this.direccionesRepo.find({
			where: {telefonoCliente: telefono},
			order: {id: 'DESC'},
		});
	}

	async addDireccion(telefono: string, direccion: string): Promise<ClienteDirecciones> {
		const trimmed = direccion.trim();

		// No duplicar
		const existe = await this.direccionesRepo.findOne({
			where: {telefonoCliente: telefono, direccion: trimmed},
		});
		if (existe) return existe;

		return this.direccionesRepo.save({
			telefonoCliente: telefono,
			direccion: trimmed,
		});
	}

	async removeDireccion(id: number) {
		return this.direccionesRepo.delete(id);
	}
}
