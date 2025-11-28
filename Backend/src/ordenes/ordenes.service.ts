import {BadRequestException, Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, Between} from 'typeorm';
import {Ordenes} from './esquemas/ordenes.entity';
import {CreateOrdenesDto} from './esquemas/ordenes.dto';
import {FacturasVentas} from '../facturas-ventas/esquemas/facturas-ventas.entity';
import {Domicilios} from '../domicilios/esquemas/domicilios.entity';
import {Clientes} from '../clientes/esquemas/clientes.entity';
import {Domiciliarios} from '../domiciliarios/esquemas/domiciliarios.entity';
import {Productos} from '../productos/esquemas/productos.entity';
import {OrdenesProductos} from '../ordenes-productos/esquemas/ordenes-productos.entity';

@Injectable()
export class OrdenesService {
	repo: Repository<Ordenes>;
	facturasRepo: Repository<FacturasVentas>;
	domiciliosRepo: Repository<Domicilios>;
	clientesRepo: Repository<Clientes>;
	domiciliariosRepo: Repository<Domiciliarios>;
	productosRepo: Repository<Productos>;
	ordenesProductosRepo: Repository<OrdenesProductos>;

	constructor(
		@InjectRepository(Ordenes) repo: Repository<Ordenes>,
		@InjectRepository(FacturasVentas) facturasRepo: Repository<FacturasVentas>,
		@InjectRepository(Domicilios) domiciliosRepo: Repository<Domicilios>,
		@InjectRepository(Clientes) clientesRepo: Repository<Clientes>,
		@InjectRepository(Domiciliarios) domiciliariosRepo: Repository<Domiciliarios>,
		@InjectRepository(Productos) productosRepo: Repository<Productos>,
		@InjectRepository(OrdenesProductos) ordenesProductosRepo: Repository<OrdenesProductos>,
	) {
		this.repo = repo;
		this.facturasRepo = facturasRepo;
		this.domiciliosRepo = domiciliosRepo;
		this.clientesRepo = clientesRepo;
		this.domiciliariosRepo = domiciliariosRepo;
		this.productosRepo = productosRepo;
		this.ordenesProductosRepo = ordenesProductosRepo;
	}

	findAll() {
		return this.repo.find({relations: ['factura', 'productos', 'productos.productoObj']});
	}

