import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In } from 'typeorm';
import { Ingrediente } from './esquemas/ingrediente.entity';
import { VarianteIngrediente } from './esquemas/variante-ingrediente.entity';
import { BebidaMovimiento } from './esquemas/bebida-movimiento.entity';
import { ProductoVariantes } from '../productos/esquemas/producto-variantes.entity';
import { CreateIngredienteDto, UpdateIngredienteDto, AjustarStockDto, VincularVarianteDto } from './esquemas/ingrediente.dto';

@Injectable()
export class InventarioBebidasService {
    constructor(
        @InjectRepository(Ingrediente)
        private readonly repo: Repository<Ingrediente>,
        @InjectRepository(VarianteIngrediente)
        private readonly viRepo: Repository<VarianteIngrediente>,
        @InjectRepository(BebidaMovimiento)
        private readonly mvRepo: Repository<BebidaMovimiento>,
        @InjectRepository(ProductoVariantes)
        private readonly varRepo: Repository<ProductoVariantes>,
    ) {}

    // ─── CRUD Ingredientes ──────────────────────────────────────────────────────

    async findAll() {
        const items = await this.repo.find({
            order: { categoria: 'ASC', nombre: 'ASC' },
            relations: ['variantes'],
        });
        return items.map((i) => this.withDerived(i));
    }

    async findOne(id: number) {
        const item = await this.repo.findOne({ where: { id }, relations: ['variantes'] });
        if (!item) throw new NotFoundException('Ingrediente no encontrado');
        return this.withDerived(item);
    }

    async create(dto: CreateIngredienteDto) {
        const item = this.repo.create({
            nombre: dto.nombre,
            categoria: (dto.categoria as any) ?? 'otro',
            unidad: dto.unidad ?? 'unidad',
            stockActual: dto.stockActual ?? 0,
            rendimientoPorUnidad: dto.rendimientoPorUnidad ?? 1,
            alertaMinimo: dto.alertaMinimo ?? null,
            costo: dto.costo ?? null,
            activo: dto.activo ?? true,
        });
        const saved = await this.repo.save(item);
        return this.withDerived(saved);
    }

    async update(id: number, dto: UpdateIngredienteDto) {
        const item = await this.repo.findOne({ where: { id } });
        if (!item) throw new NotFoundException('Ingrediente no encontrado');
        Object.assign(item, {
            ...(dto.nombre !== undefined && { nombre: dto.nombre }),
            ...(dto.categoria !== undefined && { categoria: dto.categoria }),
            ...(dto.unidad !== undefined && { unidad: dto.unidad }),
            ...(dto.rendimientoPorUnidad !== undefined && { rendimientoPorUnidad: dto.rendimientoPorUnidad }),
            ...(dto.alertaMinimo !== undefined && { alertaMinimo: dto.alertaMinimo }),
            ...(dto.costo !== undefined && { costo: dto.costo }),
            ...(dto.activo !== undefined && { activo: dto.activo }),
        });
        const saved = await this.repo.save(item);
        return this.withDerived(saved);
    }

    async remove(id: number) {
        const item = await this.repo.findOne({ where: { id } });
        if (!item) throw new NotFoundException('Ingrediente no encontrado');
        await this.repo.remove(item);
        return { ok: true };
    }

    // ─── Stock adjustment ───────────────────────────────────────────────────────

    async ajustar(id: number, dto: AjustarStockDto) {
        const item = await this.repo.findOne({ where: { id } });
        if (!item) throw new NotFoundException('Ingrediente no encontrado');
        const nuevoStock = Number(item.stockActual) + dto.delta;
        if (nuevoStock < 0) {
            throw new BadRequestException(
                `Stock insuficiente. Disponible: ${item.stockActual} ${item.unidad}, requerido: ${Math.abs(dto.delta)}`,
            );
        }
        item.stockActual = nuevoStock;
        const saved = await this.repo.save(item);
        return this.withDerived(saved);
    }

