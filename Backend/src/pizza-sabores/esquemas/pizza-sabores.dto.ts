import {IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min} from 'class-validator';

export class UpdatePizzaSaborDto {
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	nombre?: string;

	/** Grupo al que pertenece el sabor (Pizza, Calzone…). */
	@IsOptional()
	@IsInt()
	grupoId?: number;

	/** @deprecated Ya no se usa: la carta no distingue tradicional/especial. Se acepta e ignora (clientes viejos). */
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
	@IsBoolean()
	activo?: boolean;
}

export class CreatePizzaSaborDto {
	@IsString()
	@IsNotEmpty()
	nombre: string;

	@IsInt()
	grupoId: number;

	/** @deprecated Se acepta e ignora. */
	@IsOptional()
	@IsString()
	@MaxLength(30)
	tipo?: string;

	/** Recargo por tamaño. 0 (o sin enviar) = no cobra. */
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
	@IsBoolean()
	activo?: boolean;
}
