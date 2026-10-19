import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {DataSource, EntityManager} from 'typeorm';
import {InventarioEstadoService} from './inventario-estado.service';
import {
	ActualizarItemDto,
	CrearItemDto,
	GuardarReglaDto,
	ListarMovimientosDto,
	RegistrarMovimientoDto,
} from './esquemas/inventario.dto';
import {
	calcularMovimiento,
	categoriaBebidaPorNombre,
	categoriaCajaDeVariante,
	categoriaCajaPorNombre,
	estadoStock,
	type TipoItemInventario,
} from './inventario.util';

interface FilaItem {
	id: number;
	tipo: TipoItemInventario;
	nombre: string;
	categoria: string | null;
	cantidad: number;
	alertaMinimo: number | null;
	nivelObjetivo: number | null;
	activo: boolean;
	reglas: number;
	reglasAuto: number;
	actualizadoEn: Date;
}

export interface FilaMovimiento {
	id: number;
	itemId: number;
	itemNombre: string;
	itemTipo: TipoItemInventario;
	tipo: string;
	delta: number;
	aplicado: number;
	cantidadResultante: number;
	ordenId: number | null;
	nota: string | null;
	creadoEn: Date;
	usuarioNombre: string | null;
}

export interface FilaRegla {
	id: number;
	itemId: number;
	itemNombre: string;
	itemTipo: TipoItemInventario;
	varianteId: number;
	varianteNombre: string;
	productoNombre: string;
	cantidad: number;
	soloParaLlevar: boolean;
	origen: 'auto' | 'manual';
}

const SELECT_ITEM = `
	SELECT i.id, i.tipo, i.nombre, i.categoria, i.cantidad, i.alerta_minimo AS "alertaMinimo",
	       i.nivel_objetivo AS "nivelObjetivo", i.activo, i.actualizado_en AS "actualizadoEn",
	       (SELECT COUNT(*)::int FROM inventario_consumos c WHERE c.item_id = i.id) AS reglas,
	       (SELECT COUNT(*)::int FROM inventario_consumos c WHERE c.item_id = i.id AND c.origen = 'auto') AS "reglasAuto"
	FROM inventario_items i`;

