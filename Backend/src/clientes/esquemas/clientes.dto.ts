import {IsString, IsNumber, IsOptional} from "class-validator";
import {ApiProperty} from '@nestjs/swagger';

export class CreateClientesDto {
	@ApiProperty({ example: '3001234567' })
	@IsString()
	telefono: string;

	@IsOptional()
	@IsString()
	direccionDos?: string;

	@ApiProperty({ example: 'Calle 10 #5-20', required: false })
	@IsOptional()
	@IsString()
	direccion?: string;

	@ApiProperty({ example: 'Juan Pérez', required: false })
	@IsOptional()
	@IsString()
	clienteNombre?: string;

	@IsOptional()
	@IsString()
	direccionTres?: string;
}
