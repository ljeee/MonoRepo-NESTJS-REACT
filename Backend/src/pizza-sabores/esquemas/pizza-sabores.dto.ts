import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePizzaSaborDto {
	@IsOptional()
	@IsString()
	nombre?: string;

	@IsOptional()
	@IsString()
	tipo?: string;

	@IsOptional()
	@IsNumber()
	@Min(0)
	recargoPequena?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	recargoMediana?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	recargoGrande?: number;

	@IsOptional()
	activo?: boolean;
}