    // ─── Variant ↔ Ingredient links ─────────────────────────────────────────────

    async getVinculos() {
        return this.viRepo.find({ relations: ['ingrediente'] });
    }

    async vincular(dto: VincularVarianteDto) {
        // Upsert: one variant → one ingredient (remove existing link for same varianteId first)
        await this.viRepo.delete({ varianteId: dto.varianteId });
        const vi = this.viRepo.create({
            varianteId: dto.varianteId,
            ingredienteId: dto.ingredienteId,
            cantidadPorVenta: dto.cantidadPorVenta,
        });
        return this.viRepo.save(vi);
    }

    async desvincular(varianteId: number) {
        await this.viRepo.delete({ varianteId });
        return { ok: true };
    }

    // ─── Auto-deduct on order completion ────────────────────────────────────────

    /**
     * Called after an order is marked as completed.
     * For each order item that has a linked ingredient, deducts the
     * corresponding raw units from stockActual (non-blocking, best-effort).
     */
    async deductForOrden(
        items: Array<{ varianteId: number | null; cantidad: number }>,
        manager?: EntityManager,
    ) {
        if (!items.length) return;

        const varianteIds = items
            .map((i) => i.varianteId)
            .filter((v): v is number => v !== null);

        if (!varianteIds.length) return;

        const links = await this.viRepo.find({
            where: { varianteId: In(varianteIds) },
            relations: ['ingrediente'],
        });

        if (!links.length) return;

        // Accumulate total deduction per ingrediente
        const deductions = new Map<number, number>();
        for (const link of links) {
            const orderItem = items.find((i) => i.varianteId === link.varianteId);
            if (!orderItem) continue;
            const consume = link.cantidadPorVenta * orderItem.cantidad;
            deductions.set(link.ingredienteId, (deductions.get(link.ingredienteId) ?? 0) + consume);
        }

        // Apply deductions — clamp to 0 (don't throw if stock goes negative; log instead)
        const ingredientes = await this.repo.findBy({ id: In([...deductions.keys()]) });
        for (const ing of ingredientes) {
            const consume = deductions.get(ing.id) ?? 0;
            const prev = Number(ing.stockActual);
            ing.stockActual = Math.max(0, prev - consume);
        }

        const repo = manager ? manager.getRepository(Ingrediente) : this.repo;
        await repo.save(ingredientes);
    }

    // ─── Stock por variante (gaseosas/jugos) — espejo de inventario de cajas ──────

    /** Una variante es "bebida" si su producto se llama gaseosa o jugo (igual que la pantalla). */
    private esBebida(productoNombre?: string): boolean {
        return /gaseosa|jugo/i.test(productoNombre || '');
    }

    /**
     * Descuenta stock_bebida por variante al CREAR la orden.
     * Registra SIEMPRE el movimiento (delta = -qty) aunque no haya stock → "-1 en historial".
     * `aplicado` = lo realmente descontado tras el clamp a 0 (permite restaurar sin fantasma).
     * Best-effort; pensado para llamarse fire-and-forget desde ordenes.service.
     */
    async descontarBebidasParaOrden(
        items: Array<{ varianteId: number | null; productoNombre?: string; cantidad: number }>,
        ordenId: number,
    ) {
        const drinkItems = items.filter(
            (i) => i.varianteId != null && this.esBebida(i.productoNombre) && (Number(i.cantidad) || 0) > 0,
        );
        if (!drinkItems.length) return;

        // Agrupar por variante (una orden puede repetir la misma variante)
        const byVariante = new Map<number, number>();
        for (const it of drinkItems) {
            byVariante.set(it.varianteId!, (byVariante.get(it.varianteId!) ?? 0) + (Number(it.cantidad) || 0));
        }

        for (const [varianteId, qty] of byVariante) {
            await this.varRepo.manager.transaction(async (m) => {
                const vRepo = m.getRepository(ProductoVariantes);
                const mvRepo = m.getRepository(BebidaMovimiento);
                const variante = await vRepo.findOne({ where: { varianteId } });
                if (!variante) return;
                const anterior = Number(variante.stockBebida ?? 0);
                const nueva = Math.max(0, anterior - qty);
                const aplicado = anterior - nueva; // ≥0: lo realmente descontado
                await mvRepo.save(mvRepo.create({
                    varianteId,
                    delta: -qty,
                    aplicado: -aplicado,
                    cantidadResultante: nueva,
                    tipo: 'salida',
                    nota: `Orden #${ordenId}`,
                }));
                variante.stockBebida = nueva;
                await vRepo.save(variante);
            });
        }
    }

