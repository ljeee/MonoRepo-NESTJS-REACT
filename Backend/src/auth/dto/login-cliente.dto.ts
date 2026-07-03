import {ApiProperty} from '@nestjs/swagger';
import {IsNotEmpty, IsString, Matches, MinLength} from 'class-validator';

export class LoginClienteDto {
	@ApiProperty({example: '3123456789'})
	@IsString()
	@IsNotEmpty()
	@Matches(/^\d{7,15}$/, {message: 'telefono debe tener entre 7 y 15 dígitos numéricos'})
	telefono: string;

	@ApiProperty({minLength: 8})
	@IsNotEmpty()
	@MinLength(8)
	password: string;
}
