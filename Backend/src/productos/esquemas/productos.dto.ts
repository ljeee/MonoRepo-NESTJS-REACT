import {IsString, IsNumber, IsOptional, IsBoolean, ValidateNested} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';

export class CreateProductoVarianteDto {
	@ApiProperty({example: 'Pequeña', description: 'Nombre de la variante (tamaño, sabor, etc)'})
	@IsString()
	nombre: string;

	@ApiProperty({example: 15000})
	@IsNumber()
	precio: number;

	@ApiProperty({
		example: 18000,
		required: false,
		description: 'Precio cuando el jugo se prepara con leche. Null = no aplica',
	})
	@IsOptional()
	@IsNumber()
	precioLeche?: number | null;

	@ApiProperty({example: 'Pizza pequeña', required: false})
	@IsOptional()
	@IsString()
	descripcion?: string;

	@ApiProperty({example: true, required: false})
	@IsOptional()
	@IsBoolean()
	activo?: boolean;
}

export class FindProductosDto {
	@ApiProperty({example: true, required: false})
	@IsOptional()
	@IsBoolean()
	activo?: boolean;
}

export class CreateProductosDto {
	@ApiProperty({example: 'Pizza Hawaiana'})
	@IsString()
	productoNombre: string;

	@ApiProperty({example: 'Deliciosa pizza con piña y jamón', required: false})
	@IsOptional()
	@IsString()
	descripcion?: string;

	@ApiProperty({example: true, required: false})
	@IsOptional()
	@IsBoolean()
	activo?: boolean;

	@ApiProperty({example: '🍕', required: false, description: 'Emoji personalizado para el producto'})
	@IsOptional()
	@IsString()
	emoji?: string;

	@ApiProperty({
		example: 'pizza',
		required: false,
		description: "Tipo de personalización: 'pizza' | 'calzone' | 'jugo' | 'ninguna'. null = fallback por nombre",
	})
	@IsOptional()
	@IsString()
	personalizacion?: string | null;

	@ApiProperty({
		type: [CreateProductoVarianteDto],
		required: false,
		description: 'Variantes del producto (tamaños, sabores, etc)',
	})
	@IsOptional()
	@ValidateNested({each: true})
	@Type(() => CreateProductoVarianteDto)
	variantes?: CreateProductoVarianteDto[];
}
