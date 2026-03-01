import {IsString, IsNumber, IsOptional, IsDateString} from "class-validator";

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
	total?: number;
}
