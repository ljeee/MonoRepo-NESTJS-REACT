import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Domicilios} from "./esquemas/domicilios.entity";
import {CreateDomiciliosDto} from "./esquemas/domicilios.dto";
import {TelegramService} from "../common/telegram.service";

@Injectable()
export class DomiciliosService {
	constructor(
		@InjectRepository(Domicilios)
		private readonly repo: Repository<Domicilios>,
		private readonly telegramService: TelegramService,
	) {}

	findAll(page = 1, limit = 500) {
		return this.repo.find({
			take: limit,
			skip: (page - 1) * limit,
		});
	}

	findByDay() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo.createQueryBuilder('d')
			.leftJoinAndSelect('d.factura', 'factura')
			.leftJoinAndSelect('d.orden', 'orden')
			.leftJoinAndSelect('d.cliente', 'cliente')
			.leftJoinAndSelect('d.domiciliario', 'domiciliario')
			.where('d.fechaCreado BETWEEN :start AND :end', { start, end })
			.getMany();
	}

	findPendingByDay() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo.createQueryBuilder('d')
			.leftJoinAndSelect('d.factura', 'factura')
			.leftJoinAndSelect('d.orden', 'orden')
			.leftJoinAndSelect('d.cliente', 'cliente')
			.leftJoinAndSelect('d.domiciliario', 'domiciliario')
			.where('(d.estadoDomicilio = :pendiente OR d.estadoDomicilio IS NULL)')
			.andWhere('d.fechaCreado BETWEEN :start AND :end', { start, end, pendiente: 'pendiente' })
			.getMany();
	}

	findOne(id: number) {
		return this.repo.findOne({
			where: { domicilioId: id },
			relations: ['factura', 'orden', 'cliente', 'domiciliario']
		});
	}

	create(data: CreateDomiciliosDto) {
		return this.repo.save(data);
	}

	update(id: number, data: Partial<CreateDomiciliosDto>) {
		return this.repo.update(id, data);
	}

	async notificarEstadoCambio(id: number, nuevoEstado: string): Promise<void> {
		const domicilio = await this.findOne(id);
		
		if (!domicilio || !domicilio.telefonoDomiciliarioAsignado) {
			return;
		}

		const chatId = await this.telegramService.getChatIdFromPhone(domicilio.telefonoDomiciliarioAsignado);
		
		if (chatId) {
			const mensaje = `🔔 Actualización de domicilio\n\nEstado: ${nuevoEstado}\nDirección: ${domicilio.direccionEntrega || 'N/A'}`;
			await this.telegramService.sendDomicilioNotification(chatId, {
				clienteNombre: domicilio.cliente?.clienteNombre || 'Cliente',
				telefono: domicilio.telefono || 'N/A',
				direccion: domicilio.direccionEntrega || 'N/A',
				productos: `Estado actualizado a: ${nuevoEstado}`,
			});
		}
	}

	remove(id: number) {
		return this.repo.delete(id);
	}
}
