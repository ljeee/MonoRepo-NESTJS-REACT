import {IsString, IsNumber, IsOptional, IsDateString, IsArray, ValidateNested, IsIn} from 'class-validator';
import {Transform} from 'class-transformer';
import {ApiProperty, PartialType} from '@nestjs/swagger';
import {Type} from 'class-transformer';

export class CreateOrdenesDto {
	@ApiProperty({example: 'domicilio', description: 'Tipo de pedido: mesa, domicilio o llevar'})
	@Transform(({value}) => {
		if (!value) return 'mesa';
		return String(value).toLowerCase().trim();
	})
	@IsIn(['mesa', 'domicilio', 'llevar'], {message: 'tipoPedido debe ser "mesa", "domicilio" o "llevar"'})
	tipoPedido: string;

	@ApiProperty({example: 'pendiente', required: false})
	@IsOptional()
	@IsString()
	estadoOrden: string;

	@ApiProperty({example: '2025-11-11T12:00:00Z', required: false})
	@IsOptional()
	@IsDateString()
	fechaOrden: string;

	// Campos adicionales para flujo domicilio
	@ApiProperty({example: '3001234567', required: false, description: 'Teléfono del cliente para domicilio'})
	@IsOptional()
	@IsString()
	telefonoCliente: string;

	@ApiProperty({example: 'Juan Pérez', required: false, description: 'Nombre del cliente para domicilio'})
	@IsOptional()
	@IsString()
	nombreCliente: string;

	@ApiProperty({example: 'Calle 10 #5-20', required: false, description: 'Dirección del cliente para domicilio'})
	@IsOptional()
	@IsString()
	direccionCliente: string;

	@ApiProperty({example: '3109876543', required: false, description: 'Teléfono del domiciliario para domicilio'})
	@IsOptional()
	@IsString()
	telefonoDomiciliario: string;
	@ApiProperty({example: 'efectivo', required: false, description: 'Método de pago: efectivo, tarjeta, etc.'})
	@IsOptional()
	@IsString()
	metodo: string;

	@ApiProperty({example: 5000, required: false, description: 'Costo del domicilio'})
	@IsOptional()
	@IsNumber()
	costoDomicilio?: number;

	@ApiProperty({example: 'Cliente pidió sin cebolla', required: false, description: 'Observaciones o notas adicionales de la orden'})
	@IsOptional()
	@IsString()
	observaciones?: string;

	@ApiProperty({
		description: 'Productos de la orden',
		required: false,
		type: 'array',
		example: [
			{tamano: 'grande', sabor1: 'paisa', cantidad: 1},
			{tamano: 'mediana', sabor1: 'mexicana', sabor2: 'vegetales', cantidad: 1},
			{tamano: 'grande', sabor1: 'paisa', sabor2: 'carnes', cantidad: 2},
		],
		items: {$ref: '#/components/schemas/CreateOrdenItemDto'},
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({each: true})
	@Type(() => CreateOrdenItemDto)
	productos?: CreateOrdenItemDto[];
}

export class CreateOrdenItemDto {
	@ApiProperty({example: 'Pizza', description: 'Tipo de producto'})
	@IsString()
	tipo: string; // Pizza, Chuzo, Calzone, Hamburguesa, etc.

	@ApiProperty({example: 1, required: false, description: 'ID del producto (nuevo sistema)'})
	@IsOptional()
	@IsNumber()
	productoId?: number;

	@ApiProperty({example: 1, required: false, description: 'ID de la variante del producto'})
	@IsOptional()
	@IsNumber()
	varianteId?: number;

	@ApiProperty({example: 'grande', required: false, description: 'Tamaño solo para pizzas (legacy)'})
	@IsOptional()
	@IsString()
	tamano?: string;

	@ApiProperty({example: 'paisa', required: false, description: 'Sabor principal, solo para pizzas'})
	@IsOptional()
	@IsString()
	sabor1?: string;

	@ApiProperty({example: 'carnes', required: false, description: 'Segundo sabor, solo para pizzas'})
	@IsOptional()
	@IsString()
	sabor2?: string;

	@ApiProperty({example: 'hawaiana', required: false, description: 'Tercer sabor, solo para pizzas'})
	@IsOptional()
	@IsString()
	sabor3?: string;

	@ApiProperty({example: 1})
	@IsNumber()
	cantidad: number;
}

export class FindOrdenesDto {
	@ApiProperty({example: 'pendiente', required: false})
	@IsOptional()
	@IsString()
	estado?: string;

	@ApiProperty({example: '2025-11-01', required: false})
	@IsOptional()
	@IsDateString()
	from?: string;

	@ApiProperty({example: '2025-11-30', required: false})
	@IsOptional()
	@IsDateString()
	to?: string;

	@ApiProperty({example: 1, required: false})
	@IsOptional()
	@IsNumber()
	page?: number;

	@ApiProperty({example: 10, required: false})
	@IsOptional()
	@IsNumber()
	limit?: number;
}

export class UpdateOrdenesDto extends PartialType(CreateOrdenesDto) {}
