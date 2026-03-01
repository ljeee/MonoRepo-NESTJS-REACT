import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clientes } from '../../clientes/esquemas/clientes.entity';
import { Domiciliarios } from '../../domiciliarios/esquemas/domiciliarios.entity';
import { Domicilios } from '../../domicilios/esquemas/domicilios.entity';
import { CreateOrdenesDto } from '../esquemas/ordenes.dto';

@Injectable()
export class DomicilioCreationService {
	constructor(
		@InjectRepository(Clientes) private readonly clientesRepo: Repository<Clientes>,
		@InjectRepository(Domiciliarios) private readonly domiciliariosRepo: Repository<Domiciliarios>,
		@InjectRepository(Domicilios) private readonly domiciliosRepo: Repository<Domicilios>,
	) {}

	esDomicilio(tipoPedido?: string): boolean {
		return (tipoPedido || 'mesa') === 'domicilio';
	}

	async upsertCliente(telefono: string, nombre?: string, direccion?: string): Promise<Clientes> {
		let cliente = await this.clientesRepo.findOne({where: {telefono}});

		if (!cliente) {
			cliente = new Clientes();
			cliente.telefono = telefono;
			if (nombre) cliente.clienteNombre = nombre;
			if (direccion) cliente.direccion = direccion;
			return this.clientesRepo.save(cliente);
		}

		if (direccion) {
			const nueva = direccion.trim();
			const existentes = [cliente.direccion, cliente.direccionDos, cliente.direccionTres].filter(Boolean);

			if (nueva && !existentes.includes(nueva)) {
				if (!cliente.direccionDos) cliente.direccionDos = nueva;
				else if (!cliente.direccionTres) cliente.direccionTres = nueva;
				return this.clientesRepo.save(cliente);
			}
		}

		return cliente;
	}

	async upsertDomiciliario(telefono: string): Promise<Domiciliarios> {
		let domiciliario = await this.domiciliariosRepo.findOne({where: {telefono}});
		if (!domiciliario) {
			domiciliario = new Domiciliarios();
			domiciliario.telefono = telefono;
			return this.domiciliariosRepo.save(domiciliario);
		}

		return domiciliario;
	}

	async crearDomicilio(
		facturaId: number,
		ordenId: number,
		telefonoCliente: string,
		telefonoDomiciliario: string,
		direccion?: string,
		costoDomicilio?: number,
	): Promise<Domicilios> {
		return this.domiciliosRepo.save(
			this.domiciliosRepo.create({
				facturaId,
				ordenId,
				fechaCreado: new Date(),
				telefono: telefonoCliente,
				telefonoDomiciliarioAsignado: telefonoDomiciliario,
				direccionEntrega: direccion,
				costoDomicilio: costoDomicilio || 0,
			}),
		);
	}

	validarDatosDomicilio(data: CreateOrdenesDto): void {
		if (!data.telefonoCliente) {
			throw new BadRequestException('telefonoCliente es requerido cuando tipoPedido es domicilio');
		}
		if (!data.telefonoDomiciliario) {
			throw new BadRequestException('telefonoDomiciliario es requerido cuando tipoPedido es domicilio');
		}
	}

	async procesarDomicilio(data: CreateOrdenesDto, facturaId: number, ordenId: number): Promise<void> {
		this.validarDatosDomicilio(data);

		await this.upsertCliente(data.telefonoCliente, data.nombreCliente, data.direccionCliente);
		await this.upsertDomiciliario(data.telefonoDomiciliario);
		await this.crearDomicilio(
			facturaId,
			ordenId,
			data.telefonoCliente,
			data.telefonoDomiciliario,
			data.direccionCliente,
			data.costoDomicilio,
		);
	}
}
