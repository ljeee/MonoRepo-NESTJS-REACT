import {ApiPropertyOptional, ApiProperty} from '@nestjs/swagger';
import {Transform} from 'class-transformer';
import {IsIn, IsInt, IsOptional, Matches, Min} from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** solo_transferencias = «Transferencias y mixto» (el valor se conserva por compatibilidad). */
export const FILTROS_LIBRO = ['completo', 'solo_transferencias', 'cuenta_especifica'] as const;
export type FiltroLibro = (typeof FILTROS_LIBRO)[number];

export class LibroDiarioQueryDto {
	@ApiProperty({example: '2026-10-01'})
	@Matches(FECHA, {message: 'from debe ser YYYY-MM-DD'})
	from!: string;

	@ApiProperty({example: '2026-10-31'})
	@Matches(FECHA, {message: 'to debe ser YYYY-MM-DD'})
	to!: string;

	@ApiPropertyOptional({enum: FILTROS_LIBRO, default: 'completo'})
	@IsOptional()
	@IsIn(FILTROS_LIBRO)
	filtro?: FiltroLibro;

	/** Obligatorio con filtro=cuenta_especifica. */
	@ApiPropertyOptional()
	@IsOptional()
	@Transform(({value}) => (value === '' || value == null ? undefined : Number(value)))
	@IsInt()
	@Min(1)
	cuentaId?: number;

	@ApiPropertyOptional({enum: ['pdf', 'csv'], default: 'pdf'})
	@IsOptional()
	@IsIn(['pdf', 'csv'])
	formato?: 'pdf' | 'csv';
}

export class EnviarLibroDiarioDto {
	@ApiProperty({example: '2026-10-18'})
	@Matches(FECHA, {message: 'from debe ser YYYY-MM-DD'})
	from!: string;

	@ApiProperty({example: '2026-10-18'})
	@Matches(FECHA, {message: 'to debe ser YYYY-MM-DD'})
	to!: string;
}
