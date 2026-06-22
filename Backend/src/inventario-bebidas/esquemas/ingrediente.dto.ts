import {IsString, IsOptional, IsNumber, IsBoolean, IsIn, Min} from 'class-validator';

const CATEGORIAS = ['pulpa', 'jugo_directo', 'gaseosa', 'agua', 'otro'] as const;

export class CreateIngredienteDto {
	@IsString()
	nombre: string;

	@IsOptional()
	@IsIn(CATEGORIAS)
	categoria?: string;

	@IsOptional()
	@IsString()
	unidad?: string;

	@IsOptional()
	@IsNumber()
	@Min(0)
	stockActual?: number;

	@IsOptional()
	@IsNumber()
	@Min(0.0001)
	rendimientoPorUnidad?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	alertaMinimo?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	costo?: number;

	@IsOptional()
	@IsBoolean()
	activo?: boolean;
}

export class UpdateIngredienteDto {
	@IsOptional()
	@IsString()
	nombre?: string;

	@IsOptional()
	@IsIn(CATEGORIAS)
	categoria?: string;

	@IsOptional()
	@IsString()
	unidad?: string;

	@IsOptional()
	@IsNumber()
	@Min(0.0001)
	rendimientoPorUnidad?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	alertaMinimo?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	costo?: number;

	@IsOptional()
	@IsBoolean()
	activo?: boolean;
}

export class AjustarStockDto {
	@IsNumber()
	delta: number; // positive = entrada, negative = salida

	@IsOptional()
	@IsString()
	descripcion?: string;
}

export class VincularVarianteDto {
	@IsNumber()
	varianteId: number;

	@IsNumber()
	ingredienteId: number;

	@IsNumber()
	@Min(0.0001)
	cantidadPorVenta: number;
}
