import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { PizzaSaboresService } from './pizza-sabores.service';
import { UpdatePizzaSaborDto } from './esquemas/pizza-sabores.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('pizza-sabores')
export class PizzaSaboresController {
	constructor(private readonly service: PizzaSaboresService) {}

	@Get()
	@Public()
	findAll() {
		return this.service.findAll();
	}

	@Patch(':id')
	update(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdatePizzaSaborDto,
	) {
		return this.service.update(id, dto);
	}
}
