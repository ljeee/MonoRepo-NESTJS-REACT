import {IsString, IsOptional, IsNotEmpty, Matches, IsEmail} from "class-validator";
import {ApiProperty} from '@nestjs/swagger';

export class CreateClientesDto {
	@ApiProperty({ example: '3001234567' })
	@IsNotEmpty({ message: 'El teléfono es requerido' })
	@IsString()
	@Matches(/^\d{7,15}$/, { message: 'El teléfono debe contener entre 7 y 15 dígitos' })
	telefono: string;

	@ApiProperty({ example: 'Juan Pérez', required: false })
	@IsOptional()
	@IsString()
	clienteNombre?: string;

	@ApiProperty({ example: 'CC', required: false, enum: ['CC', 'NIT', 'CE', 'TI', 'PP'] })
	@IsOptional()
	@IsString()
	tipoDocumento?: string;

	@ApiProperty({ example: '1234567890', required: false })
	@IsOptional()
	@IsString()
	documento?: string;

	@ApiProperty({ example: 'cliente@email.com', required: false })
	@IsOptional()
	@IsEmail({}, { message: 'El correo no es válido' })
	correo?: string;
}
