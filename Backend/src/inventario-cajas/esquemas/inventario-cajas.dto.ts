import { IsInt, IsOptional, IsString, Min, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CrearCajaDto {
	@ApiProperty({ description: 'Nombre del tipo de caja' })
	@IsString()
	@IsNotEmpty()
	nombre: string;

	@ApiPropertyOptional({ description: 'Cantidad inicial', default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	cantidad?: number;

	@ApiPropertyOptional({ description: 'Cantidad mínima para alerta' })
	@IsOptional()
	@IsInt()
	@Min(0)
	alertaMinimo?: number;
}

export class AjustarCajasDto {
	@ApiProperty({ description: 'Delta positivo o negativo de cajas. Ej: -5' })
	@IsInt()
	delta: number;

	@ApiPropertyOptional({ description: 'Tipo de movimiento: entrada, salida, ajuste' })
	@IsOptional()
	@IsString()
	tipo?: 'entrada' | 'salida' | 'ajuste';

	@ApiPropertyOptional({ description: 'Nota/motivo del ajuste' })
	@IsOptional()
	@IsString()
	nota?: string;
}

export class ConfigurarAlertaDto {
	@ApiPropertyOptional({ description: 'Cantidad mínima antes de mostrar alerta' })
	@IsInt()
	@Min(0)
	alertaMinimo: number;
}