    /**
     * Restaura stock al CANCELAR la orden. Idempotente: deriva de los movimientos de salida
     * de esa orden y devuelve solo lo `aplicado` (no el delta), evitando stock fantasma.
     * Si ya existe una cancelación registrada para la orden, no hace nada.
     */
    async restaurarBebidasParaOrden(ordenId: number) {
        const salidas = await this.mvRepo.find({ where: { nota: `Orden #${ordenId}`, tipo: 'salida' } });
        if (!salidas.length) return;

        const yaCancelado = await this.mvRepo.count({ where: { nota: `Cancelación #${ordenId}`, tipo: 'entrada' } });
        if (yaCancelado > 0) return;

        for (const mov of salidas) {
            const devolver = Math.abs(Number(mov.aplicado) || 0); // lo realmente descontado
            if (devolver <= 0) continue;
            await this.varRepo.manager.transaction(async (m) => {
                const vRepo = m.getRepository(ProductoVariantes);
                const mvRepo = m.getRepository(BebidaMovimiento);
                const variante = await vRepo.findOne({ where: { varianteId: mov.varianteId } });
                if (!variante) return;
                const nueva = Number(variante.stockBebida ?? 0) + devolver;
                await mvRepo.save(mvRepo.create({
                    varianteId: mov.varianteId,
                    delta: devolver,
                    aplicado: devolver,
                    cantidadResultante: nueva,
                    tipo: 'entrada',
                    nota: `Cancelación #${ordenId}`,
                }));
                variante.stockBebida = nueva;
                await vRepo.save(variante);
            });
        }
    }

    /** Historial de movimientos de bebidas, con nombre de variante y producto resueltos. */
    async getMovimientosBebidas(limit = 20) {
        const movimientos = await this.mvRepo.find({ order: { creadoEn: 'DESC' }, take: limit });
        if (!movimientos.length) return [];
        const ids = [...new Set(movimientos.map((m) => m.varianteId))];
        const variantes = await this.varRepo.find({ where: { varianteId: In(ids) }, relations: ['producto'] });
        const byId = new Map(variantes.map((v) => [v.varianteId, v]));
        return movimientos.map((m) => {
            const v = byId.get(m.varianteId);
            return {
                id: m.id,
                varianteId: m.varianteId,
                varianteNombre: v?.nombre ?? 'Variante',
                productoNombre: v?.producto?.productoNombre ?? '',
                delta: m.delta,
                aplicado: m.aplicado,
                cantidadResultante: m.cantidadResultante,
                tipo: m.tipo,
                nota: m.nota,
                creadoEn: m.creadoEn,
            };
        });
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private withDerived(i: Ingrediente) {
        const stock = Number(i.stockActual);
        const rendimiento = Number(i.rendimientoPorUnidad) || 1;
        const alerta = i.alertaMinimo !== null ? Number(i.alertaMinimo) : null;
        return {
            ...i,
            stockActual: stock,
            rendimientoPorUnidad: rendimiento,
            porcionesDisponibles: Math.floor(stock * rendimiento),
            enAlerta: alerta !== null ? stock <= alerta : false,
        };
    }
}
