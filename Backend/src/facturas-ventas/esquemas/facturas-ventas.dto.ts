import {IsString, IsNumber, IsOptional, IsDateString, IsObject} from "class-validator";

export class CreateFacturasVentasDto {

	@IsOptional()
	@IsString()
	clienteNombre?: string;

	@IsOptional()
	@IsString()
	descripcion?: string;

	@IsOptional()
	@IsDateString()
	fechaFactura?: string;

	@IsOptional()
	@IsString()
	estado?: string;

	@IsOptional()
	@IsString()
	metodo?: string;

	@IsOptional()
	@IsNumber()
	pagoEfectivo?: number;

	@IsOptional()
	@IsNumber()
	pagoTransferencia?: number;

	@IsOptional()
	@IsNumber()
	total?: number;

	@IsOptional()
	@IsObject()
	denominaciones?: Record<string, number>;
}
