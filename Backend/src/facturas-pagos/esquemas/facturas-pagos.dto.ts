import {IsString, IsNumber, IsOptional, IsDateString} from "class-validator";

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
}
