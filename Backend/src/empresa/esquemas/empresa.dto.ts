import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateEmpresaDto {
    @IsOptional()
    @IsString()
    nit?: string;

    @IsOptional()
    @IsString()
    razonSocial?: string;

    @IsOptional()
    @IsString()
    nombreComercial?: string;

    @IsOptional()
    @IsString()
    regimen?: string;

    @IsOptional()
    @IsString()
    direccion?: string;

    @IsOptional()
    @IsString()
    telefono?: string;

    @IsOptional()
    @IsString()
    municipio?: string;

    @IsOptional()
    @IsString()
    departamento?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    tarifaIva?: number;
}
