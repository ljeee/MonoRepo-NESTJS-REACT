import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmpresaService } from './empresa.service';
import { UpdateEmpresaDto } from './esquemas/empresa.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Configuración Empresa')
@Controller('empresa')
export class EmpresaController {
    constructor(private readonly service: EmpresaService) {}

    @Get()
    @Public()
    @ApiOperation({ summary: 'Obtener datos del perfil del negocio' })
    getConfig() {
        return this.service.getConfig();
    }

    @Patch()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    @ApiOperation({ summary: 'Actualizar perfil del negocio (Solo Admin)' })
    update(@Body() dto: UpdateEmpresaDto) {
        return this.service.updateConfig(dto);
    }
}
