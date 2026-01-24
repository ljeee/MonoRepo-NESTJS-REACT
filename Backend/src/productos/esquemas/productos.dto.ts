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

	@ApiProperty({example: 'Pizza pequeña', required: false})
	@IsOptional()
	@IsString()
	descripcion?: string;
}

export class FindProductosDto {
	@ApiProperty({example: 'Pizzas', required: false})
	@IsOptional()
	@IsString()
	categoria?: string;

	@ApiProperty({example: true, required: false})
	@IsOptional()
	@IsBoolean()
	activo?: boolean;
}

export class CreateProductosDto {
	@ApiProperty({example: 'Pizza Hawaiana'})
	@IsString()
	productoNombre: string;

	@ApiProperty({example: 'Pizzas', description: 'Categoría del producto'})
	@IsString()
	categoria: string;

	@ApiProperty({example: 'Deliciosa pizza con piña y jamón', required: false})
	@IsOptional()
	@IsString()
	descripcion?: string;

	@ApiProperty({example: true, required: false})
	@IsOptional()
	@IsBoolean()
	activo?: boolean;

	@ApiProperty({type: [CreateProductoVarianteDto], required: false, description: 'Variantes del producto (tamaños, sabores, etc)'})
	@IsOptional()
	@ValidateNested({each: true})
	@Type(() => CreateProductoVarianteDto)
	variantes?: CreateProductoVarianteDto[];
}
