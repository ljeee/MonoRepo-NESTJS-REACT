import {PartialType} from '@nestjs/swagger';
import {IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min} from 'class-validator';

export class CreateSaborGrupoDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(60)
	nombre: string;

	/** Tope de sabores por unidad. */
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(10)
	maxSabores?: number;

	/** Las variantes del producto son los sabores (como en calzone). */
	@IsOptional()
	@IsBoolean()
	varianteEsSabor?: boolean;

	/** El producto tiene tamaños: se cobran los recargos por tamaño de cada sabor. */
	@IsOptional()
	@IsBoolean()
	usaTamano?: boolean;

	/** Desde cuántos sabores se cobra el recargo extra. Null = nunca. */
	@IsOptional()
	@IsInt()
	@Min(2)
	@Max(10)
	recargoExtraDesde?: number | null;

	@IsOptional()
	@IsNumber()
	@Min(0)
	recargoExtraPequena?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	recargoExtraMediana?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	recargoExtraGrande?: number;

	@IsOptional()
	@IsBoolean()
	activo?: boolean;

	@IsOptional()
	@IsInt()
	orden?: number;
}

export class UpdateSaborGrupoDto extends PartialType(CreateSaborGrupoDto) {}
