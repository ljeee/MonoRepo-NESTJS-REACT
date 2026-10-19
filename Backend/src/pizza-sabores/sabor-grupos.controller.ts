import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post} from '@nestjs/common';
import {ApiOperation, ApiTags} from '@nestjs/swagger';
import {Public} from '../auth/decorators/public.decorator';
import {Roles} from '../auth/decorators/roles.decorator';
import {Role} from '../auth/roles.enum';
import {SaborGruposService} from './sabor-grupos.service';
import {CreateSaborGrupoDto, UpdateSaborGrupoDto} from './esquemas/sabor-grupo.dto';

@ApiTags('Grupos de sabores')
@Controller('sabor-grupos')
export class SaborGruposController {
	constructor(private readonly service: SaborGruposService) {}

	@Get()
	@Public()
	@ApiOperation({summary: 'Grupos de sabores y sus reglas (tope, recargos, tamaños)'})
	findAll() {
		return this.service.findAll();
	}

	// Las reglas del grupo cambian lo que se cobra: solo el admin.
	@Post()
	@Roles(Role.Admin)
	create(@Body() dto: CreateSaborGrupoDto) {
		return this.service.create(dto);
	}

	@Patch(':id')
	@Roles(Role.Admin)
	update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSaborGrupoDto) {
		return this.service.update(id, dto);
	}

	@Delete(':id')
	@Roles(Role.Admin)
	remove(@Param('id', ParseIntPipe) id: number) {
		return this.service.remove(id);
	}
}
