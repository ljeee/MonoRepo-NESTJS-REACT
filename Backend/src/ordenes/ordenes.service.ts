import {BadRequestException, Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, Between} from 'typeorm';
import {Ordenes} from './esquemas/ordenes.entity';
import {CreateOrdenesDto, CreateOrdenItemDto, FindOrdenesDto} from './esquemas/ordenes.dto';
import {FacturasVentas} from '../facturas-ventas/esquemas/facturas-ventas.entity';
import {Domicilios} from '../domicilios/esquemas/domicilios.entity';
import {Clientes} from '../clientes/esquemas/clientes.entity';
import {Domiciliarios} from '../domiciliarios/esquemas/domiciliarios.entity';
import {Productos} from '../productos/esquemas/productos.entity';
import {ProductoVariantes} from '../productos/esquemas/producto-variantes.entity';
import {OrdenesProductos} from '../ordenes-productos/esquemas/ordenes-productos.entity';
import {OrdenesGateway} from './ordenes.gateway';
import {PizzaSaboresService} from '../pizza-sabores/pizza-sabores.service';

@Injectable()
export class OrdenesService {
	constructor(
		@InjectRepository(Ordenes) private readonly repo: Repository<Ordenes>,
		@InjectRepository(FacturasVentas) private readonly facturasRepo: Repository<FacturasVentas>,
		@InjectRepository(Domicilios) private readonly domiciliosRepo: Repository<Domicilios>,
		@InjectRepository(Clientes) private readonly clientesRepo: Repository<Clientes>,
		@InjectRepository(Domiciliarios) private readonly domiciliariosRepo: Repository<Domiciliarios>,
		@InjectRepository(Productos) private readonly productosRepo: Repository<Productos>,
		@InjectRepository(ProductoVariantes) private readonly variantesRepo: Repository<ProductoVariantes>,
		@InjectRepository(OrdenesProductos) private readonly ordenesProductosRepo: Repository<OrdenesProductos>,
		private readonly ordenesGateway: OrdenesGateway,
		private readonly pizzaSaboresService: PizzaSaboresService,
	) {}

	async findAll(query: FindOrdenesDto = {}) {
		const { estado, from, to, page = 1, limit = 500 } = query;
		const qb = this.repo.createQueryBuilder('o')
			.leftJoinAndSelect('o.factura', 'factura')
			.leftJoinAndSelect('o.productos', 'op')
			.leftJoinAndSelect('op.productoObj', 'productoObj')
			.orderBy('o.fechaOrden', 'DESC')
			.take(limit)
			.skip((page - 1) * limit);

		if (estado) {
			qb.andWhere('o.estadoOrden = :estado', { estado });
		}
		if (from && to) {
			qb.andWhere('o.fechaOrden BETWEEN :from AND :to', { from: new Date(from + 'T00:00:00'), to: new Date(to + 'T23:59:59') });
		} else if (from) {
			qb.andWhere('o.fechaOrden >= :from', { from: new Date(from + 'T00:00:00') });
		} else if (to) {
			qb.andWhere('o.fechaOrden <= :to', { to: new Date(to + 'T23:59:59') });
		}

		const [data, total] = await qb.getManyAndCount();
		return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
	}

	findByDay(estado?: string) {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		const qb = this.repo.createQueryBuilder('o')
			.leftJoinAndSelect('o.factura', 'factura')
			.leftJoinAndSelect('o.productos', 'op')
			.leftJoinAndSelect('op.productoObj', 'productoObj')
			.leftJoinAndSelect('o.domicilios', 'domicilios')
			.where('o.fechaOrden BETWEEN :start AND :end', { start, end });

		if (estado) {
			qb.andWhere('o.estadoOrden = :estado', { estado });
		}

		return qb.getMany();
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
			relations: ['factura', 'productos', 'productos.productoObj', 'productos.variante', 'domicilios'],
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
		// Legacy: precios hardcodeados para compatibilidad con formulario viejo
		// Los precios reales se obtienen de producto_variantes via varianteId
		if (item.tipo?.toLowerCase() === 'pizza' && item.tamano) {
			const precios: Record<string, number> = {
				pequena: 16000,
				mediana: 30000,
				grande: 43000,
			};
			return precios[(item.tamano || '').toLowerCase()] ?? 0;
		}
		if (item.tipo?.toLowerCase() === 'hamburguesa' && item.sabor1) {
			const precios: Record<string, number> = {
				sencilla: 17000,
				picosita: 20000,
				'doble carne': 22000,
			};
			return precios[(item.sabor1 || '').toLowerCase()] ?? 0;
		}
		if (item.tipo?.toLowerCase() === 'chuzo') return 27000;
		if (item.tipo?.toLowerCase() === 'torti burger') return 18000;
		return 0;
	}

