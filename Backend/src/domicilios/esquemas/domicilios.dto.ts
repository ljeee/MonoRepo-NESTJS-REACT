import {IsString, IsNumber, IsOptional, IsDateString} from 'class-validator';

export class CreateDomiciliosDto {
	@IsOptional()
	@IsNumber()
	domicilioId?: number;

	@IsOptional()
	@IsDateString()
	fechaCreado?: string;

	@IsOptional()
	@IsNumber()
	facturaId?: number;

	@IsOptional()
	@IsString()
	direccionEntrega?: string;

	@IsOptional()
	@IsNumber()
	ordenId?: number;

	@IsOptional()
	@IsString()
	telefono?: string;

	@IsOptional()
	@IsString()
	telefonoDomiciliarioAsignado?: string;

	@IsOptional()
	@IsString()
	estadoDomicilio?: string;
}
