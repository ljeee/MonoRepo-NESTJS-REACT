import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query} from '@nestjs/common';
import {Roles} from '../auth/decorators/roles.decorator';
import {Role} from '../auth/roles.enum';
import {PizzaSaboresService} from './pizza-sabores.service';
import {CreatePizzaSaborDto, UpdatePizzaSaborDto} from './esquemas/pizza-sabores.dto';
import {Public} from '../auth/decorators/public.decorator';

@Controller('pizza-sabores')
export class PizzaSaboresController {
	constructor(private readonly service: PizzaSaboresService) {}

	/** `?grupoId=` limita a los sabores de un grupo (Pizza, Calzone…). */
	@Get()
	@Public()
	findAll(@Query('grupoId') grupoId?: string) {
		const id = grupoId ? Number(grupoId) : undefined;
		return this.service.findAll(Number.isInteger(id) ? id : undefined);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Post()
	create(@Body() dto: CreatePizzaSaborDto) {
		return this.service.create(dto);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Patch(':id')
	update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePizzaSaborDto) {
		return this.service.update(id, dto);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Delete(':id')
	delete(@Param('id', ParseIntPipe) id: number) {
		return this.service.delete(id);
	}
}