	private async calcularRecargoSabores(item: CreateOrdenItemDto): Promise<number> {
		if (item.tipo?.toLowerCase() !== 'pizza') return 0;
		const saboresDeBD = await this.pizzaSaboresService.findAll();
		let recargoTotal = 0;
		
		const saboresActivos = [item.sabor1, item.sabor2, item.sabor3].filter(Boolean).map(s => (s as string).toLowerCase());
		const tamano = (item.tamano || 'grande').toLowerCase();

		for (const saborNombre of saboresActivos) {
			const saborMatch = saboresDeBD.find(s => s.nombre.toLowerCase() === saborNombre);
			if (saborMatch && saborMatch.tipo === 'especial') {
				if (tamano === 'pequena') recargoTotal += Number(saborMatch.recargoPequena || 0);
				else if (tamano === 'mediana') recargoTotal += Number(saborMatch.recargoMediana || 0);
				else recargoTotal += Number(saborMatch.recargoGrande || 0);
			}
		}

		if (saboresActivos.length >= 3) {
			const extra3Config = saboresDeBD.find(s => s.tipo === 'configuracion' && s.nombre === 'RECARGO_3_SABORES');
			recargoTotal += extra3Config ? Number(extra3Config.recargoGrande || 0) : 3000;
		}

		return recargoTotal;
	}

	private async obtenerPrecioVariante(varianteId: number): Promise<number> {
		const variante = await this.variantesRepo.findOne({where: {varianteId}});
		return variante?.precio ? Number(variante.precio) : 0;
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

	private async crearOrden(facturaId: number, tipoPedido?: string, estadoOrden?: string, observaciones?: string): Promise<Ordenes> {
		const orden = this.repo.create({facturaId, tipoPedido, estadoOrden, observaciones});
		return this.repo.save(orden);
	}

	private async upsertProducto(nombre: string, precio: number): Promise<Productos> {
		let prod = await this.productosRepo
			.createQueryBuilder('p')
			.where('LOWER(p.productoNombre) = LOWER(:nombre)', {nombre})
			.getOne();

		if (!prod) {
			prod = this.productosRepo.create({productoNombre: nombre, activo: true});
			prod = await this.productosRepo.save(prod);
		}

		// Update or create default price variant
		let variante = await this.variantesRepo.findOne({where: {productoId: prod.productoId}, order: {varianteId: 'ASC'}});
		
		if (!variante) {
			variante = this.variantesRepo.create({
				productoId: prod.productoId,
				nombre: 'Standard',
				precio: precio,
				activo: true
			});
			await this.variantesRepo.save(variante);
		} else if (precio > 0 && Number(variante.precio) !== precio) {
			variante.precio = precio;
			await this.variantesRepo.save(variante);
		}

		return prod;
	}

	private async vincularProductoAOrden(
		ordenId: number,
		nombre: string,
		cantidad: number,
		precioUnitario?: number,
		varianteId?: number,
	): Promise<void> {
		const item = new OrdenesProductos();
		item.ordenId = ordenId;
		item.producto = nombre;
		item.cantidad = cantidad;
		item.precioUnitario = precioUnitario ?? null;
		item.varianteId = varianteId ?? null;
		await this.ordenesProductosRepo.save(item);
	}

	private async procesarProductos(
		ordenId: number,
		productos: CreateOrdenItemDto[],
	): Promise<{total: number; items: {nombre: string; cantidad: number; precioUnitario: number}[]}> {
		let total = 0;
		const items: {nombre: string; cantidad: number; precioUnitario: number}[] = [];

		for (const item of productos) {
			let nombre = this.construirNombreProducto(item);
			let precio = 0;
			let varianteId: number | undefined;

			// Sistema nuevo: usar varianteId si existe
			if (item.varianteId) {
				const variante = await this.variantesRepo.findOne({
					where: {varianteId: item.varianteId},
					relations: ['producto'],
				});
				if (variante) {
					precio = Number(variante.precio);
					varianteId = item.varianteId;
					if (variante.producto) {
						nombre = `${variante.producto.productoNombre} - ${variante.nombre}`;
						const sabores = [item.sabor1, item.sabor2, item.sabor3].filter(Boolean);
						if (sabores.length > 0) {
							nombre += ` (${sabores.join(' + ')})`;
						}
					}
				}
			} else {
				// Sistema legacy: calcular precio por tipo/tamaño
				precio = this.calcularPrecioProducto(item);
				// Add recargos (Fase 4 server-side)
				const recargo = await this.calcularRecargoSabores(item);
				precio += recargo;
				
				await this.upsertProducto(nombre, precio);
			}

			const cantidad = Number(item.cantidad) || 1;
			total += precio * cantidad;

			await this.vincularProductoAOrden(ordenId, nombre, cantidad, precio, varianteId);
			items.push({nombre, cantidad, precioUnitario: precio});
		}

		return {total, items};
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
			data.costoDomicilio,
		);
	}

