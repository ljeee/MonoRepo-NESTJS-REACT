import {ApiProperty} from '@nestjs/swagger';
import {IsNotEmpty, IsString, MinLength} from 'class-validator';

export class LoginClienteDto {
	@ApiProperty({example: '3123456789'})
	@IsString()
	@IsNotEmpty()
	telefono: string;

	@ApiProperty({minLength: 8})
	@IsNotEmpty()
	@MinLength(8)
	password: string;
}
