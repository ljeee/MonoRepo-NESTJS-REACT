import {Body, Controller, Get, HttpCode, Post, Query, Res} from '@nestjs/common';
import {ApiBearerAuth, ApiOperation, ApiTags} from '@nestjs/swagger';
import type {Response} from 'express';
import {Roles} from '../../auth/decorators/roles.decorator';
import {Role} from '../../auth/roles.enum';
import {EnviarLibroDiarioDto, LibroDiarioQueryDto} from './libro-diario.dto';
import {LibroDiarioService} from './libro-diario.service';

@ApiTags('Contabilidad')
@ApiBearerAuth()
@Controller('contabilidad/libro-diario')
export class LibroDiarioController {
	constructor(private readonly libro: LibroDiarioService) {}

	@Get()
	@Roles(Role.Admin, Role.Cajero, Role.Contador)
	@ApiOperation({summary: 'Libro diario del rango en PDF (formato=pdf, por defecto) o CSV (formato=csv)'})
	async obtener(@Query() q: LibroDiarioQueryDto, @Res() res: Response) {
		const csv = q.formato === 'csv';
		const {nombre, contenido} = await this.libro.archivo(q, csv ? 'csv' : 'pdf');
		res.setHeader('Content-Type', csv ? 'text/csv; charset=utf-8' : 'application/pdf');
		res.setHeader('Content-Disposition', `${csv ? 'attachment' : 'inline'}; filename="${nombre}"`);
		res.send(contenido);
	}

	@Post('enviar')
	@HttpCode(200)
	@Roles(Role.Admin, Role.Cajero)
	@ApiOperation({
		summary:
			'Envía los dos libros del rango en PDF (completo y transferencias y mixto) al dueño (REPORT_EMAIL) y a la contadora',
	})
	enviar(@Body() dto: EnviarLibroDiarioDto) {
		return this.libro.enviar(dto.from, dto.to, {motivo: 'manual'});
	}
}