	findByDay() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo.find({
			where: {
				fechaOrden: Between(start, end),
			},
			relations: ['factura', 'productos', 'productos.productoObj'],
		});
	}

	findByDaySinPendientes() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo.createQueryBuilder('o')
			.leftJoinAndSelect('o.factura', 'factura')
			.leftJoinAndSelect('o.productos', 'op')
			.leftJoinAndSelect('op.productoObj', 'productoObj')
			.where('o.fechaOrden BETWEEN :start AND :end', {start, end})
			.andWhere('o.estadoOrden != :pendiente', {pendiente: 'pendiente'})
			.getMany();
	}

	findPendingByDay() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo
			.createQueryBuilder('o')
			.leftJoinAndSelect('o.factura', 'factura')
			.leftJoinAndSelect('o.productos', 'op')
			.where('(o.estadoOrden = :pendiente OR o.estadoOrden IS NULL)')
			.andWhere('o.fechaOrden BETWEEN :start AND :end', {start, end, pendiente: 'pendiente'})
			.getMany();
	}

	findOne(id: number) {
		return this.repo.findOne({where: {ordenId: id}, relations: ['factura', 'productos', 'productos.productoObj', 'domicilios']});
	}

	async create(data: CreateOrdenesDto) {
		// Determinar nombre del cliente para la factura

		let clienteNombreFactura = '';
		if ((data.tipoPedido || 'mesa') === 'domicilio') {
			clienteNombreFactura = data.nombreCliente || '';
		} else {
			// Si es mesa, guardar solo el número de mesa
			clienteNombreFactura = data.nombreCliente || '';
		}

		// Preparar productos tipados y descripción de productos para la factura
		const prods = Array.isArray(data.productos) ? data.productos : [];
		let descripcionFactura = '';
		if (prods.length > 0) {
			descripcionFactura = prods
				.map((p) => {
					const cant = p.cantidad ?? 1;
					const tipo = p.tipo || '';
					if (tipo.toLowerCase() === 'pizza') {
						let nombre = `${p.tipo} ${p.tamano ?? ''} ${p.sabor1 ?? ''}`.trim();
						if (p.sabor2) nombre += ` y ${p.sabor2}`;
						if (p.sabor3) nombre += ` y ${p.sabor3}`;
						return `${cant} ${nombre}`;
					}
					// Otros tipos: formar nombre con tipo + sabores/opciones
					let nombre = (p.tipo ?? '').trim();
					if (p.tamano) nombre += ` ${p.tamano}`;
					if (p.sabor1) nombre += ` ${p.sabor1}`;
					if (p.sabor2) nombre += ` y ${p.sabor2}`;
					if (p.sabor3) nombre += ` y ${p.sabor3}`;
					return `${cant} ${nombre}`.trim();
				})
				.join(', ');
		}

		// Crear factura primero, incluyendo método de pago y descripción
		const factura = await this.facturasRepo.save(
			this.facturasRepo.create({
				clienteNombre: clienteNombreFactura,
				metodo: data.metodo ?? undefined,
				descripcion: descripcionFactura || undefined,
			}),
		);

		// Crear orden ligada a la factura
		const orden = this.repo.create({
			facturaId: factura.facturaId,
			tipoPedido: data.tipoPedido,
			estadoOrden: data.estadoOrden,
		});
		await this.repo.save(orden);

		// Registrar productos (pizzas de uno o dos sabores)
		const preciosPorTamano: Record<string, number> = {
			pequena: 15000,
			mediana: 28000,
			grande: 40000,
		};
		// totalFactura eliminado, el total lo calcula la base de datos
		const productos = prods;
		for (const item of productos) {
			let nombre: string;
			let precio: number = 0;
			if (item.tipo && item.tipo.toLowerCase() === 'pizza') {
				// Pizza: usar formato extendido con hasta 3 sabores
				const {tipo, tamano, sabor1, sabor2, sabor3} = item;
				nombre = `${tipo} ${tamano} ${sabor1 ? sabor1 : ''}`;
				if (sabor2) nombre += ` y ${sabor2}`;
				if (sabor3) nombre += ` y ${sabor3}`;
				precio = preciosPorTamano[(tamano || '').toLowerCase()] ?? 0;
			} else if (item.tipo) {
				// Otros productos: usar tipo como nombre
				nombre = item.tipo;
				// Añadir opciones/sabores si vienen
				if (item.tamano) nombre += ` ${item.tamano}`;
				if (item.sabor1) nombre += ` ${item.sabor1}`;
				if (item.sabor2) nombre += ` y ${item.sabor2}`;
				if (item.sabor3) nombre += ` y ${item.sabor3}`;
				precio = 0;
			} else {
				// Respaldo: nombre genérico
				nombre = 'Producto';
			}
			// buscar producto (case-insensitive para encontrar variantes con diferente capitalización)
			let prod = await this.productosRepo
				.createQueryBuilder('p')
				.where('LOWER(p.productoNombre) = LOWER(:nombre)', {nombre})
				.getOne();
			if (!prod) {
				// No existe, crear nuevo
				prod = this.productosRepo.create({productoNombre: nombre, precio});
				await this.productosRepo.save(prod);
			} else if (prod.productoNombre !== nombre) {
				// Existe pero con diferente capitalización, actualizar
				prod.productoNombre = nombre;
				if (precio > 0) prod.precio = precio;
				await this.productosRepo.save(prod);
			}
			// solo relacionar producto existente o nuevo a la orden
			await this.ordenesProductosRepo.save(
				this.ordenesProductosRepo.create({
					ordenId: orden.ordenId,
					producto: nombre,
					cantidad: Number(item.cantidad) ?? 1,
				}),
			);
		}
		// actualizar solo la descripción en factura (el total lo maneja el trigger de la base de datos)
		if (descripcionFactura) {
			await this.facturasRepo.update({facturaId: factura.facturaId}, {descripcion: descripcionFactura});
			factura.descripcion = descripcionFactura;
		}

		// Si es domicilio, gestionar cliente, domiciliario y registro de domicilio
		if ((data.tipoPedido || 'mesa') === 'domicilio') {
			console.log('=== CREANDO DOMICILIO ===');
			console.log('telefonoCliente:', data.telefonoCliente);
			console.log('telefonoDomiciliario:', data.telefonoDomiciliario);
			console.log('direccionCliente:', data.direccionCliente);
			
			if (!data.telefonoCliente) {
				throw new BadRequestException('telefonoCliente es requerido cuando tipoPedido es domicilio');
			}
			if (!data.telefonoDomiciliario) {
				throw new BadRequestException('telefonoDomiciliario es requerido cuando tipoPedido es domicilio');
			}

			// Upsert cliente
			// Upsert cliente
			let cliente = await this.clientesRepo.findOne({where: {telefono: data.telefonoCliente}});
			if (!cliente) {
				cliente = new Clientes();
				cliente.telefono = data.telefonoCliente;
				if (data.nombreCliente !== undefined) {
					cliente.clienteNombre = data.nombreCliente;
				}
				if (data.direccionCliente !== undefined) {
					cliente.direccion = data.direccionCliente;
				}
				await this.clientesRepo.save(cliente);
			} else if (data.direccionCliente) {
				// Cliente existe: si hay nueva dirección y no está registrada, guardarla en direccion_dos o direccion_tres
				const nueva = (data.direccionCliente || '').trim();
				const existentes = [cliente.direccion, cliente.direccionDos, cliente.direccionTres].filter(
					Boolean,
				);
				if (nueva && !existentes.includes(nueva)) {
					if (!cliente.direccionDos) {
						cliente.direccionDos = nueva;
					} else if (!cliente.direccionTres) {
						cliente.direccionTres = nueva;
					}
					await this.clientesRepo.save(cliente);
				}
			}

			// Asegurar domiciliario (crearlo si no existe)
			let domiciliario = await this.domiciliariosRepo.findOne({where: {telefono: data.telefonoDomiciliario}});
			if (!domiciliario) {
				domiciliario = new Domiciliarios();
				domiciliario.telefono = data.telefonoDomiciliario;
				await this.domiciliariosRepo.save(domiciliario);
			}

			// Crear registro de domicilio
			console.log('Guardando domicilio con datos:', {
				facturaId: factura.facturaId,
				ordenId: orden.ordenId,
				telefono: data.telefonoCliente,
				telefonoDomiciliario: data.telefonoDomiciliario,
				direccion: data.direccionCliente,
			});
			
			const domicilio = await this.domiciliosRepo.save(
				this.domiciliosRepo.create({
					facturaId: factura.facturaId,
					ordenId: orden.ordenId,
					fechaCreado: new Date(),
					telefono: data.telefonoCliente,
					telefonoDomiciliarioAsignado: data.telefonoDomiciliario,
					direccionEntrega: data.direccionCliente,
				}),
			);
			
			console.log('Domicilio guardado exitosamente:', domicilio);
		}

		return {...orden, factura};
	}

	async update(id: number, data: Partial<CreateOrdenesDto>) {
		await this.repo.update(id, data);
		// Return the updated order with relations
		return this.findOne(id);
	}

	remove(id: number) {
		return this.repo.delete(id);
	}
}
