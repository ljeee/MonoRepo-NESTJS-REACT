import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AjustarCajasDto {
	@ApiPropertyOptional({ description: 'Delta positivo o negativo de cajas' })
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
