import {ApiProperty} from '@nestjs/swagger';
import {IsNotEmpty, IsString, MinLength} from 'class-validator';

export class LoginDto {
	@ApiProperty({example: 'admin'})
	@IsString()
	@IsNotEmpty()
	username: string;

	@ApiProperty({minLength: 8})
	@IsNotEmpty()
	@MinLength(8)
	password: string;
}
