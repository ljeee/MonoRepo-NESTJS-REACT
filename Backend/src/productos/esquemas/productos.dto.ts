import {IsString, IsNumber, IsOptional, IsBoolean, IsIn, IsInt, ValidateNested} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {CATEGORIAS_PRODUCTO, CategoriaProducto} from '../../common/utils/catalogo.util';

export const TAMANOS_VARIANTE = ['pequena', 'mediana', 'grande'] as const;

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

	@ApiProperty({
		example: 'pequena',
		required: false,
		enum: TAMANOS_VARIANTE,
		description: 'Tamaño de la variante (productos con tamaños). Si se omite se deduce del nombre.',
	})
	@IsOptional()
	@IsIn(TAMANOS_VARIANTE as unknown as string[])
	tamano?: (typeof TAMANOS_VARIANTE)[number] | null;

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
		example: 1,
		required: false,
		description: 'Grupo de sabores que ofrece el producto (null = sin sabores). Ver /sabor-grupos.',
	})
	@IsOptional()
	@IsInt()
	saborGrupoId?: number | null;

	@ApiProperty({
		example: 'pizza',
		required: false,
		enum: CATEGORIAS_PRODUCTO,
		description: 'Categoría para analítica e inventario. Si se omite al crear, se deduce del nombre.',
	})
	@IsOptional()
	@IsIn(CATEGORIAS_PRODUCTO as unknown as string[])
	categoria?: CategoriaProducto | null;

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
