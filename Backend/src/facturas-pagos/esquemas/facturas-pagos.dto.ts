import {IsString, IsNumber, IsOptional, IsDateString, IsIn, IsInt, Matches} from 'class-validator';
import {PATRON_CURSOR} from '../../common/utils/paginacion.util';
import {PartialType} from '@nestjs/swagger';
import {IDS_CATEGORIA_GASTO, TIPOS_GASTO} from '../../common/utils/gastos.util';
import type {TipoGasto} from '../../common/utils/gastos.util';

export class CreateFacturasPagosDto {
	@IsOptional()
	@IsNumber()
	pagosId?: number;

	@IsOptional()
	@IsNumber()
	total?: number;

	@IsOptional()
	@IsString()
	nombreGasto?: string;

	@IsOptional()
	@IsString()
	descripcion?: string;

	@IsOptional()
	@IsString()
	estado?: string;

	@IsOptional()
	@IsDateString()
	fechaFactura?: string;

	@IsOptional()
	@IsString()
	metodo?: string;

	/** nomina, servicios, insumos… (ver common/utils/gastos.util.ts). */
	@IsOptional()
	@IsIn(IDS_CATEGORIA_GASTO as string[])
	categoria?: string;

	/** 'costo' | 'gasto'. Si falta, se toma el tipo por defecto de la categoría. */
	@IsOptional()
	@IsIn(TIPOS_GASTO as unknown as string[])
	tipoGasto?: TipoGasto;

	/** Cuenta de transferencia de la que sale un egreso pagado por QR (obligatoria con metodo 'qr'). */
	@IsOptional()
	@IsInt()
	cuentaOrigenId?: number | null;

	@IsOptional()
	denominaciones?: Record<string, number>;
}

/** PATCH: mismos campos, todos opcionales, CON validación (antes `Partial<Dto>` no validaba nada). */
export class UpdateFacturasPagosDto extends PartialType(CreateFacturasPagosDto) {}

export class FindFacturasPagosDto {
	@IsOptional()
	@IsDateString()
	from?: string;

	@IsOptional()
	@IsDateString()
	to?: string;

	@IsOptional()
	@IsNumber()
	page?: number;

	/** Sin `limit` (o `limit=0`) devuelve TODOS los del rango: la contabilidad no admite topes silenciosos. */
	@IsOptional()
	@IsNumber()
	limit?: number;

	/** 'costo' | 'gasto' | 'sin_clasificar' */
	@IsOptional()
	@IsIn([...TIPOS_GASTO, 'sin_clasificar'])
	tipo?: string;

	@IsOptional()
	@IsString()
	categoria?: string;

	/** 'pagado' | 'pendiente' */
	@IsOptional()
	@IsString()
	estado?: string;

	/** Paginación por clave: 'inicio' y luego el `siguiente` de cada respuesta (ver common/utils/paginacion.util.ts). */
	@IsOptional()
	@IsString()
	@Matches(PATRON_CURSOR)
	cursor?: string;
}
