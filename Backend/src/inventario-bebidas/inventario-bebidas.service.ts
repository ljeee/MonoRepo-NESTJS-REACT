import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In } from 'typeorm';
import { Ingrediente } from './esquemas/ingrediente.entity';
import { VarianteIngrediente } from './esquemas/variante-ingrediente.entity';
import { CreateIngredienteDto, UpdateIngredienteDto, AjustarStockDto, VincularVarianteDto } from './esquemas/ingrediente.dto';

@Injectable()
export class InventarioBebidasService {
    constructor(
        @InjectRepository(Ingrediente)
        private readonly repo: Repository<Ingrediente>,
        @InjectRepository(VarianteIngrediente)
        private readonly viRepo: Repository<VarianteIngrediente>,
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
