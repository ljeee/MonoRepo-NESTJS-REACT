import {IsString, IsNumber, IsOptional, IsDateString, IsObject, IsPositive} from 'class-validator';

export class CreateFacturasVentasDto {
	@IsOptional()
	@IsString()
	clienteNombre?: string;

	@IsOptional()
	@IsString()
	telefonoCliente?: string;

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

	/** Denominaciones entregadas como cambio al cliente — dispara registrarSalida en caja */
	@IsOptional()
	@IsObject()
	cambioDenominaciones?: Record<string, number>;
}

export class AbonoDto {
	@IsNumber()
	@IsPositive()
	monto: number;

	@IsOptional()
	@IsObject()
	denominaciones?: Record<string, number>;

	@IsOptional()
	@IsObject()
	cambioDenominaciones?: Record<string, number>;
}
