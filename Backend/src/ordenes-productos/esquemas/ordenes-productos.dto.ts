import {IsString, IsNumber, IsOptional} from "class-validator";

export class CreateOrdenesProductosDto {
	@IsOptional()
	@IsNumber()
	id?: number;

	@IsOptional()
	@IsNumber()
	ordenId?: number;

	@IsOptional()
	@IsString()
	producto?: string;

	@IsOptional()
	@IsNumber()
	cantidad?: number;

	@IsOptional()
	@IsNumber()
	precioUnitario?: number;

	@IsOptional()
	@IsNumber()
	varianteId?: number;
}