@Injectable()
export class InventarioService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly estado: InventarioEstadoService,
	) {}

	private conEstado(i: FilaItem) {
		return {...i, cantidad: Number(i.cantidad), estado: estadoStock(Number(i.cantidad), i.alertaMinimo)};
	}

	async estadoMigracion() {
		const corte = await this.estado.fechaCorte();
		return {listo: !!corte, fechaCorte: corte};
	}

	// ─── Ítems ──────────────────────────────────────────────────────────────────

	async listarItems(opciones: {tipo?: TipoItemInventario; incluirInactivos?: boolean} = {}) {
		await this.estado.asegurarListo();
		const filas: FilaItem[] = await this.dataSource.query(
			`${SELECT_ITEM}
			 WHERE ($1::text IS NULL OR i.tipo = $1) AND (i.activo OR $2::boolean)
			 ORDER BY i.tipo, i.categoria NULLS LAST, i.nombre`,
			[opciones.tipo ?? null, opciones.incluirInactivos ?? false],
		);
		return filas.map((f) => this.conEstado(f));
	}

	private async item(manager: EntityManager, id: number) {
		const [fila]: FilaItem[] = await manager.query(`${SELECT_ITEM} WHERE i.id = $1`, [id]);
		if (!fila) throw new NotFoundException('Ítem de inventario no encontrado');
		return this.conEstado(fila);
	}

	async crearItem(dto: CrearItemDto, usuarioId?: string | null) {
		await this.estado.asegurarListo();
		return this.dataSource.transaction(async (m) => {
			if (dto.varianteId != null && dto.tipo !== 'bebida') {
				throw new BadRequestException('Solo las bebidas se vinculan a una variante al crearlas');
			}
			const categoria =
				dto.categoria ??
				(dto.tipo === 'caja'
					? categoriaCajaPorNombre(dto.nombre)
					: (() => {
							const c = categoriaBebidaPorNombre(dto.nombre);
							return c && c !== 'jugo' ? c : 'otra';
						})());

			const [{id}]: {id: number}[] = await m.query(
				`INSERT INTO inventario_items (tipo, nombre, categoria, cantidad, alerta_minimo, nivel_objetivo)
				 VALUES ($1, $2, $3, 0, $4, $5) RETURNING id`,
				[dto.tipo, dto.nombre.trim(), categoria, dto.alertaMinimo ?? null, dto.nivelObjetivo ?? null],
			);

			if (dto.cantidad && dto.cantidad > 0) {
				await this.moverEn(m, id, {tipo: 'entrada', cantidad: dto.cantidad, nota: 'Stock inicial'}, usuarioId);
			}
			if (dto.varianteId != null) {
				await this.guardarReglaEn(m, {
					itemId: id,
					varianteId: dto.varianteId,
					cantidad: 1,
					soloParaLlevar: false,
				});
			}
			return this.item(m, id);
		});
	}

	async actualizarItem(id: number, dto: ActualizarItemDto) {
		await this.estado.asegurarListo();
		const campos: string[] = [];
		const valores: unknown[] = [id];
		const poner = (columna: string, valor: unknown) => {
			valores.push(valor);
			campos.push(`${columna} = $${valores.length}`);
		};
		if (dto.nombre !== undefined) poner('nombre', dto.nombre.trim());
		if (dto.categoria !== undefined) poner('categoria', dto.categoria);
		if (dto.alertaMinimo !== undefined) poner('alerta_minimo', dto.alertaMinimo);
		if (dto.nivelObjetivo !== undefined) poner('nivel_objetivo', dto.nivelObjetivo);
		if (dto.activo !== undefined) poner('activo', dto.activo);

		if (campos.length) {
			const r: unknown[] = await this.dataSource.query(
				`UPDATE inventario_items SET ${campos.join(', ')}, actualizado_en = now() WHERE id = $1 RETURNING id`,
				valores,
			);
			if (!r.length) throw new NotFoundException('Ítem de inventario no encontrado');
		}
		return this.item(this.dataSource.manager, id);
	}

	// ─── Movimientos manuales ───────────────────────────────────────────────────

	async registrarMovimiento(id: number, dto: RegistrarMovimientoDto, usuarioId?: string | null) {
		await this.estado.asegurarListo();
		if ((dto.tipo === 'entrada' || dto.tipo === 'salida') && dto.cantidad <= 0) {
			throw new BadRequestException('La cantidad debe ser mayor que 0');
		}
		if (dto.tipo === 'conteo' && dto.cantidad < 0) throw new BadRequestException('El conteo no puede ser negativo');
		if (dto.tipo === 'ajuste' && dto.cantidad === 0) throw new BadRequestException('El ajuste no puede ser 0');

		return this.dataSource.transaction(async (m) => {
			await this.moverEn(m, id, dto, usuarioId);
			return this.item(m, id);
		});
	}

	private async moverEn(m: EntityManager, id: number, dto: RegistrarMovimientoDto, usuarioId?: string | null) {
		const [fila]: {cantidad: number}[] = await m.query(
			'SELECT cantidad FROM inventario_items WHERE id = $1 FOR UPDATE',
			[id],
		);
		if (!fila) throw new NotFoundException('Ítem de inventario no encontrado');
		const {delta, aplicado, resultante} = calcularMovimiento(Number(fila.cantidad), dto.tipo, dto.cantidad);
		if (delta === 0) return; // conteo igual a lo registrado: nada que anotar

		await m.query('UPDATE inventario_items SET cantidad = $2, actualizado_en = now() WHERE id = $1', [
			id,
			resultante,
		]);
		await m.query(
			`INSERT INTO inventario_movimientos (item_id, tipo, delta, aplicado, cantidad_resultante, usuario_id, nota)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[id, dto.tipo, delta, aplicado, resultante, usuarioId ?? null, dto.nota?.trim() || null],
		);
	}

	async listarMovimientos(dto: ListarMovimientosDto) {
		await this.estado.asegurarListo();
		const limit = dto.limit ?? 30;
		const offset = dto.offset ?? 0;
		const params = [dto.itemId ?? null, dto.tipoItem ?? null];
		const where = `WHERE ($1::int IS NULL OR mv.item_id = $1) AND ($2::text IS NULL OR i.tipo = $2)`;

		const [{total}]: {total: number}[] = await this.dataSource.query(
			`SELECT COUNT(*)::int AS total FROM inventario_movimientos mv JOIN inventario_items i ON i.id = mv.item_id ${where}`,
			params,
		);
		const filas: FilaMovimiento[] = await this.dataSource.query(
			`SELECT mv.id, mv.item_id AS "itemId", i.nombre AS "itemNombre", i.tipo AS "itemTipo",
			        mv.tipo, mv.delta, mv.aplicado, mv.cantidad_resultante AS "cantidadResultante",
			        mv.orden_id AS "ordenId", mv.nota, mv.creado_en AS "creadoEn",
			        COALESCE(NULLIF(u.name, ''), u.username) AS "usuarioNombre"
			 FROM inventario_movimientos mv
			 JOIN inventario_items i ON i.id = mv.item_id
			 LEFT JOIN users u ON u.id::text = mv.usuario_id
			 ${where}
			 ORDER BY mv.creado_en DESC, mv.id DESC
			 LIMIT $3 OFFSET $4`,
			[...params, limit, offset],
		);
		return {total, limit, offset, filas};
	}

	// ─── Reglas de consumo ──────────────────────────────────────────────────────

	async listarReglas(filtro: {itemId?: number; varianteId?: number} = {}): Promise<FilaRegla[]> {
		await this.estado.asegurarListo();
		const filas: FilaRegla[] = await this.dataSource.query(
			`SELECT c.id, c.item_id AS "itemId", i.nombre AS "itemNombre", i.tipo AS "itemTipo",
			        c.variante_id AS "varianteId", v.nombre AS "varianteNombre", p.producto_nombre AS "productoNombre",
			        c.cantidad, c.solo_para_llevar AS "soloParaLlevar", c.origen
			 FROM inventario_consumos c
			 JOIN inventario_items i ON i.id = c.item_id
			 JOIN producto_variantes v ON v.variante_id = c.variante_id
			 JOIN productos p ON p.producto_id = v.producto_id
			 WHERE ($1::int IS NULL OR c.item_id = $1) AND ($2::int IS NULL OR c.variante_id = $2)
			 ORDER BY i.tipo, i.nombre, p.producto_nombre, v.nombre`,
			[filtro.itemId ?? null, filtro.varianteId ?? null],
		);
		return filas;
	}

	async guardarRegla(dto: GuardarReglaDto) {
		await this.estado.asegurarListo();
		return this.dataSource.transaction((m) => this.guardarReglaEn(m, dto));
	}

	private async guardarReglaEn(m: EntityManager, dto: GuardarReglaDto) {
		const [item]: {tipo: TipoItemInventario}[] = await m.query('SELECT tipo FROM inventario_items WHERE id = $1', [
			dto.itemId,
		]);
		if (!item) throw new NotFoundException('Ítem de inventario no encontrado');
		const [variante]: unknown[] = await m.query('SELECT 1 FROM producto_variantes WHERE variante_id = $1', [
			dto.varianteId,
		]);
		if (!variante) throw new NotFoundException('Variante no encontrada');

		const [regla]: {id: number}[] = await m.query(
			`INSERT INTO inventario_consumos (item_id, variante_id, cantidad, solo_para_llevar, origen)
			 VALUES ($1, $2, $3, $4, 'manual')
			 ON CONFLICT (variante_id, item_id)
			 DO UPDATE SET cantidad = EXCLUDED.cantidad, solo_para_llevar = EXCLUDED.solo_para_llevar, origen = 'manual'
			 RETURNING id`,
			[dto.itemId, dto.varianteId, dto.cantidad ?? 1, dto.soloParaLlevar ?? item.tipo === 'caja'],
		);
		return {id: regla.id};
	}

	async eliminarRegla(id: number) {
		await this.estado.asegurarListo();
		const r: unknown[] = await this.dataSource.query('DELETE FROM inventario_consumos WHERE id = $1 RETURNING id', [
			id,
		]);
		if (!r.length) throw new NotFoundException('Regla no encontrada');
		return {ok: true};
	}

	/**
	 * Pizzas y calzones que no gastan ninguna caja (p. ej. un tamaño creado después de la
	 * migración), con la caja que les correspondería según su categoría.
	 */
	async sugerencias() {
		await this.estado.asegurarListo();
		const variantes: {
			varianteId: number;
			varianteNombre: string;
			productoNombre: string;
			categoria: string | null;
		}[] = await this.dataSource.query(
			`SELECT v.variante_id AS "varianteId", v.nombre AS "varianteNombre",
				        p.producto_nombre AS "productoNombre", p.categoria
				 FROM producto_variantes v
				 JOIN productos p ON p.producto_id = v.producto_id
				 WHERE v.activo AND p.activo IS NOT FALSE
				   AND NOT EXISTS (
				     SELECT 1 FROM inventario_consumos c JOIN inventario_items i ON i.id = c.item_id
				     WHERE c.variante_id = v.variante_id AND i.tipo = 'caja')
				 ORDER BY p.producto_nombre, v.nombre`,
		);
		const cajas: {id: number; nombre: string; categoria: string | null}[] = await this.dataSource.query(
			`SELECT id, nombre, categoria FROM inventario_items WHERE tipo = 'caja' AND activo ORDER BY id`,
		);

		return variantes.flatMap((v) => {
			const categoriaCaja = categoriaCajaDeVariante(v.categoria, v.productoNombre, v.varianteNombre);
			if (!categoriaCaja) return [];
			const caja = cajas.find((c) => c.categoria === categoriaCaja) ?? null;
			return [
				{
					varianteId: v.varianteId,
					varianteNombre: v.varianteNombre,
					productoNombre: v.productoNombre,
					categoriaCaja,
					cajaSugerida: caja ? {id: caja.id, nombre: caja.nombre} : null,
				},
			];
		});
	}
}
