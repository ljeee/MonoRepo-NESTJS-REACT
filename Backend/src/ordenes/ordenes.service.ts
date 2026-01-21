import {BadRequestException, Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, Between} from 'typeorm';
import {Ordenes} from './esquemas/ordenes.entity';
import {CreateOrdenesDto, CreateOrdenItemDto} from './esquemas/ordenes.dto';
import {FacturasVentas} from '../facturas-ventas/esquemas/facturas-ventas.entity';
import {Domicilios} from '../domicilios/esquemas/domicilios.entity';
import {Clientes} from '../clientes/esquemas/clientes.entity';
import {Domiciliarios} from '../domiciliarios/esquemas/domiciliarios.entity';
import {Productos} from '../productos/esquemas/productos.entity';
import {OrdenesProductos} from '../ordenes-productos/esquemas/ordenes-productos.entity';

@Injectable()
export class OrdenesService {
	private readonly PRECIOS_PIZZA: Record<string, number> = {
		pequena: 15000,
		mediana: 28000,
		grande: 40000,
	};

	constructor(
		@InjectRepository(Ordenes) private readonly repo: Repository<Ordenes>,
		@InjectRepository(FacturasVentas) private readonly facturasRepo: Repository<FacturasVentas>,
		@InjectRepository(Domicilios) private readonly domiciliosRepo: Repository<Domicilios>,
		@InjectRepository(Clientes) private readonly clientesRepo: Repository<Clientes>,
		@InjectRepository(Domiciliarios) private readonly domiciliariosRepo: Repository<Domiciliarios>,
		@InjectRepository(Productos) private readonly productosRepo: Repository<Productos>,
		@InjectRepository(OrdenesProductos) private readonly ordenesProductosRepo: Repository<OrdenesProductos>,
	) {}

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
		return this.repo
			.createQueryBuilder('o')
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
		return this.repo.findOne({
			where: {ordenId: id},
			relations: ['factura', 'productos', 'productos.productoObj', 'domicilios'],
		});
	}

	// ==================== OPERACIONES ATÓMICAS ====================

	private esDomicilio(tipoPedido?: string): boolean {
		return (tipoPedido || 'mesa') === 'domicilio';
	}

	private construirNombreProducto(item: CreateOrdenItemDto): string {
		if (item.tipo?.toLowerCase() === 'pizza') {
			let nombre = `${item.tipo} ${item.tamano ?? ''} ${item.sabor1 ?? ''}`.trim();
			if (item.sabor2) nombre += ` y ${item.sabor2}`;
			if (item.sabor3) nombre += ` y ${item.sabor3}`;
			return nombre;
		}

		let nombre = (item.tipo ?? 'Producto').trim();
		if (item.tamano) nombre += ` ${item.tamano}`;
		if (item.sabor1) nombre += ` ${item.sabor1}`;
		if (item.sabor2) nombre += ` y ${item.sabor2}`;
		if (item.sabor3) nombre += ` y ${item.sabor3}`;
		return nombre;
	}

	private calcularPrecioProducto(item: CreateOrdenItemDto): number {
		if (item.tipo?.toLowerCase() === 'pizza') {
			return this.PRECIOS_PIZZA[(item.tamano || '').toLowerCase()] ?? 0;
		}
		return 0;
	}

	private generarDescripcionFactura(productos: CreateOrdenItemDto[]): string {
		return productos.map((p) => `${p.cantidad ?? 1} ${this.construirNombreProducto(p)}`).join(', ');
	}

	private async crearFactura(clienteNombre: string, metodo?: string, descripcion?: string): Promise<FacturasVentas> {
		return this.facturasRepo.save(
			this.facturasRepo.create({
				clienteNombre,
				metodo: metodo ?? undefined,
				descripcion: descripcion || undefined,
			}),
		);
	}

	private async crearOrden(facturaId: number, tipoPedido?: string, estadoOrden?: string): Promise<Ordenes> {
		const orden = this.repo.create({facturaId, tipoPedido, estadoOrden});
		return this.repo.save(orden);
	}

	private async upsertProducto(nombre: string, precio: number): Promise<Productos> {
		let prod = await this.productosRepo
			.createQueryBuilder('p')
			.where('LOWER(p.productoNombre) = LOWER(:nombre)', {nombre})
			.getOne();

		if (!prod) {
			prod = this.productosRepo.create({productoNombre: nombre, precio});
			return this.productosRepo.save(prod);
		}

		if (prod.productoNombre !== nombre || (precio > 0 && prod.precio !== precio)) {
			prod.productoNombre = nombre;
			if (precio > 0) prod.precio = precio;
			return this.productosRepo.save(prod);
		}

		return prod;
	}

	private async vincularProductoAOrden(ordenId: number, nombre: string, cantidad: number): Promise<void> {
		await this.ordenesProductosRepo.save(this.ordenesProductosRepo.create({ordenId, producto: nombre, cantidad}));
	}

	private async procesarProductos(ordenId: number, productos: CreateOrdenItemDto[]): Promise<void> {
		for (const item of productos) {
			const nombre = this.construirNombreProducto(item);
			const precio = this.calcularPrecioProducto(item);
			await this.upsertProducto(nombre, precio);
			await this.vincularProductoAOrden(ordenId, nombre, Number(item.cantidad) || 1);
		}
	}

	private async upsertCliente(telefono: string, nombre?: string, direccion?: string): Promise<Clientes> {
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

	private async upsertDomiciliario(telefono: string): Promise<Domiciliarios> {
		let domiciliario = await this.domiciliariosRepo.findOne({where: {telefono}});
		if (!domiciliario) {
			domiciliario = new Domiciliarios();
			domiciliario.telefono = telefono;
			return this.domiciliariosRepo.save(domiciliario);
		}

		return domiciliario;
	}

	private async crearDomicilio(
		facturaId: number,
		ordenId: number,
		telefonoCliente: string,
		telefonoDomiciliario: string,
		direccion?: string,
	): Promise<Domicilios> {
		return this.domiciliosRepo.save(
			this.domiciliosRepo.create({
				facturaId,
				ordenId,
				fechaCreado: new Date(),
				telefono: telefonoCliente,
				telefonoDomiciliarioAsignado: telefonoDomiciliario,
				direccionEntrega: direccion,
			}),
		);
	}

	private validarDatosDomicilio(data: CreateOrdenesDto): void {
		if (!data.telefonoCliente) {
			throw new BadRequestException('telefonoCliente es requerido cuando tipoPedido es domicilio');
		}
		if (!data.telefonoDomiciliario) {
			throw new BadRequestException('telefonoDomiciliario es requerido cuando tipoPedido es domicilio');
		}
	}

	private async procesarDomicilio(data: CreateOrdenesDto, facturaId: number, ordenId: number): Promise<void> {
		this.validarDatosDomicilio(data);

		await this.upsertCliente(data.telefonoCliente, data.nombreCliente, data.direccionCliente);
		await this.upsertDomiciliario(data.telefonoDomiciliario);
		await this.crearDomicilio(
			facturaId,
			ordenId,
			data.telefonoCliente,
			data.telefonoDomiciliario,
			data.direccionCliente,
		);
	}

	// ==================== MÉTODO PRINCIPAL ====================

	async create(data: CreateOrdenesDto) {
		const productos = Array.isArray(data.productos) ? data.productos : [];
		const descripcion = productos.length > 0 ? this.generarDescripcionFactura(productos) : '';

		// 1. Crear factura
		const factura = await this.crearFactura(data.nombreCliente || '', data.metodo, descripcion);

		// 2. Crear orden
		const orden = await this.crearOrden(factura.facturaId, data.tipoPedido, data.estadoOrden);

		// 3. Procesar productos
		if (productos.length > 0) {
			await this.procesarProductos(orden.ordenId, productos);
		}

		// 4. Procesar domicilio si aplica
		if (this.esDomicilio(data.tipoPedido)) {
			await this.procesarDomicilio(data, factura.facturaId, orden.ordenId);
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
