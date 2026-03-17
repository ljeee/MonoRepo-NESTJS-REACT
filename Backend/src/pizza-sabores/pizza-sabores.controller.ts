import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { PizzaSaboresService } from './pizza-sabores.service';
import { CreatePizzaSaborDto, UpdatePizzaSaborDto } from './esquemas/pizza-sabores.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('pizza-sabores')
export class PizzaSaboresController {
	constructor(private readonly service: PizzaSaboresService) {}

	@Get()
	@Public()
	findAll() {
		return this.service.findAll();
	}

	@Post()
	create(@Body() dto: CreatePizzaSaborDto) {
		return this.service.create(dto);
	}

	@Patch(':id')
	update(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdatePizzaSaborDto,
	) {
		return this.service.update(id, dto);
	}

	@Delete(':id')
	delete(@Param('id', ParseIntPipe) id: number) {
		return this.service.delete(id);
	}
}
