import {IsString, IsOptional, IsNumber, IsBoolean, Min} from 'class-validator';

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
}
