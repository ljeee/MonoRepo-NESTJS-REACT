import {ApiProperty} from '@nestjs/swagger';
import {IsArray, IsOptional, IsString, MinLength} from 'class-validator';
import {Role} from '../roles.enum';

export class RegisterDto {
	@ApiProperty({example: 'admin'})
	@IsString()
	username: string;

	@ApiProperty({minLength: 8})
	@IsString()
	@MinLength(8)
	password: string;

	@ApiProperty({required: false})
	@IsOptional()
	@IsString()
	name?: string;

	@ApiProperty({required: false, enum: Role, isArray: true})
	@IsOptional()
	@IsArray()
	roles?: Role[];
}
