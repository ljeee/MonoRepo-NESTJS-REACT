import {IsString, IsNumber, IsOptional, IsNotEmpty, Matches, IsLatitude, IsLongitude} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

export class CreateDomiciliariosDto {
	@ApiProperty({example: '3109876543'})
	@IsNotEmpty({message: 'El teléfono es requerido'})
	@IsString()
	@Matches(/^\d{7,15}$/, {message: 'El teléfono debe contener entre 	7 y 15 dígitos'})
	telefono: string;

	@ApiProperty({example: 'Pedro Gómez', required: false})
	@IsOptional()
	@IsString()
	domiciliarioNombre?: string;
}

export class ActualizarUbicacionDto {
	@ApiProperty({example: 6.2442})
	@IsLatitude()
	latitud: number;

	@ApiProperty({example: -75.5812})
	@IsLongitude()
	longitud: number;
}
