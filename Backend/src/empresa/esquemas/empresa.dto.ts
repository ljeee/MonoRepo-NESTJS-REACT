import {IsString, IsOptional, IsNumber, IsBoolean, Min, Matches} from 'class-validator';

/** Vacío, o uno o varios correos separados por coma. */
export const PATRON_CORREOS = /^\s*$|^\s*[^\s@,]+@[^\s@,]+\.[^\s@,]+(\s*,\s*[^\s@,]+@[^\s@,]+\.[^\s@,]+)*\s*$/;

export class UpdateEmpresaDto {
	@IsOptional()
	@IsString()
	nit?: string;

	@IsOptional()
	@IsString()
	razonSocial?: string;

	@IsOptional()
	@IsString()
	nombreComercial?: string;

	@IsOptional()
	@IsString()
	regimen?: string;

	@IsOptional()
	@IsString()
	direccion?: string;

	@IsOptional()
	@IsString()
	telefono?: string;

	@IsOptional()
	@IsString()
	municipio?: string;

	@IsOptional()
	@IsString()
	departamento?: string;

	@IsOptional()
	@IsNumber()
	@Min(0)
	tarifaIva?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	recargoLeche?: number;

	/** Solo el admin puede cambiarlo (PATCH /empresa ya es solo admin). */
	@IsOptional()
	@IsBoolean()
	arqueoCaja?: boolean;

	/** Correo(s) del contador separados por coma; vacío = no se le envía el libro diario. */
	@IsOptional()
	@IsString()
	@Matches(PATRON_CORREOS, {message: 'Escribe correos válidos separados por coma (o déjalo vacío)'})
	correoContador?: string;
}
