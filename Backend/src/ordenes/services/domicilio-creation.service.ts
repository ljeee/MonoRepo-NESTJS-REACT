import {BadRequestException, Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {EntityManager, Repository} from 'typeorm';
import {Clientes} from '../../clientes/esquemas/clientes.entity';
import {ClienteDirecciones} from '../../clientes/esquemas/cliente-direcciones.entity';
import {Domiciliarios} from '../../domiciliarios/esquemas/domiciliarios.entity';
import {Domicilios} from '../../domicilios/esquemas/domicilios.entity';
import {CreateOrdenesDto} from '../esquemas/ordenes.dto';

@Injectable()
export class DomicilioCreationService {
	constructor(
		@InjectRepository(Clientes) private readonly clientesRepo: Repository<Clientes>,
		@InjectRepository(ClienteDirecciones) private readonly direccionesRepo: Repository<ClienteDirecciones>,
		@InjectRepository(Domiciliarios) private readonly domiciliariosRepo: Repository<Domiciliarios>,
		@InjectRepository(Domicilios) private readonly domiciliosRepo: Repository<Domicilios>,
	) {}

	esDomicilio(tipoPedido?: string): boolean {
		return (tipoPedido || 'mesa') === 'domicilio';
	}

	async upsertCliente(
		telefono: string,
		nombre?: string,
		direccion?: string,
		referencia?: string,
		latitud?: number,
		longitud?: number,
		manager?: EntityManager,
		direccionId?: number,
		costoDomicilio?: number,
	): Promise<Clientes> {
		const cRepo = manager ? manager.getRepository(Clientes) : this.clientesRepo;
		const dRepo = manager ? manager.getRepository(ClienteDirecciones) : this.direccionesRepo;

		let cliente = await cRepo.findOne({where: {telefono}});

		if (!cliente) {
			cliente = new Clientes();
			cliente.telefono = telefono;
			if (nombre) cliente.clienteNombre = nombre;
			await cRepo.save(cliente);
		}

		// Autoguardar o actualizar dirección
		if (direccion?.trim()) {
			const trimmed = direccion.trim();
			let existe: ClienteDirecciones | null = null;

			if (direccionId) {
				existe = await dRepo.findOne({
					where: {id: direccionId, telefonoCliente: telefono},
				});
			}

			if (!existe) {
				existe = await dRepo.findOne({
					where: {telefonoCliente: telefono, direccion: trimmed},
				});
			}

			if (!existe) {
				await dRepo.save({
					telefonoCliente: telefono,
					direccion: trimmed,
					referencia: referencia,
					costoDomicilio: costoDomicilio,
					latitud: latitud,
					longitud: longitud,
				});
			} else {
				let updated = false;
				if (existe.direccion !== trimmed) {
					existe.direccion = trimmed;
					updated = true;
				}
				if (referencia !== undefined && existe.referencia !== referencia) {
					existe.referencia = referencia;
					updated = true;
				}
				if (costoDomicilio !== undefined && existe.costoDomicilio !== costoDomicilio) {
					existe.costoDomicilio = costoDomicilio;
					updated = true;
				}
				if (latitud !== undefined && existe.latitud !== latitud) {
					existe.latitud = latitud;
					updated = true;
				}
				if (longitud !== undefined && existe.longitud !== longitud) {
					existe.longitud = longitud;
					updated = true;
				}
				if (updated) await dRepo.save(existe);
			}
		}

		return cliente;
	}

	async upsertDomiciliario(telefono: string, manager?: EntityManager): Promise<Domiciliarios> {
		const repo = manager ? manager.getRepository(Domiciliarios) : this.domiciliariosRepo;
		let domiciliario = await repo.findOne({where: {telefono}});
		if (!domiciliario) {
			domiciliario = new Domiciliarios();
			domiciliario.telefono = telefono;
			return repo.save(domiciliario);
		}

		return domiciliario;
	}

	async crearDomicilio(
		facturaId: number,
		ordenId: number,
		telefonoCliente: string,
		telefonoDomiciliario: string | undefined,
		direccion?: string,
		referencia?: string,
		costoDomicilio?: number,
		latitud?: number,
		longitud?: number,
		manager?: EntityManager,
	): Promise<Domicilios> {
		const repo = manager ? manager.getRepository(Domicilios) : this.domiciliosRepo;
		return repo.save(
			repo.create({
				facturaId,
				ordenId,
				fechaCreado: new Date(),
				telefono: telefonoCliente,
				telefonoDomiciliarioAsignado: telefonoDomiciliario,
				direccionEntrega: direccion,
				referenciaDomicilio: referencia,
				costoDomicilio: costoDomicilio || 0,
				latitud: latitud,
				longitud: longitud,
			}),
		);
	}

	validarDatosDomicilio(data: CreateOrdenesDto): void {
		if (!data.telefonoCliente) {
			throw new BadRequestException('telefonoCliente es requerido cuando tipoPedido es domicilio');
		}
	}

	async procesarDomicilio(
		data: CreateOrdenesDto,
		facturaId: number,
		ordenId: number,
		manager?: EntityManager,
	): Promise<void> {
		this.validarDatosDomicilio(data);

		const referencia = data.referenciaCliente ?? data.referenciaDomicilio;
		await this.upsertCliente(
			data.telefonoCliente,
			data.nombreCliente,
			data.direccionCliente,
			referencia,
			data.latitudCliente,
			data.longitudCliente,
			manager,
			data.direccionId,
			data.costoDomicilio,
		);
		if (data.telefonoDomiciliario) {
			await this.upsertDomiciliario(data.telefonoDomiciliario, manager);
		}
		await this.crearDomicilio(
			facturaId,
			ordenId,
			data.telefonoCliente,
			data.telefonoDomiciliario,
			data.direccionCliente,
			referencia,
			data.costoDomicilio,
			data.latitudCliente,
			data.longitudCliente,
			manager,
		);
	}

	async updateDomicilioPorOrden(
		ordenId: number,
		data: Partial<CreateOrdenesDto>,
		facturaId?: number,
		manager?: EntityManager,
	): Promise<void> {
		const repo = manager ? manager.getRepository(Domicilios) : this.domiciliosRepo;
		const domicilio = await repo.findOne({where: {ordenId}});

		if (!domicilio) {
			// Si deciden cambiar a domicilio una orden existente o no se habia creado
			if (data.telefonoCliente && data.telefonoDomiciliario && facturaId) {
				await this.procesarDomicilio(data as CreateOrdenesDto, facturaId, ordenId, manager);
			}
			return;
		}

		const referencia = data.referenciaCliente ?? data.referenciaDomicilio;

		const updateData: Partial<Domicilios> = {};
		if (data.direccionCliente !== undefined) updateData.direccionEntrega = data.direccionCliente;
		if (referencia !== undefined) updateData.referenciaDomicilio = referencia;
		if (data.telefonoCliente !== undefined) updateData.telefono = data.telefonoCliente;
		if (data.telefonoDomiciliario !== undefined)
			updateData.telefonoDomiciliarioAsignado = data.telefonoDomiciliario;
		if (data.costoDomicilio !== undefined) updateData.costoDomicilio = Number(data.costoDomicilio) || 0;
		if (data.latitudCliente !== undefined) updateData.latitud = data.latitudCliente;
		if (data.longitudCliente !== undefined) updateData.longitud = data.longitudCliente;

		if (Object.keys(updateData).length > 0) {
			await repo.update(domicilio.domicilioId, updateData);
		}

		if (
			data.telefonoCliente !== undefined ||
			data.nombreCliente !== undefined ||
			data.direccionCliente !== undefined ||
			referencia !== undefined ||
			data.latitudCliente !== undefined ||
			data.longitudCliente !== undefined ||
			data.costoDomicilio !== undefined
		) {
			await this.upsertCliente(
				data.telefonoCliente ?? domicilio.telefono,
				data.nombreCliente,
				data.direccionCliente ?? domicilio.direccionEntrega,
				referencia ?? domicilio.referenciaDomicilio,
				data.latitudCliente ?? domicilio.latitud,
				data.longitudCliente ?? domicilio.longitud,
				manager,
				data.direccionId,
				data.costoDomicilio !== undefined
					? Number(data.costoDomicilio)
					: domicilio.costoDomicilio !== undefined
						? Number(domicilio.costoDomicilio)
						: undefined,
			);
		}

		if (data.telefonoDomiciliario !== undefined) {
			await this.upsertDomiciliario(data.telefonoDomiciliario, manager);
		}
	}
}
