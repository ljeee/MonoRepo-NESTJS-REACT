import {IsString, IsNumber, IsOptional, IsNotEmpty, Matches} from "class-validator";
import {ApiProperty} from '@nestjs/swagger';

export class CreateDomiciliariosDto {
	@ApiProperty({ example: '3109876543' })
	@IsNotEmpty({ message: 'El teléfono es requerido' })
	@IsString()
	@Matches(/^\d{7,15}$/, { message: 'El teléfono debe contener entre 	7 y 15 dígitos' })
	telefono: string;

	@ApiProperty({ example: 'Pedro Gómez', required: false })
	@IsOptional()
	@IsString()
	domiciliarioNombre?: string;
}
