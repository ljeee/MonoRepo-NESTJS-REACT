import {Controller, Get, Post, Delete, Param, Body, Patch} from "@nestjs/common";
import {ApiTags, ApiOperation, ApiResponse} from '@nestjs/swagger';
import {ClientesService} from "./clientes.service";
import {CreateClientesDto} from "./esquemas/clientes.dto";
import {Public} from '../auth/decorators/public.decorator';

@Public()
@ApiTags('Clientes')
@Controller("clientes")
export class ClientesController {
	constructor(private readonly service: ClientesService) {}

	@Get()
	@ApiOperation({ summary: 'Obtener todos los clientes' })
	@ApiResponse({ status: 200, description: 'Lista de clientes con sus direcciones.' })
	findAll() {
		return this.service.findAll();
	}

	@Get(":telefono")
	@ApiOperation({ summary: 'Obtener un cliente por teléfono' })
	@ApiResponse({ status: 200, description: 'Cliente encontrado.' })
	findOne(@Param("telefono") telefono: string) {
		return this.service.findOne(telefono);
	}

	@Post()
	@ApiOperation({ summary: 'Crear un cliente' })
	@ApiResponse({ status: 201, description: 'Cliente creado.' })
	create(@Body() dto: CreateClientesDto) {
		return this.service.create(dto);
	}

	@Patch(":telefono")
	@ApiOperation({ summary: 'Actualizar un cliente' })
	@ApiResponse({ status: 200, description: 'Cliente actualizado.' })
	update(@Param("telefono") telefono: string, @Body() dto: Partial<CreateClientesDto>) {
		return this.service.update(telefono, dto);
	}

	@Delete(":telefono")
	@ApiOperation({ summary: 'Eliminar un cliente' })
	@ApiResponse({ status: 200, description: 'Cliente eliminado.' })
	remove(@Param("telefono") telefono: string) {
		return this.service.remove(telefono);
	}

	// ─── Direcciones ──────────────────────────────────────────────

	@Get(":telefono/direcciones")
	@ApiOperation({ summary: 'Obtener direcciones de un cliente (más recientes primero)' })
	getDirecciones(@Param("telefono") telefono: string) {
		return this.service.getDirecciones(telefono);
	}

	@Post(":telefono/direcciones")
	@ApiOperation({ summary: 'Agregar dirección a un cliente (auto-deduplica)' })
	addDireccion(@Param("telefono") telefono: string, @Body('direccion') direccion: string) {
		return this.service.addDireccion(telefono, direccion);
	}

	@Delete("direcciones/:id")
	@ApiOperation({ summary: 'Eliminar una dirección' })
	removeDireccion(@Param("id") id: number) {
		return this.service.removeDireccion(id);
	}
}
