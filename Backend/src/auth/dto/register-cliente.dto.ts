import {ApiProperty} from '@nestjs/swagger';
import {IsNotEmpty, IsOptional, IsString, MinLength} from 'class-validator';

export class RegisterClienteDto {
	@ApiProperty({example: '3123456789'})
	@IsString()
	@IsNotEmpty()
	telefono: string;

	@ApiProperty()
	@IsString()
	@IsOptional()
	clienteNombre?: string;

	@ApiProperty({minLength: 8})
	@IsNotEmpty()
	@MinLength(8)
	password: string;
}
