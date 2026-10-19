import {IsString, IsOptional, IsNotEmpty, Matches, IsLatitude, IsLongitude, IsNumber, Min} from 'class-validator';
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

	@ApiProperty({example: 1760000000000, required: false, description: 'Momento (ms epoch) en que el GPS tomó la posición'})
	@IsOptional()
	@IsNumber()
	@Min(0)
	capturadaEn?: number;
}
