import { Controller, Get, Post, Body, UseGuards, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CierresService } from './cierres.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../auth/esquemas/user.entity';

@ApiTags('Cierres de Caja')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cierres')
export class CierresController {
    constructor(private readonly service: CierresService) {}

    @Post()
    @Roles(Role.Admin)
    @ApiOperation({ summary: 'Realizar el cierre de caja diario' })
    ejecutarCierre(
        @Body() body: { fecha: string; observaciones?: string; enviarEmail?: boolean },
        @GetUser() user: User,
    ) {
        return this.service.generalCierre(body.fecha, user.id, body.observaciones, false, !!body.enviarEmail);
    }

    @Get()
    @Roles(Role.Admin)
    @ApiOperation({ summary: 'Obtener historial de cierres' })
    getHistory() {
        return this.service.getHistory();
    }

    @Delete(':id')
    @Roles(Role.Admin)
    @ApiOperation({ summary: 'Eliminar un registro de cierre' })
    delete(@Param('id') id: string) {
        return this.service.deleteCierre(id);
    }
}
