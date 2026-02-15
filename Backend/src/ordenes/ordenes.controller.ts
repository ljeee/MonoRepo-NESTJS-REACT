import {Controller, Get, Post, Delete, Param, Body, Patch, Query, BadRequestException} from '@nestjs/common';
import {ApiTags, ApiOperation, ApiResponse, ApiBody, ApiOkResponse} from '@nestjs/swagger';
import {OrdenesService} from './ordenes.service';
import {CreateOrdenesDto, FindOrdenesDto, UpdateOrdenesDto} from './esquemas/ordenes.dto';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {Public} from '../auth/decorators/public.decorator';

@Public()
@ApiTags('Ordenes')
@Controller('ordenes')
export class OrdenesController {
	constructor(private readonly service: OrdenesService) {}

	@Get()
	@ApiOperation({summary: 'Obtener todas las ordenes con filtros opcionales'})
	@ApiResponse({status: 200, description: 'Lista de ordenes.'})
	findAll(@Query() query: FindOrdenesDto) {
		return this.service.findAll(query);
	}

	@Get('dia')
	@ApiOperation({summary: 'Obtener todas las ordenes del día actual con filtro opcional de estado'})
	@ApiResponse({status: 200, description: 'Lista de todas las ordenes del día.'})
	findByDay(@Query('estado') estado?: string) {
		return this.service.findByDay(estado);
	}

	@Get('dia/pendientes')
	@ApiOperation({summary: 'Obtener ordenes pendientes del día actual'})
	@ApiResponse({status: 200, description: 'Lista de ordenes pendientes del día.'})
	findPendingByDay() {
		return this.service.findPendingByDay();
	}

	@Get(':id')
	@ApiOperation({summary: 'Obtener una orden por ID'})
	@ApiResponse({status: 200, description: 'Orden encontrada.'})
	findOne(@Param('id') id: number) {
		return this.service.findOne(id);
	}

	@Post()
	@ApiOperation({summary: 'Crear una orden'})
	@ApiOkResponse({
		description: 'Orden creada con productos asociados',
		schema: {
			example: {
				ordenId: 8,
				facturaId: 13,
				tipoPedido: 'domicilio',
				estadoOrden: 'pendiente',
				fechaOrden: '2025-11-11T18:31:53.997Z',
				factura: {
					facturaId: 13,
					clienteNombre: 'Juan Pérez',
					descripcion:
						'1 pizza grande paisa, 1 pizza mediana mexicana y vegetales, 2 pizza grande paisa y carnes',
					fechaFactura: '2025-11-11T18:31:53.986Z',
					estado: 'pendiente',
					metodo: 'efectivo',
					total: 148000,
				},
				productos: [
					{producto: 'pizza grande paisa', cantidad: 1},
					{producto: 'pizza mediana mexicana y vegetales', cantidad: 1},
					{producto: 'pizza grande paisa y carnes', cantidad: 2},
				],
			},
		},
	})
	@ApiBody({
		description: 'Ejemplo de body para crear una orden (domicilio o mesa) con productos de uno o dos sabores',
		type: CreateOrdenesDto,
		examples: {
			domicilio: {
				summary: 'Orden tipo domicilio con pizzas de uno y dos sabores',
				value: {
					tipoPedido: 'domicilio',
					telefonoCliente: '3244897130',
					nombreCliente: 'Juan Pérez',
					direccionCliente: 'Calle 10 #5-20',
					telefonoDomiciliario: '3112223344',
					metodo: 'efectivo',
					productos: [
						{tamano: 'grande', sabor1: 'paisa', cantidad: 1},
						{tamano: 'mediana', sabor1: 'mexicana', sabor2: 'vegetales', cantidad: 1},
						{tamano: 'grande', sabor1: 'paisa', sabor2: 'carnes', cantidad: 2},
					],
				},
			},
			mesa: {
				summary: 'Orden tipo mesa con pizzas de un sabor',
				value: {
					tipoPedido: 'mesa',
					numeroMesa: '12',
					metodo: 'tarjeta',
					productos: [{tamano: 'pequena', sabor1: 'vegetales', cantidad: 2}],
				},
			},
		},
	})
	async create(@Body() rawBody: any) {
		console.log('Raw request body:', JSON.stringify(rawBody, null, 2));
		const dto = plainToInstance(CreateOrdenesDto, rawBody, {enableImplicitConversion: true});
		// Set default tipoPedido if not provided
		if (!dto.tipoPedido) {
			dto.tipoPedido = 'mesa';
		}
		console.log('Received DTO (post-transform):', JSON.stringify(dto, null, 2));
		console.log(
			'tipoPedido value:',
			JSON.stringify(dto.tipoPedido),
			'type:',
			typeof dto.tipoPedido,
			'length:',
			dto.tipoPedido?.length,
		);

		// Validate the DTO
		const errors = await validate(dto);
		if (errors.length > 0) {
			console.error('Validation errors:', errors);
			throw new BadRequestException(
				errors.map((e) => (e.constraints ? Object.values(e.constraints).join(', ') : JSON.stringify(e))),
			);
		}

		return this.service.create(dto);
	}

	@Patch(':id')
	@ApiOperation({summary: 'Actualizar una orden'})
	@ApiResponse({status: 200, description: 'Orden actualizada.'})
	update(@Param('id') id: string, @Body() dto: UpdateOrdenesDto) {
		return this.service.update(Number(id), dto);
	}

	@Delete(':id')
	@ApiOperation({summary: 'Eliminar una orden'})
	@ApiResponse({status: 200, description: 'Orden eliminada.'})
	remove(@Param('id') id: number) {
		return this.service.remove(id);
	}
	@Patch(':id/cancel')
	@ApiOperation({summary: 'Cancelar una orden y su factura asociada'})
	@ApiResponse({status: 200, description: 'Orden cancelada.'})
	cancel(@Param('id') id: number) {
		return this.service.cancel(id);
	}
}