	// ==================== MÉTODO PRINCIPAL ====================

	async create(data: CreateOrdenesDto) {
		const productos = Array.isArray(data.productos) ? data.productos : [];
		const descripcion = productos.length > 0 ? this.generarDescripcionFactura(productos) : '';

		// 1. Crear factura
		const factura = await this.crearFactura(data.nombreCliente || '', data.metodo, descripcion);

		// 2. Crear orden
		const orden = await this.crearOrden(factura.facturaId, data.tipoPedido, data.estadoOrden, data.observaciones);

		// 3. Procesar productos y calcular total
		let total = 0;
		if (productos.length > 0) {
			const result = await this.procesarProductos(orden.ordenId, productos);
			total = result.total;
		}

		// 3.5 Sumar costo domicilio al total
		if (this.esDomicilio(data.tipoPedido) && data.costoDomicilio) {
			total += Number(data.costoDomicilio);
		}

		// 3.6 Persistir total en factura
		if (total > 0) {
			await this.facturasRepo.update(factura.facturaId, {total});
			factura.total = total;
		}

		// 4. Procesar domicilio si aplica
		if (this.esDomicilio(data.tipoPedido)) {
			await this.procesarDomicilio(data, factura.facturaId, orden.ordenId);
		}

		const fullOrden = await this.findOne(orden.ordenId);
		this.ordenesGateway.emitirNuevaOrden(fullOrden);

		return fullOrden;
	}

	async update(id: number, data: Partial<CreateOrdenesDto>) {
		await this.repo.update(id, data);
		// Return the updated order with relations
		const updated = await this.findOne(id);
		this.ordenesGateway.emitirOrdenActualizada(updated);
		return updated;
	}

	remove(id: number) {
		return this.repo.delete(id);
	}

	async cancel(id: number) {
		const orden = await this.findOne(id);
		if (!orden) throw new BadRequestException('Orden no encontrada');

		// 1. Cancelar orden
		orden.estadoOrden = 'cancelado';
		await this.repo.save(orden);

		// 2. Cancelar factura asociada
		if (orden.facturaId) {
			await this.facturasRepo.update(orden.facturaId, {estado: 'cancelado'});
		}

		this.ordenesGateway.emitirOrdenActualizada(orden);

		return orden;
	}

}
