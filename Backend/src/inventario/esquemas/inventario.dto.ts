import {Type} from 'class-transformer';
import {
	IsBoolean,
	IsIn,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
	Max,
	Min,
	ValidateIf,
} from 'class-validator';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {
	CATEGORIAS_BEBIDA,
	CATEGORIAS_CAJA,
	TIPOS_ITEM_INVENTARIO,
	TIPOS_MOVIMIENTO_MANUAL,
	type TipoItemInventario,
	type TipoMovimientoManual,
} from '../inventario.util';

const CATEGORIAS = [...new Set<string>([...CATEGORIAS_CAJA, ...CATEGORIAS_BEBIDA])];

export class CrearItemDto {
	@ApiProperty({enum: TIPOS_ITEM_INVENTARIO})
	@IsIn(TIPOS_ITEM_INVENTARIO)
	tipo: TipoItemInventario;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@MaxLength(150)
	nombre: string;

	@ApiPropertyOptional({enum: CATEGORIAS, description: 'Si se omite se deduce del nombre'})
	@IsOptional()
	@IsIn(CATEGORIAS)
	categoria?: string;

	@ApiPropertyOptional({description: 'Stock inicial (queda como movimiento de entrada)', default: 0})
	@IsOptional()
	@IsInt()
	@Min(0)
	cantidad?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@Min(0)
	alertaMinimo?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@Min(0)
	nivelObjetivo?: number;

	@ApiPropertyOptional({description: 'Bebida: variante que la descuenta 1:1 al venderse'})
	@IsOptional()
	@IsInt()
	varianteId?: number;
}

export class ActualizarItemDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(150)
	nombre?: string;

	@ApiPropertyOptional({enum: CATEGORIAS})
	@IsOptional()
	@IsIn(CATEGORIAS)
	categoria?: string;

	@ApiPropertyOptional({nullable: true})
	@ValidateIf((_o, v) => v !== null && v !== undefined)
	@IsInt()
	@Min(0)
	alertaMinimo?: number | null;

	@ApiPropertyOptional({nullable: true})
	@ValidateIf((_o, v) => v !== null && v !== undefined)
	@IsInt()
	@Min(0)
	nivelObjetivo?: number | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	activo?: boolean;
}

export class RegistrarMovimientoDto {
	@ApiProperty({enum: TIPOS_MOVIMIENTO_MANUAL, description: 'conteo = lo que se contó físicamente (fija el valor)'})
	@IsIn(TIPOS_MOVIMIENTO_MANUAL)
	tipo: TipoMovimientoManual;

	@ApiProperty({
		description: 'entrada/salida: cantidad > 0 · ajuste: delta con signo ≠ 0 · conteo: valor contado ≥ 0',
	})
	@IsInt()
	@Min(-100000)
	@Max(100000)
	cantidad: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(255)
	nota?: string;
}

export class GuardarReglaDto {
	@ApiProperty()
	@IsInt()
	itemId: number;

	@ApiProperty()
	@IsInt()
	varianteId: number;

	@ApiPropertyOptional({default: 1})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(50)
	cantidad?: number;

	@ApiPropertyOptional({description: 'Por defecto: true para cajas, false para bebidas'})
	@IsOptional()
	@IsBoolean()
	soloParaLlevar?: boolean;
}

export class ListarMovimientosDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	itemId?: number;

	@IsOptional()
	@IsIn(TIPOS_ITEM_INVENTARIO)
	tipoItem?: TipoItemInventario;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(200)
	limit?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	offset?: number;
}
