import {IsString, IsNumber, IsOptional, IsNotEmpty, Matches} from "class-validator";
import {ApiProperty} from '@nestjs/swagger';

export class CreateClientesDto {
	@ApiProperty({ example: '3001234567' })
	@IsNotEmpty({ message: 'El teléfono es requerido' })
	@IsString()
	@Matches(/^\d{7,15}$/, { message: 'El teléfono debe contener entre 7 y 15 dígitos' })
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
