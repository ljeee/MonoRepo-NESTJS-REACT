import {IsString, IsNumber, IsOptional} from "class-validator";
import {ApiProperty} from '@nestjs/swagger';

export class CreateDomiciliariosDto {
	@ApiProperty({ example: '3109876543' })
	@IsString()
	telefono: string;

	@ApiProperty({ example: 'Pedro Gómez', required: false })
	@IsOptional()
	@IsString()
	domiciliarioNombre?: string;
}
