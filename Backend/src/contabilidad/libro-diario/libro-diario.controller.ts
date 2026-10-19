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
		const sufijo = `${q.filtro === 'solo_transferencias' ? 'transferencias_' : q.filtro === 'cuenta_especifica' ? 'cuenta_' : ''}${q.from}_${q.to}`;
		if (q.formato === 'csv') {
			const csv = await this.libro.csv(q);
			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader('Content-Disposition', `attachment; filename="libro-diario_${sufijo}.csv"`);
			res.send(csv);
			return;
		}
		const pdf = await this.libro.pdf(q);
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `inline; filename="libro-diario_${sufijo}.pdf"`);
		res.send(pdf);
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
