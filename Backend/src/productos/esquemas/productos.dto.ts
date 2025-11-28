import {IsString, IsNumber, IsOptional} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

export class CreateProductosDto {
	@ApiProperty({example: 'Coca-Cola'})
	@IsString()
	productoNombre: string;

	@ApiProperty({example: 2500})
	@IsOptional()
	@IsNumber()
	precio?: number;
}
